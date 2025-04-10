# Security Measures and Recommendations for the Security Staff Portal Database

This document outlines comprehensive security measures and recommendations for protecting sensitive information in the Security Staff Portal database. These guidelines are specifically tailored for a Django-based implementation.

## 1. Data Encryption

### 1.1 Database-Level Encryption

- **Implement PostgreSQL or MySQL encryption features**
  - For PostgreSQL, use `pgcrypto` extension for column-level encryption
  - For MySQL, use the `AES_ENCRYPT()` and `AES_DECRYPT()` functions

### 1.2 Application-Level Encryption for Sensitive Fields

```python
# settings.py
FIELD_ENCRYPTION_KEY = os.environ.get('FIELD_ENCRYPTION_KEY')

# models.py example with django-encrypted-fields
from encrypted_fields import fields as encrypted_fields

class BankDetails(models.Model):
    # Regular fields
    staff_profile = models.OneToOneField(StaffProfile, on_delete=models.CASCADE)
    account_name = models.CharField(max_length=100)
    bank_name = models.CharField(max_length=100)

    # Encrypted fields
    account_number = encrypted_fields.EncryptedCharField(max_length=50)
    sort_code = encrypted_fields.EncryptedCharField(max_length=20)
```

### 1.3 Key Management

- **Use a Key Management Service (KMS)** like AWS KMS or Azure Key Vault
- **Implement key rotation policies** - rotate encryption keys every 90 days
- **Never store encryption keys in the codebase or directly in environment variables**

## 2. Authentication and Authorization Security

### 2.1 JWT Token Security

```python
# settings.py
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': os.environ.get('JWT_SECRET_KEY'),
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
}
```

### 2.2 Password Security

```python
# settings.py
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
]

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 12}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
    {'NAME': 'accounts.validators.PasswordComplexityValidator'},  # Custom validator
]
```

### 2.3 Multi-Factor Authentication (MFA)

- Implement TOTP (Time-based One-Time Password) using packages like `django-otp`
- Require MFA for admin users and make it optional for other users

### 2.4 Permission-Based Security

```python
# permissions.py
from rest_framework import permissions

class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'admin'

class IsManagerUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['manager', 'admin']

# views.py
from rest_framework.permissions import IsAuthenticated
from .permissions import IsAdminUser

class VenueViewSet(viewsets.ModelViewSet):
    queryset = Venue.objects.all()
    serializer_class = VenueSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsAdminUser()]
        return [IsAuthenticated()]
```

## 3. Database Security Best Practices

### 3.1 Use Database Migrations Cautiously

- Keep sensitive data out of migration files
- Use data migrations carefully and avoid hardcoding sensitive information

```python
# migrations/0002_create_default_admin.py
from django.db import migrations
from django.contrib.auth.hashers import make_password
import os

def create_default_admin(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    admin_username = os.environ.get('ADMIN_USERNAME')
    admin_password = os.environ.get('ADMIN_PASSWORD')

    if admin_username and admin_password:
        User.objects.create(
            username=admin_username,
            password=make_password(admin_password),
            is_staff=True,
            is_superuser=True,
            role='admin'
        )

class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0001_initial'),
    ]
    operations = [
        migrations.RunPython(create_default_admin),
    ]
```

### 3.2 Database Roles and Privileges

- Create different database roles with specific privileges
- Application should use a role with minimal required permissions

```bash
# PostgreSQL example
CREATE ROLE security_portal_app WITH LOGIN PASSWORD 'secure_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO security_portal_app;
REVOKE ALL ON schema public FROM public;
```

### 3.3 Regular Database Auditing

- Log database queries and changes to sensitive data
- Implement audit trails using Django signals

```python
# models.py
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

class AuditLog(models.Model):
    timestamp = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=50)
    table = models.CharField(max_length=50)
    record_id = models.IntegerField()
    data = models.JSONField(null=True)

@receiver(post_save, sender=BankDetails)
def log_bank_details_change(sender, instance, created, **kwargs):
    user = get_current_user()  # Implement this using middleware or thread locals
    AuditLog.objects.create(
        user=user,
        action='create' if created else 'update',
        table='BankDetails',
        record_id=instance.id,
        data={'staff_profile_id': instance.staff_profile_id}  # Don't log sensitive fields
    )
```

## 4. API Security

### 4.1 Rate Limiting

```python
# settings.py
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/day',
        'user': '1000/day'
    }
}
```

### 4.2 API Endpoint Security

- **Only expose necessary endpoints** - validate permissions for each view
- **Implement CORS properly**

```python
# settings.py
CORS_ALLOWED_ORIGINS = [
    "https://securitystaff.example.com",
]

CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
]
```

### 4.3 Input Validation

- Use Django REST Framework serializers for strict input validation
- Implement custom validators for business logic

