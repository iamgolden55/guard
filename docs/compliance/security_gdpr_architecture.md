# Security Architecture and GDPR Compliance

## Overview

This document defines the comprehensive security architecture and GDPR compliance framework for the Regional Compliance API system. It ensures data protection, regulatory compliance, audit requirements, and enterprise-grade security across all compliance operations.

## Security Architecture

### Defense in Depth Strategy

The Regional Compliance API implements a multi-layered security approach:

```
┌─────────────────────────────────────────────────┐
│                   Internet                      │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│              CDN / WAF                          │
│  • DDoS Protection                             │
│  • Rate Limiting                               │
│  • Geo-blocking                                │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│            Load Balancer                        │
│  • SSL Termination                             │
│  • Health Checks                               │
│  • Request Distribution                        │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│          API Gateway                            │
│  • Authentication                              │
│  • Authorization                               │
│  • Request Validation                          │
│  • Audit Logging                               │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│        Application Layer                        │
│  • Business Logic Security                     │
│  • Input Sanitization                          │
│  • Output Encoding                             │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│          Data Layer                             │
│  • Encryption at Rest                          │
│  • Database Security                           │
│  • Access Controls                             │
└─────────────────────────────────────────────────┘
```

### Authentication and Authorization

#### JWT-Based Authentication

```python
import jwt
from datetime import datetime, timedelta
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from django.conf import settings

class ComplianceJWTManager:
    """Secure JWT management for compliance API"""
    
    def __init__(self):
        self.private_key = self._load_private_key()
        self.public_key = self._load_public_key()
        self.algorithm = 'RS256'
        self.access_token_expire = timedelta(hours=1)
        self.refresh_token_expire = timedelta(days=7)
    
    def generate_tokens(self, user_id: int, roles: list, compliance_scope: dict) -> dict:
        """Generate access and refresh tokens with compliance-specific claims"""
        
        now = datetime.utcnow()
        
        # Access token with compliance permissions
        access_payload = {
            'user_id': user_id,
            'roles': roles,
            'compliance_scope': compliance_scope,
            'iat': now,
            'exp': now + self.access_token_expire,
            'aud': 'ssms-compliance-api',
            'iss': 'ssms-auth-service',
            'token_type': 'access'
        }
        
        # Refresh token (limited claims for security)
        refresh_payload = {
            'user_id': user_id,
            'iat': now,
            'exp': now + self.refresh_token_expire,
            'aud': 'ssms-compliance-api',
            'iss': 'ssms-auth-service',
            'token_type': 'refresh'
        }
        
        access_token = jwt.encode(access_payload, self.private_key, algorithm=self.algorithm)
        refresh_token = jwt.encode(refresh_payload, self.private_key, algorithm=self.algorithm)
        
        return {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'token_type': 'Bearer',
            'expires_in': int(self.access_token_expire.total_seconds())
        }
    
    def verify_token(self, token: str) -> dict:
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(
                token, 
                self.public_key, 
                algorithms=[self.algorithm],
                audience='ssms-compliance-api',
                issuer='ssms-auth-service'
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise AuthenticationError("Token has expired")
        except jwt.InvalidTokenError:
            raise AuthenticationError("Invalid token")
    
    def _load_private_key(self):
        """Load RSA private key for token signing"""
        with open(settings.JWT_PRIVATE_KEY_PATH, 'rb') as key_file:
            return serialization.load_pem_private_key(
                key_file.read(),
                password=settings.JWT_PRIVATE_KEY_PASSWORD.encode(),
                backend=default_backend()
            )
    
    def _load_public_key(self):
        """Load RSA public key for token verification"""
        with open(settings.JWT_PUBLIC_KEY_PATH, 'rb') as key_file:
            return serialization.load_pem_public_key(
                key_file.read(),
                backend=default_backend()
            )

# Compliance-specific authorization decorator
def require_compliance_permission(permission: str, resource_type: str = None):
    """Decorator to enforce compliance-specific permissions"""
    
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            # Extract token from request
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if not auth_header.startswith('Bearer '):
                return JsonResponse(
                    {'error': 'Authentication required'}, 
                    status=401
                )
            
            token = auth_header.split(' ')[1]
            
            try:
                # Verify token
                jwt_manager = ComplianceJWTManager()
                payload = jwt_manager.verify_token(token)
                
                # Check compliance scope
                compliance_scope = payload.get('compliance_scope', {})
                user_permissions = compliance_scope.get('permissions', [])
                
                # Verify permission
                if permission not in user_permissions:
                    return JsonResponse(
                        {'error': f'Permission {permission} required'}, 
                        status=403
                    )
                
                # Resource-specific authorization
                if resource_type:
                    allowed_resources = compliance_scope.get('resources', {})
                    if resource_type not in allowed_resources:
                        return JsonResponse(
                            {'error': f'Access to {resource_type} not permitted'}, 
                            status=403
                        )
                
                # Add user context to request
                request.compliance_user = {
                    'user_id': payload['user_id'],
                    'roles': payload['roles'],
                    'permissions': user_permissions,
                    'scope': compliance_scope
                }
                
                return view_func(request, *args, **kwargs)
                
            except AuthenticationError as e:
                return JsonResponse({'error': str(e)}, status=401)
            except Exception as e:
                logger.error(f"Authorization error: {str(e)}")
                return JsonResponse({'error': 'Authorization failed'}, status=500)
        
        return wrapper
    return decorator

# Usage example
@require_compliance_permission('violation:resolve', 'compliance_violations')
def resolve_violation_view(request, violation_id):
    # Only users with violation:resolve permission can access
    pass
```

