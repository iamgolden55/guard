"""
Minimum mobile build — AUDIT-2026-09-17, Phase 2F (server side).

Mobile builds can't be rolled back, so a build with a known defect keeps
running until the officer happens to update. The app sends `X-App-Platform`
and `X-App-Build`; below the configured minimum for its platform the API
answers 426 `app_update_required`, which the app turns into a blocking
"Update required" message.

Requests without the headers pass. That covers the web admin and builds from
before the gate existed. The older builds are the ones with the fake offline
queue, and a refusal is exactly what sends a check-in into it, so refusing
them would lose more check-ins than it saves.
"""
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

User = get_user_model()

URL = "/api/v1/users/me/"


@override_settings(MIN_APP_BUILD={"ios": 16, "android": 16})
class AppVersionGateTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="gate_officer", email="g@test.test", password="x", role="staff")
        self.client.force_authenticate(user=self.user)

    def _get(self, **headers):
        return self.client.get(URL, **{f"HTTP_{k}": v for k, v in headers.items()})

    def test_a_build_below_the_minimum_is_told_to_update(self):
        response = self._get(X_APP_PLATFORM="ios", X_APP_BUILD="15")

        self.assertEqual(response.status_code, 426)
        body = response.json()
        self.assertEqual(body["error"], "app_update_required")
        self.assertEqual(body["minimum_build"], 16)

    def test_the_minimum_itself_and_newer_builds_pass(self):
        for build in ("16", "17"):
            with self.subTest(build=build):
                self.assertNotEqual(self._get(X_APP_PLATFORM="android", X_APP_BUILD=build).status_code, 426)

    def test_each_platform_has_its_own_minimum(self):
        with self.settings(MIN_APP_BUILD={"ios": 20, "android": 10}):
            self.assertEqual(self._get(X_APP_PLATFORM="ios", X_APP_BUILD="15").status_code, 426)
            self.assertNotEqual(self._get(X_APP_PLATFORM="android", X_APP_BUILD="15").status_code, 426)

    def test_requests_without_the_headers_pass(self):
        """The web admin, and builds from before the gate."""
        self.assertNotEqual(self._get().status_code, 426)

    def test_an_unreadable_build_number_is_not_refused(self):
        self.assertNotEqual(self._get(X_APP_PLATFORM="ios", X_APP_BUILD="dev").status_code, 426)

    def test_the_health_checks_are_never_gated(self):
        response = self.client.get("/api/v1/health/", HTTP_X_APP_PLATFORM="ios", HTTP_X_APP_BUILD="1")
        self.assertEqual(response.status_code, 200)


class GateOffByDefaultTests(APITestCase):
    def test_no_minimum_configured_refuses_nothing(self):
        user = User.objects.create_user(username="gate_off", email="o@test.test", password="x", role="staff")
        self.client.force_authenticate(user=user)
        response = self.client.get(URL, HTTP_X_APP_PLATFORM="ios", HTTP_X_APP_BUILD="1")
        self.assertNotEqual(response.status_code, 426)
