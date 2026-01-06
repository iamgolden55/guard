#!/usr/bin/env python3
"""
Sprint 3: Test httpOnly Cookie-Based Authentication
Tests the new cookie-based JWT authentication system.
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000/api/v1"
TEST_USER = {
    "username": "sprint3_test",
    "password": "sprint3test123"
}

# ANSI color codes for better output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_header(text):
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}{text}{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")

def print_success(text):
    print(f"{GREEN}✓ {text}{RESET}")

def print_error(text):
    print(f"{RED}✗ {text}{RESET}")

def print_info(text):
    print(f"{YELLOW}ℹ {text}{RESET}")

def print_cookies(cookies):
    """Print cookies in a readable format"""
    if cookies:
        print(f"{YELLOW}Cookies:{RESET}")
        for name, value in cookies.items():
            # Truncate long values for readability
            display_value = value[:50] + "..." if len(value) > 50 else value
            print(f"  {name}: {display_value}")
    else:
        print(f"{YELLOW}No cookies found{RESET}")

def test_login():
    """Test 1: Login should set httpOnly cookies"""
    print_header("TEST 1: Login with httpOnly Cookies")

    try:
        # Make login request
        response = requests.post(
            f"{BASE_URL}/login/",
            json=TEST_USER,
            headers={"Content-Type": "application/json"}
        )

        print_info(f"Status Code: {response.status_code}")

        # Check response
        if response.status_code == 200:
            print_success("Login request successful")

            # Parse response body
            data = response.json()
            print_info(f"Response body: {json.dumps(data, indent=2)}")

            # Check that tokens are NOT in response body
            if 'access' not in data and 'refresh' not in data:
                print_success("✓ Tokens NOT in response body (correct for Sprint 3)")
            else:
                print_error("✗ Tokens found in response body (should be in cookies only)")
                return None

            # Check that user object is in response
            if 'user' in data:
                print_success(f"✓ User object in response: {data['user']['username']}")
            else:
                print_error("✗ User object not found in response")
                return None

            # Check cookies
            print_cookies(response.cookies)

            # Verify httpOnly cookies are set
            if 'access_token' in response.cookies:
                print_success("✓ access_token cookie set")
            else:
                print_error("✗ access_token cookie NOT set")
                return None

            if 'refresh_token' in response.cookies:
                print_success("✓ refresh_token cookie set")
            else:
                print_error("✗ refresh_token cookie NOT set")
                return None

            # Check cookie attributes (httpOnly, secure, etc.)
            # Note: requests library doesn't expose all cookie attributes
            # We need to check these in browser DevTools
            print_info("Note: Cookie attributes (httpOnly, secure) must be verified in browser DevTools")

            return response.cookies
        else:
            print_error(f"Login failed with status {response.status_code}")
            print_error(f"Response: {response.text}")
            return None

    except Exception as e:
        print_error(f"Login test failed with exception: {e}")
        return None

def test_authenticated_request(cookies):
    """Test 2: Make authenticated request using cookies"""
    print_header("TEST 2: Authenticated Request with Cookies")

    if not cookies:
        print_error("No cookies to test with")
        return False

    try:
        # Make request to protected endpoint
        response = requests.get(
            f"{BASE_URL}/profiles/me",
            cookies=cookies
        )

        print_info(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            print_success("✓ Authenticated request successful using cookies")
            data = response.json()
            print_info(f"User data: {json.dumps(data, indent=2)}")
            return True
        else:
            print_error(f"✗ Authenticated request failed with status {response.status_code}")
            print_error(f"Response: {response.text}")
            return False

    except Exception as e:
        print_error(f"Authenticated request test failed: {e}")
        return False

def test_token_refresh(cookies):
    """Test 3: Token refresh using httpOnly cookie"""
    print_header("TEST 3: Token Refresh with httpOnly Cookie")

    if not cookies:
        print_error("No cookies to test with")
        return None

    try:
        # Get CSRF token from cookies if available
        csrf_token = cookies.get('csrftoken', '')

        # Make refresh request
        response = requests.post(
            f"{BASE_URL}/auth/refresh/",
            cookies=cookies,
            headers={
                "X-CSRFToken": csrf_token,
                "Content-Type": "application/json"
            },
            json={}  # Empty body, refresh token is in cookie
        )

        print_info(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            print_success("✓ Token refresh successful using httpOnly cookie")

            data = response.json()
            print_info(f"Response body: {json.dumps(data, indent=2)}")

            # Check that tokens are NOT in response body
            if 'access' not in data:
                print_success("✓ Tokens NOT in response body (correct for Sprint 3)")
            else:
                print_error("✗ Tokens found in response body (should be in cookies only)")

            # Check if new cookies were set
            print_cookies(response.cookies)

            if 'access_token' in response.cookies:
                print_success("✓ New access_token cookie set")

            # Merge new cookies with existing ones
            new_cookies = cookies.copy()
            new_cookies.update(response.cookies)
            return new_cookies
        else:
            print_error(f"✗ Token refresh failed with status {response.status_code}")
            print_error(f"Response: {response.text}")
            return None

    except Exception as e:
        print_error(f"Token refresh test failed: {e}")
        return None

def test_logout(cookies):
    """Test 4: Logout should clear httpOnly cookies"""
    print_header("TEST 4: Logout and Cookie Clearing")

    if not cookies:
        print_error("No cookies to test with")
        return False

    try:
        # Get CSRF token
        csrf_token = cookies.get('csrftoken', '')

        # Make logout request
        response = requests.post(
            f"{BASE_URL}/logout/",
            cookies=cookies,
            headers={
                "X-CSRFToken": csrf_token,
                "Content-Type": "application/json"
            },
            json={}
        )

        print_info(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            print_success("✓ Logout request successful")

            data = response.json()
            print_info(f"Response body: {json.dumps(data, indent=2)}")

            # Check cookies after logout
            print_cookies(response.cookies)

            # Try to make authenticated request with old cookies
            # This should fail because cookies were cleared
            print_info("\nTesting if cookies were actually cleared...")
            auth_response = requests.get(
                f"{BASE_URL}/profiles/me",
                cookies=cookies
            )

            if auth_response.status_code == 401:
                print_success("✓ Old cookies no longer work (correctly cleared)")
                return True
            else:
                print_error("✗ Old cookies still work (cookies not properly cleared)")
                return False
        else:
            print_error(f"✗ Logout failed with status {response.status_code}")
            print_error(f"Response: {response.text}")
            return False

    except Exception as e:
        print_error(f"Logout test failed: {e}")
        return False

def main():
    """Run all tests"""
    print(f"\n{BLUE}{'='*60}")
    print("Sprint 3: httpOnly Cookie Authentication Test Suite")
    print(f"{'='*60}{RESET}\n")
    print(f"Testing against: {BASE_URL}")
    print(f"Test user: {TEST_USER['username']}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    # Test 1: Login
    cookies = test_login()
    if not cookies:
        print_error("\n❌ TEST SUITE FAILED: Login test failed")
        return

    # Test 2: Authenticated request
    if not test_authenticated_request(cookies):
        print_error("\n❌ TEST SUITE FAILED: Authenticated request test failed")
        return

    # Test 3: Token refresh
    refreshed_cookies = test_token_refresh(cookies)
    if not refreshed_cookies:
        print_error("\n❌ TEST SUITE FAILED: Token refresh test failed")
        return

    # Test 4: Logout
    if not test_logout(refreshed_cookies):
        print_error("\n❌ TEST SUITE FAILED: Logout test failed")
        return

    # All tests passed
    print_header("TEST SUITE SUMMARY")
    print_success("✅ ALL TESTS PASSED!")
    print_info("\nSprint 3 Implementation Verification:")
    print_info("✓ Login sets httpOnly cookies (tokens not in response body)")
    print_info("✓ Authenticated requests work with cookies")
    print_info("✓ Token refresh works with httpOnly cookie")
    print_info("✓ Logout clears cookies properly")
    print()
    print_info("Next steps:")
    print_info("1. Verify in browser DevTools that cookies have httpOnly flag")
    print_info("2. Verify in browser console that tokens cannot be accessed via document.cookie")
    print_info("3. Test frontend application with the new cookie-based authentication")

if __name__ == "__main__":
    main()
