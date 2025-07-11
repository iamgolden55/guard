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