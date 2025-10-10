# Leave Policies Configuration Guide

**Date**: 2025-10-02
**Location**: `http://localhost:3000/leave/policies` (Admin only)
**Component**: `frontend/src/pages/admin/LeavePolicies.tsx`

## Overview

The Leave Policies page allows administrators to create and manage comprehensive leave policies that define how employees accrue, use, and carry over different types of leave. Each policy is linked to a specific **Leave Type** (Annual, Sick, Personal, etc.) and can apply to specific **Employment Types** (Full-time, Part-time, Contract).

---

## Page Structure

### Dashboard Summary Cards

**Metrics Displayed:**
1. **Total Policies** - Count of all policies (active + inactive)
2. **Active Policies** - Count of currently active policies
3. **Leave Types** - Count of available leave types
4. **Employment Types** - Count of employment classifications

### Action Buttons

- **Import Policies** - Import policies from file (placeholder)
- **Export Policies** - Export policies to file (placeholder)
- **Refresh** - Reload policy data from server
- **Create Policy** - Opens policy creation form

### Policy List Table

**Component**: `PolicyListTable.tsx` (13KB)

**Columns:**
- Policy Name
- Leave Type
- Accrual Method
- Employment Types
- Effective Date
- Status (Active/Inactive)
- Actions (Edit, Delete, Activate/Deactivate)

**Features:**
- Sortable columns
- Filterable by status, leave type
- Row selection
- Quick actions dropdown

---

## Policy Configuration Form

**Component**: `PolicyDetailsForm.tsx` (24KB, 618 lines)

The form opens as a side panel (medium width) with **4 tabs** for organizing different aspects of the policy.

### Tab 1: Basic Settings

#### Purpose
Define fundamental policy information and applicability

#### Fields

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| **Policy Name** | Text | Yes | Min 2 chars | Descriptive name (e.g., "Full-time Annual Leave UK") |
| **Leave Type** | Dropdown | Yes | Must select | Type of leave this policy governs |
| **Employment Types** | Multi-select | Yes | Min 1 selected | Which employment types this policy applies to |
| **Effective Date** | Date Picker | Yes | Valid date | When policy becomes active |
| **Expiry Date** | Date Picker | No | - | Optional end date for policy |
| **Policy Active** | Toggle | - | - | Enable/disable policy without deleting |

#### Leave Type Options
Options are populated from the Leave Types configured in system (e.g., Annual Leave, Sick Leave, Personal Leave, Holiday, Maternity, Paternity, etc.)

#### Employment Type Options
- Full-time
- Part-time
- Contract
- (Other types as configured in system)

#### Use Cases

**Example 1: Standard Annual Leave**
- Policy Name: "UK Full-time Annual Leave"
- Leave Type: Annual Leave
- Employment Types: Full-time
- Effective Date: 2025-01-01
- Expiry Date: (None)
- Active: Yes

**Example 2: Contractor Sick Leave**
- Policy Name: "Contractor Sick Days"
- Leave Type: Sick Leave
- Employment Types: Contract
- Effective Date: 2025-01-01
- Expiry Date: 2025-12-31
- Active: Yes

---

### Tab 2: Accrual Settings

#### Purpose
Configure how employees earn/accumulate leave over time

#### Core Fields

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| **Accrual Method** | Dropdown | Yes | - | How leave accrues |
| **Accrual Rate** | Number | Yes | Decimal | Days earned per period |
| **Max Accrual Per Year** | Number | No | Decimal | Cap on annual accrual |
| **Maximum Balance** | Number | No | Decimal | Total balance cap |

#### Accrual Method Options

**1. Monthly Accrual**
- Leave accrues each month based on accrual rate
- Example: 1.67 days/month = 20 days/year
- **Use Case**: Standard salary employees with monthly pay
- **Calculation**: `balance += accrual_rate` on 1st of each month

**2. Annual Allocation**
- Full entitlement granted at start of leave year
- Example: 25 days granted on January 1st
- **Use Case**: Salaried staff with guaranteed annual leave
- **Calculation**: `balance = accrual_rate` on leave year start date