```python
# serializers.py
from rest_framework import serializers
from .models import SIALicense

class SIALicenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = SIALicense
        fields = ['license_number', 'license_type', 'issue_date', 'expiry_date']

    def validate_license_number(self, value):
        # SIA license numbers follow a specific format
        if not re.match(r'^\d{10}$', value):
            raise serializers.ValidationError("SIA license must be 10 digits")
        return value

    def validate(self, data):
        # Expiry date must be after issue date
        if data['issue_date'] >= data['expiry_date']:
            raise serializers.ValidationError("Expiry date must be after issue date")
        return data
```

## 5. Infrastructure Security

### 5.1 Environment Configuration

- **Use environment variables for all secrets**
- **Never commit `.env` files or secrets to version control**

```python
# settings.py
import os
from django.core.management.utils import get_random_secret_key

# Get settings from environment with fallbacks for development
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', get_random_secret_key())
DEBUG = os.environ.get('DEBUG', 'False') == 'True'
```

### 5.2 HTTPS Configuration

```python
# settings.py
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_REFERRER_POLICY = 'same-origin'
    SECURE_CONTENT_TYPE_NOSNIFF = True
```

### 5.3 Database Connection Security

- **Use SSL/TLS for database connections**
- **Don't use the default database ports**

```python
# settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST'),
        'PORT': os.environ.get('DB_PORT', '5432'),
        'OPTIONS': {
            'sslmode': 'require',
        }
    }
}
```

## 6. Deputy Integration Security

### 6.1 API Key Protection

- Store Deputy API key encrypted in the database
- Use a dedicated service account with minimum necessary permissions

```python
# models.py
from encrypted_fields import fields as encrypted_fields

class DeputyConfig(models.Model):
    api_endpoint = models.URLField()
    api_key = encrypted_fields.EncryptedCharField(max_length=255)
    is_active = models.BooleanField(default=True)
    last_sync_date = models.DateTimeField(null=True)
```

### 6.2 Data Validation During Integration

- Validate incoming data from Deputy before saving
- Implement data sanitization for all imported records

```python
# services.py
def import_deputy_timesheet(timesheet_data):
    # Validate required fields
    if not all(k in timesheet_data for k in ['Id', 'Employee', 'StartTime', 'EndTime']):
        raise ValidationError("Missing required fields in Deputy timesheet")

    # Sanitize and validate data
    employee_id = str(timesheet_data['Employee'])
    start_time = parse_datetime(timesheet_data['StartTime'])
    end_time = parse_datetime(timesheet_data['EndTime'])

    if start_time >= end_time:
        raise ValidationError("End time must be after start time")

    # Continue with import...
```

### 6.3 Secure Webhook Configuration

- Implement webhook verification using HMAC signatures
- Use HTTPS for all webhook endpoints

```python
# views.py
import hmac
import hashlib

class DeputyWebhookView(APIView):
    permission_classes = []  # Public endpoint

    def post(self, request, *args, **kwargs):
        # Get the signature from the header
        deputy_signature = request.META.get('HTTP_X_DEPUTY_SIGNATURE')
        if not deputy_signature:
            return Response({'error': 'Missing signature'}, status=400)

        # Get the webhook secret
        webhook_secret = DeputyConfig.objects.get_secret()

        # Calculate expected signature
        expected = hmac.new(
            webhook_secret.encode(),
            request.body,
            hashlib.sha256
        ).hexdigest()

        # Compare signatures
        if not hmac.compare_digest(expected, deputy_signature):
            return Response({'error': 'Invalid signature'}, status=403)

        # Process the webhook...
```

## 7. Regular Security Audits

### 7.1 Security Check Schedule

| Security Measure | Frequency |
|-----------------|-----------|
| Vulnerability scanning | Bi-weekly |
| Security code review | Before major releases |
| Penetration testing | Quarterly |
| Access review | Monthly |
| Encryption key rotation | Quarterly |
| Security policy review | Bi-annually |

### 7.2 Security Scanning Tools

- **Django Security Check**: `python manage.py check --deploy`
- **Bandit**: Static code analysis for Python security issues
- **Safety**: Check Python dependencies for known vulnerabilities
- **OWASP ZAP**: Dynamic application security testing

```bash
# Add to CI/CD pipeline
python manage.py check --deploy
bandit -r .
safety check -r requirements.txt
```

### 7.3 Incident Response Plan

1. **Detection**: Implement logging and monitoring to detect security incidents
2. **Containment**: Procedures to isolate affected systems
3. **Eradication**: Remove the cause of the breach
4. **Recovery**: Restore systems to normal operation
5. **Post-Incident Analysis**: Learn from incidents to improve security

## 8. Data Protection Compliance

### 8.1 GDPR Compliance

- Implement data subject access requests (DSAR) functionality
- Add data portability features
- Include consent management

