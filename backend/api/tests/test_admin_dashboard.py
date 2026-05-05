"""Smoke tests for /api/v1/admin/dashboard/overview/."""
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from api.models import User


class AdminDashboardOverviewTests(TestCase):
    """Smoke tests for /api/v1/admin/dashboard/overview/."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username='dash_admin', email='dash_admin@example.com', password='pw123456'
        )
        self.admin.role = 'admin'
        self.admin.save()

        self.staff = User.objects.create_user(
            username='dash_staff', email='dash_staff@example.com', password='pw123456'
        )
        self.staff.role = 'staff'
        self.staff.save()

        self.url = reverse('admin-dashboard-overview')
        self.client = APIClient()

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_dashboard_overview_returns_all_sections(self):
        """Admin can fetch overview; response has every documented section."""
        self._login(self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        for key in (
            'kpis', 'pending_approvals', 'venue_coverage',
            'sia_compliance', 'live_activity', 'staff_roster',
            'coverage_heatmap',
        ):
            self.assertIn(key, data, f'missing section: {key}')

        # KPI shape
        self.assertIn('officers_on_shift', data['kpis'])
        self.assertIn('value', data['kpis']['officers_on_shift'])

        # Heatmap is 7×24
        self.assertEqual(len(data['coverage_heatmap']), 7)
        for row in data['coverage_heatmap']:
            self.assertEqual(len(row), 24)

        # SIA compliance counters present
        for key in ('valid', 'expiring_soon', 'expired', 'expiring_list'):
            self.assertIn(key, data['sia_compliance'])

    def test_dashboard_overview_rejects_staff(self):
        """Staff role gets 403."""
        self._login(self.staff)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_dashboard_overview_requires_auth(self):
        """Anonymous gets 401 or 403 depending on auth backend ordering."""
        response = self.client.get(self.url)
        self.assertIn(response.status_code, (
            status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN,
        ))
