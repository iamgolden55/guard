#!/usr/bin/env python3
"""
Agent 1: API Authentication Tests
Comprehensive authentication and authorization testing for REST API
"""

import requests
import json
import time
from datetime import datetime, timedelta

# Configuration
BASE_URL = "http://localhost:8000"
API_BASE = f"{BASE_URL}/api/v1"

# Test credentials
TEST_USERS = {
    "admin": {"username": "admin_test", "password": "AdminPass123!"},
    "manager": {"username": "manager_test", "password": "ManagerPass123!"},
    "staff": {"username": "staff_test", "password": "StaffPass123!"},
    "inactive": {"username": "inactive_test", "password": "InactivePass123!"}
}

# Test results storage
test_results = []


class TestResult:
    def __init__(self, test_id, test_name, platform="API"):
        self.test_id = test_id
        self.test_name = test_name
        self.platform = platform
        self.status = "PENDING"
        self.notes = ""
        self.actual_response = None
        self.expected_behavior = ""
        self.timestamp = datetime.now()

    def pass_test(self, notes=""):
        self.status = "PASS"
        self.notes = notes
        print(f"✓ {self.test_id}: {self.test_name} - PASS")
        if notes:
            print(f"  → {notes}")

    def fail_test(self, notes=""):
        self.status = "FAIL"
        self.notes = notes
        print(f"✗ {self.test_id}: {self.test_name} - FAIL")
        if notes:
            print(f"  → {notes}")

    def skip_test(self, notes=""):
        self.status = "SKIP"
        self.notes = notes
        print(f"⊘ {self.test_id}: {self.test_name} - SKIP")
        if notes:
            print(f"  → {notes}")

    def to_dict(self):
        return {
            "test_id": self.test_id,
            "test_name": self.test_name,
            "platform": self.platform,
            "status": self.status,
            "notes": self.notes,
            "timestamp": self.timestamp.isoformat()
        }


def test_api_001_valid_login():
    """AUTH-API-001: Valid Login - POST /api/v1/login/ with valid credentials"""
    result = TestResult("AUTH-API-001", "Valid Login with Admin Credentials")
    result.expected_behavior = "Returns 200 with access and refresh tokens"

    try:
        response = requests.post(
            f"{API_BASE}/login/",
            json=TEST_USERS["admin"],
            headers={"Content-Type": "application/json"}
        )

        result.actual_response = response.json() if response.status_code == 200 else response.text

        if response.status_code == 200:
            data = response.json()
            if "access" in data and "refresh" in data:
                result.pass_test(f"Login successful. Tokens received. User: {data.get('user', {}).get('username', 'N/A')}")
                return result, data  # Return tokens for subsequent tests
            else:
                result.fail_test("Response missing 'access' or 'refresh' tokens")
        else:
            result.fail_test(f"Expected 200, got {response.status_code}: {response.text}")

    except Exception as e:
        result.fail_test(f"Exception: {str(e)}")

    test_results.append(result)
    return result, None


def test_api_002_invalid_username():
    """AUTH-API-002: Invalid Username - Test with non-existent user"""
    result = TestResult("AUTH-API-002", "Login with Invalid Username")
    result.expected_behavior = "Returns 401 Unauthorized with error message"

    try:
        response = requests.post(
            f"{API_BASE}/login/",
            json={"username": "nonexistent_user", "password": "SomePassword123!"},
            headers={"Content-Type": "application/json"}
        )

        if response.status_code == 401:
            result.pass_test("Correctly rejected invalid username")
        elif response.status_code == 400:
            result.pass_test("Correctly rejected invalid username with 400 Bad Request")
        else:
            result.fail_test(f"Expected 401, got {response.status_code}: {response.text}")

    except Exception as e:
        result.fail_test(f"Exception: {str(e)}")

    test_results.append(result)
    return result


