"""
Would we know? — AUDIT-2026-09-17, Phase 2D.

- The only health check answered 200 whatever state Postgres and Redis were
  in. Liveness stays that way (Render restarts on it); readiness is new and
  can fail.
- Payroll runs are beat jobs. If beat or the worker is down, nobody is paid
  and nothing says so. A daily check now looks for the runs themselves.
- Settings that make production unsafe, or leave it unmonitored, are reported
  by `manage.py check`, which the Render build runs through `migrate`.
"""
from datetime import date, timedelta
from unittest import mock

from django.core.checks import Error, Warning
from django.test import TestCase, override_settings
from django.utils import timezone

from api.checks import production_settings
from api.models import PayrollRun, SecurityCompany
from api.tasks import check_payroll_runs_exist, expected_payroll_periods


class HealthTests(TestCase):
    def test_liveness_does_not_touch_dependencies(self):
        with mock.patch("core.health._check_redis", side_effect=ConnectionError), \
                mock.patch("core.health._check_database", side_effect=ConnectionError):
            response = self.client.get("/api/v1/health/")
        self.assertEqual(response.status_code, 200)

    def test_readiness_passes_when_both_answer(self):
        with mock.patch("core.health._check_redis"):
            response = self.client.get("/api/v1/health/ready/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ready", "checks": {"database": "ok", "redis": "ok"}})

    def test_readiness_fails_when_redis_is_down(self):
        with mock.patch("core.health.CHECKS", {
            "database": lambda: None,
            "redis": mock.Mock(side_effect=ConnectionError("redis://user:secret@host")),
        }):
            response = self.client.get("/api/v1/health/ready/")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["checks"]["redis"], "failed")
        self.assertNotIn("secret", response.content.decode())


class PayrollRunWatchTests(TestCase):
    TODAY = date(2026, 9, 16)  # a Wednesday

    def setUp(self):
        self.company = SecurityCompany.objects.create(name="Watch Co", registration_number="WATCH1")
        SecurityCompany.objects.filter(pk=self.company.pk).update(
            created_at=timezone.now() - timedelta(days=400),
        )

    def _run(self):
        with mock.patch("api.tasks.timezone.localdate", return_value=self.TODAY):
            return check_payroll_runs_exist()

    def _create_expected_runs(self):
        for params in expected_payroll_periods(self.TODAY):
            PayrollRun.objects.create(
                company=self.company, cycle=params["cycle"], run_code=params["run_code"],
                label=params["label"], period_start=params["period_start"],
                period_end=params["period_end"], process_date=params["process_date"],
            )

    def test_expected_periods_are_last_week_and_last_month(self):
        weekly, monthly = expected_payroll_periods(self.TODAY)
        self.assertEqual((weekly["period_start"], weekly["period_end"]), (date(2026, 9, 7), date(2026, 9, 13)))
        self.assertEqual((monthly["period_start"], monthly["period_end"]), (date(2026, 8, 1), date(2026, 8, 31)))

    def test_a_missing_run_is_reported_as_an_error(self):
        with self.assertLogs("api.tasks", level="ERROR") as logs:
            result = self._run()

        self.assertEqual(
            sorted(m["run_code"] for m in result["missing"]),
            sorted(p["run_code"] for p in expected_payroll_periods(self.TODAY)),
        )
        self.assertIn("Watch Co", logs.output[0])

    def test_nothing_is_reported_when_the_runs_exist(self):
        self._create_expected_runs()
        self.assertEqual(self._run()["missing"], [])

    def test_a_company_created_after_the_period_is_not_owed_a_run(self):
        self._create_expected_runs()
        SecurityCompany.objects.create(name="New Co", registration_number="NEW1")  # created today, after both periods
        self.assertEqual(self._run()["missing"], [])


class ProductionSettingsCheckTests(TestCase):
    def _ids(self):
        return {problem.id: type(problem) for problem in production_settings(None)}

    @override_settings(ON_RENDER=False, DEBUG=True, REGISTRATION_REQUIRES_INVITE=False, SENTRY_DSN="")
    def test_nothing_is_checked_off_render(self):
        self.assertEqual(production_settings(None), [])

    @override_settings(ON_RENDER=True, DEBUG=True, REGISTRATION_REQUIRES_INVITE=True,
                       SENTRY_DSN="https://x@sentry.test/1", MEDIA_STORAGE_IS_DURABLE=True)
    def test_debug_in_production_is_an_error(self):
        self.assertEqual(self._ids(), {"mead.E001": Error})

    @override_settings(ON_RENDER=True, DEBUG=False, REGISTRATION_REQUIRES_INVITE=False,
                       SENTRY_DSN="", MEDIA_STORAGE_IS_DURABLE=False)
    def test_judgement_calls_are_warnings(self):
        self.assertEqual(self._ids(), {"mead.W001": Warning, "mead.W002": Warning, "mead.W003": Warning})

    @override_settings(ON_RENDER=True, DEBUG=False, REGISTRATION_REQUIRES_INVITE=True,
                       SENTRY_DSN="https://x@sentry.test/1", MEDIA_STORAGE_IS_DURABLE=True)
    def test_a_correct_production_config_is_clean(self):
        self.assertEqual(production_settings(None), [])
