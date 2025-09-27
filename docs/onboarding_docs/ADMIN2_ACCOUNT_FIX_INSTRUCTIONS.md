# Admin2 Account Fix: Immediate Resolution Steps

## Problem Summary
The admin2 account (and all existing users) cannot complete onboarding because they lack UserCompanyMembership records required by the new multi-tenant system.

## Immediate Solution

### Step 1: Diagnose Current State
```bash
cd backend
python manage.py diagnose_user admin2
python manage.py diagnose_user --all
```

### Step 2: Run Migration for Existing Users
```bash
# First, do a dry run to see what will happen
python manage.py migrate_existing_users --dry-run

# If results look correct, run the actual migration
python manage.py migrate_existing_users --company-name="Mead Security"
```

### Step 3: Verify Fix
```bash
# Check admin2 account again
python manage.py diagnose_user admin2

# Test login via Django shell
python manage.py shell
```

In the shell:
```python
from django.contrib.auth import get_user_model
from api.models import UserCompanyMembership
User = get_user_model()

# Check admin2
user = User.objects.get(username='admin2')
print(f"Memberships: {user.company_memberships.count()}")

# Test company access
membership = user.company_memberships.filter(is_active=True).first()
if membership:
    print(f"Company: {membership.company.name}")
    print(f"Role: {membership.role}")
    print(f"Is Owner: {membership.is_owner}")
else:
    print("No active company membership")
```

## What the Migration Does

1. **Creates a Default Company**: "Mead Security" (or specified name)
2. **Assigns User Roles**:
   - Superusers → Company owners
   - Staff users → Company admins
   - Regular users → Staff members
3. **Links Existing Data**: Venues, shifts, invoices to the new company
4. **Preserves Data**: No data loss, only adds relationships

## Expected Results After Migration

- ✅ admin2 can log in successfully
- ✅ admin2 bypasses onboarding (already has company)
- ✅ admin2 can access main application
- ✅ All existing users can access their data
- ✅ Multi-tenant isolation works correctly

## Alternative Quick Fix (If Migration Fails)

If the migration command has issues, you can manually create the membership:

```python
# Django shell
from django.contrib.auth import get_user_model
from api.models import SecurityCompany, UserCompanyMembership
from django.utils import timezone

User = get_user_model()

# Get admin2 user
user = User.objects.get(username='admin2')

# Create a company (if none exists)
company = SecurityCompany.objects.create(
    name="Mead Security",
    registration_number="MEAD001",
    country_code="GBR",
    city="London",
    postal_code="SW1A 1AA",
    address_line_1="123 Business Street",
    billing_email=user.email,
    primary_contact_name=user.get_full_name(),
    primary_contact_email=user.email,
    primary_contact_phone="+44 20 1234 5678",
    industry_type="security",
    company_size="medium",
    subscription_tier="professional",
    staff_capacity=100,
    venue_capacity=50,
    subscription_start_date=timezone.now().date(),
    subscription_end_date=timezone.now().date().replace(year=timezone.now().year + 1),
    created_by=user,
    is_active=True
)

# Create membership
UserCompanyMembership.objects.create(
    user=user,
    company=company,
    role='owner',
    is_owner=True,
    is_active=True,
    invitation_status='accepted',
    joined_at=timezone.now()
)

print(f"Created company: {company.name}")
print(f"Created membership for: {user.username}")
```

## Testing the Fix

1. **Backend Test**:
   ```bash
   python manage.py diagnose_user admin2
   # Should show company membership
   ```

2. **Frontend Test**:
   - Log in as admin2
   - Should bypass onboarding
   - Should see main dashboard

3. **API Test**:
   ```bash
   # Test onboarding progress endpoint
   curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/onboarding/progress/
   # Should return company data instead of error
   ```

## Rollback (If Needed)

If something goes wrong, you can rollback:

```sql
-- Remove created memberships
DELETE FROM api_usercompanymembership WHERE company_id IN (
    SELECT id FROM api_securitycompany WHERE name = 'Mead Security'
);

-- Remove created company
DELETE FROM api_securitycompany WHERE name = 'Mead Security';
```

## Prevention for Future

1. **Update deployment scripts** to run migration command
2. **Add checks in authentication** to detect unmigrated users
3. **Document multi-tenant setup** for new installations
4. **Create tests** for multi-tenant user scenarios

## Files Created

- `/backend/api/management/commands/migrate_existing_users.py` - Main migration command
- `/backend/api/management/commands/diagnose_user.py` - Diagnostic tool
- `/MULTI_TENANT_EXISTING_USERS_ANALYSIS.md` - Detailed technical analysis

## Support Commands

```bash
# List all companies
python manage.py shell -c "from api.models import SecurityCompany; print([c.name for c in SecurityCompany.objects.all()])"

# List users without companies
python manage.py shell -c "from django.contrib.auth import get_user_model; User=get_user_model(); print([u.username for u in User.objects.filter(company_memberships__isnull=True)])"

# Count memberships
python manage.py shell -c "from api.models import UserCompanyMembership; print(f'Total memberships: {UserCompanyMembership.objects.count()}')"
```