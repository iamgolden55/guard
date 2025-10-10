# Leave Settings Configuration - Detailed Documentation

**Date**: 2025-10-02
**Location**: `http://localhost:3000/leave/settings` (Admin only)
**Component**: `frontend/src/pages/admin/LeaveSettings.tsx`

## Overview

The Leave Settings page provides comprehensive system-wide configuration for the leave management system. It features 5 tabs with extensive customization options.

---

## Settings Structure

### Page Layout

**Dashboard Cards** (Top Section):
1. **Accrual Method** - Current default method (Monthly, Annual, Per Shift, Length of Service)
2. **Global Rate** - Default accrual rate (e.g., 1.67 days per period)
3. **Blackout Periods** - Count of active blackout periods
4. **Leave Types** - Count of active leave types

**Settings Tabs**:
1. Accrual Settings
2. Blackout Periods
3. Notifications (placeholder)
4. Integration (placeholder)
5. System Health (diagnostics)

---

## Tab 1: Accrual Settings

**Component**: `frontend/src/components/leave/AccrualSettings.tsx` (620 lines)
**API Endpoints**:
- GET `/api/v1/leave/settings/` - Fetch settings
- PUT `/api/v1/leave/settings/` - Save settings

### 1.1 Global Accrual Settings

**Purpose**: Configure system-wide defaults for leave accrual

**Fields**:

| Field | Type | Options | Default | Description |
|-------|------|---------|---------|-------------|
| **Default Accrual Method** | Dropdown | Monthly, Annual, Per Shift, Length of Service | Monthly | How leave accrues by default |
| **Global Accrual Rate** | Number | Decimal | 1.67 | Days accrued per period (~20 days/year) |
| **Max Accrual Per Year** | Number | Decimal | 25 | Maximum days that can accrue in a year |
| **Max Balance Limit** | Number | Decimal | 40 | Maximum cumulative balance allowed |
| **Accrual Frequency** | Dropdown | Monthly, Bi-weekly, Weekly, Daily | Monthly | How often accrual is processed |
| **Accrual Start Day** | Number | 1-28 | 1 | Day of month for monthly accrual |

**Business Logic**:
- Accrual method determines when leave is added to balances
- Global rate applies when policies don't specify their own rate
- Max accrual prevents unlimited accumulation
- Frequency controls batch processing schedule

---

### 1.2 Pro-rating Settings

**Purpose**: Configure proportional leave allocation for new hires or part-time staff

**Fields**:

| Field | Type | Options | Default | Description |
|-------|------|---------|---------|-------------|
| **Enable Pro-rating** | Toggle | On/Off | On | Enable proportional leave calculation |
| **Pro-rating Method** | Dropdown | Daily, Monthly, Anniversary | Daily | How to calculate proportional entitlement |

**Pro-rating Methods Explained**:
- **Daily**: Pro-rate based on exact days worked/employed
- **Monthly**: Pro-rate based on whole months worked
- **Anniversary**: Pro-rate from employment anniversary date

**Example**:
- Employee hired on March 15th
- Annual entitlement: 25 days
- **Daily pro-rating**: 25 × (days remaining / 365) = ~18.36 days
- **Monthly pro-rating**: 25 × (9 months remaining / 12) = 18.75 days
- **Anniversary pro-rating**: 25 days from next March 15th

---

### 1.3 Carryover Settings

**Purpose**: Configure year-end leave carryover rules

**Fields**:

| Field | Type | Options | Default | Description |
|-------|------|---------|---------|-------------|
| **Default Carryover Method** | Dropdown | None, Full, Partial, Use or Lose | Partial | How unused leave carries to next year |
| **Carryover Limit** | Number | Decimal | 5 | Max days that can carry over (partial only) |
| **Carryover Expiry** | Number | 1-24 months | 12 | Months until carried-over leave expires |

**Carryover Methods Explained**:
- **None**: No carryover - all unused leave lost at year-end
- **Full**: All unused leave carries to next year indefinitely
- **Partial**: Up to specified limit carries over (e.g., max 5 days)
- **Use or Lose**: All leave must be used by year-end

**Example Scenario (Partial Carryover)**:
- Employee has 8 days unused at year-end
- Carryover limit: 5 days
- Result: 5 days carry to next year, 3 days lost
- Carried-over 5 days expire after 12 months if unused

