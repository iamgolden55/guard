# CRITICAL: Trial Period System Not Working

**Date**: 2025-10-08
**Severity**: 🔴 **CRITICAL** - Business Logic Failure
**Impact**: All companies getting full features without trial limitations

---

## Executive Summary

The 30-day trial period system **is completely broken**. All three companies (Mead Security, CTR Security, Staffline Security Agency) should currently be:
- ✅ **In a 30-day trial period** with full feature access
- 🔔 **Monitoring trial expiry** to downgrade features after 30 days
- 📊 **Tracking trial status** to prompt subscription purchase

**Instead**, they are all:
- ❌ Marked as **paid subscriptions** (`is_trial = false`)
- ❌ **No trial end date** set (`trial_end_date = NULL`)
- ❌ **Full access indefinitely** without proper subscription validation

---

## Current State Analysis

### Company Status (As of 2025-10-08)

| Company | Created | Days Ago | Trial Should End | Current Status | **Expected Status** |
|---------|---------|----------|------------------|----------------|---------------------|
| **Mead Security** | 2025-09-27 | 10 days | 2025-10-27 | ❌ Paid subscription | ✅ Trial (20 days left) |
| **CTR Security** | 2025-09-27 | 10 days | 2025-10-27 | ❌ Paid subscription | ✅ Trial (20 days left) |
| **Staffline Security** | 2025-10-02 | 5 days | 2025-11-01 | ❌ Paid subscription | ✅ Trial (25 days left) |

### Database Evidence

```sql
SELECT name, is_trial, trial_end_date, subscription_tier
FROM security_companies
WHERE slug IN ('mead-security', 'ctr-security', 'staffline-security-agency');

-- ALL show: is_trial = false, trial_end_date = NULL
```

---

## Expected Behavior vs Actual Behavior

### Expected (30-Day Trial Model)

According to your description:

1. **Company Onboarding**:
   - User creates company account
   - User selects a subscription plan (starter/professional/enterprise)
   - **System sets**: `is_trial = true`, `trial_end_date = created_at + 30 days`

2. **During 30-Day Trial** (Days 1-30):
   - ✅ Full access to **all features** regardless of selected plan
   - 🔔 System shows trial countdown
   - 📧 Reminder emails at 7 days, 3 days, 1 day before expiry

3. **After Trial Expires** (Day 31+):
   - ❌ Features **locked to selected plan tier**
   - 💳 Prompt to upgrade or provide payment
   - 🔒 Restrict features based on starter/professional/enterprise tier

### Actual (Broken)

1. **Company Onboarding**:
   - User creates company account
   - User selects a subscription plan
   - **System sets**: `is_trial = false`, `trial_end_date = NULL` ❌

2. **Immediately After Creation**:
   - ✅ Full access to all features (correct)
   - ❌ No trial countdown shown
   - ❌ No trial expiry tracking

3. **After 30 Days**:
   - ✅ Still has full access ❌ **WRONG - Should be restricted**
   - ❌ No downgrade to selected tier
   - ❌ No payment prompts

---

## Root Cause Analysis

### 1. Model Definition is Correct

