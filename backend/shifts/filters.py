import django_filters
from django.db.models import Q
from .models import Shift

class ShiftFilter(django_filters.FilterSet):
    """Filter for Shift model"""
    venue = django_filters.CharFilter(field_name='venue__id')
    venue_name = django_filters.CharFilter(field_name='venue__name', lookup_expr='icontains')
    
    staff = django_filters.CharFilter(field_name='staff_user__id')
    staff_name = django_filters.CharFilter(method='filter_staff_name')
    
    status = django_filters.CharFilter(field_name='status')
    statuses = django_filters.CharFilter(method='filter_multiple_statuses')
    
    start_after = django_filters.IsoDateTimeFilter(field_name='start_time', lookup_expr='gte')
    start_before = django_filters.IsoDateTimeFilter(field_name='start_time', lookup_expr='lte')
    
    end_after = django_filters.IsoDateTimeFilter(field_name='end_time', lookup_expr='gte')
    end_before = django_filters.IsoDateTimeFilter(field_name='end_time', lookup_expr='lte')
    
    date = django_filters.DateFilter(field_name='start_time', lookup_expr='date')
    
    # CamelCase aliases for frontend
    venueId = django_filters.CharFilter(field_name='venue__id')
    venueName = django_filters.CharFilter(field_name='venue__name', lookup_expr='icontains')
    staffId = django_filters.CharFilter(field_name='staff_user__id')
    staffName = django_filters.CharFilter(method='filter_staff_name')
    startAfter = django_filters.IsoDateTimeFilter(field_name='start_time', lookup_expr='gte')
    startBefore = django_filters.IsoDateTimeFilter(field_name='start_time', lookup_expr='lte')
    endAfter = django_filters.IsoDateTimeFilter(field_name='end_time', lookup_expr='gte')
    endBefore = django_filters.IsoDateTimeFilter(field_name='end_time', lookup_expr='lte')
    
    class Meta:
        model = Shift
        fields = [
            'venue', 'venue_name', 'staff', 'staff_name', 
            'status', 'statuses', 'start_after', 'start_before',
            'end_after', 'end_before', 'date',
            # CamelCase aliases
            'venueId', 'venueName', 'staffId', 'staffName',
            'startAfter', 'startBefore', 'endAfter', 'endBefore',
        ]
    
    def filter_staff_name(self, queryset, name, value):
        """Filter shifts by staff name (first or last name)"""
        return queryset.filter(
            Q(staff_user__first_name__icontains=value) | 
            Q(staff_user__last_name__icontains=value)
        )
    
    def filter_multiple_statuses(self, queryset, name, value):
        """Filter shifts by multiple status values separated by commas"""
        if not value:
            return queryset
            
        statuses = [s.strip() for s in value.split(',')]
        return queryset.filter(status__in=statuses) 