---

### 1.4 Leave Year Settings

**Purpose**: Define when the leave year starts and resets

**Fields**:

| Field | Type | Options | Default | Description |
|-------|------|---------|---------|-------------|
| **Leave Year Start Month** | Dropdown | January - December | January | Month when leave year begins |
| **Leave Year Start Day** | Number | 1-28 | 1 | Day of month when leave year begins |

**Common Configurations**:
- **Calendar Year**: January 1st
- **UK Tax Year**: April 6th
- **Company Anniversary**: Company founding date
- **Employee Anniversary**: Each employee's hire date (handled per-policy)

**Impact**:
- Accrual resets on this date
- Carryover processing happens on this date
- Balance calculations reference this date for "year to date"

---

### 1.5 Advanced Settings

#### 1.5.1 Negative Balance Settings

**Purpose**: Allow employees to take leave in advance

**Fields**:

| Field | Type | Options | Default | Description |
|-------|------|---------|---------|-------------|
| **Allow Negative Balance** | Toggle | On/Off | Off | Permit leave requests exceeding current balance |
| **Negative Balance Limit** | Number | Decimal | 5 | Maximum days employee can go negative |
| **Auto-approve Negative** | Toggle | On/Off | Off | Automatically approve requests causing negative balance |

**Use Cases**:
- New employees who haven't accrued leave yet
- Emergency situations requiring immediate leave
- Trusted employees with tenure

**Risk Management**:
- Negative balance should be recovered if employee leaves
- Consider requiring manager approval for negative balance
- Track negative balance in reports for compliance

**Example**:
- Employee with 0 days accrued requests 3 days leave
- Negative balance enabled, limit 5 days
- Request approved, balance becomes -3 days
- Future accrual will first recover the -3 before adding to balance

---

#### 1.5.2 Rounding Settings

**Purpose**: Control decimal precision in leave calculations

**Fields**:

| Field | Type | Options | Default | Description |
|-------|------|---------|---------|-------------|
| **Rounding Method** | Dropdown | None, Round Up, Round Down, Round to Nearest | Round to Nearest | How to handle fractional days |
| **Decimal Places** | Number | 0-4 | 2 | Precision for rounding (0-4 decimals) |

**Rounding Methods Explained**:
- **None**: No rounding - use full precision (e.g., 1.666667 days)
- **Round Up**: Always round up (e.g., 1.1 → 2, 1.9 → 2)
- **Round Down**: Always round down (e.g., 1.1 → 1, 1.9 → 1)
- **Round to Nearest**: Standard rounding (e.g., 1.4 → 1, 1.5 → 2)

**Examples by Precision**:
- Accrual: 1.666667 days
- **0 decimals**: 2 days (nearest)
- **1 decimal**: 1.7 days
- **2 decimals**: 1.67 days (default)
- **3 decimals**: 1.667 days
- **4 decimals**: 1.6667 days

**Recommendation**: 2 decimal places for balance, 1 decimal for display

---

#### 1.5.3 Weekend & Holiday Settings

**Purpose**: Exclude non-working days from accrual calculations

**Fields**:

| Field | Type | Options | Default | Description |
|-------|------|---------|---------|-------------|
| **Exclude Weekends from Accrual** | Toggle | On/Off | Off | Don't accrue leave on Saturdays/Sundays |
| **Exclude Holidays from Accrual** | Toggle | On/Off | Off | Don't accrue leave on public holidays |

**Impact on Accrual**:
- **Weekends excluded**: Monthly accrual only counts Monday-Friday
  - Example: 30-day month with 8 weekend days = 22 accrual days
  - Rate: 1.67 days per month × (22/30) = 1.23 days

- **Holidays excluded**: Accrual excludes public holidays
  - Example: Month with 2 public holidays = 28 accrual days
  - Rate: 1.67 days × (28/30) = 1.56 days

**Use Case**:
- Shift workers who don't work weekends
- Companies with consistent closure days
- Pro-rating for actual working days

---

#### 1.5.4 Notification Settings

**Purpose**: Configure low balance alerts and accrual notifications

**Fields**:

