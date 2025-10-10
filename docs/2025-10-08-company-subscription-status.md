# Company Subscription Status Report

**Generated**: 2025-10-08
**Database**: security_management

---

## Subscription Overview

| Company | Tier | Days Remaining | Status | Renewal Date |
|---------|------|----------------|--------|--------------|
| **Mead Security** | Professional | **353 days** | ✅ Active | 2026-09-27 |
| **CTR Security** | Professional | **∞ Unlimited** | ✅ Active | No expiry |
| **Staffline Security Agency** | Professional | **∞ Unlimited** | ✅ Active | No expiry |

---

## Detailed Subscription Information

### 1. Mead Security
- **Subscription Tier**: Professional
- **Start Date**: 2025-09-27
- **End Date**: 2026-09-27
- **Days Remaining**: **353 days**
- **Total Subscription Period**: 365 days (1 year)
- **Billing Email**: *(Not set)*
- **Status**: ✅ Active - Subscription valid until September 27, 2026

**Action Required**: Set billing email for renewal notifications

---

### 2. CTR Security
- **Subscription Tier**: Professional
- **Start Date**: 2025-09-27
- **End Date**: No expiry set
- **Days Remaining**: **∞ Unlimited**
- **Billing Email**: test321@example.com
- **Status**: ✅ Active - No expiration date configured

**Note**: This company has an unlimited/perpetual subscription with no renewal required.

---

### 3. Staffline Security Agency
- **Subscription Tier**: Professional
- **Start Date**: 2025-10-02
- **End Date**: No expiry set
- **Days Remaining**: **∞ Unlimited**
- **Billing Email**: admin@wyesecuritysolutions.co.uk
- **Status**: ✅ Active - No expiration date configured

**Note**: This company has an unlimited/perpetual subscription with no renewal required.

---

## Subscription Tier Features

All three companies are on the **Professional** tier, which includes:
- Medium company size support (11-50 employees)
- Advanced features and integrations
- Priority support
- Enhanced compliance tools

---

## Key Findings

1. **Only 1 company has a subscription end date**: Mead Security expires in 353 days (2026-09-27)
2. **2 companies have unlimited subscriptions**: CTR Security and Staffline Security Agency have no expiry dates
3. **All subscriptions are currently active**: No expired subscriptions
4. **Billing email missing**: Mead Security needs a billing email configured for renewal notifications

---

## Upcoming Renewals (Next 12 Months)

| Company | Renewal Date | Days Until Renewal | Action Required |
|---------|--------------|-------------------|-----------------|
| Mead Security | 2026-09-27 | 353 days | Set billing email, prepare renewal 30 days prior |

---

## How to Check Subscription Status

### SQL Query
```sql
psql -U postgres -d security_management -c "
SELECT
    name as \"Company\",
    subscription_tier as \"Tier\",
    subscription_start_date as \"Started\",
    subscription_end_date as \"Expires\",
    CASE
        WHEN subscription_end_date IS NULL THEN 'Unlimited'
        WHEN subscription_end_date < NOW() THEN 'EXPIRED'
        ELSE CAST(EXTRACT(DAY FROM (subscription_end_date - NOW())) AS INTEGER) || ' days'
    END as \"Days Remaining\",
    billing_email
FROM security_companies
WHERE is_active = true
ORDER BY subscription_end_date NULLS LAST;
"
```

### Model Reference
**File**: [backend/api/models.py:26](../backend/api/models.py#L26)

Key fields:
- `subscription_tier` - Current plan (starter/professional/enterprise/custom)
- `subscription_start_date` - When subscription began
- `subscription_end_date` - When subscription expires (NULL = unlimited)
- `billing_email` - Email for renewal notifications

---

## Subscription Management Tasks

### For Mead Security (Expires in 353 days)
- [ ] Set billing email for renewal notifications
- [ ] Schedule renewal reminder 30 days before expiry (August 28, 2026)
- [ ] Review subscription tier needs before renewal
- [ ] Confirm staff capacity limits are sufficient

### For CTR Security & Staffline Security Agency
- [x] Subscriptions are unlimited - no action required
- [ ] Consider reviewing subscription terms annually
- [ ] Ensure billing emails are up to date

---

## Database Schema

### Subscription Fields in SecurityCompany Model

```python
# Subscription and Billing
subscription_tier = models.CharField(
    max_length=50,
    choices=SUBSCRIPTION_TIER_CHOICES,
    default='starter',
    help_text="Current subscription tier"
)
subscription_start_date = models.DateTimeField(
    default=timezone.now,
    help_text="When subscription started"
)
subscription_end_date = models.DateTimeField(
    null=True,
    blank=True,
    help_text="When subscription ends (null for active subscriptions)"
)
billing_email = models.EmailField(
    help_text="Email for billing and invoices"
)
```

**Note**: `subscription_end_date = NULL` indicates an unlimited/perpetual subscription with no expiry.

---

## Recommendations

1. **Set Billing Email for Mead Security**: Critical for renewal notifications
2. **Implement Renewal Alerts**: Create automated alerts 30/60/90 days before expiry
3. **Regular Subscription Audits**: Review subscription status quarterly
4. **Document Unlimited Subscriptions**: Clarify terms for CTR Security and Staffline Security Agency

---

## Related Documentation

- [How to Find Companies in System](./2025-10-08-how-to-find-companies-in-system.md)
- [SecurityCompany Model](../backend/api/models.py#L26)
