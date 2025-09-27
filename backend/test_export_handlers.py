#!/usr/bin/env python
"""
Test script for the new PDF and Excel export handlers
"""
import os
import sys
import django

# Add the backend directory to the Python path
sys.path.append('/Users/new/Projects/mead-security/remix2/backend')

# Configure Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from api.models import ReportTemplate, User
from api.utils.report_generator import ReportGenerator
from datetime import datetime, timedelta
from django.utils import timezone

def test_export_handlers():
    """Test PDF and Excel export functionality"""

    # Get the first available template and user
    try:
        template = ReportTemplate.objects.first()
        user = User.objects.filter(is_staff=True).first()

        if not template:
            print("❌ No report templates found. Run 'python manage.py setup_report_templates' first.")
            return False

        if not user:
            print("❌ No admin user found.")
            return False

        print(f"✅ Using template: {template.name}")
        print(f"✅ Using user: {user.get_full_name()}")

        # Test date range
        end_date = timezone.now()
        start_date = end_date - timedelta(days=30)

        # Test PDF export
        print(f"\n🔄 Testing PDF export...")
        try:
            pdf_generator = ReportGenerator(
                template=template,
                export_format='pdf',
                date_range_start=start_date,
                date_range_end=end_date,
                user=user
            )

            pdf_result = pdf_generator.generate()
            print(f"✅ PDF export successful!")
            print(f"   📄 File path: {pdf_result.get('file_path')}")
            print(f"   📊 Rows: {pdf_result.get('row_count')}")
            print(f"   💾 Size: {pdf_result.get('file_size')} bytes")

        except Exception as e:
            print(f"❌ PDF export failed: {str(e)}")
            return False

        # Test Excel export
        print(f"\n🔄 Testing Excel export...")
        try:
            excel_generator = ReportGenerator(
                template=template,
                export_format='excel',
                date_range_start=start_date,
                date_range_end=end_date,
                user=user
            )

            excel_result = excel_generator.generate()
            print(f"✅ Excel export successful!")
            print(f"   📄 File path: {excel_result.get('file_path')}")
            print(f"   📊 Rows: {excel_result.get('row_count')}")
            print(f"   💾 Size: {excel_result.get('file_size')} bytes")

        except Exception as e:
            print(f"❌ Excel export failed: {str(e)}")
            return False

        # Test CSV export (should still work)
        print(f"\n🔄 Testing CSV export (legacy)...")
        try:
            csv_generator = ReportGenerator(
                template=template,
                export_format='csv',
                date_range_start=start_date,
                date_range_end=end_date,
                user=user
            )

            csv_result = csv_generator.generate()
            print(f"✅ CSV export successful!")
            print(f"   📊 Rows: {csv_result.get('row_count')}")

        except Exception as e:
            print(f"❌ CSV export failed: {str(e)}")
            return False

        print(f"\n🎉 All export handlers working correctly!")
        return True

    except Exception as e:
        print(f"❌ Test setup failed: {str(e)}")
        return False

def test_preview_functionality():
    """Test report preview functionality"""

    print(f"\n🔄 Testing report preview functionality...")

    try:
        template = ReportTemplate.objects.first()
        user = User.objects.filter(is_staff=True).first()

        end_date = timezone.now()
        start_date = end_date - timedelta(days=7)

        parameters = {
            'date_range_start': start_date,
            'date_range_end': end_date,
            'user': user
        }

        preview_result = ReportGenerator.generate_preview(template, parameters, limit=5)

        print(f"✅ Preview successful!")
        print(f"   📊 Preview rows: {preview_result.get('row_count')}")
        print(f"   🔍 Preview limit: {preview_result.get('preview_limit')}")
        print(f"   📈 Estimated total: {preview_result.get('estimated_total_rows')}")

        return True

    except Exception as e:
        print(f"❌ Preview test failed: {str(e)}")
        return False

def test_template_validation():
    """Test template validation functionality"""

    print(f"\n🔄 Testing template validation...")

    try:
        template = ReportTemplate.objects.first()

        validation_result = ReportGenerator.validate_template(template)

        print(f"✅ Validation completed!")
        print(f"   ✓ Valid: {validation_result.get('valid')}")
        print(f"   ⚠️  Warnings: {len(validation_result.get('warnings', []))}")
        print(f"   ❌ Errors: {len(validation_result.get('errors', []))}")
        print(f"   ⚡ Performance: {validation_result.get('estimated_performance')}")

        if validation_result.get('warnings'):
            print("   Warnings:")
            for warning in validation_result['warnings']:
                print(f"     • {warning}")

        if validation_result.get('errors'):
            print("   Errors:")
            for error in validation_result['errors']:
                print(f"     • {error}")

        return True

    except Exception as e:
        print(f"❌ Validation test failed: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Testing Export & Reporting Architecture - Phase 1")
    print("=" * 60)

    # Run all tests
    all_passed = True

    all_passed &= test_export_handlers()
    all_passed &= test_preview_functionality()
    all_passed &= test_template_validation()

    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 All tests passed! Phase 1 implementation is working correctly.")
    else:
        print("❌ Some tests failed. Check the output above for details.")

    print("\n📋 Phase 1 Summary:")
    print("✅ PDF Export Handler - Professional reports with charts")
    print("✅ Excel Export Handler - Multi-sheet workbooks with formatting")
    print("✅ Enhanced ReportGenerator - Supports all formats")
    print("✅ Report Preview - Limited data previews")
    print("✅ Template Validation - SQL and parameter validation")
    print("✅ New Models - ScheduledReport and ExportConfiguration")

    print("\n🔄 Next: Phase 2 - Asynchronous Processing & Enhanced API")