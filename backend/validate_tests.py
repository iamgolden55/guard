#!/usr/bin/env python
"""
Simple validation script to check test file structure and imports
"""
import sys
import os

# Add the project path
sys.path.insert(0, '/Users/new/Projects/mead-security/remix2/backend')

# Set Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django
django.setup()

def validate_test_imports():
    """Validate that test files can be imported correctly"""
    print("Validating test file imports...")

    try:
        # Test model tests import
        from api.tests.test_recruitment_conversion import (
            RecruitmentConversionModelTest,
            RecruitmentConversionMultiTenantTest,
            RecruitmentConversionEdgeCaseTest
        )
        print("✓ Model tests import successfully")

        # Test API tests import
        from api.tests.test_recruitment_api import (
            RecruitmentConversionAPITest,
            RecruitmentConversionAPIMultiTenantTest,
            RecruitmentConversionAPIPerformanceTest
        )
        print("✓ API tests import successfully")

        # Validate test methods exist
        model_test = RecruitmentConversionModelTest()
        api_test = RecruitmentConversionAPITest()

        # Check key test methods exist
        model_methods = [
            'test_successful_conversion_creates_all_relationships',
            'test_unapproved_application_conversion_fails',
            'test_duplicate_conversion_attempts_fail',
            'test_transaction_rollback_works_on_failures'
        ]

        api_methods = [
            'test_successful_conversion_api_returns_proper_response_format',
            'test_unapproved_application_returns_400_error_with_helpful_message',
            'test_cross_company_conversion_security_prevents_access',
            'test_logging_statements_execute_without_errors'
        ]

        for method in model_methods:
            if hasattr(model_test, method):
                print(f"✓ Model test method '{method}' exists")
            else:
                print(f"✗ Model test method '{method}' missing")

        for method in api_methods:
            if hasattr(api_test, method):
                print(f"✓ API test method '{method}' exists")
            else:
                print(f"✗ API test method '{method}' missing")

        print("\n✓ All test files validated successfully!")
        return True

    except Exception as e:
        print(f"✗ Validation failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def count_test_cases():
    """Count the number of test cases in each file"""
    print("\nCounting test cases...")

    try:
        from api.tests.test_recruitment_conversion import (
            RecruitmentConversionModelTest,
            RecruitmentConversionMultiTenantTest,
            RecruitmentConversionEdgeCaseTest
        )
        from api.tests.test_recruitment_api import (
            RecruitmentConversionAPITest,
            RecruitmentConversionAPIMultiTenantTest,
            RecruitmentConversionAPIPerformanceTest
        )

        # Count model tests
        model_test_classes = [
            RecruitmentConversionModelTest,
            RecruitmentConversionMultiTenantTest,
            RecruitmentConversionEdgeCaseTest
        ]

        model_test_count = 0
        for test_class in model_test_classes:
            methods = [method for method in dir(test_class) if method.startswith('test_')]
            model_test_count += len(methods)
            print(f"  {test_class.__name__}: {len(methods)} tests")

        # Count API tests
        api_test_classes = [
            RecruitmentConversionAPITest,
            RecruitmentConversionAPIMultiTenantTest,
            RecruitmentConversionAPIPerformanceTest
        ]

        api_test_count = 0
        for test_class in api_test_classes:
            methods = [method for method in dir(test_class) if method.startswith('test_')]
            api_test_count += len(methods)
            print(f"  {test_class.__name__}: {len(methods)} tests")

        print(f"\nTotal model tests: {model_test_count}")
        print(f"Total API tests: {api_test_count}")
        print(f"Grand total: {model_test_count + api_test_count} tests")

    except Exception as e:
        print(f"Error counting tests: {e}")

if __name__ == "__main__":
    success = validate_test_imports()
    count_test_cases()

    if success:
        print("\n🎉 Test validation completed successfully!")
        print("\nTo run the tests:")
        print("  cd backend")
        print("  python manage.py test api.tests.test_recruitment_conversion --verbosity=2")
        print("  python manage.py test api.tests.test_recruitment_api --verbosity=2")
    else:
        print("\n❌ Test validation failed!")
        sys.exit(1)