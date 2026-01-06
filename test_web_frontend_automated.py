#!/usr/bin/env python3
"""
Agent 2: Web Frontend Authentication Tests (Automated)
Comprehensive frontend authentication testing with Playwright
"""

import asyncio
import json
from datetime import datetime
from playwright.async_api import async_playwright, Page, Browser, BrowserContext

# Configuration
FRONTEND_URL = "http://localhost:3000"
BACKEND_URL = "http://localhost:8000"

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
    def __init__(self, test_id, test_name, phase="Web Frontend"):
        self.test_id = test_id
        self.test_name = test_name
        self.phase = phase
        self.status = "PENDING"
        self.notes = ""
        self.screenshot_path = None
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
            "phase": self.phase,
            "status": self.status,
            "notes": self.notes,
            "screenshot": self.screenshot_path,
            "timestamp": self.timestamp.isoformat()
        }


async def wait_for_navigation_or_error(page: Page, timeout=5000):
    """Wait for either navigation or error message"""
    try:
        await page.wait_for_load_state("networkidle", timeout=timeout)
        return True
    except:
        return False


async def check_cookies_for_auth(context: BrowserContext):
    """Check if authentication cookies are set (Sprint 3 implementation)"""
    cookies = await context.cookies()
    has_access = any(c['name'] == 'access_token' for c in cookies)
    has_refresh = any(c['name'] == 'refresh_token' for c in cookies)
    return has_access and has_refresh


async def test_auth_w_001_valid_login_admin(page: Page, context: BrowserContext):
    """AUTH-W-001: Valid Login - Admin User"""
    result = TestResult("AUTH-W-001", "Valid Login - Admin User")

    try:
        await page.goto(FRONTEND_URL)
        await page.wait_for_load_state("networkidle")

        # Take screenshot of login page
        await page.screenshot(path="screenshots/auth_w_001_login_page.png")
        result.screenshot_path = "screenshots/auth_w_001_login_page.png"

        # Find and fill login form
        username_selector = 'input[name="username"], input[type="text"], input[placeholder*="username" i], input[id*="username" i]'
        password_selector = 'input[name="password"], input[type="password"]'

        # Wait for login form
        await page.wait_for_selector(username_selector, timeout=5000)

        # Fill credentials
        await page.fill(username_selector, TEST_USERS["admin"]["username"])
        await page.fill(password_selector, TEST_USERS["admin"]["password"])

        # Find and click login button
        login_button = page.locator('button:has-text("Login"), button:has-text("Sign In"), button[type="submit"]').first
        await login_button.click()

        # Wait for navigation or error
        await page.wait_for_load_state("networkidle", timeout=10000)
        await page.screenshot(path="screenshots/auth_w_001_after_login.png")

        # Check if logged in (URL changed, cookies set, or dashboard visible)
        current_url = page.url
        has_auth_cookies = await check_cookies_for_auth(context)

        if current_url != FRONTEND_URL and current_url != f"{FRONTEND_URL}/":
            result.pass_test(f"Login successful. Redirected to: {current_url}. Cookies: {has_auth_cookies}")
        else:
            # Check for error message
            error_visible = await page.locator('text=/error|invalid|failed/i').count() > 0
            if error_visible:
                error_text = await page.locator('text=/error|invalid|failed/i').first.text_content()
                result.fail_test(f"Login failed with error: {error_text}")
            else:
                result.fail_test("Login did not redirect (might still be on login page)")

    except Exception as e:
        result.fail_test(f"Exception: {str(e)}")

    test_results.append(result)
    return result


async def test_auth_w_002_invalid_username(page: Page):
    """AUTH-W-002: Invalid Username Login"""
    result = TestResult("AUTH-W-002", "Invalid Username Login")

    try:
        await page.goto(FRONTEND_URL)
        await page.wait_for_load_state("networkidle")

        # Fill invalid credentials
        await page.fill('input[name="username"], input[type="text"]', "nonexistent_user")
        await page.fill('input[type="password"]', "SomePassword123!")

        # Click login
        await page.locator('button:has-text("Login"), button[type="submit"]').first.click()
        await page.wait_for_timeout(2000)

        # Check for error message
        error_visible = await page.locator('text=/invalid|error|incorrect|failed/i').count() > 0

        if error_visible:
            error_text = await page.locator('text=/invalid|error|incorrect|failed/i').first.text_content()
            result.pass_test(f"Error message displayed: {error_text}")
        else:
            result.fail_test("No error message displayed for invalid username")

        await page.screenshot(path="screenshots/auth_w_002_invalid_username.png")

    except Exception as e:
        result.fail_test(f"Exception: {str(e)}")

    test_results.append(result)
    return result


