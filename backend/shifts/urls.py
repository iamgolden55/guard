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

    # Frontend-friendly attendance endpoints (camelCase for the React client).
    # These two are the only routes the web app calls, and they are the only
    # ones this shim exposes. It used to carry a full ModelViewSet's CRUD —
    # list/create/retrieve/update/destroy/cancel over an unscoped
    # `Shift.objects.all()` — which let any authenticated account read, edit,
    # cancel or delete any shift in any company. Nothing consumed those routes;
    # they arrived free with `ModelViewSet` and were never considered. Use the
    # snake_case `ShiftViewSet` above for shift CRUD — it is company-scoped and
    # role-gated.
    path('frontend/<int:pk>/checkIn/', FrontendShiftViewSet.as_view({
        'post': 'checkIn'
    }), name='frontend-shift-checkin'),
    path('frontend/<int:pk>/checkOut/', FrontendShiftViewSet.as_view({
        'post': 'checkOut'
    }), name='frontend-shift-checkout'),
]