#### Role-Based Access Control (RBAC)

```python
class ComplianceRoleManager:
    """Manage compliance-specific roles and permissions"""
    
    COMPLIANCE_ROLES = {
        'compliance_admin': {
            'name': 'Compliance Administrator',
            'description': 'Full compliance system administration',
            'permissions': [
                'compliance:admin',
                'regulation:create', 'regulation:read', 'regulation:update', 'regulation:delete',
                'violation:create', 'violation:read', 'violation:update', 'violation:delete',
                'profile:create', 'profile:read', 'profile:update', 'profile:delete',
                'audit:read', 'audit:export',
                'metrics:read', 'metrics:export',
                'user:impersonate'
            ],
            'data_access': {
                'scope': 'global',
                'regions': ['*'],
                'users': ['*'],
                'sensitive_data': True
            }
        },
        'compliance_manager': {
            'name': 'Compliance Manager',
            'description': 'Regional compliance management',
            'permissions': [
                'violation:read', 'violation:resolve', 'violation:approve',
                'profile:read', 'profile:update',
                'metrics:read',
                'schedule:validate', 'schedule:approve',
                'report:generate', 'report:export'
            ],
            'data_access': {
                'scope': 'regional',
                'regions': [],  # Set per user
                'users': [],    # Set per user (team members)
                'sensitive_data': False
            }
        },
        'compliance_officer': {
            'name': 'Compliance Officer',
            'description': 'Compliance monitoring and reporting',
            'permissions': [
                'violation:read', 'violation:investigate',
                'profile:read',
                'metrics:read',
                'schedule:validate',
                'report:generate'
            ],
            'data_access': {
                'scope': 'regional',
                'regions': [],
                'users': [],
                'sensitive_data': False
            }
        },
        'staff_member': {
            'name': 'Staff Member',
            'description': 'Basic compliance access for staff',
            'permissions': [
                'profile:read_own',
                'violation:read_own',
                'schedule:submit',
                'metrics:read_own'
            ],
            'data_access': {
                'scope': 'personal',
                'regions': [],
                'users': ['self'],
                'sensitive_data': False
            }
        }
    }
    
    @classmethod
    def get_user_permissions(cls, user_roles: list, user_id: int = None) -> dict:
        """Get aggregated permissions for user roles"""
        
        permissions = set()
        data_access = {
            'scope': 'none',
            'regions': set(),
            'users': set(),
            'sensitive_data': False
        }
        
        for role in user_roles:
            if role in cls.COMPLIANCE_ROLES:
                role_config = cls.COMPLIANCE_ROLES[role]
                
                # Aggregate permissions
                permissions.update(role_config['permissions'])
                
                # Merge data access (most permissive wins)
                role_access = role_config['data_access']
                
                if role_access['scope'] == 'global':
                    data_access['scope'] = 'global'
                    data_access['regions'] = {'*'}
                    data_access['users'] = {'*'}
                elif role_access['scope'] == 'regional' and data_access['scope'] != 'global':
                    data_access['scope'] = 'regional'
                    data_access['regions'].update(role_access.get('regions', []))
                    data_access['users'].update(role_access.get('users', []))
                elif role_access['scope'] == 'personal' and data_access['scope'] == 'none':
                    data_access['scope'] = 'personal'
                    data_access['users'] = {str(user_id)} if user_id else set()
                
                if role_access['sensitive_data']:
                    data_access['sensitive_data'] = True
        
        return {
            'permissions': list(permissions),
            'data_access': {
                'scope': data_access['scope'],
                'regions': list(data_access['regions']),
                'users': list(data_access['users']),
                'sensitive_data': data_access['sensitive_data']
            }
        }
    
    @classmethod
    def check_permission(cls, user_permissions: list, required_permission: str) -> bool:
        """Check if user has required permission"""
        
        # Direct permission match
        if required_permission in user_permissions:
            return True
        
        # Wildcard permissions
        permission_parts = required_permission.split(':')
        if len(permission_parts) == 2:
            wildcard_permission = f"{permission_parts[0]}:*"
            if wildcard_permission in user_permissions:
                return True
        
        # Admin override
        if 'compliance:admin' in user_permissions:
            return True
        
        return False
```

