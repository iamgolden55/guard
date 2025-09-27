from django.apps import AppConfig


class LeaveManagementConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "leave_management"
    verbose_name = "Leave Management"

    def ready(self):
        """Initialize app with optimized managers"""
        # Import and apply optimized managers
        from .managers import enhance_existing_managers
        enhance_existing_managers()

        # Import signal handlers if any
        # from . import signals