**3. Per Shift Worked**
- Leave accrues for each shift worked
- Example: 0.083 days per shift = 20 days per 240 shifts
- **Use Case**: Shift workers, casual staff, hourly employees
- **Calculation**: `balance += accrual_rate` after each approved shift

**4. Length of Service**
- Accrual rate increases with tenure
- Uses **Service Brackets** (see below)
- **Use Case**: Reward long-serving employees with more leave
- **Example**:
  - 0-12 months: 1.25 days/month (15 days/year)
  - 12-36 months: 1.67 days/month (20 days/year)
  - 36+ months: 2.08 days/month (25 days/year)

**5. No Accrual**
- Leave does not automatically accrue
- Manual allocations only
- **Use Case**: One-time leave grants, emergency leave, compassionate leave

#### Service Brackets (for Length of Service method)

**Purpose**: Define tiered accrual rates based on employment duration

**Fields per Bracket:**
- **Months of Service**: Tenure threshold (e.g., 0, 12, 36, 60)
- **Accrual Rate**: Days per period at this tier (e.g., 1.25, 1.67, 2.08)

**Example Configuration**:
```
Bracket 1: 0 months → 1.25 days/month
Bracket 2: 12 months → 1.67 days/month
Bracket 3: 36 months → 2.08 days/month
Bracket 4: 60 months → 2.50 days/month
```

**Actions:**
- **Add Bracket** - Add new service tier
- **Delete Bracket** - Remove tier (trash icon)

**Business Logic**:
- System selects highest applicable bracket based on employee tenure
- Employee hired 18 months ago → uses Bracket 2 (1.67 days/month)
- Automatic tier progression as employee reaches thresholds

#### Accrual Rate Calculation Examples

**Monthly Accrual (20 days/year)**:
- Annual entitlement: 20 days
- Accrual rate: 20 ÷ 12 = **1.67 days/month**

**Per Shift (20 days/year, 240 shifts/year)**:
- Annual entitlement: 20 days
- Expected shifts: 240
- Accrual rate: 20 ÷ 240 = **0.083 days/shift**

**Annual Allocation (25 days)**:
- Full entitlement granted upfront
- Accrual rate: **25 days** (granted once per year)

#### Max Accrual Per Year

**Purpose**: Cap annual accrual to prevent excessive accumulation

**Example**:
- Policy: Monthly accrual at 2.0 days/month
- Without cap: 2.0 × 12 = 24 days/year
- With cap (max 20 days/year): Stops accruing after 10 months
- **Use Case**: Prevent over-accrual for employees who rarely take leave

#### Maximum Balance

**Purpose**: Cap total accumulated balance

**Example**:
- Policy: Monthly accrual at 1.67 days/month
- Employee accrued 40 days over 2 years
- Max balance: 30 days
- System prevents further accrual until balance drops below 30
- **Use Case**: Encourage employees to use leave, prevent liability buildup

---

### Tab 3: Carryover & Eligibility

#### Part A: Carryover Settings

**Purpose**: Define year-end leave carryover rules

#### Carryover Method Options

**1. No Carryover**
- All unused leave lost at year-end
- Balance resets to 0
- **Use Case**: Use-or-lose policies, statutory minimum only
- **Example**: Employee has 5 days unused → lost on Dec 31st

**2. Full Carryover**
- All unused leave carries to next year indefinitely
- No limits or expiry
- **Use Case**: Generous policies, trust-based organizations
- **Example**: Employee has 15 days unused → all carry over

**3. Partial Carryover**
- Up to specified limit carries over
- Excess lost
- Requires **Carryover Limit** field
- **Use Case**: Most common approach, balances flexibility and liability
- **Example**:
  - Carryover limit: 5 days
  - Employee has 12 days unused
  - 5 days carry over, 7 days lost

**4. Use or Lose**
- Must use leave by specified deadline
- System enforces usage tracking
- **Use Case**: Strict compliance policies
- **Example**: All leave must be used by March 31st or lost

#### Carryover Limit
- **Shown when**: Carryover Method = Partial
- **Type**: Decimal number (days)
- **Description**: Maximum days that can carry over
- **Example**: 5 days

#### Carryover Expiry (months)
- **Type**: Number (1-24 months)
- **Default**: 12 months
- **Description**: How long carried-over leave remains valid
- **Example**:
  - Carryover expiry: 12 months
  - Employee carries 5 days on Jan 1st 2025
  - Must use by Dec 31st 2025 or lost
  - **Note**: Applies even to full carryover