| Field | Type | Options | Default | Description |
|-------|------|---------|---------|-------------|
| **Notify when balance is low** | Toggle | On/Off | On | Alert employees when balance drops below threshold |
| **Low Balance Threshold** | Number | Decimal | 3 | Days remaining to trigger notification |
| **Notify when accrual is processed** | Toggle | On/Off | Off | Alert employees when leave accrues |

**Notification Triggers**:
- **Low Balance**: Email/notification when balance ≤ threshold
  - Example: Threshold 3 days, current balance 2.5 days → notification sent
  - Helps employees plan leave requests

- **Accrual Processed**: Monthly notification showing:
  - Days accrued
  - New balance
  - Upcoming expiry (for carried-over leave)

**Status**: Notification triggers exist in UI but require backend implementation

---

## Tab 2: Blackout Periods

**Component**: `frontend/src/components/leave/BlackoutPeriodManager.tsx` (21KB)
**API Endpoints**:
- GET `/api/v1/leave/blackout-periods/` - List periods
- POST `/api/v1/leave/blackout-periods/` - Create period
- PUT `/api/v1/leave/blackout-periods/{id}/` - Update period
- DELETE `/api/v1/leave/blackout-periods/{id}/` - Delete period
- PATCH `/api/v1/leave/blackout-periods/{id}/` - Toggle active status

### Blackout Period Configuration

**Purpose**: Define periods when leave requests are restricted

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| **Name** | Text | Yes | Descriptive name (e.g., "Christmas Period") |
| **Description** | Text | No | Additional details about restriction |
| **Start Date** | Date | Yes | First day of blackout period |
| **End Date** | Date | Yes | Last day of blackout period |
| **Is Recurring** | Boolean | No | Repeat annually/monthly |
| **Recurrence Type** | Dropdown | No | Yearly, Monthly (if recurring) |
| **Departments** | Multi-select | No | Affected departments (empty = all) |
| **Leave Types** | Multi-select | Yes | Restricted leave types |
| **Is Active** | Toggle | Yes | Enable/disable without deleting |

### Blackout Period Features

**Restriction Levels** (Backend-defined):
- **No Requests**: All leave blocked
- **Emergency Only**: Only emergency leave allowed
- **Manager Approval**: Requires additional manager approval
- **Limit Percentage**: Max % of team on leave

**Use Cases**:
1. **Peak Business Periods**: Retail during holidays, tax season for accountants
2. **Company Events**: Annual conference, training weeks
3. **Venue-Specific**: Special events at specific venues
4. **Capacity Planning**: Ensure minimum staffing levels

**Example Configurations**:

**Christmas Blackout**:
- Name: "Christmas Period"
- Start: December 23rd
- End: December 26th
- Recurring: Yes, Yearly
- Leave Types: Annual Leave
- Departments: All
- Status: Active

**Tax Season Blackout**:
- Name: "Tax Season"
- Start: March 1st
- End: April 15th
- Recurring: Yes, Yearly
- Leave Types: Annual Leave, Personal Leave
- Departments: Accounting
- Status: Active

---

## Tab 3: Notifications (Placeholder)

**Status**: ⚠️ **Not Yet Implemented**

**Planned Features**:
- Email notification settings
- SMS notification configuration
- Manager approval notifications
- Employee request notifications
- Balance threshold alerts
- Accrual processing notifications
- Reminder days before leave starts
- Digest frequency (daily, weekly, monthly)

**Current Implementation**:
- UI displays placeholder text
- Settings interface defined in LeaveSettings.tsx
- NotificationSettings interface exists (Lines 66-75)
- No backend integration

---

## Tab 4: Integration (Placeholder)

**Status**: ⚠️ **Not Yet Implemented**

**Planned Integrations**:
- Payroll system integration
- Calendar application sync (Outlook, Google Calendar)
- Workforce management tools
- HR information systems (HRIS)
- Time tracking systems

**Current Implementation**:
- UI displays "Integration settings coming soon"
- Placeholder tab exists
- No configuration options available

---

## Tab 5: System Health

**Purpose**: Display diagnostic information about leave system status

**Health Monitors**:

### 1. Accrual Engine
- **Status**: Running normally / Error
- **Last Run**: Timestamp of last accrual processing
- **Display**: Green badge with checkmark icon

### 2. Notifications
- **Status**: All systems operational / Issues detected
- **Queue**: Number of pending notifications
- **Display**: Green badge with checkmark icon