**File**: [backend/api/models.py:217](../backend/api/models.py#L217)

```python
is_trial = models.BooleanField(
    default=False,  # ⚠️ Defaults to False - should default to True for new companies!
    help_text="Whether this is a trial account"
)
trial_end_date = models.DateTimeField(
    null=True,
    blank=True,
    help_text="When trial period ends"
)
```

**Issue**: `is_trial` defaults to `False`, so unless explicitly set to `True` during creation, companies skip trial.

### 2. Subscription Status Logic Exists

**File**: [backend/api/models.py:288](../backend/api/models.py#L288)

```python
def get_subscription_status(self):
    """Get current subscription status"""
    now = timezone.now()

    if self.is_trial:
        if self.trial_end_date and now > self.trial_end_date:
            return 'trial_expired'  # ✅ Logic exists
        return 'trial_active'       # ✅ Logic exists

    if self.subscription_end_date and now > self.subscription_end_date:
        return 'subscription_expired'

    return 'active'
```

**Status**: ✅ The logic is implemented correctly, but it's **never being triggered** because `is_trial = false`.

### 3. Company Creation Process is Broken

**File**: [backend/api/management/commands/migrate_existing_users.py:154](../backend/api/management/commands/migrate_existing_users.py#L154)

```python
default_company = SecurityCompany.objects.create(
    name=company_name,
    # ... other fields ...
    subscription_tier='professional',
    subscription_start_date=timezone.now().date(),
    subscription_end_date=timezone.now().date().replace(year=timezone.now().year + 1),
    # ❌ MISSING: is_trial=True
    # ❌ MISSING: trial_end_date=timezone.now() + timedelta(days=30)
    # ...
)
```

**Issue**: The migration script (used for Mead Security) never sets trial fields.

### 4. Company Onboarding API Missing Trial Logic

Let me check if there's an onboarding API endpoint:

**Likely locations**:
- Company registration endpoint
- Onboarding wizard API
- Admin company creation

**Missing Implementation**: Onboarding process doesn't set:
```python
is_trial=True,
trial_end_date=timezone.now() + timedelta(days=30)
```

---

## Business Impact

### Financial Loss
- **Lost Trial Conversions**: No pressure to convert after 30 days
- **Free Feature Access**: Companies getting enterprise features on starter plans
- **No Payment Collection**: No payment prompts after trial expiry

### User Experience Issues
- **No Trial Countdown**: Users don't know their trial is expiring
- **No Upgrade Prompts**: No incentive to purchase subscription
- **Confusion**: Unclear when features will be restricted

### Compliance/Legal
- **Inconsistent Billing**: Companies not being charged correctly
- **Terms of Service**: Not enforcing stated trial period terms

### Estimated Impact
- **Mead Security**: 10 days of "free trial" already used - should have 20 days left
- **CTR Security**: 10 days of "free trial" already used - should have 20 days left
- **Staffline Security**: 5 days of "free trial" already used - should have 25 days left

After 30 days, all should be restricted to their selected plan features, but **won't be** due to this bug.

---

## Immediate Fix Required

### Fix 1: Enable Trial Period for Existing Companies

```sql
BEGIN;

-- Set all companies to trial mode with 30-day period from creation
UPDATE security_companies
SET
    is_trial = true,
    trial_end_date = created_at + INTERVAL '30 days'
WHERE slug IN ('mead-security', 'ctr-security', 'staffline-security-agency')
  AND is_trial = false;

-- Verify changes
SELECT
    name,
    is_trial,
    TO_CHAR(created_at, 'YYYY-MM-DD') as created,
    TO_CHAR(trial_end_date, 'YYYY-MM-DD') as trial_expires,
    CAST(EXTRACT(DAY FROM (trial_end_date - NOW())) AS INTEGER) as days_remaining
FROM security_companies
WHERE slug IN ('mead-security', 'ctr-security', 'staffline-security-agency')
ORDER BY name;

COMMIT;
```

**Result**:
- Mead Security: Trial expires 2025-10-27 (20 days remaining)
- CTR Security: Trial expires 2025-10-27 (20 days remaining)
- Staffline Security: Trial expires 2025-11-01 (25 days remaining)

### Fix 2: Update Model Default

**File**: [backend/api/models.py:217](../backend/api/models.py#L217)

```python
is_trial = models.BooleanField(
    default=True,  # ✅ Changed from False to True
    help_text="Whether this is a trial account (defaults to true for new companies)"
)
```

**⚠️ Warning**: This will make ALL new companies start as trials. Need to add logic to set `is_trial=False` when payment is received.

### Fix 3: Add Company Creation Signal/Hook

**New File**: `backend/api/signals.py` (or add to existing signals file)

```python
from django.db.models.signals import post_save
from django.dispatch import receiver
from datetime import timedelta
from django.utils import timezone
from .models import SecurityCompany

@receiver(post_save, sender=SecurityCompany)
def setup_trial_period(sender, instance, created, **kwargs):
    """Automatically set up 30-day trial for new companies"""
    if created and not instance.is_trial:
        # Set trial period for new companies
        instance.is_trial = True
        instance.trial_end_date = timezone.now() + timedelta(days=30)
        instance.save(update_fields=['is_trial', 'trial_end_date'])
```

**Register in**: `backend/api/apps.py`

```python
class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        import api.signals  # ✅ Import signals
```

### Fix 4: Add Trial Expiry Checks

**Add to**: Frontend middleware or backend API responses

```python
def check_trial_status(company):
    """Check if company trial has expired and restrict features"""
    if company.is_trial:
        if company.trial_end_date and timezone.now() > company.trial_end_date:
            # Trial expired - enforce plan restrictions
            return {
                'status': 'trial_expired',
                'allowed_features': get_features_for_tier(company.subscription_tier),
                'message': 'Your 30-day trial has expired. Upgrade to continue accessing all features.'
            }
        else:
            # Trial active - full access
            days_remaining = (company.trial_end_date - timezone.now()).days
            return {
                'status': 'trial_active',
                'days_remaining': days_remaining,
                'allowed_features': 'all',
                'message': f'Trial active: {days_remaining} days remaining'
            }
    else:
        # Paid subscription - enforce plan limits
        return {
            'status': 'active',
            'allowed_features': get_features_for_tier(company.subscription_tier)
        }
```

---

## Testing Checklist

After implementing fixes:

- [ ] All existing companies have `is_trial = true` and `trial_end_date` set
- [ ] New companies automatically get 30-day trial
- [ ] Trial countdown displays correctly in UI
- [ ] Features remain full access during trial
- [ ] Features downgrade to selected tier after trial expires
- [ ] Email notifications sent before trial expiry
- [ ] Payment prompt appears when trial expires
- [ ] Converting from trial to paid updates `is_trial = false`

---

## Timeline

### Immediate (Today)
1. ✅ Document the bug
2. ⏳ Execute SQL fix to enable trials for existing companies
3. ⏳ Add trial status to admin dashboard

### This Week
1. Implement model default change
2. Add post_save signal for auto-trial setup
3. Create trial expiry check middleware
4. Add trial countdown to frontend UI

### This Sprint
1. Implement trial expiry notifications (email)
2. Build payment/upgrade flow for trial conversion
3. Add feature restriction logic based on trial status
4. Test complete trial lifecycle

---

## Feature Restriction Matrix

When trial expires, restrict features based on selected tier:

| Feature | Starter | Professional | Enterprise |
|---------|---------|--------------|------------|
| Staff Capacity | 10 | 50 | 200 |
| Venue Capacity | 5 | 20 | 100 |
| Deputy Integration | ❌ | ✅ | ✅ |
| Advanced Reports | ❌ | ✅ | ✅ |
| API Access | ❌ | ❌ | ✅ |
| Custom Branding | ❌ | ❌ | ✅ |
| Priority Support | ❌ | ✅ | ✅ |

During 30-day trial: **All features enabled regardless of tier**

---

## Related Files

- [SecurityCompany Model](../backend/api/models.py#L26)
- [Subscription Status Logic](../backend/api/models.py#L288)
- [Migration Script](../backend/api/management/commands/migrate_existing_users.py#L154)
- [Previous Subscription Bug Fix](./2025-10-08-subscription-bug-analysis-and-fix.md)

---

## Recommendation

**Execute the immediate fix NOW**:

```sql
UPDATE security_companies
SET
    is_trial = true,
    trial_end_date = created_at + INTERVAL '30 days'
WHERE is_trial = false;
```

This will:
1. Put all companies on proper 30-day trial
2. Enable trial countdown
3. Allow testing of trial expiry flow
4. Properly enforce feature restrictions after trial

**Then implement the long-term fixes** to prevent this from happening to new companies.