**Business Logic**:
- System tracks carried-over days separately from newly accrued
- Expiry checking runs monthly
- Notifications sent before expiry (if configured)

---

#### Part B: Eligibility Requirements

**Purpose**: Define minimum requirements before employees can use this policy

#### Fields

| Field | Type | Range | Default | Description |
|-------|------|-------|---------|-------------|
| **Probation Period** | Number | 0-12 months | 0 | Months before policy applies |
| **Min Employment Days** | Number | 0-365 days | 0 | Days employed before eligible |

#### Probation Period (months)

**Purpose**: Require employees to work specified months before using this leave type

**Examples**:
- **3 months probation**: New hire starts Jan 1st, eligible April 1st
- **6 months probation**: New hire starts Jan 1st, eligible July 1st
- **0 months**: Immediate eligibility

**Use Cases**:
- Annual leave: Often 3-6 month probation
- Sick leave: Often immediate (0 months)
- Personal leave: May have 3 month probation

#### Minimum Employment Days

**Purpose**: Fine-grained control using days instead of months

**Examples**:
- **90 days**: ~3 months
- **180 days**: ~6 months
- **0 days**: Immediate eligibility

**Interaction with Probation Period**:
- Both conditions must be met
- If probation = 3 months AND min employment = 100 days:
  - Employee must satisfy **both** requirements
  - Typically use one OR the other, not both

**Note**: Probation months is more common; min employment days provides precision for specific policies

---

### Tab 4: Advanced Settings

#### Purpose
Configure exceptional leave balance rules

#### Allow Negative Balance

**Type**: Toggle (On/Off)
**Default**: Off

**Description**: Permit employees to take leave exceeding their current balance

**Use Cases**:
1. **New Employees**: Haven't accrued leave yet but have emergency
2. **Trusted Staff**: Long-term employees with proven reliability
3. **Emergency Situations**: Family emergency, medical crisis

**Example**:
- Employee has 0 days accrued (just started)
- Needs 3 days for family emergency
- Negative balance enabled → request can be approved
- Balance becomes -3 days
- Future accrual recovers the debt

#### Negative Balance Limit (days)

**Shown when**: Allow Negative Balance = On
**Type**: Decimal number
**Description**: Maximum negative balance allowed

**Examples**:
- Limit: 5 days → employee can go up to -5 days
- Limit: 10 days → employee can take 10 days "in advance"

**Risk Management**:
- Set conservative limits (e.g., 5 days)
- Require manager approval for negative requests
- Track negative balances in reports
- Consider requiring recovery plan

**Business Logic**:
- Request validation checks: `current_balance - days_requested ≥ -negative_balance_limit`
- Example:
  - Current balance: 2 days
  - Request: 8 days
  - Limit: 5 days
  - Calculation: 2 - 8 = -6 ❌ **REJECTED** (exceeds -5 limit)

**Recovery**:
- Future accrual first repays negative balance
- Example:
  - Balance: -3 days
  - Accrual: +1.67 days
  - New balance: -1.33 days (not 1.67)
- Once recovered to 0, accrual resumes normally

---

## API Integration

### Endpoints Used

#### Fetch Policies
```
GET /api/v1/leave-policies/
Authorization: Bearer {token}

Response:
[
  {
    "id": 1,
    "name": "UK Full-time Annual Leave",
    "leave_type": {
      "id": 1,
      "name": "Annual Leave",
      "code": "AL"
    },
    "employment_types": [
      { "id": 1, "name": "Full-time" }
    ],
    "accrual_method": "monthly",
    "accrual_rate": "1.67",
    "max_accrual_per_year": "20",
    "max_balance": "30",
    "service_brackets": [],
    "carryover_method": "partial",
    "carryover_limit": "5",
    "carryover_expiry_months": 12,
    "probation_months": 3,
    "min_employment_days": 0,
    "allow_negative_balance": false,
    "negative_balance_limit": "0",
    "is_active": true,
    "effective_date": "2025-01-01",
    "expiry_date": null,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
]
```

