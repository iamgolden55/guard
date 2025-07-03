from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ShiftViewSet, FrontendShiftViewSet

# Create router for shift-related endpoints
router = DefaultRouter()

# Register the consolidated shift viewset
router.register('', ShiftViewSet, basename='shift')

urlpatterns = [
    # Standard shift endpoints (snake_case for backend/API consumers)
    path('', include(router.urls)),
    
    # Frontend-friendly endpoints (camelCase for React frontend)
    path('frontend/', FrontendShiftViewSet.as_view({
        'get': 'list',
        'post': 'create'
    }), name='frontend-shifts-list'),
    path('frontend/<int:pk>/', FrontendShiftViewSet.as_view({
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy'
    }), name='frontend-shifts-detail'),
    
    # Custom actions for frontend viewset
    path('frontend/<int:pk>/checkIn/', FrontendShiftViewSet.as_view({
        'post': 'checkIn'
    }), name='frontend-shift-checkin'),
    path('frontend/<int:pk>/checkOut/', FrontendShiftViewSet.as_view({
        'post': 'checkOut'
    }), name='frontend-shift-checkout'),
    path('frontend/<int:pk>/cancel/', FrontendShiftViewSet.as_view({
        'post': 'cancel'
    }), name='frontend-shift-cancel'),
]