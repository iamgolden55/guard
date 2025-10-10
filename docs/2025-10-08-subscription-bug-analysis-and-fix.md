# Subscription Bug Analysis and Fix

**Date**: 2025-10-08
**Issue**: CTR Security and Staffline Security Agency have unlimited subscriptions when they should expire after 1 year
**Severity**: Medium - Business Logic Error

---

## Problem Summary

During multi-tenant conversion, **CTR Security** and **Staffline Security Agency** were created without `subscription_end_date` values, giving them **unlimited subscriptions** instead of the standard 1-year professional tier subscription.

### Current State (Incorrect)

| Company | Subscription End Date | Status |
|---------|----------------------|--------|
| Mead Security | 2026-09-27 | ✅ Correct (1 year) |
| CTR Security | `NULL` | ❌ **Unlimited (Bug)** |
| Staffline Security Agency | `NULL` | ❌ **Unlimited (Bug)** |

---

## Root Cause Analysis

### 1. Model Definition

**File**: [backend/api/models.py:159](../backend/api/models.py#L159)

```python
subscription_end_date = models.DateTimeField(
    null=True,
    blank=True,
    help_text="When subscription ends (null for active subscriptions)"
)
```

**Issue**: The field allows `NULL` values with no default, and the help text misleadingly says "null for active subscriptions" when it should mean "null for unlimited subscriptions".

### 2. Expected Behavior

**File**: [backend/api/management/commands/migrate_existing_users.py:173](../backend/api/management/commands/migrate_existing_users.py#L173)

The migration script that creates companies **should** set:

```python
subscription_end_date=timezone.now().date().replace(year=timezone.now().year + 1),
```

This sets subscription to **expire 1 year from creation**, which is correct for professional tier.

### 3. What Went Wrong

When CTR Security and Staffline Security Agency were created:
- **Mead Security**: Created via migration script → Got correct 1-year subscription ✅
- **CTR Security**: Created on 2025-09-27 → Missing `subscription_end_date` ❌
- **Staffline Security Agency**: Created on 2025-10-02 → Missing `subscription_end_date` ❌

**Likely Cause**: These companies were created through:
- Manual admin panel creation (doesn't enforce subscription_end_date)
- API endpoint that doesn't set default subscription_end_date
- Company registration form that doesn't require subscription_end_date

---

## Business Impact

### Financial Impact
- **Lost Revenue**: CTR Security and Staffline Security Agency are getting professional tier features without renewal billing
- **Subscription Tracking**: Unable to track renewal dates for these companies
- **Billing Notifications**: No automated reminders for subscription renewal

### Operational Impact
- **Inconsistent Data**: Some companies have expiry dates, others don't
- **Confusion**: "Unlimited" vs "Active" subscriptions unclear
- **Audit Trail**: Can't determine when these companies should renew

---

## Recommended Fix

### Option 1: Set Standard 1-Year Subscription (Recommended)

Set both companies to **1-year subscriptions** from their creation dates:

- **CTR Security**: Created 2025-09-27 → Expires **2026-09-27**
- **Staffline Security Agency**: Created 2025-10-02 → Expires **2026-10-02**

**Pros**:
- Consistent with business model (professional tier = 1 year)
- Aligns with Mead Security subscription pattern
- Enables renewal tracking and billing

**Cons**:
- Need to notify companies of expiry dates

### Option 2: Grandfather Unlimited Subscriptions

Keep them as unlimited subscriptions as a "grandfather" benefit.

**Pros**:
- No customer communication needed
- Honors unintentional promise

**Cons**:
- Lost recurring revenue
- Inconsistent subscription model
- Sets bad precedent

---

## Implementation Plan

### Step 1: Fix Database (SQL)

```sql
-- Set CTR Security subscription to expire 1 year from creation
UPDATE security_companies
SET subscription_end_date = subscription_start_date + INTERVAL '1 year'
WHERE slug = 'ctr-security';

-- Set Staffline Security Agency subscription to expire 1 year from creation
UPDATE security_companies
SET subscription_end_date = subscription_start_date + INTERVAL '1 year'
WHERE slug = 'staffline-security-agency';

-- Verify changes
SELECT
    name,
    TO_CHAR(subscription_start_date, 'YYYY-MM-DD') as started,
    TO_CHAR(subscription_end_date, 'YYYY-MM-DD') as expires,
    EXTRACT(DAY FROM (subscription_end_date - NOW())) as days_remaining
FROM security_companies
WHERE slug IN ('mead-security', 'ctr-security', 'staffline-security-agency')
ORDER BY name;
```

### Step 2: Prevent Future Issues

#### A. Update Model Help Text

**File**: [backend/api/models.py:159](../backend/api/models.py#L159)

```python
subscription_end_date = models.DateTimeField(
    null=True,
    blank=True,
    help_text="When subscription ends (null only for explicitly unlimited subscriptions)"  # Updated
)
```

#### B. Add Model Validation

**File**: [backend/api/models.py](../backend/api/models.py) - Add to `SecurityCompany` model

```python
def save(self, *args, **kwargs):
    """Override save to set default subscription_end_date"""
    # If creating new company and no end date set, default to 1 year
    if not self.pk and not self.subscription_end_date:
        if self.subscription_tier in ['starter', 'professional', 'enterprise']:
            # Set to 1 year from start date
            start = self.subscription_start_date or timezone.now()
            self.subscription_end_date = start + timedelta(days=365)

    super().save(*args, **kwargs)
```

#### C. Add Serializer Validation

**File**: [backend/api/serializers.py:1688](../backend/api/serializers.py#L1688)

Add to `SecurityCompanySerializer.validate()`:

```python
def validate(self, data):
    """Validate company data"""
    errors = {}

    # ... existing validation ...

    # Ensure subscription_end_date is set for paid tiers
    subscription_tier = data.get('subscription_tier', 'starter')
    subscription_end_date = data.get('subscription_end_date')

    if subscription_tier in ['starter', 'professional', 'enterprise']:
        if not subscription_end_date:
            # Auto-set to 1 year if not provided
            start_date = data.get('subscription_start_date', timezone.now())
            data['subscription_end_date'] = start_date + timedelta(days=365)

    if errors:
        raise serializers.ValidationError(errors)

    return data
```

### Step 3: Customer Communication

**Email Template** (if implementing Option 1):

```
Subject: Your [Company Name] Subscription Details

Dear [Contact Name],

We're writing to confirm your company's subscription details:

- Subscription Tier: Professional
- Started: [Start Date]
- Renewal Date: [End Date - 1 year from start]

Your subscription includes:
✅ Up to 100 staff members
✅ Up to 50 venues
✅ Advanced compliance tools
✅ Priority support

We'll send renewal reminders 30 days before your renewal date.

Questions? Contact us at [support email]

Best regards,
[Company Name] Team
```

---

## Testing Checklist

After implementing the fix:

- [ ] Verify all 3 companies have subscription_end_date set
- [ ] Confirm subscription_end_date is 1 year from subscription_start_date
- [ ] Test company creation via admin panel sets subscription_end_date
- [ ] Test company creation via API sets subscription_end_date
- [ ] Test get_subscription_status() returns correct status
- [ ] Test subscription renewal notifications work
- [ ] Verify billing emails are set for all companies

---

## Recommended Action

**Implement Option 1**: Set standard 1-year subscriptions for consistency and revenue protection.

**SQL Fix** (execute immediately):

```sql
BEGIN;

UPDATE security_companies
SET subscription_end_date = subscription_start_date + INTERVAL '1 year'
WHERE slug IN ('ctr-security', 'staffline-security-agency')
  AND subscription_end_date IS NULL;

COMMIT;
```

**Code Fix** (implement in next sprint):
- Add model save() override to set default subscription_end_date
- Add serializer validation to ensure subscription_end_date is set
- Update help text to clarify NULL meaning

---

## Related Issues

1. **Missing Billing Emails**: Mead Security has no billing_email set
2. **Inconsistent Subscription Model**: Need to clarify when NULL is acceptable
3. **No Renewal Notifications**: System should alert 30/60/90 days before expiry

---

## Reference Files

- [SecurityCompany Model](../backend/api/models.py#L26)
- [SecurityCompanySerializer](../backend/api/serializers.py#L1640)
- [Migration Script](../backend/api/management/commands/migrate_existing_users.py#L154)
- [Current Subscription Status](./2025-10-08-company-subscription-status.md)