```python
# views.py
class UserDataExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # Collect all user data
        profile_data = StaffProfile.objects.filter(user=user).first()
        shifts_data = Shift.objects.filter(staff_user=user)
        invoices_data = Invoice.objects.filter(staff_user=user)

        # Serialize the data
        data = {
            'user': UserSerializer(user).data,
            'profile': StaffProfileSerializer(profile_data).data if profile_data else None,
            'shifts': ShiftSerializer(shifts_data, many=True).data,
            'invoices': InvoiceSerializer(invoices_data, many=True).data,
        }

        # Generate JSON file
        response = HttpResponse(json.dumps(data, indent=4), content_type='application/json')
        response['Content-Disposition'] = f'attachment; filename="{user.username}_data_export.json"'

        return response
```

### 8.2 Data Retention Policies

```python
# management/commands/apply_retention_policies.py
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from your_app.models import AuditLog, Shift, Invoice

class Command(BaseCommand):
    help = 'Apply data retention policies'

    def handle(self, *args, **options):
        # Delete audit logs older than 2 years
        two_years_ago = timezone.now() - timedelta(days=730)
        deleted_logs = AuditLog.objects.filter(timestamp__lt=two_years_ago).delete()

        # Archive completed shifts older than 7 years
        seven_years_ago = timezone.now() - timedelta(days=2555)
        old_shifts = Shift.objects.filter(
            end_time__lt=seven_years_ago,
            status__in=['completed', 'approved']
        )

        # Archive the shifts to a long-term storage solution
        for shift in old_shifts:
            # Logic to archive shift data
            pass

        # Then delete them from the active database
        old_shifts.delete()

        # Similar logic for invoices and other data types...
```

## 9. Specific Django Security Settings

### 9.1 Security Middleware Configuration

```python
# settings.py
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'csp.middleware.CSPMiddleware',  # Content Security Policy
    'your_app.middleware.SecurityHeadersMiddleware',  # Custom security headers
]

# Content Security Policy
CSP_DEFAULT_SRC = ("'self'",)
CSP_STYLE_SRC = ("'self'", "'unsafe-inline'")  # If needed
CSP_SCRIPT_SRC = ("'self'",)
CSP_IMG_SRC = ("'self'", "data:", "https://via.placeholder.com")
CSP_CONNECT_SRC = ("'self'",)
```

### 9.2 Custom Security Middleware

```python
# middleware.py
class SecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Add security headers
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'

        return response
```

### 9.3 Database Backup Encryption

```python
# Custom management command for secure backups
from django.core.management.base import BaseCommand
import subprocess
import os
from cryptography.fernet import Fernet

class Command(BaseCommand):
    help = 'Create encrypted database backup'

    def handle(self, *args, **options):
        # Make database backup
        timestamp = self.get_timestamp()
        backup_filename = f'backup_{timestamp}.sql'
        subprocess.run([
            'pg_dump',
            '-h', os.environ.get('DB_HOST'),
            '-U', os.environ.get('DB_USER'),
            '-d', os.environ.get('DB_NAME'),
            '-f', backup_filename
        ])

        # Encrypt the backup
        encryption_key = os.environ.get('BACKUP_ENCRYPTION_KEY')
        fernet = Fernet(encryption_key)

        with open(backup_filename, 'rb') as file:
            file_data = file.read()

        encrypted_data = fernet.encrypt(file_data)

        with open(f'{backup_filename}.enc', 'wb') as file:
            file.write(encrypted_data)

        # Remove the unencrypted file
        os.remove(backup_filename)

        # Upload to secure storage (e.g. S3 with encryption)
        # ...
```

## 10. Monitoring and Alerting

### 10.1 Security Event Monitoring

- Implement centralized logging for security events
- Use Django Axes for login attempt monitoring

```python
# settings.py
INSTALLED_APPS = [
    # ...
    'axes',
]

MIDDLEWARE = [
    # ...
    'axes.middleware.AxesMiddleware',
]

AUTHENTICATION_BACKENDS = [
    'axes.backends.AxesBackend',
    'django.contrib.auth.backends.ModelBackend',
]

AXES_FAILURE_LIMIT = 5
AXES_LOCKOUT_TIME = 1  # 1 hour
AXES_RESET_ON_SUCCESS = True
```

### 10.2 Suspicious Activity Alerts

```python
# utils.py
from django.core.mail import send_mail
from django.conf import settings

def send_security_alert(user, event_type, details):
    subject = f"Security Alert: {event_type}"
    message = f"""
    Security alert for user: {user.username}

    Event: {event_type}
    Time: {timezone.now()}

    Details:
    {details}

    This is an automated security alert.
    """

    admin_emails = [admin[1] for admin in settings.ADMINS]
    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, admin_emails)

    # Also log to security events table
    SecurityEvent.objects.create(
        user=user,
        event_type=event_type,
        details=details
    )
```

## Conclusion

Implementing these security measures will significantly enhance the protection of sensitive data in the Security Staff Portal database. Regular security audits and continuous monitoring are essential to maintain the security posture over time.

Remember that security is an ongoing process, not a one-time implementation. Stay updated with the latest security practices and regularly review and update the security measures.
