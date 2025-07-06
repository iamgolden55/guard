# 🔐 Production Authentication Guide

## Current Status
- ✅ AI parsing and intelligence working perfectly
- ❌ Backend API requires valid authentication token
- 🔄 Using test data fallback when API fails

## Production Authentication Options

### Option 1: Service Account Token (Recommended)

#### Step 1: Create AI Service Account
```python
# In your Django admin or shell
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token

# Create dedicated AI service user
ai_user = User.objects.create_user(
    username='ai_service',
    email='ai-service@yourdomain.com',
    is_staff=True,  # Needs staff access for API
    is_active=True
)

# Create permanent token
token, created = Token.objects.get_or_create(user=ai_user)
print(f"AI Service Token: {token.key}")
```

#### Step 2: Configure Permissions
```python
# Give AI service necessary permissions
from django.contrib.auth.models import Permission

permissions = [
    'view_user',      # Read staff data
    'add_shift',      # Create shifts
    'change_shift',   # Modify shifts
    'view_shift',     # Read shifts
    'view_venue',     # Read venues
    'view_invoice',   # Read invoices
    'change_invoice', # Update invoice status
]

for perm_codename in permissions:
    try:
        permission = Permission.objects.get(codename=perm_codename)
        ai_user.user_permissions.add(permission)
    except Permission.DoesNotExist:
        print(f"Permission {perm_codename} not found")
```

#### Step 3: Environment Configuration
```bash
# .env for production
BACKEND_API_TOKEN=actual_token_from_step_1
BACKEND_API_URL=https://your-domain.com
```

### Option 2: JWT Authentication
```python
# If using JWT instead of Token auth
from rest_framework_simplejwt.tokens import RefreshToken

refresh = RefreshToken.for_user(ai_user)
access_token = str(refresh.access_token)
refresh_token = str(refresh)
```

### Option 3: Environment-Based Auto-Authentication
```python
# agents/auth/auto_auth.py
import os
import httpx
from config.settings import settings

class AutoAuthenticator:
    """Automatically authenticate with backend using environment credentials"""
    
    @staticmethod
    async def get_service_token():
        """Get service token automatically in production"""
        
        # Option A: Use pre-configured service token
        if settings.backend_api_token and settings.backend_api_token != "your_api_token_here":
            return settings.backend_api_token
        
        # Option B: Auto-login with service credentials
        service_username = os.getenv('AI_SERVICE_USERNAME')
        service_password = os.getenv('AI_SERVICE_PASSWORD')
        
        if service_username and service_password:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{settings.backend_api_url}/api/auth/login/",
                    json={
                        "username": service_username,
                        "password": service_password
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    return data.get('access_token') or data.get('token')
        
        # Option C: Use system environment token
        return os.getenv('BACKEND_SERVICE_TOKEN')

# Usage in API client
async def get_authenticated_headers():
    token = await AutoAuthenticator.get_service_token()
    return {"Authorization": f"Bearer {token}"}
```

## 🚀 Deployment Strategies

### Development
```bash
# Local development with test data fallback
BACKEND_API_TOKEN=your_api_token_here  # Triggers test data mode
```

### Staging
```bash
# Staging with real API
BACKEND_API_TOKEN=staging_service_token_here
BACKEND_API_URL=https://staging.yourdomain.com
```

### Production
```bash
# Production with secure token
BACKEND_API_TOKEN=prod_service_token_here
BACKEND_API_URL=https://yourdomain.com
```

## 🔒 Security Best Practices

1. **Rotate Tokens**: Regularly rotate service tokens
2. **Minimal Permissions**: Only grant necessary permissions
3. **Environment Variables**: Never commit tokens to code
4. **Monitor Usage**: Log all AI service API calls
5. **Rate Limiting**: Implement rate limits for AI service

## 🧪 Testing Real Database Integration

Once you have a real token:

```bash
# Test real API connection
curl -X GET "http://localhost:8000/api/v1/users/" \
  -H "Authorization: Bearer YOUR_REAL_TOKEN"

# Test AI with real database
curl -X POST "http://localhost:8001/query" \
  -H "Content-Type: application/json" \
  -d '{"query": "Create shifts for Nini at renatos pizza tomorrow 9 AM to 5 PM"}'
```

## 📋 Checklist for Production

- [ ] Create AI service account in Django
- [ ] Generate service token
- [ ] Configure proper permissions
- [ ] Update production .env file
- [ ] Test real database operations
- [ ] Set up token rotation schedule
- [ ] Monitor AI API usage
- [ ] Document AI service account for team