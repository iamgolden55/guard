from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from .models import Shift
from .serializers import (
    ShiftSerializer, 
    ShiftDetailSerializer,
    FrontendShiftSerializer,
    FrontendShiftDetailSerializer
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
        """Check in for a shift"""
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
            
        # Check if the shift is scheduled
        if shift.status != 'scheduled':
            return Response(
                {"detail": f"Cannot check in shift with status: {shift.status}"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Perform check in
        shift.check_in_time = datetime.now()
        shift.status = 'in_progress'
        shift.save()
        
        serializer = self.get_serializer(shift)
        return Response(serializer.data)
        
    @action(detail=True, methods=['post'])
    def check_out(self, request, pk=None):
        """Check out from a shift"""
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
            
        # Check if the shift is in progress
        if shift.status != 'in_progress':
            return Response(
                {"detail": f"Cannot check out shift with status: {shift.status}"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Perform check out
        shift.check_out_time = datetime.now()
        shift.status = 'completed'
        shift.save()
        
        serializer = self.get_serializer(shift)
        return Response(serializer.data)
        
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
            
        # Check if the shift is already canceled
        if shift.status == 'canceled':
            return Response(
                {"detail": "Shift already canceled"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Check if the shift is completed
        if shift.status == 'completed':
            return Response(
                {"detail": "Cannot cancel a completed shift"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Perform cancellation
        shift.canceled_time = datetime.now()
        shift.status = 'canceled'
        shift.save()
        
        serializer = self.get_serializer(shift)
        return Response(serializer.data)

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
        serializer.save()

    @action(detail=True, methods=['post'])
    def checkIn(self, request, pk=None):
        shift = self.get_object()
        if shift.check_in_time:
            return Response({'error': 'Shift already checked in'}, status=status.HTTP_400_BAD_REQUEST)
        
        shift.check_in_time = timezone.now()
        shift.status = 'active'
        shift.save()
        
        serializer = self.get_serializer(shift)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def checkOut(self, request, pk=None):
        shift = self.get_object()
        if not shift.check_in_time:
            return Response({'error': 'Shift not checked in yet'}, status=status.HTTP_400_BAD_REQUEST)
        if shift.check_out_time:
            return Response({'error': 'Shift already checked out'}, status=status.HTTP_400_BAD_REQUEST)
        
        shift.check_out_time = timezone.now()
        shift.status = 'completed'
        shift.save()
        
        serializer = self.get_serializer(shift)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        shift = self.get_object()
        shift.status = 'cancelled'
        shift.save()
        
        serializer = self.get_serializer(shift)
        return Response(serializer.data) 