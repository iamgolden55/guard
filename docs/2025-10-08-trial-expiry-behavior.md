# Trial Expiry Behavior - What Happens When Trial Ends

**Date**: 2025-10-08
**Company Example**: Deputy Service (30 days remaining)

## Current Status

**Deputy Service Company:**
- **Subscription Tier**: Professional (£79/month)
- **Trial Status**: Active (30 days remaining)
- **Trial End Date**: November 7, 2025 at 9:02 PM
- **Current Feature Access**: ALL features enabled (trial period)

---

## What Happens When Trial Expires

### Automatic System Behavior

When the 30-day trial period ends on **November 7, 2025**, the following happens **automatically**:

#### 1. **Trial Status Changes**
```python
# Backend: api/models.py - get_subscription_status()
Status changes from: 'trial_active' → 'trial_expired'

# Database fields remain:
is_trial = True  # Still marked as trial account
trial_end_date = '2025-11-07 21:02:04'  # Past date
subscription_tier = 'professional'  # Selected plan during onboarding
```

#### 2. **Feature Access Restriction**
The system automatically restricts features based on the **Professional tier** they selected during onboarding:

```python
# Backend: api/models.py - has_feature_access()

# BEFORE trial expiry (trial_active):
has_feature_access('deputy_integration') → True
has_feature_access('api_access') → True
has_feature_access('custom_branding') → True
# ALL features return True during trial

# AFTER trial expiry (trial_expired):
has_feature_access('deputy_integration') → True  ✅ (Professional tier includes this)
has_feature_access('api_access') → False  ❌ (Only Enterprise has this)
has_feature_access('custom_branding') → False  ❌ (Only Enterprise has this)
```

---

## Feature Access by Subscription Tier

### Deputy Service Will Have (Professional Tier - £79/month):

✅ **Included Features:**
- `basic_scheduling` - Core shift scheduling
- `staff_management` - Full staff management
- `venue_management` - Venue management
- `shift_tracking` - Time tracking and attendance
- `basic_reports` - Standard reporting
- `deputy_integration` - Deputy API integration ⭐
- `advanced_reports` - Advanced analytics ⭐
- `leave_management` - Leave request system ⭐
- `compliance_tracking` - Compliance monitoring ⭐
- `priority_support` - Priority customer support ⭐

❌ **NOT Included (Enterprise Only - £199/month):**
- `api_access` - REST API access
- `custom_branding` - White-label branding

### For Comparison - Starter Tier (£29/month):

Only includes:
- `basic_scheduling`
- `staff_management`
- `venue_management`
- `shift_tracking`
- `basic_reports`

Does NOT include:
- Deputy integration
- Advanced reports
- Leave management
- Compliance tracking
- Priority support
- API access
- Custom branding

---

## User Experience After Trial Expiry

### 1. **No Immediate Lockout**
- The system does NOT lock users out completely
- Core features (scheduling, staff management) continue working
- Only premium features beyond their tier are restricted

### 2. **Feature Lock Indicators** (TO BE IMPLEMENTED)
When users try to access Enterprise-only features:
- Show upgrade prompt: "This feature requires Enterprise plan"
- Display pricing comparison
- One-click upgrade flow

### 3. **Payment Required**
After trial expires, to continue using the Professional tier features:
- System should send payment reminder emails (TO BE IMPLEMENTED)
- Show billing dashboard with payment options
- If payment not received within grace period, restrict to Starter tier

---

## Current Implementation Status

### ✅ **Working Now:**
1. Trial period tracking (30 days from creation)
2. Automatic trial status detection (`get_subscription_status()`)
3. Feature access enforcement (`has_feature_access()`)
4. Tier-based feature matrix (Starter/Professional/Enterprise)

### ⚠️ **NOT YET IMPLEMENTED:**

1. **Payment Integration:**
   - No Stripe/payment gateway integration
   - No automatic billing when trial expires
   - No payment reminder emails

2. **Trial Expiry Notifications:**
   - No email at 7 days before expiry
   - No email at 3 days before expiry
   - No email at 1 day before expiry
   - No email on day of expiry

3. **Feature Lock UI:**
   - No visual indicators showing which features are locked
   - No upgrade prompts when accessing Enterprise features
   - No pricing comparison modal

4. **Grace Period:**
   - No 7-day grace period after trial expiry
   - No automatic downgrade to Starter if payment not received

5. **Dashboard Trial Status:**
   - No trial countdown timer on dashboard
   - No "Upgrade Now" call-to-action
   - No trial progress indicator

---

## Recommended Implementation Timeline

### Phase 1: Critical (Week 1)
1. Trial countdown component on dashboard
2. Email notifications (7/3/1 days before expiry)
3. Feature lock UI with upgrade prompts

### Phase 2: Essential (Week 2)
4. Payment gateway integration (Stripe)
5. Subscription upgrade flow
6. Automatic billing after trial

### Phase 3: Polish (Week 3)
7. Grace period handling
8. Trial extension capability (admin)
9. Usage analytics during trial

---

## Testing Scenario

To test trial expiry behavior manually:

```sql
-- Set Deputy Service trial to expire in 1 minute
UPDATE security_companies
SET trial_end_date = NOW() + INTERVAL '1 minute'
WHERE slug = 'deputy-service';

-- Wait 2 minutes, then test:
-- 1. Check status: get_subscription_status() should return 'trial_expired'
-- 2. Test feature access: has_feature_access('api_access') should return False
-- 3. Test Professional features: has_feature_access('deputy_integration') should return True
```

---

## Summary for Deputy Service

**Today (Trial Active - Days 1-30):**
- Full access to ALL features (Starter + Professional + Enterprise)
- No payment required
- No credit card on file

**After November 7, 2025 (Trial Expired):**
- Automatic downgrade to Professional tier feature set
- Will lose: API access, Custom branding (Enterprise features)
- Will keep: Deputy integration, Advanced reports, Leave management (Professional features)
- Payment required to continue (£79/month for Professional)
- If no payment: Should eventually downgrade to Starter tier (TO BE IMPLEMENTED)

**Current Gap:**
- No payment mechanism exists yet
- No trial expiry notifications
- No feature lock UI
- System restricts features but doesn't prompt for payment
