"""
Incident reports on a database that kept migration 0035's columns.

Production has sixteen columns on `incident_reports` that 0036 should have
removed; eight are NOT NULL with no default, so every IncidentReport insert
failed and no report was ever saved. Migration 0079 drops those NOT NULL
constraints. These tests rebuild the drift in the test database and pin that
an incident saves afterwards, and that the migration is a no-op without it.
"""
import importlib
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, transaction
from django.test import TestCase
from django.utils import timezone

from api.models import IncidentReport, SecurityCompany, Shift, Venue

User = get_user_model()
relax = importlib.import_module('api.migrations.0079_relax_orphan_incident_report_columns')

# As found in production (information_schema), minus the nullable ones.
DRIFT_COLUMNS = {
    'ambulance_called': 'boolean', 'incident_type': 'varchar(50)',
    'persons_involved': 'jsonb', 'photos': 'jsonb', 'police_notified': 'boolean',
    'reported_at': 'timestamptz', 'status': 'varchar(20)', 'videos': 'jsonb',
    'witnesses': 'jsonb',
}


class IncidentSchemaDriftTests(TestCase):
    def setUp(self):
        company = SecurityCompany.objects.create(name='Drift Co', registration_number='D1')
        self.venue = Venue.objects.create(
            company=company, name='V', address='1 St', city='London', postal_code='E1',
            country='UK', capacity=10, contact_name='C', contact_phone='07700900000',
            contact_email='c@v.test', terms_and_conditions='T',
        )
        self.user = User.objects.create_user(username='drift', email='d@t.test', password='testpass123')
        start = timezone.now()
        self.shift = Shift.objects.create(
            staff_user=self.user, venue=self.venue, start_time=start,
            end_time=start + timedelta(hours=8), required_security_role='ds', status='scheduled',
        )

    def _report(self):
        return IncidentReport.objects.create(
            venue=self.venue, reported_by=self.user, shift=self.shift,
            incident_time=timezone.now(), description='d', severity='low', actions_taken='a',
        )

    def _add_drift(self):
        with connection.cursor() as c:
            for col, typ in DRIFT_COLUMNS.items():
                c.execute(f'ALTER TABLE incident_reports ADD COLUMN {col} {typ} NOT NULL')

    def _relax(self):
        with connection.cursor() as c:
            c.execute(relax.RELAX_SQL)

    def test_drifted_table_rejects_inserts_until_relaxed(self):
        self._add_drift()
        with self.assertRaises(IntegrityError), transaction.atomic():
            self._report()
        self._relax()
        self.assertTrue(IncidentReport.objects.filter(pk=self._report().pk).exists())

    def test_relax_is_a_no_op_on_a_correct_schema(self):
        self._relax()
        self._report()
        with connection.cursor() as c:
            c.execute("SELECT count(*) FROM information_schema.columns WHERE table_name='incident_reports'")
            self.assertEqual(c.fetchone()[0], len(IncidentReport._meta.concrete_fields))