def test_api_003_invalid_password():
    """AUTH-API-003: Invalid Password - Test with wrong password"""
    result = TestResult("AUTH-API-003", "Login with Invalid Password")
    result.expected_behavior = "Returns 401 Unauthorized"

    try:
        response = requests.post(
            f"{API_BASE}/login/",
            json={"username": TEST_USERS["admin"]["username"], "password": "WrongPassword123!"},
            headers={"Content-Type": "application/json"}
        )

        if response.status_code == 401:
            result.pass_test("Correctly rejected invalid password")
        elif response.status_code == 400:
            result.pass_test("Correctly rejected invalid password with 400 Bad Request")
        else:
            result.fail_test(f"Expected 401, got {response.status_code}: {response.text}")

    except Exception as e:
        result.fail_test(f"Exception: {str(e)}")

    test_results.append(result)
    return result


def test_api_004_empty_credentials():
    """AUTH-API-004: Empty Credentials - Test validation"""
    result = TestResult("AUTH-API-004", "Login with Empty Credentials")
    result.expected_behavior = "Returns 400 Bad Request with validation errors"

    try:
        response = requests.post(
            f"{API_BASE}/login/",
            json={"username": "", "password": ""},
            headers={"Content-Type": "application/json"}
        )

        if response.status_code in [400, 401]:
            result.pass_test(f"Correctly rejected empty credentials with {response.status_code}")
        else:
            result.fail_test(f"Expected 400/401, got {response.status_code}: {response.text}")

    except Exception as e:
        result.fail_test(f"Exception: {str(e)}")

    test_results.append(result)
    return result


def test_api_005_sql_injection():
    """AUTH-API-005: SQL Injection - Test with SQL injection attempts"""
    result = TestResult("AUTH-API-005", "SQL Injection Attempt")
    result.expected_behavior = "Returns 401/400, no SQL execution"

    try:
        sql_payloads = [
            "admin' OR '1'='1",
            "admin'--",
            "admin' OR 1=1--",
            "' OR '1'='1' --"
        ]

        all_safe = True
        for payload in sql_payloads:
            response = requests.post(
                f"{API_BASE}/login/",
                json={"username": payload, "password": "anything"},
                headers={"Content-Type": "application/json"}
            )

            if response.status_code == 200:
                all_safe = False
                result.fail_test(f"SQL injection successful with payload: {payload}")
                break

        if all_safe:
            result.pass_test("All SQL injection attempts safely rejected")

    except Exception as e:
        result.fail_test(f"Exception: {str(e)}")

    test_results.append(result)
    return result


def test_api_006_token_refresh(refresh_token):
    """AUTH-API-006: Token Refresh - POST /api/v1/token/refresh/ with valid refresh token"""
    result = TestResult("AUTH-API-006", "Token Refresh with Valid Refresh Token")
    result.expected_behavior = "Returns 200 with new access token"

    if not refresh_token:
        result.skip_test("No refresh token available from previous tests")
        test_results.append(result)
        return result

    try:
        response = requests.post(
            f"{API_BASE}/token/refresh/",
            json={"refresh": refresh_token},
            headers={"Content-Type": "application/json"}
        )

        if response.status_code == 200:
            data = response.json()
            if "access" in data:
                result.pass_test("Token refresh successful, new access token received")
                return result, data["access"]
            else:
                result.fail_test("Response missing 'access' token")
        else:
            result.fail_test(f"Expected 200, got {response.status_code}: {response.text}")

    except Exception as e:
        result.fail_test(f"Exception: {str(e)}")

    test_results.append(result)
    return result, None


def test_api_007_invalid_refresh_token():
    """AUTH-API-007: Invalid Refresh Token - Test with invalid token"""
    result = TestResult("AUTH-API-007", "Token Refresh with Invalid Token")
    result.expected_behavior = "Returns 401 Unauthorized"

    try:
        response = requests.post(
            f"{API_BASE}/token/refresh/",
            json={"refresh": "invalid.token.here"},
            headers={"Content-Type": "application/json"}
        )

        if response.status_code == 401:
            result.pass_test("Correctly rejected invalid refresh token")
        else:
            result.fail_test(f"Expected 401, got {response.status_code}: {response.text}")

    except Exception as e:
        result.fail_test(f"Exception: {str(e)}")

    test_results.append(result)
    return result


