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

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get upcoming shifts in the next 7 days"""
        now = datetime.now()
        end_date = now + timedelta(days=7)
        shifts = self.queryset.filter(
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
        """Get shifts for the current user"""
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication required"}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
            
        shifts = self.queryset.filter(staff_user=request.user)
        
        # Apply any additional filters from the filter backend
        shifts = self.filter_queryset(shifts)
        
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
        
        # Get all shifts with related data
        shifts = self.queryset.select_related('venue', 'staff_user').prefetch_related(
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
        
        # Get all venues or filter by venue_id
        venues_queryset = Venue.objects.all()
        if venue_id:
            venues_queryset = venues_queryset.filter(id=venue_id)
        
        compliance_data = []
        
        for venue in venues_queryset:
            # Get shifts for this venue within date range
            shifts_queryset = self.queryset.filter(venue=venue)
            
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
        
        # Get all venues or filter by venue_id
        venues_queryset = Venue.objects.all()
        if venue_id:
            venues_queryset = venues_queryset.filter(id=venue_id)
        
        safety_data = []
        
        for venue in venues_queryset:
            # Get shifts for this venue within date range
            shifts_queryset = self.queryset.filter(venue=venue)
            
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
        from django.contrib.auth.models import User
        
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
        
        # Get all staff users who have worked shifts
        staff_users = User.objects.filter(shift__isnull=False).distinct()
        
        performance_data = []
        
        for staff_user in staff_users:
            # Get shifts for this staff member within date range
            shifts_queryset = self.queryset.filter(staff_user=staff_user)
            
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
        shift_date = shift.start_time.date()
        current_date = now.date()
        
        # Restriction 1: Must be the same date
        if shift_date != current_date:
            if shift_date > current_date:
                days_diff = (shift_date - current_date).days
                return Response(
                    {"detail": f"Cannot check in {days_diff} day{'s' if days_diff > 1 else ''} early. You can only check in on the day of your shift ({shift_date.strftime('%B %d, %Y')})."}, 
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
        """Cancel a shift"""
        shift = self.get_object()
        
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
            
        # Perform cancellation
        shift.status = 'cancelled'  # Use the correct status choice
        shift.save()
        
        serializer = self.get_serializer(shift)
        return Response(serializer.data)

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