### 3. Database
- **Status**: Healthy / Performance issues
- **Response Time**: Query response time (<2ms typical)
- **Display**: Green badge with checkmark icon

**Current Implementation**:
- ⚠️ **Hardcoded Status**: All systems show "healthy"
- ⚠️ **No Real Monitoring**: Status is cosmetic, not live data
- ⚠️ **No Alerts**: No error detection or reporting

**Recommended Enhancement**:
- Add backend endpoint: `/api/v1/leave/system/health/`
- Real-time status checks
- Error logging and alerting
- Performance metrics

---

## API Integration

### Settings Endpoints

#### Fetch Accrual Settings
```
GET /api/v1/leave/settings/
Authorization: Bearer {token}

Response:
{
  "accrual_settings": {
    "default_accrual_method": "monthly",
    "global_accrual_rate": "1.67",
    "max_accrual_per_year": "25",
    // ... all accrual settings
  }
}
```

#### Update Accrual Settings
```
PUT /api/v1/leave/settings/
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "accrual_settings": {
    "default_accrual_method": "monthly",
    "global_accrual_rate": "2.0",
    // ... updated settings
  }
}

Response:
{
  "message": "Settings updated successfully",
  "accrual_settings": { ... }
}
```

#### Fetch Notification Settings
```
GET /api/v1/leave/settings/notifications/
Authorization: Bearer {token}

Response:
{
  "email_notifications": true,
  "sms_notifications": false,
  "manager_approval_notifications": true,
  // ... notification settings
}
```

**Status**:
- ✅ Accrual settings endpoints: Implemented
- ✅ Blackout periods endpoints: Fully implemented
- ⚠️ Notification settings endpoints: Partially implemented (returns defaults)
- ❌ Integration endpoints: Not implemented
- ❌ System health endpoint: Not implemented

---

## Default Settings

### Accrual Settings Defaults
```javascript
{
  default_accrual_method: 'monthly',
  global_accrual_rate: '1.67',      // ~20 days/year
  max_accrual_per_year: '25',
  max_balance_limit: '40',
  accrual_frequency: 'monthly',
  accrual_start_day: 1,
  enable_pro_rating: true,
  pro_rating_method: 'daily',
  default_carryover_method: 'partial',
  carryover_limit: '5',
  carryover_expiry_months: 12,
  leave_year_start_month: 1,        // January
  leave_year_start_day: 1,
  enable_negative_balance: false,
  negative_balance_limit: '5',
  auto_approve_negative: false,
  rounding_method: 'nearest',
  rounding_precision: 2,
  exclude_weekends_from_accrual: false,
  exclude_holidays_from_accrual: false,
  notify_balance_low: true,
  balance_low_threshold: '3',
  notify_accrual_processed: false,
}
```

### Notification Settings Defaults
```javascript
{
  email_notifications: true,
  sms_notifications: false,
  manager_approval_notifications: true,
  employee_request_notifications: true,
  balance_threshold_notifications: true,
  accrual_processing_notifications: false,
  reminder_days_before: 7,
  digest_frequency: 'weekly',
}
```

---

## Validation Rules

### Accrual Settings Validation
- **global_accrual_rate**: Must be valid decimal number
- **max_accrual_per_year**: Optional, must be valid number if provided
- **max_balance_limit**: Optional, must be valid number if provided
- **carryover_limit**: Must be valid number
- **carryover_expiry_months**: 1-24 months
- **accrual_start_day**: 1-28 (to avoid month-end issues)
- **leave_year_start_day**: 1-28
- **negative_balance_limit**: Must be valid number
- **balance_low_threshold**: Must be valid number
- **rounding_precision**: 0-4 decimal places

### Business Logic Validation
- If **carryover_method = 'partial'**, **carryover_limit** is required
- If **enable_pro_rating = false**, **pro_rating_method** is ignored
- If **enable_negative_balance = false**, negative limit settings ignored
- If **rounding_method = 'none'**, **rounding_precision** is ignored

---

## Permission Requirements

**Access Control**: Admin Only

- Settings page: `role === 'admin'`
- Read settings: Admin or Manager
- Update settings: Admin only
- System health: Admin only

