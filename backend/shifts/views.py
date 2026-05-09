from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from api.models import Shift  # Import from api.models instead
from .serializers import (
    ShiftSerializer,
    ShiftDetailSerializer,
    FrontendShiftSerializer,
    FrontendShiftDetailSerializer,
    MultiStaffShiftSerializer
)
from .filters import ShiftFilter
from django.db.models import Q
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class ShiftViewSet(viewsets.ModelViewSet):
    """
    ViewSet for viewing and editing Shifts with snake_case fields.
    """
    queryset = Shift.objects.all().order_by('-start_time')
    serializer_class = ShiftSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_class = ShiftFilter
    ordering_fields = ['start_time', 'end_time', 'status', 'created_at', 'updated_at']
    search_fields = ['venue__name', 'staff_user__first_name', 'staff_user__last_name']
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Filter shifts to only show the current user's shifts unless they're a manager/admin

        SECURITY: Admin/manager users see all shifts from their company ONLY, not the entire database.
        Uses middleware-provided company context (respects X-Company-ID header) for multi-tenant isolation.
        """
        user_role = getattr(self.request.user, 'role', 'staff')

        if user_role in ['manager', 'admin']:
            # SECURITY FIX: Use middleware-provided company context (respects X-Company-ID header)
            company = getattr(self.request, 'current_company', None)
            if company:
                return Shift.objects.filter(venue__company=company).order_by('-start_time')

            # Fallback: Get user's primary company membership (most recently joined with manager+ role)
            from api.models import UserCompanyMembership
            membership = UserCompanyMembership.objects.filter(
                user=self.request.user,
                is_active=True,
                company__is_active=True
            ).select_related('company').order_by('-joined_at').first()

            if membership and membership.company:
                # Return all shifts for venues in the user's company
                return Shift.objects.filter(venue__company=membership.company).order_by('-start_time')
            else:
                # No company membership - return only user's own shifts as fallback
                return Shift.objects.filter(staff_user=self.request.user).order_by('-start_time')
        else:
            # Regular staff can only see their own published shifts. Drafts
            # (is_published=False) belong to the manager's scheduling workflow
            # and must stay invisible until "Publish week" is clicked.
            return Shift.objects.filter(
                staff_user=self.request.user,
                is_published=True,
            ).order_by('-start_time')

    def get_serializer_class(self):
        # Use the camelCase serializer for the frontend
        if self.request.query_params.get('format') == 'camel':
            return FrontendShiftSerializer
        if self.action == 'retrieve':
            return ShiftDetailSerializer
        return ShiftSerializer

    def perform_create(self, serializer):
        # Check if this is a copy operation that should allow past dates
        allow_past_dates = self.request.data.get('allow_past_dates', False)
        serializer.context['allow_past_dates'] = allow_past_dates
        shift = serializer.save()
        self._send_shift_assignment_email(shift)

    def _send_shift_assignment_email(self, shift):
        """Send email notification for a newly assigned shift."""
        try:
            from api.services.email_notification_service import EmailNotificationService
            if not shift.staff_user:
                return
            email_service = EmailNotificationService()
            venue_name = shift.venue.name if shift.venue else 'TBD'
            venue_address = shift.venue.address if shift.venue else None
            email_service.send_shift_assignment_email(
                user_id=shift.staff_user.id,
                shift_id=shift.id,
                venue_name=venue_name,
                venue_address=venue_address,
                start_time=shift.start_time.strftime('%H:%M'),
                end_time=shift.end_time.strftime('%H:%M'),
                formatted_date=shift.start_time.strftime('%A, %d %B %Y'),
                hourly_rate=str(shift.hourly_rate) if shift.hourly_rate else None,
            )
        except Exception as e:
            logger.warning(f"Failed to send shift assignment email for shift {shift.id}: {e}")

    def perform_update(self, serializer):
        shift = self.get_object()
        if shift.status == 'in_progress' and self.request.user.role != 'admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Cannot edit an in-progress shift. Use time adjustments instead.")
        serializer.save()

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get upcoming shifts in the next 7 days"""
        now = datetime.now()
        end_date = now + timedelta(days=7)
        # SECURITY FIX: Use get_queryset() for company-scoped filtering
        shifts = self.get_queryset().filter(
            start_time__gte=now,
            start_time__lte=end_date,
            status='scheduled'
        )
        
        # Apply any additional filters from the filter backend
        shifts = self.filter_queryset(shifts)
        
        serializer = self.get_serializer(shifts, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def my_shifts(self, request):
        """Get shifts for the current user with pagination support.

        This endpoint always returns only the authenticated user's shifts,
        regardless of their role (staff, manager, or admin). This is the
        correct endpoint for mobile apps where users should only see their
        own shifts for check-in/check-out purposes.
        """
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Route through get_queryset() so role-based filters apply (notably:
        # staff never see unpublished/draft shifts).
        shifts = self.get_queryset().filter(staff_user=request.user)

        # Apply any additional filters from the filter backend
        shifts = self.filter_queryset(shifts)

        # Use pagination if available
        page = self.paginate_queryset(shifts)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(shifts, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='manager/all')
    def manager_all(self, request):
        """Get all shifts for manager/admin view with venue check summaries"""
        from django.db.models import Count, Q
        from api.models import FireExitCheck, CapacityCheck, ToiletCheck
        
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication required"}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
            
        # Check if user has manager or admin permissions
        if not (request.user.role in ['manager', 'admin'] or request.user.is_staff):
            return Response(
                {"detail": "Manager or admin permissions required"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # SECURITY FIX: Use get_queryset() for company-scoped filtering
        shifts = self.get_queryset().select_related('venue', 'staff_user').prefetch_related(
            'fireexitcheck_set', 'capacitycheck_set', 'toiletcheck_set'
        )
        
        # Apply any filters
        shifts = self.filter_queryset(shifts)
        
        # Prepare response data with venue check summaries
        shift_data = []
        for shift in shifts:
            # Count venue checks
            fire_checks = shift.fireexitcheck_set.count()
            capacity_checks = shift.capacitycheck_set.count()
            toilet_checks = shift.toiletcheck_set.count()
            
            # Count critical issues (failed fire exits, at-capacity situations, poor toilet conditions)
            critical_issues = 0
            critical_issues += shift.fireexitcheck_set.filter(is_clear=False).count()
            critical_issues += shift.capacitycheck_set.filter(is_at_capacity=True).count()
            critical_issues += shift.toiletcheck_set.filter(condition__in=['poor', 'critical']).count()
            
            # Calculate duration in hours
            duration_hours = None
            if shift.check_in_time and shift.check_out_time:
                duration = shift.check_out_time - shift.check_in_time
                duration_hours = round(duration.total_seconds() / 3600, 2)
            
            shift_info = {
                'id': shift.id,
                'staff_details': {
                    'id': shift.staff_user.id if shift.staff_user else None,
                    'first_name': shift.staff_user.first_name if shift.staff_user else 'Unassigned',
                    'last_name': shift.staff_user.last_name if shift.staff_user else '',
                    'email': shift.staff_user.email if shift.staff_user else ''
                } if shift.staff_user else None,
                'venue_details': {
                    'id': shift.venue.id,
                    'name': shift.venue.name,
                    'requires_fire_safety_checks': shift.venue.requires_fire_safety_checks,
                    'requires_capacity_monitoring': shift.venue.requires_capacity_monitoring,
                    'requires_toilet_checks': shift.venue.requires_toilet_checks,
                    'capacity': getattr(shift.venue, 'capacity', None)
                } if shift.venue else None,
                'start_time': shift.start_time,
                'end_time': shift.end_time,
                'check_in_time': shift.check_in_time,
                'check_out_time': shift.check_out_time,
                'duration_hours': duration_hours,
                'status': shift.status,
                'manager_approved': shift.manager_approved,
                'venue_checks_summary': {
                    'fireExitChecks': fire_checks,
                    'capacityChecks': capacity_checks,
                    'toiletChecks': toilet_checks,
                    'totalChecks': fire_checks + capacity_checks + toilet_checks,
                    'criticalIssues': critical_issues
                }
            }
            shift_data.append(shift_info)

        # Server-side pagination
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 25))
        total = len(shift_data)
        start = (page - 1) * page_size
        end = start + page_size

        return Response({
            'count': total,
            'total_pages': (total + page_size - 1) // page_size,
            'current_page': page,
            'page_size': page_size,
            'results': shift_data[start:end],
        })

    @action(detail=False, methods=['get'], url_path='reports/compliance')
    def compliance_reports(self, request):
        """Get venue compliance reports for admin view"""
        from django.db.models import Count, Q
        from api.models import Venue
        
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication required"}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
            
        # Check if user has admin permissions
        if not (request.user.role == 'admin' or request.user.is_staff):
            return Response(
                {"detail": "Admin permissions required"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get date filters
        start_date = request.query_params.get('startDate')
        end_date = request.query_params.get('endDate')
        venue_id = request.query_params.get('venueId')

        # SECURITY FIX: Scope venues to user's current company
        company = getattr(request, 'current_company', None)
        if company:
            venues_queryset = Venue.objects.filter(company=company)
        else:
            # Fallback: no company context - return empty result
            return Response([])

        if venue_id:
            venues_queryset = venues_queryset.filter(id=venue_id)

        # SECURITY FIX: Use get_queryset() for company-scoped shift filtering
        base_shifts = self.get_queryset()
        compliance_data = []

        for venue in venues_queryset:
            # Get shifts for this venue within date range
            shifts_queryset = base_shifts.filter(venue=venue)
            
            if start_date:
                shifts_queryset = shifts_queryset.filter(start_time__date__gte=start_date)
            if end_date:
                shifts_queryset = shifts_queryset.filter(start_time__date__lte=end_date)
            
            total_shifts = shifts_queryset.count()
            
            if total_shifts == 0:
                continue
                
            # Count shifts with at least one venue check
            shifts_with_checks = shifts_queryset.filter(
                Q(fireexitcheck__isnull=False) | 
                Q(capacitycheck__isnull=False) | 
                Q(toiletcheck__isnull=False)
            ).distinct().count()
            
            # Count critical issues
            critical_issues = 0
            for shift in shifts_queryset:
                critical_issues += shift.fireexitcheck_set.filter(is_clear=False).count()
                critical_issues += shift.capacitycheck_set.filter(is_at_capacity=True).count()
                critical_issues += shift.toiletcheck_set.filter(condition__in=['poor', 'critical']).count()
            
            # Find last incident (shift with critical issues)
            last_incident = None
            last_incident_shift = shifts_queryset.filter(
                Q(fireexitcheck__is_clear=False) |
                Q(capacitycheck__is_at_capacity=True) |
                Q(toiletcheck__condition__in=['poor', 'critical'])
            ).order_by('-start_time').first()
            
            if last_incident_shift:
                last_incident = last_incident_shift.start_time.date().isoformat()
            
            compliance_rate = (shifts_with_checks / total_shifts * 100) if total_shifts > 0 else 0
            
            compliance_data.append({
                'venueId': venue.id,
                'venueName': venue.name,
                'totalShifts': total_shifts,
                'shiftsWithChecks': shifts_with_checks,
                'complianceRate': round(compliance_rate, 1),
                'criticalIssues': critical_issues,
                'lastIncident': last_incident
            })
        
        return Response(compliance_data)

    @action(detail=False, methods=['get'], url_path='reports/safety')
    def safety_reports(self, request):
        """Get venue safety reports for admin view"""
        from django.db.models import Count, Q
        from api.models import Venue

        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Check if user has admin permissions
        if not (request.user.role == 'admin' or request.user.is_staff):
            return Response(
                {"detail": "Admin permissions required"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get date filters
        start_date = request.query_params.get('startDate')
        end_date = request.query_params.get('endDate')
        venue_id = request.query_params.get('venueId')

        # SECURITY FIX: Scope venues to user's current company
        company = getattr(request, 'current_company', None)
        if company:
            venues_queryset = Venue.objects.filter(company=company)
        else:
            # Fallback: no company context - return empty result
            return Response([])

        if venue_id:
            venues_queryset = venues_queryset.filter(id=venue_id)

        # SECURITY FIX: Use get_queryset() for company-scoped shift filtering
        base_shifts = self.get_queryset()
        safety_data = []

        for venue in venues_queryset:
            # Get shifts for this venue within date range
            shifts_queryset = base_shifts.filter(venue=venue)
            
            if start_date:
                shifts_queryset = shifts_queryset.filter(start_time__date__gte=start_date)
            if end_date:
                shifts_queryset = shifts_queryset.filter(start_time__date__lte=end_date)
            
            if shifts_queryset.count() == 0:
                continue
            
            # Aggregate safety check data
            fire_checks = 0
            fire_failures = 0
            capacity_checks = 0
            capacity_breaches = 0
            toilet_checks = 0
            toilet_issues = 0
            
            for shift in shifts_queryset:
                # Fire exit checks
                fire_exit_checks = shift.fireexitcheck_set.all()
                fire_checks += fire_exit_checks.count()
                fire_failures += fire_exit_checks.filter(is_clear=False).count()
                
                # Capacity checks
                capacity_check_items = shift.capacitycheck_set.all()
                capacity_checks += capacity_check_items.count()
                capacity_breaches += capacity_check_items.filter(is_at_capacity=True).count()
                
                # Toilet checks
                toilet_check_items = shift.toiletcheck_set.all()
                toilet_checks += toilet_check_items.count()
                toilet_issues += toilet_check_items.filter(condition__in=['poor', 'critical']).count()
            
            # Calculate overall safety score (percentage of checks that passed)
            total_checks = fire_checks + capacity_checks + toilet_checks
            total_issues = fire_failures + capacity_breaches + toilet_issues
            
            if total_checks > 0:
                safety_score = ((total_checks - total_issues) / total_checks) * 100
            else:
                safety_score = 100  # No checks means no issues
            
            safety_data.append({
                'venueId': venue.id,
                'venueName': venue.name,
                'fireExitChecks': fire_checks,
                'fireExitFailures': fire_failures,
                'capacityChecks': capacity_checks,
                'capacityBreaches': capacity_breaches,
                'toiletChecks': toilet_checks,
                'toiletIssues': toilet_issues,
                'overallSafetyScore': round(safety_score, 1)
            })
        
        return Response(safety_data)

    @action(detail=False, methods=['get'], url_path='reports/performance')
    def performance_reports(self, request):
        """Get staff performance reports for admin view"""
        from django.db.models import Count, Q, Avg
        from django.contrib.auth import get_user_model

        User = get_user_model()

        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Check if user has admin permissions
        if not (request.user.role == 'admin' or request.user.is_staff):
            return Response(
                {"detail": "Admin permissions required"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get date filters
        start_date = request.query_params.get('startDate')
        end_date = request.query_params.get('endDate')
        venue_id = request.query_params.get('venueId')

        # SECURITY FIX: Scope staff users to the user's current company
        company = getattr(request, 'current_company', None)
        if not company:
            return Response([])

        # Get staff users who are members of this company and have worked shifts
        from api.models import UserCompanyMembership
        company_user_ids = UserCompanyMembership.objects.filter(
            company=company,
            is_active=True
        ).values_list('user_id', flat=True)

        staff_users = User.objects.filter(
            id__in=company_user_ids,
            shift__isnull=False
        ).distinct()

        # SECURITY FIX: Use get_queryset() for company-scoped shift filtering
        base_shifts = self.get_queryset()
        performance_data = []

        for staff_user in staff_users:
            # Get shifts for this staff member within date range
            shifts_queryset = base_shifts.filter(staff_user=staff_user)
            
            if start_date:
                shifts_queryset = shifts_queryset.filter(start_time__date__gte=start_date)
            if end_date:
                shifts_queryset = shifts_queryset.filter(start_time__date__lte=end_date)
            if venue_id:
                shifts_queryset = shifts_queryset.filter(venue_id=venue_id)
            
            total_shifts = shifts_queryset.count()
            
            if total_shifts == 0:
                continue
            
            # Count checks completed by this staff member
            checks_completed = 0
            critical_issues_found = 0
            total_response_time = 0
            response_time_count = 0
            
            for shift in shifts_queryset:
                # Count all checks
                fire_checks = shift.fireexitcheck_set.count()
                capacity_checks = shift.capacitycheck_set.count()
                toilet_checks = shift.toiletcheck_set.count()
                checks_completed += fire_checks + capacity_checks + toilet_checks
                
                # Count critical issues found
                critical_issues_found += shift.fireexitcheck_set.filter(is_clear=False).count()
                critical_issues_found += shift.capacitycheck_set.filter(is_at_capacity=True).count()
                critical_issues_found += shift.toiletcheck_set.filter(condition__in=['poor', 'critical']).count()
                
                # Calculate average response time (time between shift start and first check)
                if shift.check_in_time:
                    first_check = None
                    
                    # Find earliest check
                    first_fire_check = shift.fireexitcheck_set.order_by('timestamp').first()
                    first_capacity_check = shift.capacitycheck_set.order_by('timestamp').first()
                    first_toilet_check = shift.toiletcheck_set.order_by('timestamp').first()
                    
                    checks = [c for c in [first_fire_check, first_capacity_check, first_toilet_check] if c]
                    if checks:
                        first_check = min(checks, key=lambda x: x.timestamp)
                        response_time = (first_check.timestamp - shift.check_in_time).total_seconds() / 3600
                        total_response_time += response_time
                        response_time_count += 1
            
            # Calculate metrics
            avg_response_time = (total_response_time / response_time_count) if response_time_count > 0 else 0
            
            # Calculate completion rate (assume each shift should have at least 3 checks)
            expected_checks = total_shifts * 3  # Approximate expected checks per shift
            check_completion_rate = min((checks_completed / expected_checks * 100), 100) if expected_checks > 0 else 0
            
            # Calculate performance score (weighted average of completion rate and responsiveness)
            performance_score = (check_completion_rate * 0.7) + (min(100, (1 / (avg_response_time + 0.1)) * 10) * 0.3)
            
            performance_data.append({
                'staffId': staff_user.id,
                'staffName': f"{staff_user.first_name} {staff_user.last_name}",
                'totalShifts': total_shifts,
                'checksCompleted': checks_completed,
                'checkCompletionRate': round(check_completion_rate, 1),
                'criticalIssuesFound': critical_issues_found,
                'avgResponseTime': round(avg_response_time, 1),
                'performanceScore': round(performance_score, 1)
            })
        
        return Response(performance_data)

    @action(detail=False, methods=['get'], url_path='active')
    def active_shifts(self, request):
        """Get all currently active (in_progress) shifts regardless of whether end time has passed.

        Unlike incomplete_shifts, this returns ALL in_progress shifts - including those
        where the scheduled end time hasn't been reached yet. This allows admins to see
        and manage shifts that are currently being worked.
        """
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Check if user has manager or admin permissions
        if not (request.user.role in ['manager', 'admin'] or request.user.is_staff):
            return Response(
                {"detail": "Manager or admin permissions required"},
                status=status.HTTP_403_FORBIDDEN
            )

        now = timezone.now()

        # SECURITY FIX: Use get_queryset() for company-scoped filtering
        active_shifts = self.get_queryset().filter(
            status='in_progress',
            check_in_time__isnull=False,
            check_out_time__isnull=True
        ).select_related('venue', 'staff_user').order_by('start_time')

        shifts_data = []
        for shift in active_shifts:
            # Calculate elapsed time since check-in
            elapsed_seconds = (now - shift.check_in_time).total_seconds()
            elapsed_hours = round(elapsed_seconds / 3600, 2)

            # Calculate scheduled duration
            scheduled_duration = (shift.end_time - shift.start_time).total_seconds() / 3600

            # Determine if shift is past scheduled end time
            is_overdue = now > shift.end_time
            overdue_hours = round((now - shift.end_time).total_seconds() / 3600, 2) if is_overdue else 0

            shifts_data.append({
                'id': shift.id,
                'staff_details': {
                    'id': shift.staff_user.id if shift.staff_user else None,
                    'first_name': shift.staff_user.first_name if shift.staff_user else 'Unassigned',
                    'last_name': shift.staff_user.last_name if shift.staff_user else '',
                    'email': shift.staff_user.email if shift.staff_user else ''
                } if shift.staff_user else None,
                'venue_details': {
                    'id': shift.venue.id,
                    'name': shift.venue.name,
                    'address': getattr(shift.venue, 'address', ''),
                } if shift.venue else None,
                'start_time': shift.start_time,
                'end_time': shift.end_time,
                'check_in_time': shift.check_in_time,
                'elapsed_hours': elapsed_hours,
                'scheduled_duration': round(scheduled_duration, 2),
                'is_overdue': is_overdue,
                'overdue_hours': overdue_hours,
                'status': shift.status
            })

        return Response(shifts_data)

    @action(detail=False, methods=['get'], url_path='incomplete')
    def incomplete_shifts(self, request):
        """Get shifts that need manager attention (incomplete check-ins/check-outs)"""
        from django.utils import timezone
        from datetime import timedelta

        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Check if user has manager or admin permissions
        if not (request.user.role in ['manager', 'admin'] or request.user.is_staff):
            return Response(
                {"detail": "Manager or admin permissions required"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        now = timezone.now()

        # Find shifts that need attention
        incomplete_shifts = []

        # SECURITY FIX: Use get_queryset() for company-scoped filtering
        base_queryset = self.get_queryset()

        # 1. Shifts that should have started but no check-in
        no_checkin_shifts = base_queryset.filter(
            start_time__lte=now,
            check_in_time__isnull=True,
            status='scheduled'
        ).select_related('venue', 'staff_user')

        # 2. Shifts that should have ended but no check-out
        no_checkout_shifts = base_queryset.filter(
            end_time__lte=now,
            check_in_time__isnull=False,
            check_out_time__isnull=True,
            status='in_progress'
        ).select_related('venue', 'staff_user')
        
        # Process no check-in shifts
        for shift in no_checkin_shifts:
            time_overdue = now - shift.start_time
            hours_overdue_raw = time_overdue.total_seconds() / 3600
            requires_manual_resolution = hours_overdue_raw > 24
            hours_overdue = min(round(hours_overdue_raw, 1), 24.0)  # Cap at 24 hours

            incomplete_shifts.append({
                'id': shift.id,
                'type': 'no_checkin',
                'staff_details': {
                    'id': shift.staff_user.id if shift.staff_user else None,
                    'first_name': shift.staff_user.first_name if shift.staff_user else 'Unassigned',
                    'last_name': shift.staff_user.last_name if shift.staff_user else '',
                    'email': shift.staff_user.email if shift.staff_user else ''
                },
                'venue_details': {
                    'id': shift.venue.id,
                    'name': shift.venue.name,
                    'address': getattr(shift.venue, 'address', ''),
                } if shift.venue else None,
                'start_time': shift.start_time,
                'end_time': shift.end_time,
                'hours_overdue': hours_overdue,
                'hours_overdue_raw': round(hours_overdue_raw, 1),
                'requires_manual_resolution': requires_manual_resolution,
                'status': shift.status,
                'auto_checkout_eligible': shift.can_auto_checkout() if hasattr(shift, 'can_auto_checkout') else False,
                'force_timeout_eligible': shift.can_force_timeout() if hasattr(shift, 'can_force_timeout') else False,
                'priority': 'critical' if requires_manual_resolution else 'high' if hours_overdue_raw > 2 else 'medium' if hours_overdue_raw > 0.5 else 'low'
            })
        
        # Process no check-out shifts
        for shift in no_checkout_shifts:
            time_overdue = now - shift.end_time
            hours_overdue_raw = time_overdue.total_seconds() / 3600
            requires_manual_resolution = hours_overdue_raw > 24
            hours_overdue = min(round(hours_overdue_raw, 1), 24.0)  # Cap at 24 hours

            incomplete_shifts.append({
                'id': shift.id,
                'type': 'no_checkout',
                'staff_details': {
                    'id': shift.staff_user.id if shift.staff_user else None,
                    'first_name': shift.staff_user.first_name if shift.staff_user else 'Unassigned',
                    'last_name': shift.staff_user.last_name if shift.staff_user else '',
                    'email': shift.staff_user.email if shift.staff_user else ''
                },
                'venue_details': {
                    'id': shift.venue.id,
                    'name': shift.venue.name,
                    'address': getattr(shift.venue, 'address', ''),
                } if shift.venue else None,
                'start_time': shift.start_time,
                'end_time': shift.end_time,
                'check_in_time': shift.check_in_time,
                'hours_overdue': hours_overdue,
                'hours_overdue_raw': round(hours_overdue_raw, 1),
                'requires_manual_resolution': requires_manual_resolution,
                'status': shift.status,
                'auto_checkout_eligible': shift.can_auto_checkout() if hasattr(shift, 'can_auto_checkout') else False,
                'force_timeout_eligible': shift.can_force_timeout() if hasattr(shift, 'can_force_timeout') else False,
                'priority': 'critical' if requires_manual_resolution else 'high' if hours_overdue_raw > 2 else 'medium' if hours_overdue_raw > 0.5 else 'low'
            })

        # Sort by priority and hours overdue
        priority_order = {'critical': 4, 'high': 3, 'medium': 2, 'low': 1}
        incomplete_shifts.sort(key=lambda x: (priority_order.get(x['priority'], 0), x['hours_overdue']), reverse=True)
        
        return Response(incomplete_shifts)

    @action(detail=True, methods=['post'], url_path='manual_checkin')
    def manual_checkin(self, request, pk=None):
        """Manager override: manually check in a staff member"""
        shift = self.get_object()

        # Check manager permissions
        if not (request.user.role in ['manager', 'admin'] or request.user.is_staff):
            return Response(
                {"detail": "Manager or admin permissions required"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Draft shifts must be published before manager-override check-in.
        # Same reasoning as check_in — even managers shouldn't be starting
        # unpublished shifts; publish first, then check in.
        if not shift.is_published:
            return Response(
                {"detail": "This shift hasn't been published yet. Publish it before performing a manual check-in."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if already checked in
        if shift.check_in_time:
            return Response(
                {"detail": "Shift already checked in"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get manager signature and notes
        manager_signature = request.data.get('manager_signature')
        manager_notes = request.data.get('manager_notes', '')
        checkin_time = request.data.get('checkin_time')  # Allow backdating
        
        if not manager_signature:
            return Response(
                {"detail": "Manager signature is required for manual check-in"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from django.utils import timezone
            import logging

            # Use provided time or current time
            if checkin_time:
                from datetime import datetime
                checkin_datetime = datetime.fromisoformat(checkin_time.replace('Z', '+00:00'))

                # Validate: override time must not be in the future
                if checkin_datetime > timezone.now():
                    return Response(
                        {"detail": "Check-in time cannot be in the future"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                checkin_datetime = timezone.now()

            # Perform manual check-in
            shift.check_in_time = checkin_datetime
            shift.status = 'in_progress'
            shift.start_signature = manager_signature
            shift.manager_notes = f"Manual check-in by {request.user.get_full_name() or request.user.username}: {manager_notes}"
            shift.save()
            
            # Log the manual intervention
            logger = logging.getLogger(__name__)
            logger.info(f"Manual check-in performed by manager {request.user.username} for shift {shift.id} - Staff: {shift.staff_user.username if shift.staff_user else 'Unassigned'}")
            
            serializer = self.get_serializer(shift)
            return Response({
                "detail": "Manual check-in successful",
                "shift": serializer.data
            })
            
        except Exception as e:
            return Response(
                {"detail": f"Manual check-in failed: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'], url_path='manual_checkout')
    def manual_checkout(self, request, pk=None):
        """Manager override: manually check out a staff member"""
        shift = self.get_object()
        
        # Check manager permissions
        if not (request.user.role in ['manager', 'admin'] or request.user.is_staff):
            return Response(
                {"detail": "Manager or admin permissions required"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if already checked out
        if shift.check_out_time:
            return Response(
                {"detail": "Shift already checked out"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get manager signature, notes, and hours
        manager_signature = request.data.get('manager_signature')
        manager_notes = request.data.get('manager_notes', '')
        checkout_time = request.data.get('checkout_time')  # Allow backdating
        actual_hours = request.data.get('actual_hours')  # Manual hours input
        
        if not manager_signature:
            return Response(
                {"detail": "Manager signature is required for manual check-out"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Ensure shift has been checked in before allowing checkout
        if not shift.check_in_time:
            return Response(
                {"detail": "Shift must be checked in before manual check-out"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from django.utils import timezone
            import logging

            # Use provided time or current time
            if checkout_time:
                from datetime import datetime
                checkout_datetime = datetime.fromisoformat(checkout_time.replace('Z', '+00:00'))

                # Validate: override time must not be in the future
                if checkout_datetime > timezone.now():
                    return Response(
                        {"detail": "Check-out time cannot be in the future"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Validate: checkout time must be after check-in time
                if shift.check_in_time and checkout_datetime <= shift.check_in_time:
                    return Response(
                        {"detail": "Check-out time must be after check-in time"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                checkout_datetime = timezone.now()

            # Perform manual check-out
            shift.check_out_time = checkout_datetime
            shift.status = 'completed'
            shift.end_signature = manager_signature

            # Set actual hours if provided
            if actual_hours:
                shift.actual_hours_worked = float(actual_hours)
            
            # Update manager notes
            existing_notes = shift.manager_notes or ''
            new_note = f"Manual check-out by {request.user.get_full_name() or request.user.username}: {manager_notes}"
            shift.manager_notes = f"{existing_notes}\n{new_note}" if existing_notes else new_note
            
            shift.save()
            
            # Log the manual intervention
            logger = logging.getLogger(__name__)
            logger.info(f"Manual check-out performed by manager {request.user.username} for shift {shift.id} - Staff: {shift.staff_user.username if shift.staff_user else 'Unassigned'}")
            
            serializer = self.get_serializer(shift)
            return Response({
                "detail": "Manual check-out successful",
                "shift": serializer.data
            })
            
        except Exception as e:
            return Response(
                {"detail": f"Manual check-out failed: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'], url_path='force_complete')
    def force_complete(self, request, pk=None):
        """Manager override: force complete a shift with custom hours"""
        shift = self.get_object()
        
        # Check manager permissions
        if not (request.user.role in ['manager', 'admin'] or request.user.is_staff):
            return Response(
                {"detail": "Manager or admin permissions required"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if already completed
        if shift.status in ('completed', 'no_show'):
            return Response(
                {"detail": "Shift already completed"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get required data
        manager_signature = request.data.get('manager_signature')
        manager_notes = request.data.get('manager_notes', '')
        actual_hours = request.data.get('actual_hours')
        checkin_time = request.data.get('checkin_time')
        checkout_time = request.data.get('checkout_time')
        
        if not manager_signature:
            return Response(
                {"detail": "Manager signature is required for force complete"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if actual_hours is None:
            return Response(
                {"detail": "Actual hours worked is required for force complete"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from django.utils import timezone
            from datetime import datetime
            import logging

            # Only set check-in/check-out times if actual hours > 0 (not a no-show)
            if float(actual_hours) > 0:
                # Set check-in time if not already set
                if not shift.check_in_time and checkin_time:
                    shift.check_in_time = datetime.fromisoformat(checkin_time.replace('Z', '+00:00'))
                elif not shift.check_in_time:
                    shift.check_in_time = shift.start_time

                # Set check-out time
                if checkout_time:
                    shift.check_out_time = datetime.fromisoformat(checkout_time.replace('Z', '+00:00'))
                else:
                    shift.check_out_time = timezone.now()
            # else: No-show - leave check_in_time and check_out_time as None/unset

            # Set status based on hours (0 hours = no show)
            shift.status = 'no_show' if float(actual_hours) == 0 else 'completed'
            shift.actual_hours_worked = float(actual_hours)
            shift.start_signature = manager_signature
            shift.end_signature = manager_signature
            
            # Update manager notes
            existing_notes = shift.manager_notes or ''
            new_note = f"Force completed by {request.user.get_full_name() or request.user.username}: {manager_notes}"
            shift.manager_notes = f"{existing_notes}\n{new_note}" if existing_notes else new_note
            
            shift.save()
            
            # Log the manual intervention
            logger = logging.getLogger(__name__)
            logger.warning(f"Force complete performed by manager {request.user.username} for shift {shift.id} - Staff: {shift.staff_user.username if shift.staff_user else 'Unassigned'} - Hours: {actual_hours}")
            
            serializer = self.get_serializer(shift)
            return Response({
                "detail": "Shift force completed successfully",
                "shift": serializer.data
            })
            
        except Exception as e:
            return Response(
                {"detail": f"Force complete failed: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
    @action(detail=True, methods=['post'])
    def check_in(self, request, pk=None):
        """Check in for a shift with location verification, signature, and photo"""
        from datetime import timedelta

        shift = self.get_object()

        # Verify the user is assigned to this shift
        if shift.staff_user != request.user:
            return Response(
                {"detail": "You are not assigned to this shift"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Draft shifts must be published before anyone can check in.
        # Without this gate, a staff/admin user assigned to an unpublished
        # shift can still hit this endpoint and start the shift.
        if not shift.is_published:
            return Response(
                {"detail": "This shift hasn't been published yet. Ask your manager to publish it before checking in."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if the shift is already checked in
        if shift.check_in_time:
            return Response(
                {"detail": "Shift already checked in"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Time-based restrictions validation
        now = timezone.now()
        shift_start = shift.start_time
        shift_end = shift.end_time
        
        # Restriction 1: Must be within the valid check-in window
        # For overnight shifts, allow check-in if current time is within the shift duration
        # or on the shift start date (even if we've crossed to the next day)
        shift_start_date = shift_start.date()
        current_date = now.date()

        # Calculate if we're in a valid check-in period
        is_overnight_shift = shift_end.date() > shift_start.date()
        is_valid_checkin_period = False
        
        if is_overnight_shift:
            # For overnight shifts: allow check-in if we're on start date OR 
            # if we're on end date but before the shift end time
            if current_date == shift_start_date:
                is_valid_checkin_period = True
            elif current_date == shift_end.date() and now <= shift_end:
                is_valid_checkin_period = True
        else:
            # For same-day shifts: must be on the same date
            is_valid_checkin_period = (current_date == shift_start_date)
        
        if not is_valid_checkin_period:
            if current_date < shift_start_date:
                days_diff = (shift_start_date - current_date).days
                return Response(
                    {"detail": f"Cannot check in {days_diff} day{'s' if days_diff > 1 else ''} early. You can only check in on the day of your shift ({shift_start_date.strftime('%B %d, %Y')})."}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            else:
                return Response(
                    {"detail": "Cannot check in to a shift from a previous date. Please contact your manager."}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Restriction 2: Cannot check in more than 15 minutes early
        early_checkin_window = timedelta(minutes=15)
        earliest_checkin_time = shift.start_time - early_checkin_window
        
        if now < earliest_checkin_time:
            time_diff = earliest_checkin_time - now
            hours = int(time_diff.total_seconds() // 3600)
            minutes = int((time_diff.total_seconds() % 3600) // 60)
            
            if hours > 0:
                wait_time = f"{hours} hour{'s' if hours > 1 else ''} and {minutes} minute{'s' if minutes != 1 else ''}"
            else:
                wait_time = f"{minutes} minute{'s' if minutes != 1 else ''}"
                
            available_time = earliest_checkin_time.strftime('%I:%M %p')
            return Response(
                {"detail": f"Cannot check in {wait_time} early. Check-in becomes available at {available_time} (15 minutes before shift start)."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Get location, signature, and photo from request
        latitude = request.data.get('latitude')
        longitude = request.data.get('longitude')
        signature = request.data.get('signature')
        photo = request.data.get('photo')
        
        # Validate required parameters
        if not latitude or not longitude:
            return Response(
                {"detail": "Latitude and longitude are required for check-in"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            # Use the advanced model method for check-in
            shift.check_in(
                latitude=float(latitude),
                longitude=float(longitude),
                signature=signature,
                photo=photo
            )
            
            serializer = self.get_serializer(shift)
            return Response({
                "detail": "Successfully checked in",
                "shift": serializer.data
            })
            
        except ValueError as e:
            return Response(
                {"detail": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"detail": f"Check-in failed: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
    @action(detail=True, methods=['post'])
    def check_out(self, request, pk=None):
        """Check out from a shift with location verification, signature, and photo"""
        shift = self.get_object()
        
        # Verify the user is assigned to this shift
        if shift.staff_user != request.user:
            return Response(
                {"detail": "You are not assigned to this shift"}, 
                status=status.HTTP_403_FORBIDDEN
            )
            
        # Check if the shift is not checked in
        if not shift.check_in_time:
            return Response(
                {"detail": "Shift not checked in yet"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Check if the shift is already checked out
        if shift.check_out_time:
            return Response(
                {"detail": "Shift already checked out"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Monitored venues: require a logbook signoff before checkout. Mobile
        # funnels through LogbookSignoffModal first, but older app versions
        # may skip that gate. Reject server-side so old clients get a clear
        # error instead of silently closing a shift with no logbook record.
        if shift.venue and shift.venue.requires_capacity_monitoring:
            from api.models import CapacityLogbookSignoff
            shift_group = shift.shift_group or f'shift_{shift.id}'
            if not CapacityLogbookSignoff.objects.filter(shift_group=shift_group).exists():
                return Response(
                    {
                        "detail": (
                            "Capacity logbook must be signed off before checkout. "
                            "Open the Capacity Logbook screen and submit a signoff "
                            "(or an override reason if the venue admin is unavailable)."
                        ),
                        "code": "logbook_signoff_required",
                        "shift_group": shift_group,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Get location, signature, and photo from request
        latitude = request.data.get('latitude')
        longitude = request.data.get('longitude')
        signature = request.data.get('signature')
        photo = request.data.get('photo')
        
        # Validate required parameters
        if not latitude or not longitude:
            return Response(
                {"detail": "Latitude and longitude are required for check-out"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            # Use the advanced model method for check-out
            shift.check_out(
                latitude=float(latitude),
                longitude=float(longitude),
                signature=signature,
                photo=photo
            )
            
            serializer = self.get_serializer(shift)
            return Response({
                "detail": "Successfully checked out",
                "shift": serializer.data
            })
            
        except ValueError as e:
            return Response(
                {"detail": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"detail": f"Check-out failed: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """
        Cancel a shift and notify managers.

        Robust implementation with explicit error handling and logging.

        Optional body parameter:
        - publish_to_pool: If true, creates an OpenShiftRequest so other staff can claim the slot
        """
        from api.models import User, OpenShiftRequest
        from api.services import push_notification_service
        from django.db import transaction

        shift = self.get_object()
        shift_id = shift.id  # Store ID before any operations

        # Only staff users with appropriate permissions or the assigned user can cancel a shift
        if not request.user.is_staff and shift.staff_user != request.user:
            return Response(
                {"detail": "You don't have permission to cancel this shift"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check if the shift is already cancelled
        if shift.status == 'cancelled':
            return Response(
                {"detail": "Shift already cancelled"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if the shift is completed
        if shift.status == 'completed':
            return Response(
                {"detail": "Cannot cancel a completed shift"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Store info before cancellation for notifications
        cancelled_by_staff = shift.staff_user == request.user
        staff_name = f"{shift.staff_user.first_name} {shift.staff_user.last_name}" if shift.staff_user else "Unknown"
        venue_name = shift.venue.name if shift.venue else "Unknown Venue"
        shift_date = shift.start_time.strftime('%B %d, %Y')
        shift_time = shift.start_time.strftime('%I:%M %p')
        company = shift.venue.company if shift.venue else None
        publish_to_pool = request.data.get('publish_to_pool', False)

        # CRITICAL: Perform cancellation with explicit transaction and logging
        try:
            with transaction.atomic():
                logger.info(f"Cancelling shift {shift_id}, current status: {shift.status}")
                shift.status = 'cancelled'
                shift.save()
                logger.info(f"Shift {shift_id} saved with status: {shift.status}")
        except Exception as save_error:
            logger.exception(f"Failed to save cancelled shift {shift_id}: {save_error}")
            return Response(
                {"detail": f"Failed to cancel shift: {str(save_error)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # If publish_to_pool is requested, create an OpenShiftRequest
        if publish_to_pool and company:
            try:
                # Find a manager to be the requesting user for the open shift
                manager = User.objects.filter(
                    company_memberships__company=company,
                    company_memberships__is_active=True,
                    role__in=['admin', 'manager']
                ).first()

                if manager:
                    # Create a new shift copy for the open pool (unassigned)
                    from api.models import Shift as ApiShift
                    new_shift = ApiShift.objects.create(
                        venue=shift.venue,
                        start_time=shift.start_time,
                        end_time=shift.end_time,
                        status='open',
                        staff_user=None,
                        notes=f"Re-opened after cancellation by {staff_name}"
                    )

                    # Create OpenShiftRequest for the new shift
                    OpenShiftRequest.objects.create(
                        original_shift=new_shift,
                        requesting_user=manager,
                        request_reason=f"Shift cancelled by {staff_name} - published to open pool",
                        status='open'
                    )
                    logger.info(f"Created OpenShiftRequest for cancelled shift {shift_id}")
            except Exception as e:
                logger.error(f"Error creating open shift request: {e}")

        # Notify managers if cancelled by staff
        if cancelled_by_staff and company:
            try:
                # Get all managers and admins in the company
                managers = User.objects.filter(
                    company_memberships__company=company,
                    company_memberships__is_active=True,
                    role__in=['admin', 'manager']
                ).distinct()

                for manager in managers:
                    push_notification_service.send_shift_cancellation_to_manager(
                        manager_user_id=manager.id,
                        shift_id=shift_id,
                        staff_name=staff_name,
                        venue_name=venue_name,
                        shift_date=shift_date,
                        shift_time=shift_time,
                        published_to_pool=publish_to_pool
                    )

                logger.info(f"Notified {managers.count()} managers of shift cancellation by {staff_name}")
            except Exception as e:
                logger.error(f"Error notifying managers of cancellation: {e}")

        # Return response - try full serialization, fallback to simple response
        try:
            serializer = self.get_serializer(shift)
            return Response(serializer.data)
        except Exception as serialization_error:
            logger.warning(f"Serialization failed for cancelled shift {shift_id}, returning simple response: {serialization_error}")
            # Return simple success response - the shift WAS cancelled successfully
            return Response({
                "id": shift_id,
                "status": "cancelled",
                "message": "Shift cancelled successfully"
            })

    @action(detail=False, methods=['post'])
    def create_multi_staff(self, request):
        """Create shifts for multiple staff members at the same venue and time"""
        # Check if this is a copy operation that should allow past dates
        allow_past_dates = request.data.get('allow_past_dates', False)
        context = {'allow_past_dates': allow_past_dates}
        
        serializer = MultiStaffShiftSerializer(data=request.data, context=context)
        if serializer.is_valid():
            shifts = serializer.save()
            # Send email notifications for each created shift
            for shift in shifts:
                self._send_shift_assignment_email(shift)
            # Return the created shifts using the regular serializer
            shift_data = ShiftSerializer(shifts, many=True).data
            return Response({
                'message': f'Successfully created {len(shifts)} shifts',
                'shifts': shift_data,
                'shift_group': shifts[0].shift_group if shifts else None
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get', 'post'], url_path='enforcement-visits')
    def enforcement_visits(self, request, pk=None):
        """Get or add enforcement visits for a shift"""
        shift = self.get_object()
        from api.models import EnforcementVisit
        from api.serializers import EnforcementVisitSerializer
        
        if request.method == 'GET':
            visits = EnforcementVisit.objects.filter(shift=shift).order_by('-timestamp')
            serializer = EnforcementVisitSerializer(visits, many=True)
            return Response(serializer.data)
        
        elif request.method == 'POST':
            # Add the shift to the request data
            data = request.data.copy()
            data['shift'] = shift.id
            
            serializer = EnforcementVisitSerializer(data=data)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Manager approval of a shift"""
        shift = self.get_object()
        
        # Check permissions - only managers and admins can approve
        if not (request.user.role in ['manager', 'admin'] or request.user.is_staff):
            return Response(
                {"error": "Only managers and admins can approve shifts"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get approval data
        approved = request.data.get('approved', False)
        manager_signature = request.data.get('managerSignature', '')
        manager_notes = request.data.get('managerNotes', '')
        
        # Validate required fields
        if approved and not manager_signature:
            return Response(
                {"error": "Manager signature is required for approval"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update shift
        if approved:
            shift.status = 'approved'
            shift.manager_approved = True
        else:
            shift.status = 'rejected'
            shift.manager_approved = False
        
        shift.manager_signature = manager_signature
        shift.manager_notes = manager_notes
        shift.manager_user = request.user
        shift.save()

        serializer = self.get_serializer(shift)
        return Response(serializer.data)

    def _handle_attendance_write(self, request, *, require_reason: bool):
        """Shared implementation for record_attendance + adjust_time.

        Both endpoints route through the `record_attendance` service so the
        Shift table stays the single source of truth and audit trail (a
        TimeAdjustment row) is only created when prior data was overwritten.
        """
        from decimal import Decimal, InvalidOperation
        from datetime import datetime
        from django.utils.dateparse import parse_datetime
        from api.models import InvoiceItem
        from .services import record_attendance

        if request.user.role not in ['manager', 'admin']:
            return Response(
                {'detail': 'Only managers and admins can record shift attendance'},
                status=status.HTTP_403_FORBIDDEN
            )

        shift = self.get_object()

        def _parse_dt(value):
            if value in (None, ''):
                return None
            if isinstance(value, datetime):
                return value
            return parse_datetime(value)

        def _parse_hours(value):
            if value in (None, ''):
                return None
            try:
                return Decimal(str(value))
            except (InvalidOperation, TypeError):
                return None

        check_in = _parse_dt(request.data.get('adjusted_check_in_time'))
        check_out = _parse_dt(request.data.get('adjusted_check_out_time'))
        hours = _parse_hours(request.data.get('adjusted_actual_hours'))
        reason = (request.data.get('reason') or '').strip()
        source = request.data.get('manager_signature') or 'admin'

        if hours is None and check_in and check_out:
            duration_hours = Decimal(str((check_out - check_in).total_seconds() / 3600))
            hours = duration_hours.quantize(Decimal('0.01'))

        if hours is None and check_in is None and check_out is None:
            return Response(
                {'detail': 'Provide check-in, check-out, or hours.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if require_reason and not reason:
            return Response(
                {'detail': 'A reason is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if hours is not None and hours > 24:
            return Response(
                {'detail': 'Adjusted hours cannot exceed 24.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            shift, audit = record_attendance(
                shift=shift,
                check_in=check_in,
                check_out=check_out,
                hours=hours,
                actor=request.user,
                source=source,
                reason=reason,
            )
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except DjangoValidationError as e:
            return Response(
                {'detail': '; '.join(e.messages) if hasattr(e, 'messages') else str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Lift no-show / cancelled shifts back into the pipeline once a manager
        # attests presence — Scheduling hides terminal statuses.
        if check_in and shift.status in ('no_show', 'cancelled'):
            shift.status = 'pending_approval' if check_out else 'in_progress'
            shift.save(update_fields=['status'])

        invoice_item = (
            InvoiceItem.objects.select_related('invoice').filter(shift=shift).first()
        )
        invoice_updated = invoice_item is not None
        invoice_id = invoice_item.invoice.id if invoice_item else None

        response_data = {
            'id': audit.id if audit else None,
            'shift': shift.id,
            'original_hours': float(audit.original_actual_hours or Decimal('0.00')) if audit else 0.0,
            'adjusted_hours': float(shift.actual_hours_worked or Decimal('0.00')),
            'check_in_time': shift.check_in_time.isoformat() if shift.check_in_time else None,
            'check_out_time': shift.check_out_time.isoformat() if shift.check_out_time else None,
            'audited': audit is not None,
            'invoice_updated': invoice_updated,
            'invoice_id': invoice_id,
            'created_at': (audit.created_at if audit else shift.updated_at).isoformat(),
        }

        return Response(response_data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='record_attendance')
    def record_attendance(self, request, pk=None):
        """Record attendance values onto a shift (canonical endpoint).

        Used by the admin Attendance UI and any first-time recording flow. The
        Shift table is the source of truth; an audit TimeAdjustment row is
        created only if this call overwrites previously recorded values.

        Body:
        - adjusted_check_in_time (ISO 8601, optional)
        - adjusted_check_out_time (ISO 8601, optional)
        - adjusted_actual_hours (decimal, optional — derived from times if absent)
        - reason (required only when overwriting prior data)
        - manager_signature (string label, optional)
        """
        return self._handle_attendance_write(request, require_reason=False)

    @action(detail=True, methods=['post'], url_path='adjust_time')
    def adjust_time(self, request, pk=None):
        """Adjust an already-recorded shift (legacy + corrections endpoint).

        Same payload as record_attendance, but always requires `reason` because
        this endpoint's contract is "I am correcting recorded data". For new
        recordings the admin UI should use /record_attendance/.
        """
        return self._handle_attendance_write(request, require_reason=True)

    @action(detail=True, methods=['get'], url_path='time_adjustments')
    def time_adjustments(self, request, pk=None):
        """
        Get all time adjustments for a shift (audit history).

        Returns chronological list of all time adjustments made to this shift,
        including original times, adjusted times, reasons, and who made the adjustment.
        """
        from api.models import TimeAdjustment
        from api.serializers import TimeAdjustmentSerializer

        shift = self.get_object()
        adjustments = TimeAdjustment.objects.filter(shift=shift).order_by('-created_at')
        serializer = TimeAdjustmentSerializer(adjustments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='reports/attendance')
    def attendance_reports(self, request):
        """
        Get staff attendance analytics for admin view.

        Tracks check-ins, no-shows, lateness, and hours worked.

        Query parameters:
        - startDate (required): Start date for the report period (YYYY-MM-DD)
        - endDate (required): End date for the report period (YYYY-MM-DD)
        - venueId (optional): Filter by specific venue
        - page (optional): Page number for pagination (default: 1)
        - pageSize (optional): Items per page (default: 25)
        """
        from django.db.models import Count, Sum, F, Case, When, Value, DecimalField
        from django.db.models.functions import Coalesce
        from django.contrib.auth import get_user_model
        from decimal import Decimal

        User = get_user_model()

        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Check if user has admin permissions
        if not (request.user.role == 'admin' or request.user.is_staff):
            return Response(
                {"detail": "Admin permissions required"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get query parameters
        start_date = request.query_params.get('startDate')
        end_date = request.query_params.get('endDate')
        venue_id = request.query_params.get('venueId')
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('pageSize', 25))

        if not start_date or not end_date:
            return Response(
                {"detail": "startDate and endDate are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Parse dates
        try:
            from datetime import datetime
            start_datetime = datetime.strptime(start_date, '%Y-%m-%d')
            end_datetime = datetime.strptime(end_date, '%Y-%m-%d')
        except ValueError:
            return Response(
                {"detail": "Invalid date format. Use YYYY-MM-DD"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # SECURITY FIX: Use middleware-provided company context (respects X-Company-ID header)
        from api.models import UserCompanyMembership

        company = getattr(request, 'current_company', None)
        if not company:
            # Fallback: Get user's primary company
            membership = UserCompanyMembership.objects.filter(
                user=request.user,
                is_active=True,
                company__is_active=True
            ).select_related('company').order_by('-joined_at').first()
            company = membership.company if membership else None

        if not company:
            return Response({
                'summary': {
                    'totalCheckIns': 0,
                    'totalNoShows': 0,
                    'totalLateCheckIns': 0,
                    'totalHoursWorked': 0,
                    'avgHoursPerStaff': 0,
                    'onTimePercentage': 100.0,
                    'previousPeriodComparison': {
                        'checkInsChange': 0,
                        'noShowsChange': 0,
                        'lateChange': 0,
                        'hoursChange': 0
                    }
                },
                'staffMetrics': [],
                'pagination': {'page': 1, 'totalPages': 0, 'totalCount': 0}
            })

        # Base queryset for current period - filter by company, not by staff_user
        shifts_queryset = Shift.objects.filter(
            venue__company=company,
            start_time__date__gte=start_date,
            start_time__date__lte=end_date
        )

        if venue_id:
            shifts_queryset = shifts_queryset.filter(venue_id=venue_id)

        now = timezone.now()

        # Calculate summary metrics
        total_check_ins = shifts_queryset.filter(check_in_time__isnull=False).count()

        # No-shows: scheduled shifts that have ended but never checked in, or explicitly marked no_show
        total_no_shows = shifts_queryset.filter(
            Q(status='scheduled', end_time__lt=now, check_in_time__isnull=True) |
            Q(status='no_show')
        ).count()

        # Late check-ins: checked in after the scheduled start time
        total_late = shifts_queryset.filter(
            check_in_time__isnull=False,
            check_in_time__gt=F('start_time')
        ).count()

        # Total hours worked
        total_hours_result = shifts_queryset.filter(
            actual_hours_worked__isnull=False
        ).aggregate(
            total=Coalesce(Sum('actual_hours_worked'), Decimal('0.00'))
        )
        total_hours = float(total_hours_result['total'])

        # Calculate previous period for comparison
        period_length = (end_datetime - start_datetime).days + 1
        prev_start = start_datetime - timedelta(days=period_length)
        prev_end = start_datetime - timedelta(days=1)

        prev_shifts = Shift.objects.filter(
            venue__company=company,
            start_time__date__gte=prev_start,
            start_time__date__lte=prev_end
        )
        if venue_id:
            prev_shifts = prev_shifts.filter(venue_id=venue_id)

        prev_check_ins = prev_shifts.filter(check_in_time__isnull=False).count()
        prev_no_shows = prev_shifts.filter(
            Q(status='scheduled', end_time__lt=now, check_in_time__isnull=True) |
            Q(status='no_show')
        ).count()
        prev_late = prev_shifts.filter(
            check_in_time__isnull=False,
            check_in_time__gt=F('start_time')
        ).count()
        prev_hours_result = prev_shifts.filter(
            actual_hours_worked__isnull=False
        ).aggregate(
            total=Coalesce(Sum('actual_hours_worked'), Decimal('0.00'))
        )
        prev_hours = float(prev_hours_result['total'])

        # Calculate percentage changes
        def calc_change(current, previous):
            if previous == 0:
                return 100.0 if current > 0 else 0.0
            return round(((current - previous) / previous) * 100, 1)

        check_ins_change = calc_change(total_check_ins, prev_check_ins)
        no_shows_change = calc_change(total_no_shows, prev_no_shows)
        late_change = calc_change(total_late, prev_late)
        hours_change = calc_change(total_hours, prev_hours)

        # Calculate on-time percentage
        total_completed = total_check_ins
        on_time_count = total_completed - total_late
        on_time_percentage = round((on_time_count / total_completed * 100), 1) if total_completed > 0 else 100.0

        # Get staff metrics with pagination
        staff_users = User.objects.filter(
            shifts__venue__company=company,
            shifts__start_time__date__gte=start_date,
            shifts__start_time__date__lte=end_date
        )
        if venue_id:
            staff_users = staff_users.filter(shifts__venue_id=venue_id)
        staff_users = staff_users.distinct()

        # Count total for pagination
        total_staff_count = staff_users.count()
        total_pages = (total_staff_count + page_size - 1) // page_size

        # Paginate
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        paginated_staff = list(staff_users[start_index:end_index])

        staff_metrics = []
        for staff_user in paginated_staff:
            user_shifts = shifts_queryset.filter(staff_user=staff_user)

            check_in_count = user_shifts.filter(check_in_time__isnull=False).count()
            no_show_count = user_shifts.filter(
                Q(status='scheduled', end_time__lt=now, check_in_time__isnull=True) |
                Q(status='no_show')
            ).count()
            late_count = user_shifts.filter(
                check_in_time__isnull=False,
                check_in_time__gt=F('start_time')
            ).count()

            hours_result = user_shifts.filter(
                actual_hours_worked__isnull=False
            ).aggregate(
                total=Coalesce(Sum('actual_hours_worked'), Decimal('0.00'))
            )
            staff_hours = float(hours_result['total'])

            # Calculate on-time percentage for this staff member
            staff_on_time = check_in_count - late_count
            staff_on_time_pct = round((staff_on_time / check_in_count * 100), 1) if check_in_count > 0 else 100.0

            # Determine status based on on-time percentage
            if staff_on_time_pct >= 95:
                performance_status = 'excellent'
            elif staff_on_time_pct >= 80:
                performance_status = 'good'
            elif staff_on_time_pct >= 60:
                performance_status = 'warning'
            else:
                performance_status = 'critical'

            # Get last shift date
            last_shift = user_shifts.order_by('-start_time').first()
            last_shift_date = last_shift.start_time.date().isoformat() if last_shift else None

            staff_metrics.append({
                'staffId': staff_user.id,
                'staffName': f"{staff_user.first_name} {staff_user.last_name}".strip() or staff_user.username,
                'staffEmail': staff_user.email,
                'checkInCount': check_in_count,
                'noShowCount': no_show_count,
                'lateCount': late_count,
                'totalHoursWorked': round(staff_hours, 1),
                'onTimePercentage': staff_on_time_pct,
                'lastShiftDate': last_shift_date,
                'status': performance_status
            })

        # Sort by on-time percentage descending
        staff_metrics.sort(key=lambda x: x['onTimePercentage'], reverse=True)

        # Calculate average hours per staff
        avg_hours_per_staff = round(total_hours / total_staff_count, 1) if total_staff_count > 0 else 0.0

        return Response({
            'summary': {
                'totalCheckIns': total_check_ins,
                'totalNoShows': total_no_shows,
                'totalLateCheckIns': total_late,
                'totalHoursWorked': round(total_hours, 1),
                'avgHoursPerStaff': avg_hours_per_staff,
                'onTimePercentage': on_time_percentage,
                'previousPeriodComparison': {
                    'checkInsChange': check_ins_change,
                    'noShowsChange': no_shows_change,
                    'lateChange': late_change,
                    'hoursChange': hours_change
                }
            },
            'staffMetrics': staff_metrics,
            'pagination': {
                'page': page,
                'totalPages': total_pages,
                'totalCount': total_staff_count
            }
        })

    # ─── Attendance Page (Live / Exceptions / Timesheets tabs) ─────────

    def _company_for_request(self, request):
        """Resolve the active company for the current request, with multi-tenant fallback."""
        from api.models import UserCompanyMembership
        company = getattr(request, 'current_company', None)
        if company:
            return company
        membership = UserCompanyMembership.objects.filter(
            user=request.user,
            is_active=True,
            company__is_active=True,
        ).select_related('company').order_by('-joined_at').first()
        return membership.company if membership else None

    @action(detail=False, methods=['get'], url_path='attendance/live')
    def attendance_live(self, request):
        """
        Returns today's shifts + officers + venues + stats for the Attendance
        page Live and Exceptions tabs.

        Shape matches frontend/src/features/attendance/data/mocks.ts so the
        UI can drop the mock import for this hook directly.

        Query params:
        - date (optional, YYYY-MM-DD): defaults to today in the company timezone
        - venueId (optional): filter to one venue
        """
        from .attendance_serializers import build_live_payload

        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not (getattr(request.user, 'role', None) in ('admin', 'manager') or request.user.is_staff):
            return Response({"detail": "Manager or admin permissions required"}, status=status.HTTP_403_FORBIDDEN)

        company = self._company_for_request(request)
        if not company:
            return Response({"shifts": [], "officers": [], "venues": [], "stats": {}})

        date_str = request.query_params.get('date')
        try:
            target_date = (
                datetime.strptime(date_str, '%Y-%m-%d').date()
                if date_str else timezone.localdate()
            )
        except ValueError:
            return Response({"detail": "Invalid date format. Use YYYY-MM-DD"},
                            status=status.HTTP_400_BAD_REQUEST)

        # Window is the local calendar day, plus a 6h spillover for overnight shifts
        # whose start_time is the previous day (the timeline ribbon shows them too).
        day_start = timezone.make_aware(datetime.combine(target_date, datetime.min.time()))
        day_end = day_start + timedelta(days=1)
        spill_start = day_start - timedelta(hours=6)

        shifts_qs = Shift.objects.filter(
            venue__company=company,
        ).filter(
            Q(start_time__gte=spill_start, start_time__lt=day_end)
            | Q(end_time__gt=day_start, end_time__lte=day_end + timedelta(hours=6))
        )

        venue_id = request.query_params.get('venueId')
        if venue_id:
            shifts_qs = shifts_qs.filter(venue_id=venue_id)

        payload = build_live_payload(shifts_qs.order_by('start_time'), now=timezone.now())
        return Response(payload)

    @action(detail=False, methods=['get'], url_path='attendance/timesheets')
    def attendance_timesheets(self, request):
        """
        Returns weekly per-officer TimesheetRow aggregates for the Timesheets tab.

        Query params:
        - weekStart (optional, YYYY-MM-DD): Monday of the requested week.
          Defaults to current week's Monday in the company timezone.
        - venueId (optional): filter to one venue
        """
        from .attendance_serializers import build_timesheets_payload

        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not (getattr(request.user, 'role', None) in ('admin', 'manager') or request.user.is_staff):
            return Response({"detail": "Manager or admin permissions required"}, status=status.HTTP_403_FORBIDDEN)

        company = self._company_for_request(request)
        if not company:
            return Response({"rows": [], "days": [], "officers": [], "venues": []})

        week_str = request.query_params.get('weekStart')
        try:
            if week_str:
                week_start = datetime.strptime(week_str, '%Y-%m-%d').date()
            else:
                today = timezone.localdate()
                week_start = today - timedelta(days=today.weekday())  # Monday
        except ValueError:
            return Response({"detail": "Invalid weekStart format. Use YYYY-MM-DD"},
                            status=status.HTTP_400_BAD_REQUEST)

        week_start_dt = timezone.make_aware(datetime.combine(week_start, datetime.min.time()))
        week_end_dt = week_start_dt + timedelta(days=7)

        shifts_qs = Shift.objects.filter(
            venue__company=company,
            start_time__gte=week_start_dt,
            start_time__lt=week_end_dt,
        )

        venue_id = request.query_params.get('venueId')
        if venue_id:
            shifts_qs = shifts_qs.filter(venue_id=venue_id)

        payload = build_timesheets_payload(shifts_qs, week_start, now=timezone.now())
        return Response(payload)

    # ─── Scheduler Endpoints ───────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='resource_timeline')
    def resource_timeline(self, request):
        """
        Returns FullCalendar-compatible resources + events for the scheduler timeline.
        Groups by staff or venue depending on query param.
        """
        from api.models import Venue, StaffProfile, SIALicense, UserCompanyMembership
        from api.utils.shift_validators import validate_shift_warnings
        from django.db.models import Sum, F
        from decimal import Decimal

        if not request.user.role in ['manager', 'admin']:
            return Response({"detail": "Manager or admin permissions required"}, status=status.HTTP_403_FORBIDDEN)

        # Parse params
        start = request.query_params.get('start')
        end = request.query_params.get('end')
        group_by = request.query_params.get('group_by', 'staff')
        venue_ids = request.query_params.getlist('venue_ids[]', request.query_params.getlist('venue_ids'))
        staff_ids = request.query_params.getlist('staff_ids[]', request.query_params.getlist('staff_ids'))
        roles = request.query_params.getlist('roles[]', request.query_params.getlist('roles'))
        shift_status = request.query_params.get('status')

        if not start or not end:
            return Response({"detail": "start and end query params required"}, status=status.HTTP_400_BAD_REQUEST)

        from datetime import datetime as dt
        try:
            start_dt = dt.fromisoformat(start.replace('Z', '+00:00'))
            end_dt = dt.fromisoformat(end.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            return Response({"detail": "Invalid date format. Use ISO 8601."}, status=status.HTTP_400_BAD_REQUEST)

        # Base queryset scoped to company
        shifts_qs = self.get_queryset().filter(
            start_time__lt=end_dt,
            end_time__gt=start_dt,
        ).select_related('venue', 'staff_user')

        if venue_ids:
            shifts_qs = shifts_qs.filter(venue_id__in=venue_ids)
        if staff_ids:
            shifts_qs = shifts_qs.filter(staff_user_id__in=staff_ids)
        if roles:
            shifts_qs = shifts_qs.filter(required_security_role__in=roles)
        if shift_status:
            shifts_qs = shifts_qs.filter(status=shift_status)

        # Build resources
        resources = []
        company = getattr(request, 'current_company', None)

        if group_by == 'venue':
            venue_qs = Venue.objects.filter(is_active=True)
            if company:
                venue_qs = venue_qs.filter(company=company)
            if venue_ids:
                venue_qs = venue_qs.filter(id__in=venue_ids)

            for v in venue_qs:
                resources.append({
                    'id': f'venue_{v.id}',
                    'title': v.name,
                    'address': v.address or '',
                    'capacity': v.capacity,
                    'type': 'venue',
                })
        else:
            # Group by staff — show all company members
            from django.contrib.auth import get_user_model
            User = get_user_model()

            # Resolve company: use middleware context or fall back to user's membership
            resolved_company = company
            if not resolved_company:
                user_membership = UserCompanyMembership.objects.filter(
                    user=request.user, is_active=True
                ).select_related('company').order_by('-joined_at').first()
                if user_membership:
                    resolved_company = user_membership.company

            if resolved_company:
                member_ids = UserCompanyMembership.objects.filter(
                    company=resolved_company, is_active=True
                ).values_list('user_id', flat=True)
                staff_qs = User.objects.filter(id__in=member_ids, is_active=True)
            else:
                # Last resort: show users who have shifts in range
                staff_user_ids = shifts_qs.values_list('staff_user', flat=True).distinct()
                staff_qs = User.objects.filter(id__in=staff_user_ids, is_active=True)

            if staff_ids:
                staff_qs = staff_qs.filter(id__in=staff_ids)

            for u in staff_qs:
                # Calculate weekly hours for this date range
                user_shifts = shifts_qs.filter(staff_user=u)
                weekly_hours = Decimal('0')
                for s in user_shifts:
                    if s.end_time:
                        weekly_hours += Decimal(str(round((s.end_time - s.start_time).total_seconds() / 3600, 2)))

                # Get qualifications
                qualifications = []
                try:
                    profile = u.profile
                    licenses = SIALicense.objects.filter(staff_profile=profile, status='valid')
                    qualifications = [{'type': l.license_type, 'level': l.level} for l in licenses]
                except (StaffProfile.DoesNotExist, AttributeError):
                    pass

                role_display = ''
                if hasattr(u, 'security_roles') and u.security_roles:
                    role_display = u.security_roles[0] if isinstance(u.security_roles, list) and u.security_roles else ''

                resources.append({
                    'id': f'staff_{u.id}',
                    'title': f"{u.first_name} {u.last_name}".strip() or u.username,
                    'role': role_display,
                    'avatar': getattr(getattr(u, 'profile', None), 'profile_image_url', None) or '',
                    'qualifications': qualifications,
                    'weeklyHours': float(weekly_hours),
                    'type': 'staff',
                })

            # Add an "Unassigned" resource for open shifts
            resources.append({
                'id': 'staff_unassigned',
                'title': 'Open Shifts',
                'role': '',
                'avatar': '',
                'qualifications': [],
                'weeklyHours': 0,
                'type': 'unassigned',
            })

        # Build events
        events = []
        for shift in shifts_qs:
            if group_by == 'venue':
                resource_id = f'venue_{shift.venue_id}'
            else:
                resource_id = f'staff_{shift.staff_user_id}' if shift.staff_user_id else 'staff_unassigned'

            staff_name = ''
            if shift.staff_user:
                staff_name = f"{shift.staff_user.first_name} {shift.staff_user.last_name}".strip()

            events.append({
                'id': shift.id,
                'resourceId': resource_id,
                'title': f"{shift.venue.name}" if shift.venue else 'Unknown Venue',
                'start': shift.start_time.isoformat(),
                'end': shift.end_time.isoformat() if shift.end_time else None,
                'extendedProps': {
                    'shiftId': shift.id,
                    'venueId': shift.venue_id,
                    'venueName': shift.venue.name if shift.venue else '',
                    'staffId': shift.staff_user_id,
                    'staffName': staff_name,
                    'status': shift.status,
                    'isPublished': shift.is_published,
                    'hourlyRate': float(shift.hourly_rate) if shift.hourly_rate else None,
                    'isSpecialEvent': shift.is_special_event,
                    'billRate': str(shift.bill_rate) if shift.bill_rate else None,
                    'breakDuration': shift.break_duration,
                    'requiredRole': shift.required_security_role,
                    'notes': shift.notes,
                    'shiftGroup': shift.shift_group,
                    # Effective times honour TimeAdjustment overrides so a manager
                    # attesting presence makes the coverage banner / calendar
                    # treat the shift as checked-in.
                    'checkInTime': (
                        shift.get_effective_check_in_time().isoformat()
                        if shift.get_effective_check_in_time() else None
                    ),
                    'checkOutTime': (
                        shift.get_effective_check_out_time().isoformat()
                        if shift.get_effective_check_out_time() else None
                    ),
                },
            })

        # Build schedule-level warnings
        schedule_warnings = []
        # Check each staff member for overtime in the displayed range
        if group_by == 'staff':
            from api.models import WorkingHoursRegulation
            regulation = WorkingHoursRegulation.objects.filter(is_active=True).first()
            if regulation:
                staff_hours = {}
                for shift in shifts_qs:
                    if shift.staff_user_id and shift.end_time:
                        hours = (shift.end_time - shift.start_time).total_seconds() / 3600
                        staff_hours.setdefault(shift.staff_user_id, {'name': '', 'hours': 0})
                        staff_hours[shift.staff_user_id]['hours'] += hours
                        if shift.staff_user:
                            staff_hours[shift.staff_user_id]['name'] = f"{shift.staff_user.first_name} {shift.staff_user.last_name}".strip()

                for uid, data in staff_hours.items():
                    if data['hours'] > float(regulation.max_weekly_hours):
                        schedule_warnings.append({
                            'staffId': uid,
                            'type': 'overtime',
                            'message': f"{data['name']}: {data['hours']:.1f}h scheduled (max {regulation.max_weekly_hours}h)",
                            'severity': 'error'
                        })
                    elif regulation.overtime_threshold_hours and data['hours'] > float(regulation.overtime_threshold_hours):
                        schedule_warnings.append({
                            'staffId': uid,
                            'type': 'overtime',
                            'message': f"{data['name']}: {data['hours']:.1f}h scheduled (overtime threshold: {regulation.overtime_threshold_hours}h)",
                            'severity': 'warning'
                        })

        return Response({
            'resources': resources,
            'events': events,
            'warnings': schedule_warnings,
        })

    @action(detail=False, methods=['post'], url_path='validate')
    def validate_shift(self, request):
        """
        Pre-flight validation for a proposed shift. Returns errors and warnings
        without creating anything.
        """
        from api.utils.shift_validators import validate_shift_warnings
        from django.contrib.auth import get_user_model

        if not request.user.role in ['manager', 'admin']:
            return Response({"detail": "Manager or admin permissions required"}, status=status.HTTP_403_FORBIDDEN)

        staff_user_id = request.data.get('staff_user')
        venue_id = request.data.get('venue')
        start_time_str = request.data.get('start_time')
        end_time_str = request.data.get('end_time')
        required_role = request.data.get('required_security_role')
        exclude_shift_id = request.data.get('exclude_shift_id')

        if not start_time_str or not end_time_str:
            return Response({"detail": "start_time and end_time are required"}, status=status.HTTP_400_BAD_REQUEST)

        from datetime import datetime as dt
        try:
            start_time = dt.fromisoformat(start_time_str.replace('Z', '+00:00'))
            end_time = dt.fromisoformat(end_time_str.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            return Response({"detail": "Invalid date format"}, status=status.HTTP_400_BAD_REQUEST)

        if start_time >= end_time:
            return Response({
                'valid': False,
                'errors': [{'type': 'invalid_time', 'message': 'Start time must be before end time'}],
                'warnings': [],
            })

        staff_user = None
        if staff_user_id:
            User = get_user_model()
            try:
                staff_user = User.objects.get(id=staff_user_id)
            except User.DoesNotExist:
                return Response({"detail": "Staff user not found"}, status=status.HTTP_404_NOT_FOUND)

        result = validate_shift_warnings(
            staff_user=staff_user,
            start_time=start_time,
            end_time=end_time,
            venue=venue_id,
            required_role=required_role,
            exclude_shift_id=exclude_shift_id,
        )

        return Response(result)

    @action(detail=False, methods=['patch'], url_path='bulk_update')
    def bulk_update(self, request):
        """
        Batch update shifts for drag-and-drop operations (reassign, resize, move).
        Validates each shift and applies atomically.
        """
        from api.utils.shift_validators import validate_shift_warnings
        from api.models import AuditLog
        from django.db import transaction

        if not request.user.role in ['manager', 'admin']:
            return Response({"detail": "Manager or admin permissions required"}, status=status.HTTP_403_FORBIDDEN)

        updates = request.data.get('updates', [])
        if not updates:
            return Response({"detail": "No updates provided"}, status=status.HTTP_400_BAD_REQUEST)

        if len(updates) > 50:
            return Response({"detail": "Maximum 50 updates per request"}, status=status.HTTP_400_BAD_REQUEST)

        # Validate all first
        errors = []
        validated = []
        base_qs = self.get_queryset()

        for update in updates:
            shift_id = update.get('id')
            if not shift_id:
                errors.append({'id': None, 'errors': [{'type': 'missing_id', 'message': 'Shift ID is required'}]})
                continue

            try:
                shift = base_qs.get(id=shift_id)
            except Shift.DoesNotExist:
                errors.append({'id': shift_id, 'errors': [{'type': 'not_found', 'message': f'Shift {shift_id} not found'}]})
                continue

            # Parse update fields
            new_staff_id = update.get('staff_user', shift.staff_user_id)
            new_venue_id = update.get('venue', shift.venue_id)
            new_start_str = update.get('start_time')
            new_end_str = update.get('end_time')

            from datetime import datetime as dt
            new_start = dt.fromisoformat(new_start_str.replace('Z', '+00:00')) if new_start_str else shift.start_time
            new_end = dt.fromisoformat(new_end_str.replace('Z', '+00:00')) if new_end_str else shift.end_time

            # Validate
            if new_staff_id:
                from django.contrib.auth import get_user_model
                User = get_user_model()
                try:
                    staff = User.objects.get(id=new_staff_id)
                except User.DoesNotExist:
                    errors.append({'id': shift_id, 'errors': [{'type': 'staff_not_found', 'message': f'Staff {new_staff_id} not found'}]})
                    continue

                result = validate_shift_warnings(
                    staff_user=staff,
                    start_time=new_start,
                    end_time=new_end,
                    venue=new_venue_id,
                    required_role=shift.required_security_role,
                    exclude_shift_id=shift_id,
                )
                if not result['valid']:
                    errors.append({'id': shift_id, 'errors': result['errors']})
                    continue

            validated.append({
                'shift': shift,
                'staff_user_id': new_staff_id,
                'venue_id': new_venue_id,
                'start_time': new_start,
                'end_time': new_end,
                'original': {
                    'staff_user_id': shift.staff_user_id,
                    'venue_id': shift.venue_id,
                    'start_time': shift.start_time,
                    'end_time': shift.end_time,
                },
            })

        if errors:
            return Response({'updated': [], 'errors': errors}, status=status.HTTP_400_BAD_REQUEST)

        # Apply atomically
        updated = []
        company = getattr(request, 'current_company', None)

        try:
            with transaction.atomic():
                for item in validated:
                    shift = item['shift']
                    shift.staff_user_id = item['staff_user_id']
                    shift.venue_id = item['venue_id']
                    shift.start_time = item['start_time']
                    shift.end_time = item['end_time']
                    shift.save(update_fields=['staff_user_id', 'venue_id', 'start_time', 'end_time', 'updated_at'])

                    # Audit log
                    AuditLog.objects.create(
                        user=request.user,
                        company=company,
                        action='update',
                        resource_type='shift',
                        resource_id=str(shift.id),
                        details={
                            'action': 'scheduler_bulk_update',
                            'original': {
                                'staff_user_id': item['original']['staff_user_id'],
                                'venue_id': item['original']['venue_id'],
                                'start_time': item['original']['start_time'].isoformat(),
                                'end_time': item['original']['end_time'].isoformat() if item['original']['end_time'] else None,
                            },
                            'updated': {
                                'staff_user_id': item['staff_user_id'],
                                'venue_id': item['venue_id'],
                                'start_time': item['start_time'].isoformat(),
                                'end_time': item['end_time'].isoformat() if item['end_time'] else None,
                            },
                        },
                        ip_address=request.META.get('REMOTE_ADDR'),
                        user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
                    )

                    updated.append({
                        'id': shift.id,
                        'staff_user': shift.staff_user_id,
                        'venue': shift.venue_id,
                        'start_time': shift.start_time.isoformat(),
                        'end_time': shift.end_time.isoformat() if shift.end_time else None,
                    })
        except Exception as e:
            return Response(
                {'detail': f'Bulk update failed: {str(e)}', 'updated': [], 'errors': []},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({'updated': updated, 'errors': []})

    @action(detail=False, methods=['post'], url_path='publish')
    def publish_shifts(self, request):
        """
        Batch publish draft shifts. Sets is_published=True and creates notifications
        for assigned staff.
        """
        from api.models import AuditLog, Notification
        from api.services import push_notification_service
        from django.db import transaction

        if not request.user.role in ['manager', 'admin']:
            return Response({"detail": "Manager or admin permissions required"}, status=status.HTTP_403_FORBIDDEN)

        shift_ids = request.data.get('shift_ids', [])
        date_range = request.data.get('date_range')
        venue_ids = request.data.get('venue_ids', [])

        base_qs = self.get_queryset().filter(is_published=False)

        if shift_ids:
            shifts_to_publish = base_qs.filter(id__in=shift_ids)
        elif date_range:
            from datetime import datetime as dt
            try:
                range_start = dt.fromisoformat(date_range['start'].replace('Z', '+00:00'))
                range_end = dt.fromisoformat(date_range['end'].replace('Z', '+00:00'))
            except (ValueError, KeyError):
                return Response({"detail": "Invalid date_range format"}, status=status.HTTP_400_BAD_REQUEST)
            shifts_to_publish = base_qs.filter(start_time__gte=range_start, start_time__lt=range_end)
            if venue_ids:
                shifts_to_publish = shifts_to_publish.filter(venue_id__in=venue_ids)
        else:
            return Response({"detail": "Provide shift_ids or date_range"}, status=status.HTTP_400_BAD_REQUEST)

        company = getattr(request, 'current_company', None)
        published_count = 0
        notifications_sent = 0

        try:
            with transaction.atomic():
                shifts = list(shifts_to_publish.select_related('venue', 'staff_user'))
                for shift in shifts:
                    shift.is_published = True
                    shift.save(update_fields=['is_published', 'updated_at'])
                    published_count += 1

                    # Notify assigned staff (in-app + push). The post_save
                    # signal won't fire an assignment push here — staff_user
                    # didn't change on this save — so we trigger it directly.
                    if shift.staff_user:
                        Notification.objects.create(
                            user=shift.staff_user,
                            company=company,
                            notification_type='shift_assigned',
                            title='Shift Published',
                            message=f"You have been assigned a shift at {shift.venue.name if shift.venue else 'Unknown'} "
                                    f"on {shift.start_time.strftime('%a %d %b')} "
                                    f"{shift.start_time.strftime('%H:%M')}-{shift.end_time.strftime('%H:%M') if shift.end_time else 'TBD'}",
                            priority='normal',
                            related_type='shift',
                            related_id=str(shift.id),
                            action_url=f'/shifts/{shift.id}',
                        )
                        notifications_sent += 1
                        try:
                            push_notification_service.send_shift_assignment_notification(
                                user_id=shift.staff_user_id,
                                shift_id=shift.id,
                                venue_name=shift.venue.name if shift.venue else 'Unknown Venue',
                                start_time=shift.start_time.strftime('%I:%M %p'),
                                formatted_date=shift.start_time.strftime('%B %d, %Y'),
                            )
                        except Exception:
                            # Don't fail the publish if push delivery fails — the
                            # in-app Notification is already recorded above.
                            pass

                    # Audit log
                    AuditLog.objects.create(
                        user=request.user,
                        company=company,
                        action='status_change',
                        resource_type='shift',
                        resource_id=str(shift.id),
                        details={'action': 'publish', 'staff_user_id': shift.staff_user_id},
                        ip_address=request.META.get('REMOTE_ADDR'),
                        user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
                    )
        except Exception as e:
            return Response(
                {'detail': f'Publish failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({
            'published': published_count,
            'notifications_sent': notifications_sent,
        })

    @action(detail=False, methods=['get'], url_path='schedule_health')
    def schedule_health(self, request):
        """
        Summary statistics for the visible date range — used by the scheduler health bar.
        """
        from api.models import WorkingHoursRegulation
        from api.utils.shift_validators import check_shift_overlap
        from decimal import Decimal

        if not request.user.role in ['manager', 'admin']:
            return Response({"detail": "Manager or admin permissions required"}, status=status.HTTP_403_FORBIDDEN)

        start = request.query_params.get('start')
        end = request.query_params.get('end')
        venue_ids = request.query_params.getlist('venue_ids[]', request.query_params.getlist('venue_ids'))

        if not start or not end:
            return Response({"detail": "start and end required"}, status=status.HTTP_400_BAD_REQUEST)

        from datetime import datetime as dt
        try:
            start_dt = dt.fromisoformat(start.replace('Z', '+00:00'))
            end_dt = dt.fromisoformat(end.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            return Response({"detail": "Invalid date format"}, status=status.HTTP_400_BAD_REQUEST)

        shifts_qs = self.get_queryset().filter(
            start_time__lt=end_dt,
            end_time__gt=start_dt,
        ).exclude(status='cancelled')

        if venue_ids:
            shifts_qs = shifts_qs.filter(venue_id__in=venue_ids)

        total = shifts_qs.count()
        draft = shifts_qs.filter(is_published=False).count()
        published = shifts_qs.filter(is_published=True).count()
        open_shifts = shifts_qs.filter(staff_user__isnull=True).count()

        # Calculate total hours and estimated cost
        total_hours = Decimal('0')
        estimated_cost = Decimal('0')
        for s in shifts_qs:
            if s.end_time:
                hours = Decimal(str(round((s.end_time - s.start_time).total_seconds() / 3600, 2)))
                total_hours += hours
                if s.hourly_rate:
                    estimated_cost += hours * s.hourly_rate

        # Count conflicts (overlapping shifts per staff)
        conflicts = 0
        staff_shifts = {}
        for s in shifts_qs.filter(staff_user__isnull=False):
            staff_shifts.setdefault(s.staff_user_id, []).append(s)

        for uid, user_shifts in staff_shifts.items():
            user_shifts.sort(key=lambda x: x.start_time)
            for i in range(len(user_shifts) - 1):
                if user_shifts[i].end_time and user_shifts[i].end_time > user_shifts[i + 1].start_time:
                    conflicts += 1

        # Overtime warnings
        overtime_warnings = 0
        regulation = WorkingHoursRegulation.objects.filter(is_active=True).first()
        if regulation:
            for uid, user_shifts in staff_shifts.items():
                hours = sum(
                    (s.end_time - s.start_time).total_seconds() / 3600
                    for s in user_shifts if s.end_time
                )
                if hours > float(regulation.max_weekly_hours):
                    overtime_warnings += 1

        return Response({
            'totalShifts': total,
            'draftShifts': draft,
            'publishedShifts': published,
            'openShifts': open_shifts,
            'conflicts': conflicts,
            'overtimeWarnings': overtime_warnings,
            'totalHours': float(total_hours),
            'estimatedCost': float(estimated_cost),
        })


class FrontendShiftViewSet(viewsets.ModelViewSet):
    """
    ViewSet for viewing and editing Shifts with camelCase fields
    for frontend compatibility.
    """
    queryset = Shift.objects.all().order_by('-start_time')
    serializer_class = FrontendShiftSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ShiftFilter
    search_fields = ['venue__name', 'staff_user__first_name', 'staff_user__last_name', 'notes']
    ordering_fields = ['start_time', 'end_time', 'venue__name', 'status']
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return FrontendShiftDetailSerializer
        return FrontendShiftSerializer

    def perform_create(self, serializer):
        # Check if this is a copy operation that should allow past dates
        allow_past_dates = self.request.data.get('allow_past_dates', False)
        serializer.context['allow_past_dates'] = allow_past_dates
        serializer.save()

    @action(detail=True, methods=['post'])
    def checkIn(self, request, pk=None):
        """Frontend-compatible check-in with location verification, signature, and photo"""
        shift = self.get_object()
        
        # Verify the user is assigned to this shift
        if shift.staff_user != request.user:
            return Response(
                {"error": "You are not assigned to this shift"}, 
                status=status.HTTP_403_FORBIDDEN
            )
            
        # Check if the shift is already checked in
        if shift.check_in_time:
            return Response(
                {"error": "Shift already checked in"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Get location, signature, and photo from request
        latitude = request.data.get('latitude')
        longitude = request.data.get('longitude')
        signature = request.data.get('signature')
        photo = request.data.get('photo')
        
        # Validate required parameters
        if not latitude or not longitude:
            return Response(
                {"error": "Latitude and longitude are required for check-in"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            # Use the advanced model method for check-in
            shift.check_in(
                latitude=float(latitude),
                longitude=float(longitude),
                signature=signature,
                photo=photo
            )
            
            serializer = self.get_serializer(shift)
            return Response({
                "message": "Successfully checked in",
                "shift": serializer.data
            })
            
        except ValueError as e:
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"error": f"Check-in failed: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def checkOut(self, request, pk=None):
        """Frontend-compatible check-out with location verification, signature, and photo"""
        shift = self.get_object()
        
        # Verify the user is assigned to this shift
        if shift.staff_user != request.user:
            return Response(
                {"error": "You are not assigned to this shift"}, 
                status=status.HTTP_403_FORBIDDEN
            )
            
        # Check if the shift is not checked in
        if not shift.check_in_time:
            return Response(
                {"error": "Shift not checked in yet"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Check if the shift is already checked out
        if shift.check_out_time:
            return Response(
                {"error": "Shift already checked out"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Get location, signature, and photo from request
        latitude = request.data.get('latitude')
        longitude = request.data.get('longitude')
        signature = request.data.get('signature')
        photo = request.data.get('photo')
        
        # Validate required parameters
        if not latitude or not longitude:
            return Response(
                {"error": "Latitude and longitude are required for check-out"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            # Use the advanced model method for check-out
            shift.check_out(
                latitude=float(latitude),
                longitude=float(longitude),
                signature=signature,
                photo=photo
            )
            
            serializer = self.get_serializer(shift)
            return Response({
                "message": "Successfully checked out",
                "shift": serializer.data
            })
            
        except ValueError as e:
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"error": f"Check-out failed: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        shift = self.get_object()
        shift.status = 'cancelled'
        shift.save()
        
        serializer = self.get_serializer(shift)
        return Response(serializer.data)

 