#### Create Policy
```
POST /api/v1/leave-policies/
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "name": "Contractor Sick Leave",
  "leave_type_id": 2,
  "employment_type_ids": [3],
  "accrual_method": "annual",
  "accrual_rate": "5",
  "max_accrual_per_year": "5",
  "max_balance": "5",
  "service_brackets": [],
  "carryover_method": "none",
  "carryover_limit": "",
  "carryover_expiry_months": 12,
  "probation_months": 0,
  "min_employment_days": 0,
  "allow_negative_balance": false,
  "negative_balance_limit": "0",
  "is_active": true,
  "effective_date": "2025-01-01",
  "expiry_date": "2025-12-31"
}

Response: (Same structure as GET response)
```

#### Update Policy
```
PUT /api/v1/leave-policies/{id}/
Authorization: Bearer {token}
Content-Type: application/json

Body: (Same as Create)
```

#### Delete Policy
```
DELETE /api/v1/leave-policies/{id}/
Authorization: Bearer {token}

Response: 204 No Content
```

#### Activate/Deactivate Policy
```
POST /api/v1/leave-policies/{id}/activate/
POST /api/v1/leave-policies/{id}/deactivate/
Authorization: Bearer {token}

Response:
{
  "message": "Policy activated successfully",
  "policy": { ... }
}
```

---

## Validation Rules

### Form Validation (Frontend)

| Field | Rule | Error Message |
|-------|------|---------------|
| name | Required, min 2 chars | "Policy name is required" / "Name must be at least 2 characters" |
| leave_type_id | Required | "Leave type is required" |
| employment_type_ids | Min 1 selected | "At least one employment type must be selected" |
| accrual_method | Required | "Accrual method is required" |
| accrual_rate | Required, decimal format | "Accrual rate is required" / "Must be a valid number" |
| max_balance | Decimal format (if provided) | "Must be a valid number" |
| carryover_method | Required | "Carryover method is required" |
| probation_months | Min 0 | "Cannot be negative" |
| min_employment_days | Min 0 | "Cannot be negative" |
| effective_date | Required, valid date | "Effective date is required" |

### Business Logic Validation (Backend)

- **Carryover partial**: If carryover_method = 'partial', carryover_limit must be provided
- **Service brackets**: If accrual_method = 'length_of_service', at least 1 bracket required
- **Negative balance**: If allow_negative_balance = false, negative_balance_limit ignored
- **Date range**: If expiry_date provided, must be > effective_date
- **Duplicate policy**: Cannot have multiple active policies for same leave_type + employment_type combination

---

## Permission Requirements

**Access Control**: Admin Only

- View policies: Admin or Manager
- Create policy: Admin only
- Edit policy: Admin only
- Delete policy: Admin only
- Activate/deactivate: Admin only

**Frontend Route Protection**:
```typescript
<Route path="/policies" element={
  authState.user?.role === 'admin'
    ? <LeavePolicies />
    : <Navigate to="/leave" />
} />
```

---

## Common Policy Configurations

### 1. UK Statutory Annual Leave (Full-time)

```
Name: UK Full-time Annual Leave
Leave Type: Annual Leave
Employment Types: Full-time
Accrual Method: Monthly
Accrual Rate: 2.33 days/month (28 days/year including bank holidays)
Max Accrual Per Year: 28
Max Balance: 40
Carryover Method: Partial
Carryover Limit: 8 days
Carryover Expiry: 12 months
Probation: 3 months
Allow Negative Balance: No
Effective Date: 2025-01-01
Active: Yes
```

### 2. US PTO (Paid Time Off) - Accrual by Tenure

```
Name: US Full-time PTO
Leave Type: Personal Time Off
Employment Types: Full-time
Accrual Method: Length of Service
Service Brackets:
  - 0 months: 0.83 days/month (10 days/year)
  - 12 months: 1.25 days/month (15 days/year)
  - 60 months: 1.67 days/month (20 days/year)
Max Balance: 30
Carryover Method: Partial
Carryover Limit: 5
Probation: 6 months
Allow Negative Balance: No
```

### 3. Contractor Sick Leave (Limited)