### Data Encryption

#### Encryption at Rest

```python
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import os

class ComplianceDataEncryption:
    """Handle encryption of sensitive compliance data"""
    
    def __init__(self):
        self.master_key = self._derive_master_key()
        self.fernet = Fernet(self.master_key)
    
    def _derive_master_key(self) -> bytes:
        """Derive encryption key from master password and salt"""
        
        master_password = settings.COMPLIANCE_MASTER_PASSWORD.encode()
        salt = settings.COMPLIANCE_ENCRYPTION_SALT.encode()
        
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(master_password))
        return key
    
    def encrypt_field(self, plaintext: str) -> str:
        """Encrypt sensitive field data"""
        if not plaintext:
            return plaintext
        
        encrypted_data = self.fernet.encrypt(plaintext.encode())
        return base64.urlsafe_b64encode(encrypted_data).decode()
    
    def decrypt_field(self, encrypted_data: str) -> str:
        """Decrypt sensitive field data"""
        if not encrypted_data:
            return encrypted_data
        
        try:
            decoded_data = base64.urlsafe_b64decode(encrypted_data.encode())
            decrypted_data = self.fernet.decrypt(decoded_data)
            return decrypted_data.decode()
        except Exception as e:
            logger.error(f"Decryption failed: {str(e)}")
            raise ValueError("Failed to decrypt data")
    
    def encrypt_json_field(self, json_data: dict) -> str:
        """Encrypt JSON field containing sensitive data"""
        if not json_data:
            return json_data
        
        json_str = json.dumps(json_data, separators=(',', ':'))
        return self.encrypt_field(json_str)
    
    def decrypt_json_field(self, encrypted_json: str) -> dict:
        """Decrypt JSON field"""
        if not encrypted_json:
            return {}
        
        decrypted_str = self.decrypt_field(encrypted_json)
        return json.loads(decrypted_str)

# Custom Django model field for automatic encryption
class EncryptedField(models.TextField):
    """Django field that automatically encrypts/decrypts data"""
    
    def __init__(self, *args, **kwargs):
        self.encryption = ComplianceDataEncryption()
        super().__init__(*args, **kwargs)
    
    def from_db_value(self, value, expression, connection):
        if value is None:
            return value
        return self.encryption.decrypt_field(value)
    
    def to_python(self, value):
        if isinstance(value, str) and value:
            return self.encryption.decrypt_field(value)
        return value
    
    def get_prep_value(self, value):
        if value is None:
            return value
        return self.encryption.encrypt_field(str(value))

# Usage in models
class ComplianceProfile(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    
    # Encrypted sensitive fields
    personal_notes = EncryptedField(blank=True, help_text="Encrypted personal notes")
    sensitive_metadata = EncryptedField(blank=True, help_text="Encrypted metadata")
    
    # Non-sensitive fields remain unencrypted
    max_daily_hours_override = models.DecimalField(max_digits=4, decimal_places=2, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

#### Encryption in Transit

```python
# SSL/TLS Configuration
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = 'DENY'

# API-specific security headers
COMPLIANCE_API_SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
}

class ComplianceSecurityHeadersMiddleware:
    """Add security headers to compliance API responses"""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        response = self.get_response(request)
        
        # Only apply to compliance API endpoints
        if request.path.startswith('/api/v1/compliance/'):
            for header, value in COMPLIANCE_API_SECURITY_HEADERS.items():
                response[header] = value
        
        return response
