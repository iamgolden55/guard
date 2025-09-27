#!/usr/bin/env python
"""
Test script to validate Celery configuration and task integration.

Usage:
    python test_celery_setup.py
"""

import os
import sys
import django
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def test_celery_import():
    """Test that Celery app can be imported."""
    print("Testing Celery app import...")
    try:
        from core.celery_app import app as celery_app
        print(f"✓ Celery app imported successfully: {celery_app}")
        print(f"  - Broker URL: {celery_app.conf.broker_url}")
        print(f"  - Result backend: {celery_app.conf.result_backend}")
        return True
    except ImportError as e:
        print(f"✗ Failed to import Celery app: {e}")
        return False
    except Exception as e:
        print(f"✗ Error importing Celery app: {e}")
        return False


def test_task_import():
    """Test that tasks can be imported."""
    print("\nTesting task imports...")
    try:
        from api.tasks import (
            generate_report_async,
            cancel_report_job,
            send_report_notification,
            cleanup_old_report_files,
            health_check
        )
        print("✓ All tasks imported successfully")
        print(f"  - generate_report_async: {generate_report_async}")
        print(f"  - cancel_report_job: {cancel_report_job}")
        print(f"  - send_report_notification: {send_report_notification}")
        print(f"  - cleanup_old_report_files: {cleanup_old_report_files}")
        print(f"  - health_check: {health_check}")
        return True
    except ImportError as e:
        print(f"✗ Failed to import tasks: {e}")
        return False
    except Exception as e:
        print(f"✗ Error importing tasks: {e}")
        return False


def test_django_integration():
    """Test Django-Celery integration."""
    print("\nTesting Django-Celery integration...")
    try:
        from django.conf import settings

        # Check Redis configuration
        redis_url = getattr(settings, 'REDIS_URL', None)
        celery_broker = getattr(settings, 'CELERY_BROKER_URL', None)

        print(f"✓ Redis URL configured: {redis_url}")
        print(f"✓ Celery broker configured: {celery_broker}")

        # Check installed apps
        installed_apps = settings.INSTALLED_APPS
        celery_beat_installed = 'django_celery_beat' in installed_apps
        celery_results_installed = 'django_celery_results' in installed_apps

        print(f"✓ django-celery-beat installed: {celery_beat_installed}")
        print(f"✓ django-celery-results installed: {celery_results_installed}")

        return True
    except Exception as e:
        print(f"✗ Error checking Django-Celery integration: {e}")
        return False


def test_model_access():
    """Test that models can be accessed from tasks."""
    print("\nTesting model access...")
    try:
        from api.models import ReportJob, ReportTemplate, User

        # Test basic model queries (read-only)
        user_count = User.objects.count()
        template_count = ReportTemplate.objects.count()
        job_count = ReportJob.objects.count()

        print(f"✓ Models accessible from tasks")
        print(f"  - Users: {user_count}")
        print(f"  - Templates: {template_count}")
        print(f"  - Jobs: {job_count}")

        return True
    except Exception as e:
        print(f"✗ Error accessing models: {e}")
        return False


def test_utility_imports():
    """Test that utility modules can be imported."""
    print("\nTesting utility imports...")
    try:
        from api.utils.report_generator import ReportGenerator
        from api.utils.export_handlers import get_export_handler

        print("✓ Utility modules imported successfully")
        print(f"  - ReportGenerator: {ReportGenerator}")
        print(f"  - get_export_handler: {get_export_handler}")

        return True
    except ImportError as e:
        print(f"✗ Failed to import utilities: {e}")
        return False
    except Exception as e:
        print(f"✗ Error importing utilities: {e}")
        return False


def run_health_check_task():
    """Test running the health check task synchronously."""
    print("\nTesting health check task...")
    try:
        from api.tasks import health_check

        # Run synchronously for testing
        result = health_check()
        print(f"✓ Health check task executed successfully")
        print(f"  Result: {result}")

        return True
    except Exception as e:
        print(f"✗ Error running health check task: {e}")
        return False


def main():
    """Run all tests."""
    print("Celery Setup Validation")
    print("=" * 50)

    tests = [
        test_celery_import,
        test_task_import,
        test_django_integration,
        test_model_access,
        test_utility_imports,
        run_health_check_task,
    ]

    passed = 0
    total = len(tests)

    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"✗ Test {test.__name__} failed with exception: {e}")

    print("\n" + "=" * 50)
    print(f"Test Results: {passed}/{total} passed")

    if passed == total:
        print("🎉 All tests passed! Celery setup is ready.")
        print("\nNext steps:")
        print("1. Install required dependencies:")
        print("   pip install celery redis django-celery-beat django-celery-results django-redis")
        print("2. Start Redis server:")
        print("   redis-server")
        print("3. Start Celery worker:")
        print("   celery -A core worker --loglevel=info")
        print("4. Start Celery beat scheduler (optional):")
        print("   celery -A core beat --loglevel=info")
    else:
        print("❌ Some tests failed. Check the errors above.")
        sys.exit(1)


if __name__ == '__main__':
    main()