```
Name: Contractor Sick Days
Leave Type: Sick Leave
Employment Types: Contract
Accrual Method: Annual
Accrual Rate: 5 days (allocated upfront)
Max Balance: 5
Carryover Method: None
Probation: 0 months
Allow Negative Balance: No
Effective Date: 2025-01-01
Expiry Date: 2025-12-31
```

### 4. Shift Worker Leave (Accrual Per Shift)

```
Name: Shift Worker Annual Leave
Leave Type: Annual Leave
Employment Types: Part-time, Casual
Accrual Method: Per Shift
Accrual Rate: 0.083 days/shift (20 days per 240 shifts)
Max Balance: 30
Carryover Method: Full
Probation: 0 months
Allow Negative Balance: Yes
Negative Balance Limit: 3 days
```

---

## Policy Lifecycle Management

### Creating a New Policy

**Steps**:
1. Click "Create Policy" button
2. **Tab 1 - Basic Settings**:
   - Enter policy name
   - Select leave type
   - Select employment types (multi-select)
   - Set effective date (today or future)
   - Optional: Set expiry date for temporary policies
   - Toggle "Policy Active" on
3. **Tab 2 - Accrual Settings**:
   - Select accrual method
   - Enter accrual rate
   - Optional: Set max accrual per year
   - Optional: Set maximum balance
   - If "Length of Service": Add service brackets
4. **Tab 3 - Carryover & Eligibility**:
   - Select carryover method
   - If "Partial": Enter carryover limit
   - Set carryover expiry months
   - Enter probation period (if applicable)
   - Enter minimum employment days (if applicable)
5. **Tab 4 - Advanced**:
   - Toggle negative balance if needed
   - If enabled: Set negative balance limit
6. Click "Create Policy"

### Editing an Existing Policy

**Steps**:
1. Find policy in list table
2. Click "Edit" action
3. Form opens with all current values pre-populated
4. Make changes across any tabs
5. Click "Update Policy"

**Best Practices**:
- **Avoid editing active policies** with existing entitlements
- Consider creating new policy with new effective date instead
- Test changes in staging environment first

### Activating/Deactivating Policies

**Activate**:
- Makes policy available for new entitlements
- Existing entitlements unaffected
- Accrual processing includes this policy

**Deactivate**:
- Prevents new entitlements
- Existing entitlements continue unchanged
- Accrual processing continues for existing entitlements
- Does NOT delete historical data

**Use Case**: Deactivate outdated policies while preserving history

### Deleting Policies

**Warning**: Permanent deletion

**Restrictions**:
- Cannot delete if active entitlements exist
- Cannot delete if historical leave requests reference this policy
- Backend should prevent deletion with appropriate error message

**Recommendation**: Deactivate instead of delete

---

## Impact on Employee Entitlements

### When Policy Created
- No immediate impact
- Must manually assign policy to employees OR
- Auto-assignment if employment type matches

### When Policy Edited
- **Active entitlements**: Changes may/may not apply retroactively (depends on system configuration)
- **Future entitlements**: Use updated policy
- **Best Practice**: Create new policy version instead of editing

### When Policy Activated
- Becomes available in entitlement creation
- Auto-assignment rules may apply

### When Policy Deactivated
- Existing entitlements unaffected
- New entitlements cannot use this policy

---

## Known Issues & Limitations

### Implemented Features
✅ Full CRUD operations
✅ Multi-tab form with validation
✅ Service brackets for length-of-service accrual
✅ Activate/deactivate without deletion
✅ Employment type multi-select
✅ Effective date and expiry date

### Partially Implemented
⚠️ Import/Export functionality (buttons present, no backend)
⚠️ Employment types API endpoint (using mock data)
⚠️ Policy duplication feature (not exposed in UI)
⚠️ Impact preview before save

### Not Implemented
❌ Versioning for policy changes
❌ Audit log of policy modifications
❌ Policy templates library
❌ Bulk policy operations
❌ Policy simulation/testing
❌ Conflict detection (overlapping policies)

---

## Code References

### Frontend Components
- Policies page: `frontend/src/pages/admin/LeavePolicies.tsx:1-415`
- Policy list table: `frontend/src/components/leave/PolicyListTable.tsx`
- Policy form: `frontend/src/components/leave/PolicyDetailsForm.tsx:1-618`