```

## GDPR Compliance Framework

### Data Protection Impact Assessment (DPIA)

```python
class GDPRComplianceManager:
    """Manage GDPR compliance for compliance data"""
    
    # Data categories and their GDPR classification
    DATA_CATEGORIES = {
        'personal_identifiers': {
            'fields': ['user_id', 'employee_id', 'email', 'phone'],
            'classification': 'personal_data',
            'retention_period': timedelta(days=2555),  # 7 years
            'legal_basis': 'legitimate_interest',
            'encryption_required': True
        },
        'working_time_data': {
            'fields': ['shift_hours', 'overtime_hours', 'break_duration'],
            'classification': 'personal_data',
            'retention_period': timedelta(days=2555),  # 7 years for employment records
            'legal_basis': 'legal_obligation',
            'encryption_required': False
        },
        'compliance_violations': {
            'fields': ['violation_type', 'severity', 'resolution_notes'],
            'classification': 'personal_data',
            'retention_period': timedelta(days=2555),  # 7 years for audit
            'legal_basis': 'legal_obligation',
            'encryption_required': True
        },
        'biometric_data': {
            'fields': ['fingerprint_hash', 'facial_recognition_id'],
            'classification': 'special_category',
            'retention_period': timedelta(days=365),   # 1 year
            'legal_basis': 'explicit_consent',
            'encryption_required': True
        },
        'health_data': {
            'fields': ['medical_exemptions', 'disability_accommodations'],
            'classification': 'special_category',
            'retention_period': timedelta(days=2555),  # 7 years
            'legal_basis': 'explicit_consent',
            'encryption_required': True
        }
    }
    
    def __init__(self):
        self.audit_logger = self._setup_audit_logger()
    
    def log_data_access(self, user_id: int, data_subject_id: int, 
                       data_category: str, operation: str, 
                       legal_basis: str = None) -> None:
        """Log data access for GDPR audit trail"""
        
        audit_entry = {
            'timestamp': timezone.now().isoformat(),
            'user_id': user_id,
            'data_subject_id': data_subject_id,
            'data_category': data_category,
            'operation': operation,
            'legal_basis': legal_basis or self._get_legal_basis(data_category),
            'ip_address': self._get_current_ip(),
            'user_agent': self._get_current_user_agent(),
            'session_id': self._get_current_session_id()
        }
        
        self.audit_logger.info(json.dumps(audit_entry))
    
    def check_retention_compliance(self) -> dict:
        """Check for data that exceeds retention periods"""
        
        violations = []
        
        for category, config in self.DATA_CATEGORIES.items():
            retention_cutoff = timezone.now() - config['retention_period']
            
            # Check different models based on category
            if category == 'compliance_violations':
                expired_records = ComplianceViolation.objects.filter(
                    created_at__lt=retention_cutoff,
                    gdpr_deletion_date__isnull=True  # Not yet marked for deletion
                )
                
                for record in expired_records:
                    violations.append({
                        'model': 'ComplianceViolation',
                        'record_id': record.id,
                        'data_subject': record.user_id,
                        'category': category,
                        'created_at': record.created_at.isoformat(),
                        'retention_cutoff': retention_cutoff.isoformat(),
                        'action_required': 'delete_or_anonymize'
                    })
        
        return {
            'total_violations': len(violations),
            'violations': violations,
            'checked_at': timezone.now().isoformat()
        }
    
    def anonymize_user_data(self, user_id: int, reason: str) -> dict:
        """Anonymize user data while preserving statistical value"""
        
        anonymized_data = {
            'user_id': user_id,
            'reason': reason,
            'anonymized_at': timezone.now().isoformat(),
            'operations': []
        }
        
        # Anonymize compliance violations
        violations = ComplianceViolation.objects.filter(user_id=user_id)
        for violation in violations:
            # Replace user_id with anonymized identifier
            anonymized_id = self._generate_anonymized_id(user_id, 'violation')
            violation.user_id = None
            violation.anonymized_user_id = anonymized_id
            violation.resolution_notes = self._anonymize_text(violation.resolution_notes)
            violation.gdpr_anonymized_date = timezone.now()
            violation.save()
        
        anonymized_data['operations'].append({
            'model': 'ComplianceViolation',
            'records_affected': violations.count(),
            'action': 'anonymized'
        })
        
        # Anonymize working hours metrics
        metrics = WorkingHoursMetrics.objects.filter(user_id=user_id)
        for metric in metrics:
            anonymized_id = self._generate_anonymized_id(user_id, 'metrics')
            metric.user_id = None
            metric.anonymized_user_id = anonymized_id
            metric.gdpr_anonymized_date = timezone.now()
            metric.save()
        
        anonymized_data['operations'].append({
            'model': 'WorkingHoursMetrics',
            'records_affected': metrics.count(),
            'action': 'anonymized'
        })
        
        # Log anonymization action
        self.log_data_access(
            user_id=0,  # System action
            data_subject_id=user_id,
            data_category='all',
            operation='anonymize',
            legal_basis='gdpr_erasure'
        )
        
        return anonymized_data
    
    def export_user_data(self, user_id: int, requester_id: int) -> dict:
        """Export all user data for GDPR data portability"""
        
        # Log data export request
        self.log_data_access(
            user_id=requester_id,
            data_subject_id=user_id,
            data_category='all',
            operation='export',
            legal_basis='gdpr_portability'
        )
        
        export_data = {
            'export_date': timezone.now().isoformat(),
            'data_subject_id': user_id,
            'requester_id': requester_id,
            'data': {}
        }
        
        # Export compliance profile
        try:
            profile = ComplianceProfile.objects.get(user_id=user_id)
            export_data['data']['compliance_profile'] = {
                'max_daily_hours_override': float(profile.max_daily_hours_override) if profile.max_daily_hours_override else None,
                'max_weekly_hours_override': float(profile.max_weekly_hours_override) if profile.max_weekly_hours_override else None,
                'working_hours_regulation': profile.working_hours_regulation.country_code if profile.working_hours_regulation else None,
                'created_at': profile.created_at.isoformat(),
                'updated_at': profile.updated_at.isoformat()
            }
        except ComplianceProfile.DoesNotExist:
            export_data['data']['compliance_profile'] = None
        
        # Export violations
        violations = ComplianceViolation.objects.filter(user_id=user_id)
        export_data['data']['violations'] = [
            {
                'violation_type': v.violation_type,
                'severity': v.severity,
                'description': v.description,
                'period_start': v.period_start.isoformat(),
                'period_end': v.period_end.isoformat(),
                'resolution_status': v.resolution_status,
                'created_at': v.created_at.isoformat(),
                'resolved_at': v.resolved_at.isoformat() if v.resolved_at else None
            }
            for v in violations
        ]
        
        # Export metrics
        metrics = WorkingHoursMetrics.objects.filter(user_id=user_id)
        export_data['data']['working_hours_metrics'] = [
            {
                'period_type': m.period_type,
                'period_start': m.period_start.isoformat(),
                'period_end': m.period_end.isoformat(),
                'total_hours_worked': float(m.total_hours_worked),
                'overtime_hours': float(m.overtime_hours),
                'compliance_score': float(m.compliance_score),
                'violation_count': m.violation_count,
                'calculated_at': m.calculated_at.isoformat()
            }
            for m in metrics
        ]
        
        return export_data
    
    def _generate_anonymized_id(self, original_id: int, category: str) -> str:
        """Generate consistent anonymized identifier"""
        import hashlib
        
        hash_input = f"{original_id}:{category}:{settings.SECRET_KEY}"
        hash_object = hashlib.sha256(hash_input.encode())
        return f"anon_{hash_object.hexdigest()[:16]}"
    
    def _anonymize_text(self, text: str) -> str:
        """Anonymize text content while preserving structure"""
        if not text:
            return text
        
        # Replace names, emails, phone numbers with anonymized versions
        import re
        
        # Replace email addresses
        text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', 
                     '[EMAIL_ANONYMIZED]', text)
        
        # Replace phone numbers
        text = re.sub(r'\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b', 
                     '[PHONE_ANONYMIZED]', text)
        
        # Replace potential names (simple heuristic)
        text = re.sub(r'\b[A-Z][a-z]+\s+[A-Z][a-z]+\b', 
                     '[NAME_ANONYMIZED]', text)
        
        return text
    
    def _setup_audit_logger(self):
        """Setup dedicated audit logger for GDPR compliance"""
        audit_logger = logging.getLogger('gdpr_audit')
        audit_logger.setLevel(logging.INFO)
        
        # Create file handler for audit logs
        handler = logging.FileHandler('/var/log/compliance/gdpr_audit.log')
        formatter = logging.Formatter(
            '%(asctime)s - GDPR_AUDIT - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        audit_logger.addHandler(handler)
        
        return audit_logger
```

### Data Subject Rights Implementation

```python
class DataSubjectRightsManager:
    """Implement GDPR data subject rights"""
    
    def __init__(self):
        self.gdpr_manager = GDPRComplianceManager()
    
    def handle_access_request(self, user_id: int, requester_email: str) -> dict:
        """Handle Article 15 - Right of access"""
        
        # Verify requester identity (simplified for example)
        if not self._verify_identity(user_id, requester_email):
            raise PermissionDenied("Identity verification failed")
        
        # Export user data
        export_data = self.gdpr_manager.export_user_data(user_id, user_id)
        
        # Add metadata about data processing
        export_data['data_processing_info'] = {
            'purposes': [
                'Employment law compliance',
                'Working time regulation enforcement',
                'Health and safety monitoring',
                'Payroll calculation'
            ],
            'legal_bases': [
                'Legal obligation (Working Time Regulations)',
                'Legitimate interest (Employee safety)',
                'Contract performance (Employment terms)'
            ],
            'retention_periods': {
                category: config['retention_period'].days 
                for category, config in self.gdpr_manager.DATA_CATEGORIES.items()
            },
            'data_recipients': [
                'Internal HR systems',
                'Payroll processors',
                'Regulatory authorities (when required)',
                'Authorized managers and compliance officers'
            ]
        }
        
        return export_data
    
    def handle_erasure_request(self, user_id: int, requester_email: str, 
                              reason: str = 'user_request') -> dict:
        """Handle Article 17 - Right to erasure"""
        
        # Verify requester identity
        if not self._verify_identity(user_id, requester_email):
            raise PermissionDenied("Identity verification failed")
        
        # Check if erasure is legally permissible
        erasure_check = self._assess_erasure_request(user_id)
        
        if not erasure_check['can_erase']:
            return {
                'status': 'denied',
                'reason': erasure_check['denial_reason'],
                'legal_basis': erasure_check['legal_basis'],
                'retention_required_until': erasure_check['retention_required_until']
            }
        
        # Perform anonymization (safer than deletion for compliance data)
        anonymization_result = self.gdpr_manager.anonymize_user_data(user_id, reason)
        
        return {
            'status': 'completed',
            'action': 'anonymized',
            'reason': 'GDPR erasure request',
            'anonymization_details': anonymization_result,
            'effective_date': timezone.now().isoformat()
        }
    
    def handle_rectification_request(self, user_id: int, field_updates: dict) -> dict:
        """Handle Article 16 - Right to rectification"""
        
        rectification_log = []
        
        # Update compliance profile
        try:
            profile = ComplianceProfile.objects.get(user_id=user_id)
            
            for field, new_value in field_updates.items():
                if hasattr(profile, field):
                    old_value = getattr(profile, field)
                    setattr(profile, field, new_value)
                    
                    rectification_log.append({
                        'model': 'ComplianceProfile',
                        'field': field,
                        'old_value': str(old_value),
                        'new_value': str(new_value),
                        'updated_at': timezone.now().isoformat()
                    })
            
            profile.save()
            
        except ComplianceProfile.DoesNotExist:
            pass
        
        # Log rectification
        self.gdpr_manager.log_data_access(
            user_id=user_id,
            data_subject_id=user_id,
            data_category='personal_data',
            operation='rectify',
            legal_basis='gdpr_rectification'
        )
        
        return {
            'status': 'completed',
            'rectifications': rectification_log,
            'updated_at': timezone.now().isoformat()
        }
    
    def handle_portability_request(self, user_id: int, format_type: str = 'json') -> dict:
        """Handle Article 20 - Right to data portability"""
        
        export_data = self.gdpr_manager.export_user_data(user_id, user_id)
        
        if format_type == 'csv':
            # Convert to CSV format for portability
            return self._convert_to_csv(export_data)
        elif format_type == 'xml':
            # Convert to XML format
            return self._convert_to_xml(export_data)
        else:
            # Default JSON format
            return export_data
    
    def handle_restriction_request(self, user_id: int, restriction_type: str) -> dict:
        """Handle Article 18 - Right to restriction of processing"""
        
        # Add restriction flags to user data
        ComplianceProfile.objects.filter(user_id=user_id).update(
            gdpr_processing_restricted=True,
            gdpr_restriction_type=restriction_type,
            gdpr_restriction_date=timezone.now()
        )
        
        ComplianceViolation.objects.filter(user_id=user_id).update(
            gdpr_processing_restricted=True,
            gdpr_restriction_date=timezone.now()
        )
        
        return {
            'status': 'completed',
            'restriction_type': restriction_type,
            'effective_date': timezone.now().isoformat(),
            'note': 'Data processing has been restricted. Data is retained but not processed.'
        }
    
    def _assess_erasure_request(self, user_id: int) -> dict:
        """Assess whether erasure request can be granted"""
        
        # Check for legal obligations to retain data
        current_violations = ComplianceViolation.objects.filter(
            user_id=user_id,
            resolution_status__in=['open', 'investigating']
        ).exists()
        
        # Check employment status
        user = User.objects.get(id=user_id)
        is_current_employee = user.is_active
        
        # Check regulatory retention requirements
        last_shift_date = Shift.objects.filter(
            user_id=user_id
        ).aggregate(
            last_shift=models.Max('end_time')
        )['last_shift']
        
        if last_shift_date:
            retention_required_until = last_shift_date + timedelta(days=2555)  # 7 years
            can_erase = timezone.now().date() > retention_required_until.date()
        else:
            can_erase = True
            retention_required_until = None
        
        if current_violations:
            return {
                'can_erase': False,
                'denial_reason': 'Open compliance violations require retention',
                'legal_basis': 'Legal obligation under employment law',
                'retention_required_until': None
            }
        
        if is_current_employee:
            return {
                'can_erase': False,
                'denial_reason': 'Current employee data required for ongoing employment',
                'legal_basis': 'Contract performance and legal obligations',
                'retention_required_until': None
            }
        
        if not can_erase:
            return {
                'can_erase': False,
                'denial_reason': 'Regulatory retention period not yet expired',
                'legal_basis': 'Legal obligation under Working Time Regulations',
                'retention_required_until': retention_required_until.isoformat() if retention_required_until else None
            }
        
        return {
            'can_erase': True,
            'denial_reason': None,
            'legal_basis': None,
            'retention_required_until': None
        }
    
    def _verify_identity(self, user_id: int, email: str) -> bool:
        """Verify identity of data subject making request"""
        try:
            user = User.objects.get(id=user_id, email=email)
            return True
        except User.DoesNotExist:
            return False
```

## Audit Trail and Compliance Monitoring

### Comprehensive Audit Logging

```python
class ComplianceAuditLogger:
    """Comprehensive audit logging for compliance operations"""
    
    def __init__(self):
        self.logger = logging.getLogger('compliance_audit')
        self.setup_logger()
    
    def setup_logger(self):
        """Setup audit logger with secure file handling"""
        
        # Create dedicated audit log file
        handler = logging.handlers.RotatingFileHandler(
            '/var/log/compliance/audit.log',
            maxBytes=100*1024*1024,  # 100MB
            backupCount=10
        )
        
        # Structured audit log format
        formatter = logging.Formatter(
            '%(asctime)s|%(levelname)s|%(message)s',
            datefmt='%Y-%m-%d %H:%M:%S UTC'
        )
        handler.setFormatter(formatter)
        
        self.logger.addHandler(handler)
        self.logger.setLevel(logging.INFO)
    
    def log_api_access(self, request, response, processing_time: float):
        """Log API access for audit trail"""
        
        user_id = getattr(request, 'compliance_user', {}).get('user_id', 'anonymous')
        
        audit_data = {
            'event_type': 'api_access',
            'user_id': user_id,
            'endpoint': request.path,
            'method': request.method,
            'status_code': response.status_code,
            'processing_time_ms': round(processing_time * 1000, 2),
            'ip_address': self._get_client_ip(request),
            'user_agent': request.META.get('HTTP_USER_AGENT', ''),
            'request_id': getattr(request, 'request_id', None),
            'query_params': dict(request.GET),
            'response_size': len(response.content) if hasattr(response, 'content') else 0
        }
        
        self.logger.info(json.dumps(audit_data, separators=(',', ':')))
    
    def log_compliance_action(self, action_type: str, user_id: int, 
                            target_user_id: int = None, details: dict = None):
        """Log compliance-specific actions"""
        
        audit_data = {
            'event_type': 'compliance_action',
            'action_type': action_type,
            'actor_user_id': user_id,
            'target_user_id': target_user_id,
            'timestamp': timezone.now().isoformat(),
            'details': details or {},
            'session_id': self._get_current_session_id()
        }
        
        self.logger.info(json.dumps(audit_data, separators=(',', ':')))
    
    def log_data_access(self, user_id: int, accessed_data: dict, access_reason: str):
        """Log sensitive data access"""
        
        audit_data = {
            'event_type': 'data_access',
            'user_id': user_id,
            'accessed_data': {
                'data_types': accessed_data.get('data_types', []),
                'record_count': accessed_data.get('record_count', 0),
                'time_range': accessed_data.get('time_range', {}),
                'sensitive_fields': accessed_data.get('sensitive_fields', [])
            },
            'access_reason': access_reason,
            'timestamp': timezone.now().isoformat(),
            'legal_basis': accessed_data.get('legal_basis', 'legitimate_interest')
        }
        
        self.logger.info(json.dumps(audit_data, separators=(',', ':')))
    
    def log_security_event(self, event_type: str, severity: str, details: dict):
        """Log security-related events"""
        
        audit_data = {
            'event_type': 'security_event',
            'security_event_type': event_type,
            'severity': severity,
            'timestamp': timezone.now().isoformat(),
            'details': details,
            'source_ip': details.get('ip_address', 'unknown'),
            'user_agent': details.get('user_agent', 'unknown')
        }
        
        # Also send to security monitoring system
        if severity in ['high', 'critical']:
            self._send_security_alert(audit_data)
        
        self.logger.warning(json.dumps(audit_data, separators=(',', ':')))
    
    def _get_client_ip(self, request) -> str:
        """Get client IP address considering proxy headers"""
        
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        
        x_real_ip = request.META.get('HTTP_X_REAL_IP')
        if x_real_ip:
            return x_real_ip
        
        return request.META.get('REMOTE_ADDR', 'unknown')
    
    def _send_security_alert(self, audit_data: dict):
        """Send critical security alerts to monitoring system"""
        # Implementation depends on monitoring system
        # Could be email, Slack, PagerDuty, etc.
        pass

# Audit middleware
class ComplianceAuditMiddleware:
    """Middleware to audit all compliance API requests"""
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.audit_logger = ComplianceAuditLogger()
    
    def __call__(self, request):
        start_time = time.time()
        
        # Generate unique request ID
        request.request_id = self._generate_request_id()
        
        response = self.get_response(request)
        
        processing_time = time.time() - start_time
        
        # Audit compliance API requests
        if request.path.startswith('/api/v1/compliance/'):
            self.audit_logger.log_api_access(request, response, processing_time)
        
        return response
    
    def _generate_request_id(self) -> str:
        """Generate unique request identifier"""
        import uuid
        return str(uuid.uuid4())
```

### Regulatory Compliance Reporting

```python
class RegulatoryComplianceReporter:
    """Generate reports for regulatory inspections"""
    
    def generate_working_time_compliance_report(self, 
                                              start_date: date, 
                                              end_date: date,
                                              venue_ids: List[int] = None) -> dict:
        """Generate comprehensive working time compliance report"""
        
        report_data = {
            'report_type': 'working_time_compliance',
            'period': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat()
            },
            'generated_at': timezone.now().isoformat(),
            'venue_scope': venue_ids or 'all',
            'summary': {},
            'detailed_findings': [],
            'recommendations': []
        }
        
        # Query violations in the period
        violations_query = ComplianceViolation.objects.filter(
            period_start__gte=start_date,
            period_end__lte=end_date
        )
        
        if venue_ids:
            violations_query = violations_query.filter(
                shift__venue_id__in=venue_ids
            )
        
        violations = violations_query.values(
            'violation_type', 'severity'
        ).annotate(
            count=Count('id')
        ).order_by('violation_type', 'severity')
        
        # Summary statistics
        total_violations = sum(v['count'] for v in violations)
        critical_violations = sum(
            v['count'] for v in violations 
            if v['severity'] == 'critical'
        )
        
        report_data['summary'] = {
            'total_violations': total_violations,
            'critical_violations': critical_violations,
            'violation_rate': self._calculate_violation_rate(start_date, end_date),
            'compliance_score': self._calculate_overall_compliance_score(start_date, end_date),
            'most_common_violations': violations[:5]
        }
        
        # Detailed findings
        for violation in violations:
            if violation['severity'] in ['major', 'critical']:
                finding = {
                    'violation_type': violation['violation_type'],
                    'severity': violation['severity'],
                    'occurrence_count': violation['count'],
                    'regulatory_impact': self._assess_regulatory_impact(
                        violation['violation_type'], 
                        violation['severity']
                    ),
                    'corrective_actions': self._get_corrective_actions(
                        violation['violation_type']
                    )
                }
                report_data['detailed_findings'].append(finding)
        
        # Recommendations
        if critical_violations > 0:
            report_data['recommendations'].append({
                'priority': 'immediate',
                'action': 'Review and address all critical violations',
                'timeframe': '24 hours'
            })
        
        if total_violations > 0:
            report_data['recommendations'].append({
                'priority': 'high',
                'action': 'Implement additional compliance training',
                'timeframe': '2 weeks'
            })
        
        return report_data
    
    def generate_gdpr_compliance_report(self) -> dict:
        """Generate GDPR compliance status report"""
        
        gdpr_manager = GDPRComplianceManager()
        retention_check = gdpr_manager.check_retention_compliance()
        
        # Count data processing activities
        total_users = User.objects.filter(is_active=True).count()
        users_with_violations = ComplianceViolation.objects.values(
            'user_id'
        ).distinct().count()
        
        return {
            'report_type': 'gdpr_compliance',
            'generated_at': timezone.now().isoformat(),
            'data_protection_status': {
                'total_active_users': total_users,
                'users_with_compliance_data': users_with_violations,
                'retention_violations': retention_check['total_violations'],
                'data_categories_processed': len(gdpr_manager.DATA_CATEGORIES),
                'encryption_status': 'enabled',
                'audit_logging': 'comprehensive'
            },
            'retention_compliance': retention_check,
            'data_subject_requests': self._get_data_subject_requests_summary(),
            'privacy_controls': {
                'field_level_encryption': True,
                'access_logging': True,
                'consent_management': True,
                'data_minimization': True,
                'purpose_limitation': True
            }
        }
    
    def _calculate_violation_rate(self, start_date: date, end_date: date) -> float:
        """Calculate violation rate per 1000 shifts"""
        
        total_shifts = Shift.objects.filter(
            start_time__date__gte=start_date,
            end_time__date__lte=end_date,
            status='completed'
        ).count()
        
        total_violations = ComplianceViolation.objects.filter(
            period_start__date__gte=start_date,
            period_end__date__lte=end_date
        ).count()
        
        if total_shifts == 0:
            return 0.0
        
        return (total_violations / total_shifts) * 1000
    
    def _assess_regulatory_impact(self, violation_type: str, severity: str) -> str:
        """Assess regulatory impact of violation"""
        
        impact_matrix = {
            ('weekly_overtime', 'critical'): 'High - Working Time Regulations breach',
            ('daily_overtime', 'major'): 'Medium - Daily hours limit exceeded',
            ('insufficient_rest', 'major'): 'High - Rest period requirements violated',
            ('missing_break', 'minor'): 'Low - Break requirements not met',
        }
        
        return impact_matrix.get(
            (violation_type, severity), 
            'Medium - Compliance standard deviation'
        )
```

This comprehensive security and GDPR compliance framework ensures the Regional Compliance API meets enterprise security standards while maintaining full regulatory compliance across all data protection requirements. The multi-layered security approach, combined with robust GDPR implementation, provides a solid foundation for handling sensitive employment compliance data.