def test_api_008_protected_endpoint_access(access_token):
    """AUTH-API-008: Protected Endpoint Access - GET with valid token"""
    result = TestResult("AUTH-API-008", "Access Protected Endpoint with Valid Token")
    result.expected_behavior = "Returns 200 with requested data"

    if not access_token:
        result.skip_test("No access token available from previous tests")
        test_results.append(result)
        return result

    try:
        # Test accessing user profile endpoint
        response = requests.get(
            f"{API_BASE}/users/me/",
            headers={"Authorization": f"Bearer {access_token}"}
        )

        if response.status_code == 200:
            data = response.json()
            result.pass_test(f"Successfully accessed protected endpoint. User: {data.get('username', 'N/A')}")
        elif response.status_code == 404:
            # Try alternative endpoint
            response = requests.get(
                f"{API_BASE}/shifts/",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if response.status_code == 200:
                result.pass_test("Successfully accessed protected endpoint (shifts)")
            else:
                result.fail_test(f"Protected endpoint returned {response.status_code}: {response.text}")
        else:
            result.fail_test(f"Expected 200, got {response.status_code}: {response.text}")

    except Exception as e:
        result.fail_test(f"Exception: {str(e)}")

    test_results.append(result)
    return result


def test_api_009_no_token_access():
    """AUTH-API-009: No Token Access - Test 401 Unauthorized"""
    result = TestResult("AUTH-API-009", "Access Protected Endpoint without Token")
    result.expected_behavior = "Returns 401 Unauthorized"

    try:
        response = requests.get(f"{API_BASE}/shifts/")

        if response.status_code == 401:
            result.pass_test("Correctly rejected request without token")
        else:
            result.fail_test(f"Expected 401, got {response.status_code}: {response.text}")

    except Exception as e:
        result.fail_test(f"Exception: {str(e)}")

    test_results.append(result)
    return result


def test_api_010_expired_token_access():
    """AUTH-API-010: Expired Token Access - Test with expired access token"""
    result = TestResult("AUTH-API-010", "Access with Expired Token")
    result.expected_behavior = "Returns 401 Unauthorized"

    # Note: Creating a genuinely expired token requires waiting or token manipulation
    # For now, we'll test with a malformed token that simulates expiration
    try:
        expired_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1MTYyMzkwMjJ9.invalid"
        response = requests.get(
            f"{API_BASE}/shifts/",
            headers={"Authorization": f"Bearer {expired_token}"}
        )

        if response.status_code == 401:
            result.pass_test("Correctly rejected expired/invalid token")
        else:
            result.fail_test(f"Expected 401, got {response.status_code}: {response.text}")

    except Exception as e:
        result.fail_test(f"Exception: {str(e)}")

    test_results.append(result)
    return result


def test_api_011_inactive_account_login():
    """AUTH-API-011: Inactive Account Login - Test with inactive_test user"""
    result = TestResult("AUTH-API-011", "Login with Inactive Account")
    result.expected_behavior = "Returns 401 or 403 with appropriate error message"

    try:
        response = requests.post(
            f"{API_BASE}/login/",
            json=TEST_USERS["inactive"],
            headers={"Content-Type": "application/json"}
        )

        if response.status_code in [401, 403]:
            result.pass_test(f"Correctly rejected inactive account with {response.status_code}")
        elif response.status_code == 200:
            result.fail_test("Inactive account was allowed to login - SECURITY ISSUE")
        else:
            result.fail_test(f"Expected 401/403, got {response.status_code}: {response.text}")

    except Exception as e:
        result.fail_test(f"Exception: {str(e)}")

    test_results.append(result)
    return result


def test_api_012_rate_limiting():
    """AUTH-API-012: Rate Limiting - Test rapid failed login attempts"""
    result = TestResult("AUTH-API-012", "Rate Limiting on Failed Logins")
    result.expected_behavior = "Returns 429 Too Many Requests after threshold"

    try:
        # Attempt multiple rapid failed logins
        rate_limited = False
        for i in range(15):
            response = requests.post(
                f"{API_BASE}/login/",
                json={"username": "admin_test", "password": f"wrong_password_{i}"},
                headers={"Content-Type": "application/json"}
            )

            if response.status_code == 429:
                rate_limited = True
                result.pass_test(f"Rate limiting activated after {i+1} attempts")
                break

            time.sleep(0.1)  # Small delay between requests

        if not rate_limited:
            result.fail_test("No rate limiting detected after 15 failed attempts - SECURITY CONCERN")

    except Exception as e:
        result.fail_test(f"Exception: {str(e)}")

    test_results.append(result)
    return result


def generate_test_report():
    """Generate comprehensive test report"""
    print("\n" + "=" * 80)
    print("AGENT 1: API AUTHENTICATION TESTS - FINAL REPORT")
    print("=" * 80)

    total_tests = len(test_results)
    passed = sum(1 for r in test_results if r.status == "PASS")
    failed = sum(1 for r in test_results if r.status == "FAIL")
    skipped = sum(1 for r in test_results if r.status == "SKIP")

    print(f"\nTest Execution Summary:")
    print(f"  Total Tests:   {total_tests}")
    print(f"  Passed:        {passed} ({100*passed//total_tests if total_tests > 0 else 0}%)")
    print(f"  Failed:        {failed}")
    print(f"  Skipped:       {skipped}")
    print(f"\nPass Rate: {100*passed//total_tests if total_tests > 0 else 0}%")

    print("\n" + "-" * 80)
    print("Detailed Test Results:")
    print("-" * 80)

    for result in test_results:
        status_symbol = "✓" if result.status == "PASS" else "✗" if result.status == "FAIL" else "⊘"
        print(f"\n{status_symbol} {result.test_id}: {result.test_name}")
        print(f"  Status: {result.status}")
        if result.notes:
            print(f"  Notes: {result.notes}")

    # Save results to JSON
    with open("test_results_api_auth.json", "w") as f:
        json.dump([r.to_dict() for r in test_results], f, indent=2)

    print("\n" + "=" * 80)
    print("Test results saved to: test_results_api_auth.json")
    print("=" * 80)


def main():
    """Execute all API authentication tests"""
    print("=" * 80)
    print("AGENT 1: API AUTHENTICATION TESTS")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print(f"Test Start Time: {datetime.now().isoformat()}")
    print("=" * 80)

    # Execute tests in sequence
    print("\n--- Phase 1: Login Tests ---")
    result_001, login_data = test_api_001_valid_login()
    access_token = login_data.get("access") if login_data else None
    refresh_token = login_data.get("refresh") if login_data else None

    test_api_002_invalid_username()
    test_api_003_invalid_password()
    test_api_004_empty_credentials()
    test_api_005_sql_injection()

    print("\n--- Phase 2: Token Management Tests ---")
    result_006, new_access_token = test_api_006_token_refresh(refresh_token)
    if new_access_token:
        access_token = new_access_token
    test_api_007_invalid_refresh_token()

    print("\n--- Phase 3: Protected Endpoint Tests ---")
    test_api_008_protected_endpoint_access(access_token)
    test_api_009_no_token_access()
    test_api_010_expired_token_access()

    print("\n--- Phase 4: Security Tests ---")
    test_api_011_inactive_account_login()
    test_api_012_rate_limiting()

    # Generate final report
    generate_test_report()


if __name__ == "__main__":
    main()
