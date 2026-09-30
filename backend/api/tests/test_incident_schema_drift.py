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
adopt_photos = importlib.import_module('api.migrations.0082_incident_report_photos')
ADOPT_PHOTOS_SQL = adopt_photos.Migration.operations[0].database_operations[0].sql


def _as_production(cursor, columns):
    """Give incident_reports production's leftover columns.

    `photos` is one of them, and is now also a model field (0082), so the test
    database has it already: drop it first, so it comes back as production has
    it (jsonb NOT NULL), not as 0082 would create it.
    """
    cursor.execute('ALTER TABLE incident_reports DROP COLUMN IF EXISTS photos')
    for col, (typ, null) in columns.items():
        cursor.execute(f'ALTER TABLE incident_reports ADD COLUMN {col} {typ} {null}')

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
            _as_production(c, {col: (typ, 'NOT NULL') for col, typ in DRIFT_COLUMNS.items()})

    def _relax(self):
        with connection.cursor() as c:
            c.execute(relax.RELAX_SQL)
            # Then 0082, which must adopt the existing `photos`, not fail on it.
            c.execute(ADOPT_PHOTOS_SQL)

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


# The other seven 0035 columns production kept. They are nullable, so they never
# blocked an insert, but the API test rebuilds the whole production table.
NULLABLE_DRIFT_COLUMNS = {
    'latitude': 'numeric(9,6)', 'longitude': 'numeric(9,6)',
    'location_description': 'varchar(255)', 'occurred_at': 'timestamptz',
    'police_reference': 'varchar(100)', 'title': 'varchar(200)',
    'voice_note': 'varchar(100)',
}


class IncidentApiOnDriftedTableTests(TestCase):
    """`POST /api/v1/incidents/` as it failed in production (Sentry PYTHON-DJANGO-1E).

    The request carried only the fields the model knows, so none of the sixteen
    orphan columns got a value, and `ambulance_called` (NOT NULL) raised
    IntegrityError and a 500. The ORM-level test above pins the constraint; this
    pins the endpoint an officer's report actually goes through.
    """

    def setUp(self):
        from rest_framework.test import APIClient
        from api.models import UserCompanyMembership

        company = SecurityCompany.objects.create(name='Riverside Co', registration_number='R1')
        self.company = company
        self.venue = Venue.objects.create(
            company=company, name='Riverside Exchange', address='1 St', city='Bristol',
            postal_code='BS1', country='UK', capacity=10, contact_name='C',
            contact_phone='07700900000', contact_email='r@v.test', terms_and_conditions='T',
        )
        self.officer = User.objects.create_user(
            username='riverside_officer', email='o@t.test', password='testpass123', role='staff',
        )
        UserCompanyMembership.objects.create(
            user=self.officer, company=company, is_active=True, role='staff',
        )
        start = timezone.now()
        self.shift = Shift.objects.create(
            staff_user=self.officer, venue=self.venue, start_time=start,
            end_time=start + timedelta(hours=8), required_security_role='ds', status='in_progress',
        )
        with connection.cursor() as c:
            _as_production(c, {
                col: (typ, 'NOT NULL' if col in DRIFT_COLUMNS else '')
                for col, typ in {**DRIFT_COLUMNS, **NULLABLE_DRIFT_COLUMNS}.items()
            })
            # What migrations 0079 and 0082 do in production.
            c.execute(relax.RELAX_SQL)
            c.execute(ADOPT_PHOTOS_SQL)
        self.client = APIClient()
        self.client.force_authenticate(self.officer)

    def test_the_production_request_saves(self):
        # The payload from the failed request, field for field.
        response = self.client.post('/api/v1/incidents/', {
            'venue': self.venue.id,
            'shift': self.shift.id,
            'incident_time': timezone.now().isoformat(),
            'description': 'Refused entry to intoxicated guest.',
            'severity': 'low',
            'actions_taken': 'Refused entry politely; guest left without incident.',
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        report = IncidentReport.objects.get(pk=response.data['id'])
        self.assertEqual(report.reported_by, self.officer)
        with connection.cursor() as c:
            c.execute(
                'SELECT ambulance_called, police_notified, status, title '
                'FROM incident_reports WHERE id = %s', [report.pk],
            )
            self.assertEqual(c.fetchone(), (None, None, None, None))

    def test_every_orphan_column_accepts_null(self):
        with connection.cursor() as c:
            c.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'incident_reports' AND is_nullable = 'NO'"
            )
            not_null = {row[0] for row in c.fetchall()}
        self.assertEqual(not_null & set(DRIFT_COLUMNS) | not_null & set(NULLABLE_DRIFT_COLUMNS), set())

    def test_a_report_with_photos_saves_in_the_adopted_column(self):
        # 0082 adopts production's leftover `photos` column rather than adding
        # one; a report's photos must land in it and read back.
        photo = (
            'https://mead-security-api.onrender.com/api/v1/evidence-photos/'
            f'{self.company.id}/{self.officer.id}/{"b" * 32}.jpg'
        )
        response = self.client.post('/api/v1/incidents/', {
            'venue': self.venue.id,
            'shift': self.shift.id,
            'incident_time': timezone.now().isoformat(),
            'description': 'Glass on the dance floor.',
            'severity': 'low',
            'photos': [photo],
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        with connection.cursor() as c:
            c.execute('SELECT photos FROM incident_reports WHERE id = %s', [response.data['id']])
            stored = c.fetchone()[0]
        self.assertEqual(stored if isinstance(stored, list) else __import__('json').loads(stored), [photo])
