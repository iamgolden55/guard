from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
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
            # Regular staff can only see their own shifts
            return Shift.objects.filter(staff_user=self.request.user).order_by('-start_time')

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
        serializer.save()

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

        shifts = self.queryset.filter(staff_user=request.user)

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
        
        return Response(shift_data)

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

    @action(detail=True, methods=['post'], url_path='adjust_time')
    def adjust_time(self, request, pk=None):
        """
        Create a time adjustment for a shift.

        Allows managers/admins to correct shift check-in/check-out times when staff
        were present on time but signed in late due to technical issues.

        Requires:
        - adjusted_check_in_time (optional): Corrected check-in time
        - adjusted_check_out_time (optional): Corrected check-out time
        - adjusted_actual_hours: Corrected actual hours worked
        - reason: Explanation for the adjustment (required)
        - manager_signature: Base64 encoded signature image (required)

        Returns payment impact details and invoice update status.
        """
        from api.models import TimeAdjustment, InvoiceItem
        from api.serializers import TimeAdjustmentSerializer
        from decimal import Decimal

        # Check permissions - only managers and admins can adjust times
        if request.user.role not in ['manager', 'admin']:
            return Response(
                {'detail': 'Only managers and admins can adjust shift times'},
                status=status.HTTP_403_FORBIDDEN
            )

        shift = self.get_object()

        # Prepare data for TimeAdjustment
        adjustment_data = {
            'shift': shift.id,
            'adjusted_check_in_time': request.data.get('adjusted_check_in_time'),
            'adjusted_check_out_time': request.data.get('adjusted_check_out_time'),
            'adjusted_actual_hours': request.data.get('adjusted_actual_hours'),
            'reason': request.data.get('reason'),
            'manager_signature': request.data.get('manager_signature'),
        }

        # Create serializer and validate
        serializer = TimeAdjustmentSerializer(data=adjustment_data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Save the adjustment (this will trigger the signal to auto-update invoice)
        adjustment = serializer.save(adjusted_by=request.user)

        # Check if this shift has an invoice
        invoice_updated = False
        invoice_id = None
        try:
            invoice_item = InvoiceItem.objects.select_related('invoice').get(shift=shift)
            invoice_updated = True
            invoice_id = invoice_item.invoice.id
        except InvoiceItem.DoesNotExist:
            pass

        # Prepare response with payment impact
        response_data = {
            'id': adjustment.id,
            'shift': shift.id,
            'original_hours': float(adjustment.original_actual_hours or Decimal('0.00')),
            'adjusted_hours': float(adjustment.adjusted_actual_hours or Decimal('0.00')),
            'payment_impact': serializer.data.get('payment_impact', {}),
            'invoice_updated': invoice_updated,
            'invoice_id': invoice_id,
            'created_at': adjustment.created_at.isoformat(),
        }

        return Response(response_data, status=status.HTTP_201_CREATED)

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

 