### TypeScript Interfaces
- LeavePolicy: `frontend/src/types/leave.ts:45-80`
- PolicyFormData: `frontend/src/components/leave/PolicyDetailsForm.tsx:40-72`

### API Endpoints
- Policy ViewSet: `backend/leave_management/views.py` (LeavePolicyViewSet)
- Policy serializer: `backend/leave_management/serializers.py` (LeavePolicySerializer)
- URLs: `backend/leave_management/urls.py`

### Backend Models
- LeavePolicy model: `backend/leave_management/models.py:119-428`

---

## Best Practices

### Policy Naming Conventions
- Include geography: "UK Full-time Annual Leave", "US Sick Days"
- Include employment type: "Contractor PTO", "Part-time Annual Leave"
- Be specific: "2025 Annual Leave" vs "Annual Leave"

### Accrual Rate Calculation
- **Monthly**: Annual entitlement ÷ 12
  - 20 days/year = 1.67 days/month
- **Per Shift**: Annual entitlement ÷ Expected annual shifts
  - 20 days ÷ 240 shifts = 0.083 days/shift
- **Annual**: Full annual entitlement
  - 25 days = 25 (allocated once)

### Testing New Policies
1. Create policy as **inactive** first
2. Assign to test employee
3. Verify accrual calculations
4. Test request/approval workflow
5. Check balance updates
6. Activate for production use

### Policy Versioning (Manual)
- When updating policy significantly:
  1. Set expiry date on old policy (today)
  2. Create new policy (effective tomorrow)
  3. Update employment type assignments
- Preserves historical accuracy

### Multi-tier Accrual (Length of Service)
- Start bracket at 0 months (new hires)
- Use sensible increments (12, 24, 36, 60 months)
- Ensure rates increase monotonically
- Test tier transitions carefully

---

## Troubleshooting

### "Employment types not loading"
- Check browser console for API errors
- Currently using mock data - API endpoint may not exist
- Verify authentication token is valid

### "Cannot save policy"
- Check all required fields are filled
- Verify accrual_rate is valid decimal format
- If carryover_method = 'partial', carryover_limit required
- Check browser console for validation errors

### "Policy not appearing for employees"
- Verify policy is **active** (toggle on)
- Check effective_date is not in future
- Verify employment type matches employee
- Check employee passes probation/minimum employment days

### "Accrual not working"
- Verify accrual_method is not 'none'
- Check accrual processing is scheduled (backend job)
- Verify employee has entitlement linked to this policy
- Check max_balance and max_accrual_per_year not blocking accrual

---

## Recommendations

### Short-term
1. ✅ Implement employment types API endpoint (remove mock data)
2. ✅ Add policy duplication button (backend endpoint exists)
3. ✅ Implement import/export functionality
4. ✅ Add policy conflict detection

### Medium-term
1. **Policy templates** - Pre-configured templates for common scenarios (UK, US, EU)
2. **Impact preview** - Show which employees will be affected before save
3. **Versioning** - Automatic policy versioning on edit
4. **Audit log** - Track all policy changes with who/when

### Long-term
1. **Policy simulator** - Test policy with mock employee over time
2. **Compliance checker** - Validate policies against legal requirements
3. **Recommendation engine** - Suggest optimal accrual rates based on usage
4. **A/B testing** - Compare different policy configurations

---

## Conclusion

The Leave Policies page provides comprehensive configuration for defining how employees earn, use, and carry over leave. With support for multiple accrual methods, service-based tiers, flexible carryover rules, and negative balance allowances, the system accommodates diverse workforce management needs across different employment types and regulatory environments.

**Key Capabilities**:
- ✅ 5 accrual methods (monthly, annual, per-shift, service-based, none)
- ✅ 4 carryover methods (none, full, partial, use-or-lose)
- ✅ Service-length tiered accrual with unlimited brackets
- ✅ Negative balance allowance with limits
- ✅ Probation period and minimum employment requirements
- ✅ Employment type-specific policies
- ✅ Effective date and expiry date support
- ✅ Active/inactive toggle for lifecycle management

The 4-tab form structure organizes complex configuration into logical groupings, making it easy for administrators to create sophisticated leave policies without overwhelming complexity.