**Frontend Route Protection**:
```typescript
// In LeaveManagement.tsx router
<Route path="/settings" element={
  authState.user?.role === 'admin'
    ? <LeaveSettings />
    : <Navigate to="/leave" />
} />
```

---

## Settings Impact on Leave System

### How Settings Affect Leave Operations

**Accrual Processing**:
- `accrual_frequency` determines batch job schedule
- `accrual_start_day` determines when monthly accrual runs
- `exclude_weekends_from_accrual` modifies accrual calculations
- `exclude_holidays_from_accrual` reduces accrual on holidays

**Leave Requests**:
- `enable_negative_balance` allows/prevents negative balance requests
- `auto_approve_negative` bypasses approval for negative requests
- Blackout periods block requests in restricted date ranges

**Balance Display**:
- `rounding_method` + `rounding_precision` format displayed balances
- `notify_balance_low` triggers low balance warnings

**Year-End Processing**:
- `leave_year_start_month/day` determines when carryover occurs
- `default_carryover_method` controls carryover behavior
- `carryover_limit` caps carryover amount (partial method)
- `carryover_expiry_months` sets expiry for carried-over leave

**Pro-rating**:
- `enable_pro_rating` activates proportional leave calculation
- `pro_rating_method` determines calculation approach for new hires

---

## Known Issues & Limitations

### Implemented Features
✅ Accrual settings fully functional
✅ Blackout period management complete
✅ Real-time settings updates
✅ Form validation
✅ Settings persistence

### Partially Implemented
⚠️ Notification settings (UI ready, backend partial)
⚠️ System health monitoring (cosmetic display only)

### Not Implemented
❌ Integration settings (placeholder only)
❌ Real-time accrual engine status
❌ Settings audit log
❌ Multi-tenancy settings isolation
❌ Settings export/import
❌ Settings versioning/rollback

---

## Code References

### Frontend Components
- Settings page: `frontend/src/pages/admin/LeaveSettings.tsx:1-605`
- Accrual settings: `frontend/src/components/leave/AccrualSettings.tsx:1-621`
- Blackout manager: `frontend/src/components/leave/BlackoutPeriodManager.tsx`

### TypeScript Interfaces
- AccrualSettingsData: `frontend/src/pages/admin/LeaveSettings.tsx:25-49`
- BlackoutPeriod: `frontend/src/pages/admin/LeaveSettings.tsx:51-64`
- NotificationSettings: `frontend/src/pages/admin/LeaveSettings.tsx:66-75`

### API Endpoints
- Settings: `backend/leave_management/views.py` (LeaveSettingsViewSet)
- Blackout periods: `backend/leave_management/views.py` (BlackoutPeriodsViewSet)
- URLs: `backend/leave_management/urls.py`

---

## Recommendations

### Short-term Improvements
1. ✅ **Complete notification backend** - Implement `/api/v1/leave/settings/notifications/` PUT endpoint
2. ✅ **Add system health endpoint** - Real monitoring instead of hardcoded status
3. ✅ **Settings audit log** - Track who changed what and when
4. ✅ **Validation enhancement** - Add cross-field validation (e.g., max_balance > max_accrual)

### Medium-term Enhancements
1. **Settings templates** - Pre-configured settings for different countries (UK, US, etc.)
2. **Settings export/import** - JSON export for backup/migration
3. **Policy override preview** - Show which policies will be affected by settings change
4. **Accrual simulation** - Preview accrual over time with current settings

### Long-term Vision
1. **Multi-tenant settings** - Company-specific settings isolation
2. **Settings versioning** - Track changes over time with rollback capability
3. **A/B testing framework** - Test different accrual methods
4. **Integration marketplace** - Pre-built connectors for popular payroll systems
5. **Machine learning** - Optimize accrual rates based on usage patterns

---

## Conclusion

The Leave Settings page provides comprehensive configuration options for the leave management system, with **Accrual Settings** and **Blackout Periods** fully implemented and operational. The **Notifications**, **Integration**, and **System Health** tabs are placeholders awaiting backend implementation.

The settings system follows a layered architecture:
1. **System-level defaults** (this settings page)
2. **Policy-level overrides** (individual leave policies)
3. **User-level exceptions** (manual adjustments)

This approach provides flexibility while maintaining consistency across the organization.