async def test_auth_w_003_invalid_password(page: Page):
    """AUTH-W-003: Invalid Password Login"""
    result = TestResult("AUTH-W-003", "Invalid Password Login")

    try:
        await page.goto(FRONTEND_URL)
        await page.wait_for_load_state("networkidle")

        # Fill credentials with wrong password
        await page.fill('input[name="username"], input[type="text"]', TEST_USERS["admin"]["username"])
        await page.fill('input[type="password"]', "WrongPassword123!")

        # Click login
        await page.locator('button:has-text("Login"), button[type="submit"]').first.click()
        await page.wait_for_timeout(2000)

        # Check for error message
        error_visible = await page.locator('text=/invalid|error|incorrect|failed/i').count() > 0

        if error_visible:
            result.pass_test("Error message displayed for invalid password")
        else:
            result.fail_test("No error message for invalid password")

        await page.screenshot(path="screenshots/auth_w_003_invalid_password.png")

    except Exception as e:
        result.fail_test(f"Exception: {str(e)}")

    test_results.append(result)
    return result


async def test_auth_w_004_empty_credentials(page: Page):
    """AUTH-W-004: Empty Credentials Validation"""
    result = TestResult("AUTH-W-004", "Empty Credentials Validation")

    try:
        await page.goto(FRONTEND_URL)
        await page.wait_for_load_state("networkidle")

        # Try to submit empty form
        login_button = page.locator('button:has-text("Login"), button[type="submit"]').first

        # Check if button is disabled
        is_disabled = await login_button.is_disabled()

        # Try clicking anyway
        if not is_disabled:
            await login_button.click()
            await page.wait_for_timeout(1000)

        # Check for validation messages
        validation_visible = await page.locator('text=/required|cannot be empty|fill/i').count() > 0

        if is_disabled or validation_visible:
            result.pass_test(f"Form validation working (button disabled: {is_disabled}, validation message: {validation_visible})")
        else:
            result.fail_test("No validation for empty credentials")

        await page.screenshot(path="screenshots/auth_w_004_empty_credentials.png")

    except Exception as e:
        result.fail_test(f"Exception: {str(e)}")

    test_results.append(result)
    return result


async def test_auth_w_005_xss_attempt(page: Page):
    """AUTH-W-005: XSS Attempt in Login Form"""
    result = TestResult("AUTH-W-005", "XSS Prevention in Login Form")

    try:
        await page.goto(FRONTEND_URL)
        await page.wait_for_load_state("networkidle")

        xss_payload = "<script>alert('XSS')</script>"

        # Fill form with XSS payload
        await page.fill('input[name="username"], input[type="text"]', xss_payload)
        await page.fill('input[type="password"]', "test123")

        # Set up dialog handler to catch any alert
        alert_fired = False
        page.on("dialog", lambda dialog: setattr(result, 'alert_fired', True))

        # Click login
        await page.locator('button:has-text("Login"), button[type="submit"]').first.click()
        await page.wait_for_timeout(2000)

        # Check if alert fired
        if hasattr(result, 'alert_fired'):
            result.fail_test("XSS vulnerability detected - alert was triggered")
        else:
            result.pass_test("XSS attack prevented - no script execution")

        await page.screenshot(path="screenshots/auth_w_005_xss_attempt.png")

    except Exception as e:
        result.fail_test(f"Exception: {str(e)}")

    test_results.append(result)
    return result


async def test_auth_w_011_direct_url_access(page: Page, context: BrowserContext):
    """AUTH-W-011: Direct URL Access Without Authentication"""
    result = TestResult("AUTH-W-011", "Direct URL Access Without Authentication")

    try:
        # Clear all cookies and storage
        await context.clear_cookies()
        await page.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")

        # Try to access protected route directly
        protected_urls = [
            f"{FRONTEND_URL}/dashboard",
            f"{FRONTEND_URL}/admin",
            f"{FRONTEND_URL}/shifts"
        ]

        redirected = False
        for url in protected_urls:
            try:
                await page.goto(url, timeout=5000)
                await page.wait_for_timeout(2000)

                current_url = page.url

                # Check if redirected to login
                if "login" in current_url.lower() or current_url == FRONTEND_URL or current_url == f"{FRONTEND_URL}/":
                    redirected = True
                    result.pass_test(f"Correctly redirected to login when accessing {url}")
                    break
            except:
                continue

        if not redirected:
            result.fail_test("No redirect to login for protected routes - security issue")

        await page.screenshot(path="screenshots/auth_w_011_direct_access.png")

    except Exception as e:
        result.fail_test(f"Exception: {str(e)}")

    test_results.append(result)
    return result


async def test_auth_w_014_logout(page: Page, context: BrowserContext):
    """AUTH-W-014: Logout Functionality"""
    result = TestResult("AUTH-W-014", "Logout Functionality")

    try:
        # First login
        await page.goto(FRONTEND_URL)
        await page.fill('input[name="username"], input[type="text"]', TEST_USERS["admin"]["username"])
        await page.fill('input[type="password"]', TEST_USERS["admin"]["password"])
        await page.locator('button:has-text("Login"), button[type="submit"]').first.click()
        await page.wait_for_load_state("networkidle", timeout=10000)

        # Look for logout button/link
        logout_locators = [
            page.locator('text=/logout/i'),
            page.locator('button:has-text("Logout")'),
            page.locator('a:has-text("Logout")'),
            page.locator('[aria-label="Logout"]')
        ]

        logout_clicked = False
        for locator in logout_locators:
            if await locator.count() > 0:
                await locator.first.click()
                logout_clicked = True
                break

        if not logout_clicked:
            result.skip_test("Logout button not found on page")
            test_results.append(result)
            return result

        await page.wait_for_timeout(2000)

        # Check if redirected to login
        current_url = page.url
        cookies = await context.cookies()
        has_auth = any(c['name'] in ['access_token', 'refresh_token'] for c in cookies)

        if ("login" in current_url.lower() or current_url == FRONTEND_URL) and not has_auth:
            result.pass_test("Logout successful - redirected to login and cookies cleared")
        else:
            result.fail_test(f"Logout incomplete - URL: {current_url}, Has auth cookies: {has_auth}")

        await page.screenshot(path="screenshots/auth_w_014_logout.png")

    except Exception as e:
        result.fail_test(f"Exception: {str(e)}")

    test_results.append(result)
    return result


async def run_security_check_cookies(page: Page, context: BrowserContext):
    """Security Check: Token Storage in Cookies (Sprint 3)"""
    result = TestResult("SEC-CHECK-1", "Token Storage Security (httpOnly Cookies)")

    try:
        # Login first
        await page.goto(FRONTEND_URL)
        await page.fill('input[name="username"], input[type="text"]', TEST_USERS["admin"]["username"])
        await page.fill('input[type="password"]', TEST_USERS["admin"]["password"])
        await page.locator('button:has-text("Login"), button[type="submit"]').first.click()
        await page.wait_for_load_state("networkidle", timeout=10000)

        # Check cookies
        cookies = await context.cookies()
        auth_cookies = [c for c in cookies if c['name'] in ['access_token', 'refresh_token']]

        if auth_cookies:
            httponly_status = all(c.get('httpOnly', False) for c in auth_cookies)
            secure_status = all(c.get('secure', False) for c in auth_cookies)

            if httponly_status:
                result.pass_test(f"✓ Tokens stored in httpOnly cookies (Sprint 3 complete). Secure: {secure_status}")
            else:
                result.fail_test("Tokens in cookies but NOT httpOnly - XSS vulnerability remains")
        else:
            # Check localStorage as fallback
            local_storage_check = await page.evaluate("""() => {
                const keys = Object.keys(localStorage);
                return keys.filter(k => k.includes('token') || k.includes('auth'));
            }""")

            if local_storage_check:
                result.fail_test(f"Tokens in localStorage (XSS vulnerable): {local_storage_check}")
            else:
                result.fail_test("No tokens found in cookies or localStorage")

    except Exception as e:
        result.fail_test(f"Exception: {str(e)}")

    test_results.append(result)
    return result


def generate_test_report():
    """Generate comprehensive test report"""
    print("\n" + "=" * 80)
    print("AGENT 2: WEB FRONTEND AUTHENTICATION TESTS - FINAL REPORT")
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
        if result.screenshot_path:
            print(f"  Screenshot: {result.screenshot_path}")

    # Save results to JSON
    with open("test_results_web_frontend.json", "w") as f:
        json.dump([r.to_dict() for r in test_results], f, indent=2)

    print("\n" + "=" * 80)
    print("Test results saved to: test_results_web_frontend.json")
    print("Screenshots saved to: screenshots/")
    print("=" * 80)


async def main():
    """Main test execution"""
    print("=" * 80)
    print("AGENT 2: WEB FRONTEND AUTHENTICATION TESTS")
    print("=" * 80)
    print(f"Frontend URL: {FRONTEND_URL}")
    print(f"Test Start Time: {datetime.now().isoformat()}")
    print("=" * 80)

    # Create screenshots directory
    import os
    os.makedirs("screenshots", exist_ok=True)

    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 720},
            ignore_https_errors=True
        )
        page = await context.new_page()

        # Enable console logging
        page.on("console", lambda msg: print(f"  [Browser Console] {msg.text}"))

        print("\n--- Phase 1: Login Form Tests ---")
        await test_auth_w_001_valid_login_admin(page, context)
        await test_auth_w_002_invalid_username(page)
        await test_auth_w_003_invalid_password(page)
        await test_auth_w_004_empty_credentials(page)
        await test_auth_w_005_xss_attempt(page)

        print("\n--- Phase 2: Route Protection Tests ---")
        await test_auth_w_011_direct_url_access(page, context)

        print("\n--- Phase 3: Session Management ---")
        await test_auth_w_014_logout(page, context)

        print("\n--- Security Checks ---")
        await run_security_check_cookies(page, context)

        await browser.close()

    # Generate final report
    generate_test_report()


if __name__ == "__main__":
    asyncio.run(main())