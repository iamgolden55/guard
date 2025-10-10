# Leave Settings Comprehensive Testing Plan - Playwright MCP

**Document Date:** 2025-10-03
**Target URL:** http://localhost:3000/leave/settings
**Test Framework:** Playwright MCP
**Test Type:** Automated E2E Testing

## Test Credentials

- **Username:** Ctrindex
- **Password:** Test123456
- **Role:** Admin (required for leave settings access)

## Executive Summary

This document outlines a comprehensive testing strategy for the Leave Settings page covering:
- **5 tabs:** Accrual Settings, Blackout Periods, Notifications, Integrations, System Health
- **24 accrual configuration fields** with validation rules
- **Blackout period CRUD operations** with recurring support
- **Form validation and error handling**
- **Cross-tab navigation and state management**
- **Edge cases and error scenarios**

**Total Test Cases:** 76+
**Estimated Execution Time:** 45-60 minutes
**Critical Path Tests:** 35 (Phases 1-3)

---

## 🔄 TEST EXECUTION PROGRESS TRACKER

**Last Updated:** 2025-10-03 (In Progress)
**Current Phase:** Phase 2 - Accrual Settings Testing
**Tests Completed:** 7/76+
**Tests Passed:** 7
**Tests Failed:** 0
**Blockers:** None

### Quick Status Overview
- ✅ **Phase 1** - Environment Setup (5/5) - **COMPLETE**
- 🔄 **Phase 2** - Accrual Settings (2/30) - **IN PROGRESS**
- ⏳ **Phase 3** - Blackout Periods (0/15) - NOT STARTED
- ⏳ **Phase 4** - Notifications Tab (0/3) - NOT STARTED
- ⏳ **Phase 5** - Integrations Tab (0/3) - NOT STARTED
- ⏳ **Phase 6** - System Health (0/5) - NOT STARTED
- ⏳ **Phase 7** - Cross-Tab Navigation (0/5) - NOT STARTED
- ⏳ **Phase 8** - Error Handling (0/8) - NOT STARTED

### Test Results Summary
- ✅ Backend running on port 8000
- ✅ Frontend accessible at http://localhost:3000
- ✅ Login successful with credentials: Ctrindex / Test123456
- ✅ User: Dave Smith (Admin/Owner role)
- ✅ Leave Settings page loaded with all 5 tabs visible
- ✅ Accrual Settings tab active with 24 configuration fields displayed

### Detailed Progress Checklist

#### Phase 1: Environment Setup & Authentication (5 tests)
- [x] Test 1.1 - Backend Availability ✅ PASS
- [x] Test 1.2 - Frontend Availability ✅ PASS
- [x] Test 1.3 - Login Navigation ✅ PASS
- [x] Test 1.4 - Admin Login ✅ PASS (User: Dave Smith, Role: Admin)
- [x] Test 1.5 - Navigate to Leave Settings ✅ PASS

#### Phase 2: Accrual Settings Tab (30 tests)

**Section 2.1: Global Accrual Configuration**
- [ ] Test 2.1.1 - Default Accrual Method Dropdown
- [ ] Test 2.1.2 - Global Accrual Rate (Numeric Validation)
- [ ] Test 2.1.3 - Max Accrual Per Year
- [ ] Test 2.1.4 - Max Balance Limit

**Section 2.2: Accrual Frequency**
- [ ] Test 2.2.5 - Accrual Frequency Dropdown
- [ ] Test 2.2.6 - Accrual Start Day (1-31)

**Section 2.3: Pro-rating**
- [ ] Test 2.3.7 - Enable Pro Rating Toggle
- [ ] Test 2.3.8 - Pro Rating Method (Conditional)

**Section 2.4: Carryover**
- [ ] Test 2.4.9 - Default Carryover Method
- [ ] Test 2.4.10 - Carryover Limit (Conditional)
- [ ] Test 2.4.11 - Carryover Expiry Months (1-24)

**Section 2.5: Leave Year**
- [ ] Test 2.5.12 - Leave Year Start Month
- [ ] Test 2.5.13 - Leave Year Start Day

**Section 2.6: Negative Balance**
- [ ] Test 2.6.14 - Enable Negative Balance Toggle
- [ ] Test 2.6.15 - Negative Balance Limit (Conditional)
- [ ] Test 2.6.16 - Auto Approve Negative Toggle

**Section 2.7: Rounding**
- [ ] Test 2.7.17 - Rounding Method Dropdown
- [ ] Test 2.7.18 - Rounding Precision

**Section 2.8: Exclusions**
- [ ] Test 2.8.19 - Exclude Weekends Toggle
- [ ] Test 2.8.20 - Exclude Holidays Toggle

**Section 2.9: Notifications**
- [ ] Test 2.9.21 - Notify Balance Low Toggle
- [ ] Test 2.9.22 - Balance Low Threshold (Conditional)
- [ ] Test 2.9.23 - Notify Accrual Processed Toggle

**Section 2.10: Form Submission**
- [ ] Test 2.10.24 - Save Valid Configuration
- [ ] Test 2.10.25 - Submit with Validation Errors
- [ ] Test 2.10.26 - API Error Handling

#### Phase 3: Blackout Periods Tab (15 tests)

**Section 3.1: Navigation**
- [ ] Test 3.1.1 - Navigate to Blackout Periods Tab

**Section 3.2: Create**
- [ ] Test 3.2.2 - Open Create Form
- [ ] Test 3.2.3 - Fill Required Fields
- [ ] Test 3.2.4 - Validation: Name Too Short
- [ ] Test 3.2.5 - Validation: End Date Before Start
- [ ] Test 3.2.6 - Validation: No Departments
- [ ] Test 3.2.7 - Validation: No Leave Types
- [ ] Test 3.2.8 - Recurring Period Configuration
- [ ] Test 3.2.9 - Submit Valid Blackout Period

**Section 3.3: Edit**
- [ ] Test 3.3.10 - Open Edit Form
- [ ] Test 3.3.11 - Update and Save

**Section 3.4: Delete**
- [ ] Test 3.4.12 - Delete with Confirmation

**Section 3.5: Activate/Deactivate**
- [ ] Test 3.5.13 - Toggle Active Status
- [ ] Test 3.5.14 - Verify Inactive Styling
- [ ] Test 3.5.15 - Filter by Status

#### Phase 4: Notifications Tab (3 tests)
- [ ] Test 4.1 - Navigate to Notifications
- [ ] Test 4.2 - Verify Current State
- [ ] Test 4.3 - Test Functionality

#### Phase 5: Integrations Tab (3 tests)
- [ ] Test 5.1 - Navigate to Integrations
- [ ] Test 5.2 - Verify Current State
- [ ] Test 5.3 - Test Integration Settings

#### Phase 6: System Health Tab (5 tests)
- [ ] Test 6.1 - Navigate to System Health
- [ ] Test 6.2 - Verify Metrics Display
- [ ] Test 6.3 - Verify Metric Accuracy
- [ ] Test 6.4 - Verify Visual Indicators
- [ ] Test 6.5 - Test Refresh Functionality

#### Phase 7: Cross-Tab Navigation (5 tests)
- [ ] Test 7.1 - Sequential Tab Switching
- [ ] Test 7.2 - Data Persistence Across Tabs
- [ ] Test 7.3 - Unsaved Changes Warning
- [ ] Test 7.4 - URL State Persistence
- [ ] Test 7.5 - Keyboard Navigation

#### Phase 8: Error Handling & Edge Cases (8 tests)
- [ ] Test 8.1 - Network Error Simulation
- [ ] Test 8.2 - API 500 Error
- [ ] Test 8.3 - Permission Error (403)
- [ ] Test 8.4 - Session Timeout
- [ ] Test 8.5 - Concurrent Edits
- [ ] Test 8.6 - Browser Back/Forward
- [ ] Test 8.7 - Page Refresh During Edit
- [ ] Test 8.8 - XSS Prevention

### Issues Found During Testing
*Add bugs/issues here as they are discovered*

---

## Phase 1: Environment Setup & Authentication (5 tests)

### Prerequisites Verification

**Test 1.1 - Backend Availability**
```typescript
// Verify backend API is running
await fetch('http://localhost:8000/api/v1/health/');
// Expected: 200 OK
```

**Test 1.2 - Frontend Availability**
```typescript
// Navigate to frontend
browser_navigate({ url: 'http://localhost:3000' });
// Expected: Page loads successfully
```

### Authentication Flow

**Test 1.3 - Login Navigation**
```typescript
// Navigate to login page
browser_navigate({ url: 'http://localhost:3000/login' });
browser_snapshot();
// Verify login form displays
```

**Test 1.4 - Admin Login**
```typescript
// Fill login credentials
browser_type({
  element: "Username field",
  ref: "[name='username']",
  text: "Ctrindex"
});
browser_type({
  element: "Password field",
  ref: "[name='password']",
  text: "Test123456"
});
browser_click({
  element: "Login button",
  ref: "[type='submit']"
});
// Expected: Redirect to dashboard
// Verify: No error messages
```

**Test 1.5 - Navigate to Leave Settings**
```typescript
// Navigate to leave settings
browser_navigate({ url: 'http://localhost:3000/leave/settings' });
browser_snapshot();
// Verify: Page loads without 403 Forbidden
// Verify: 5 tabs visible (Accrual Settings, Blackout Periods, Notifications, Integrations, System Health)
```

---

## Phase 2: Accrual Settings Tab Testing (30 tests)

### Section 2.1: Global Accrual Configuration

**Test 2.1.1 - Default Accrual Method Dropdown**
```typescript
// Verify dropdown options
browser_click({
  element: "Default Accrual Method dropdown",
  ref: "[name='default_accrual_method']"
});
browser_snapshot();
// Expected options: monthly, annual, per_shift, length_of_service

// Test selection
browser_select_option({
  element: "Default Accrual Method",
  ref: "[name='default_accrual_method']",
  values: ["monthly"]
});
// Verify selection persists
```

**Test 2.1.2 - Global Accrual Rate (Numeric Validation)**
```typescript
// Test valid input
browser_type({
  element: "Global Accrual Rate field",
  ref: "[name='global_accrual_rate']",
  text: "20.5"
});
// Expected: Accepts decimal numbers

// Test invalid input
browser_type({
  element: "Global Accrual Rate field",
  ref: "[name='global_accrual_rate']",
  text: "abc"
});
browser_snapshot();
// Expected: Error message "Must be a valid number"

// Test negative value
browser_type({
  element: "Global Accrual Rate field",
  ref: "[name='global_accrual_rate']",
  text: "-5"
});
// Expected: Validation error or acceptance based on business rules

// Test required validation
browser_click({
  element: "Global Accrual Rate field",
  ref: "[name='global_accrual_rate']"
});
browser_press_key({ key: "Backspace" }); // Clear field
browser_click({ element: "Save button", ref: "[type='submit']" });
browser_snapshot();
// Expected: "Global accrual rate is required" error
```

**Test 2.1.3 - Max Accrual Per Year**
```typescript
// Test valid decimal
browser_type({
  element: "Max Accrual Per Year field",
  ref: "[name='max_accrual_per_year']",
  text: "30"
});

// Test decimal value
browser_type({
  element: "Max Accrual Per Year field",
  ref: "[name='max_accrual_per_year']",
  text: "25.5"
});
// Expected: Accepts decimal

// Test invalid input
browser_type({
  element: "Max Accrual Per Year field",
  ref: "[name='max_accrual_per_year']",
  text: "xyz"
});
browser_snapshot();
// Expected: Error message
```

**Test 2.1.4 - Max Balance Limit**
```typescript
// Test valid value
browser_type({
  element: "Max Balance Limit field",
  ref: "[name='max_balance_limit']",
  text: "100"
});

// Test decimal
browser_type({
  element: "Max Balance Limit field",
  ref: "[name='max_balance_limit']",
  text: "99.5"
});

// Test validation
browser_type({
  element: "Max Balance Limit field",
  ref: "[name='max_balance_limit']",
  text: "invalid"
});
browser_snapshot();
// Expected: Validation error
```

### Section 2.2: Accrual Frequency Configuration

**Test 2.2.5 - Accrual Frequency Dropdown**
```typescript
browser_click({
  element: "Accrual Frequency dropdown",
  ref: "[name='accrual_frequency']"
});
browser_snapshot();
// Expected options: monthly, bi_weekly, weekly, daily

// Test each option
const frequencies = ['monthly', 'bi_weekly', 'weekly', 'daily'];
for (const freq of frequencies) {
  browser_select_option({
    element: "Accrual Frequency",
    ref: "[name='accrual_frequency']",
    values: [freq]
  });
  // Verify selection
}
```

**Test 2.2.6 - Accrual Start Day (Range: 1-31)**
```typescript
// Test valid value
browser_type({
  element: "Accrual Start Day field",
  ref: "[name='accrual_start_day']",
  text: "15"
});

// Test minimum boundary
browser_type({
  element: "Accrual Start Day field",
  ref: "[name='accrual_start_day']",
  text: "0"
});
browser_snapshot();
// Expected: Validation error or auto-correction to 1

// Test maximum boundary
browser_type({
  element: "Accrual Start Day field",
  ref: "[name='accrual_start_day']",
  text: "32"
});
browser_snapshot();
// Expected: Validation error

// Test non-numeric
browser_type({
  element: "Accrual Start Day field",
  ref: "[name='accrual_start_day']",
  text: "abc"
});
browser_snapshot();
// Expected: Error or rejection of input
```

### Section 2.3: Pro-rating Settings

**Test 2.3.7 - Enable Pro Rating Toggle (Conditional Field Display)**
```typescript
browser_snapshot(); // Before toggle

// Toggle ON
browser_evaluate({
  element: "Enable Pro Rating toggle",
  ref: "[name='enable_pro_rating']",
  function: "(element) => { element.click(); }"
});
browser_snapshot(); // After toggle ON
// Expected: pro_rating_method field becomes visible

// Toggle OFF
browser_evaluate({
  element: "Enable Pro Rating toggle",
  ref: "[name='enable_pro_rating']",
  function: "(element) => { element.click(); }"
});
browser_snapshot(); // After toggle OFF
// Expected: pro_rating_method field disappears/disabled
```

**Test 2.3.8 - Pro Rating Method Dropdown (Conditional)**
```typescript
// Enable pro-rating first
browser_evaluate({
  element: "Enable Pro Rating toggle",
  ref: "[name='enable_pro_rating']",
  function: "(element) => { if (!element.checked) element.click(); }"
});

// Verify dropdown options
browser_click({
  element: "Pro Rating Method dropdown",
  ref: "[name='pro_rating_method']"
});
browser_snapshot();
// Expected options: daily, monthly, anniversary

// Test each option
browser_select_option({
  element: "Pro Rating Method",
  ref: "[name='pro_rating_method']",
  values: ["daily"]
});
```

### Section 2.4: Carryover Settings

**Test 2.4.9 - Default Carryover Method (Conditional Fields)**
```typescript
// Test 'partial' option (should require carryover_limit)
browser_select_option({
  element: "Default Carryover Method",
  ref: "[name='default_carryover_method']",
  values: ["partial"]
});
browser_snapshot();
// Expected: carryover_limit field becomes required

// Attempt to save without carryover_limit
browser_click({ element: "Save button", ref: "[type='submit']" });
browser_snapshot();
// Expected: Validation error for carryover_limit

// Test 'none' option
browser_select_option({
  element: "Default Carryover Method",
  ref: "[name='default_carryover_method']",
  values: ["none"]
});
browser_snapshot();
// Expected: carryover_limit becomes optional/hidden

// Test other options
browser_select_option({
  element: "Default Carryover Method",
  ref: "[name='default_carryover_method']",
  values: ["full"]
});

browser_select_option({
  element: "Default Carryover Method",
  ref: "[name='default_carryover_method']",
  values: ["use_or_lose"]
});
```

**Test 2.4.10 - Carryover Limit (Conditional Field)**
```typescript
// Set carryover method to partial first
browser_select_option({
  element: "Default Carryover Method",
  ref: "[name='default_carryover_method']",
  values: ["partial"]
});

// Test valid value
browser_type({
  element: "Carryover Limit field",
  ref: "[name='carryover_limit']",
  text: "10"
});

// Test decimal
browser_type({
  element: "Carryover Limit field",
  ref: "[name='carryover_limit']",
  text: "7.5"
});

// Test validation
browser_type({
  element: "Carryover Limit field",
  ref: "[name='carryover_limit']",
  text: "invalid"
});
browser_snapshot();
// Expected: "Must be a valid number" error
```

**Test 2.4.11 - Carryover Expiry Months (Range: 1-24)**
```typescript
// Test valid value
browser_type({
  element: "Carryover Expiry Months field",
  ref: "[name='carryover_expiry_months']",
  text: "12"
});

// Test minimum boundary (0)
browser_type({
  element: "Carryover Expiry Months field",
  ref: "[name='carryover_expiry_months']",
  text: "0"
});
browser_snapshot();
// Expected: "Must be at least 1 month" error

// Test maximum boundary (25)
browser_type({
  element: "Carryover Expiry Months field",
  ref: "[name='carryover_expiry_months']",
  text: "25"
});
browser_snapshot();
// Expected: "Cannot exceed 24 months" error

// Test edge cases
browser_type({
  element: "Carryover Expiry Months field",
  ref: "[name='carryover_expiry_months']",
  text: "1"
}); // Minimum valid

browser_type({
  element: "Carryover Expiry Months field",
  ref: "[name='carryover_expiry_months']",
  text: "24"
}); // Maximum valid
```

### Section 2.5: Leave Year Configuration

**Test 2.5.12 - Leave Year Start Month (1-12)**
```typescript
browser_click({
  element: "Leave Year Start Month dropdown",
  ref: "[name='leave_year_start_month']"
});
browser_snapshot();
// Expected: Options 1-12 (January-December)

// Test selection
browser_select_option({
  element: "Leave Year Start Month",
  ref: "[name='leave_year_start_month']",
  values: ["4"] // April
});

// Test edge months
browser_select_option({
  element: "Leave Year Start Month",
  ref: "[name='leave_year_start_month']",
  values: ["1"] // January
});

browser_select_option({
  element: "Leave Year Start Month",
  ref: "[name='leave_year_start_month']",
  values: ["12"] // December
});
```

**Test 2.5.13 - Leave Year Start Day (1-31)**
```typescript
// Test valid value
browser_type({
  element: "Leave Year Start Day field",
  ref: "[name='leave_year_start_day']",
  text: "1"
});

// Test range boundaries
browser_type({
  element: "Leave Year Start Day field",
  ref: "[name='leave_year_start_day']",
  text: "31"
});

// Test invalid value
browser_type({
  element: "Leave Year Start Day field",
  ref: "[name='leave_year_start_day']",
  text: "32"
});
browser_snapshot();
// Expected: Validation error
```

### Section 2.6: Negative Balance Configuration

**Test 2.6.14 - Enable Negative Balance Toggle (Conditional)**
```typescript
browser_snapshot(); // Before state

// Toggle ON
browser_evaluate({
  element: "Enable Negative Balance toggle",
  ref: "[name='enable_negative_balance']",
  function: "(element) => { element.click(); }"
});
browser_snapshot(); // After toggle ON
// Expected: negative_balance_limit and auto_approve_negative fields appear

// Toggle OFF
browser_evaluate({
  element: "Enable Negative Balance toggle",
  ref: "[name='enable_negative_balance']",
  function: "(element) => { element.click(); }"
});
browser_snapshot(); // After toggle OFF
// Expected: Related fields hidden
```

**Test 2.6.15 - Negative Balance Limit (Conditional)**
```typescript
// Enable negative balance first
browser_evaluate({
  element: "Enable Negative Balance toggle",
  ref: "[name='enable_negative_balance']",
  function: "(element) => { if (!element.checked) element.click(); }"
});

// Test valid value
browser_type({
  element: "Negative Balance Limit field",
  ref: "[name='negative_balance_limit']",
  text: "5"
});

// Test decimal
browser_type({
  element: "Negative Balance Limit field",
  ref: "[name='negative_balance_limit']",
  text: "3.5"
});

// Test validation
browser_type({
  element: "Negative Balance Limit field",
  ref: "[name='negative_balance_limit']",
  text: "abc"
});
browser_snapshot();
// Expected: Validation error
```

**Test 2.6.16 - Auto Approve Negative Toggle**
```typescript
// Ensure negative balance is enabled
browser_evaluate({
  element: "Enable Negative Balance toggle",
  ref: "[name='enable_negative_balance']",
  function: "(element) => { if (!element.checked) element.click(); }"
});

// Toggle auto approve ON
browser_evaluate({
  element: "Auto Approve Negative toggle",
  ref: "[name='auto_approve_negative']",
  function: "(element) => { element.click(); }"
});
browser_snapshot();

// Toggle auto approve OFF
browser_evaluate({
  element: "Auto Approve Negative toggle",
  ref: "[name='auto_approve_negative']",
  function: "(element) => { element.click(); }"
});
browser_snapshot();
```

### Section 2.7: Rounding Settings

**Test 2.7.17 - Rounding Method Dropdown**
```typescript
browser_click({
  element: "Rounding Method dropdown",
  ref: "[name='rounding_method']"
});
browser_snapshot();
// Expected options: none, up, down, nearest

// Test each option
const roundingMethods = ['none', 'up', 'down', 'nearest'];
for (const method of roundingMethods) {
  browser_select_option({
    element: "Rounding Method",
    ref: "[name='rounding_method']",
    values: [method]
  });
  browser_snapshot();
}
```

**Test 2.7.18 - Rounding Precision (Decimal Places)**
```typescript
// Test valid value
browser_type({
  element: "Rounding Precision field",
  ref: "[name='rounding_precision']",
  text: "2"
});

// Test edge values
browser_type({
  element: "Rounding Precision field",
  ref: "[name='rounding_precision']",
  text: "0"
}); // No decimal places

browser_type({
  element: "Rounding Precision field",
  ref: "[name='rounding_precision']",
  text: "4"
}); // High precision

// Test invalid
browser_type({
  element: "Rounding Precision field",
  ref: "[name='rounding_precision']",
  text: "-1"
});
browser_snapshot();
// Expected: Validation error
```

### Section 2.8: Weekend and Holiday Exclusions

**Test 2.8.19 - Exclude Weekends from Accrual Toggle**
```typescript
// Toggle ON
browser_evaluate({
  element: "Exclude Weekends toggle",
  ref: "[name='exclude_weekends_from_accrual']",
  function: "(element) => { element.click(); }"
});
browser_snapshot();

// Toggle OFF
browser_evaluate({
  element: "Exclude Weekends toggle",
  ref: "[name='exclude_weekends_from_accrual']",
  function: "(element) => { element.click(); }"
});
browser_snapshot();
```

**Test 2.8.20 - Exclude Holidays from Accrual Toggle**
```typescript
// Toggle ON
browser_evaluate({
  element: "Exclude Holidays toggle",
  ref: "[name='exclude_holidays_from_accrual']",
  function: "(element) => { element.click(); }"
});
browser_snapshot();

// Toggle OFF
browser_evaluate({
  element: "Exclude Holidays toggle",
  ref: "[name='exclude_holidays_from_accrual']",
  function: "(element) => { element.click(); }"
});
browser_snapshot();
```

### Section 2.9: Notification Preferences

**Test 2.9.21 - Notify Balance Low Toggle (Conditional)**
```typescript
browser_snapshot(); // Before state

// Toggle ON
browser_evaluate({
  element: "Notify Balance Low toggle",
  ref: "[name='notify_balance_low']",
  function: "(element) => { element.click(); }"
});
browser_snapshot();
// Expected: balance_low_threshold field appears

// Toggle OFF
browser_evaluate({
  element: "Notify Balance Low toggle",
  ref: "[name='notify_balance_low']",
  function: "(element) => { element.click(); }"
});
browser_snapshot();
// Expected: balance_low_threshold field hidden
```

**Test 2.9.22 - Balance Low Threshold (Conditional)**
```typescript
// Enable notify balance low first
browser_evaluate({
  element: "Notify Balance Low toggle",
  ref: "[name='notify_balance_low']",
  function: "(element) => { if (!element.checked) element.click(); }"
});

// Test valid value
browser_type({
  element: "Balance Low Threshold field",
  ref: "[name='balance_low_threshold']",
  text: "3"
});

// Test decimal
browser_type({
  element: "Balance Low Threshold field",
  ref: "[name='balance_low_threshold']",
  text: "2.5"
});

// Test validation
browser_type({
  element: "Balance Low Threshold field",
  ref: "[name='balance_low_threshold']",
  text: "invalid"
});
browser_snapshot();
// Expected: Validation error
```

**Test 2.9.23 - Notify Accrual Processed Toggle**
```typescript
// Toggle ON
browser_evaluate({
  element: "Notify Accrual Processed toggle",
  ref: "[name='notify_accrual_processed']",
  function: "(element) => { element.click(); }"
});
browser_snapshot();

// Toggle OFF
browser_evaluate({
  element: "Notify Accrual Processed toggle",
  ref: "[name='notify_accrual_processed']",
  function: "(element) => { element.click(); }"
});
browser_snapshot();
```

### Section 2.10: Form Submission & Data Persistence

**Test 2.10.24 - Save Valid Configuration**
```typescript
// Fill all required fields with valid data
browser_select_option({
  element: "Default Accrual Method",
  ref: "[name='default_accrual_method']",
  values: ["monthly"]
});

browser_type({
  element: "Global Accrual Rate field",
  ref: "[name='global_accrual_rate']",
  text: "20"
});

browser_type({
  element: "Max Accrual Per Year field",
  ref: "[name='max_accrual_per_year']",
  text: "30"
});

browser_type({
  element: "Max Balance Limit field",
  ref: "[name='max_balance_limit']",
  text: "100"
});

browser_select_option({
  element: "Accrual Frequency",
  ref: "[name='accrual_frequency']",
  values: ["monthly"]
});

browser_type({
  element: "Accrual Start Day field",
  ref: "[name='accrual_start_day']",
  text: "1"
});

browser_select_option({
  element: "Default Carryover Method",
  ref: "[name='default_carryover_method']",
  values: ["partial"]
});

browser_type({
  element: "Carryover Limit field",
  ref: "[name='carryover_limit']",
  text: "10"
});

browser_type({
  element: "Carryover Expiry Months field",
  ref: "[name='carryover_expiry_months']",
  text: "12"
});

browser_select_option({
  element: "Leave Year Start Month",
  ref: "[name='leave_year_start_month']",
  values: ["1"]
});

browser_type({
  element: "Leave Year Start Day field",
  ref: "[name='leave_year_start_day']",
  text: "1"
});

// Click Save button
browser_click({ element: "Save button", ref: "[type='submit']" });
browser_wait_for({ time: 3 }); // Wait for API call
browser_snapshot();
// Expected: Success message appears (e.g., "Settings saved successfully!")

// Verify data persists - refresh page
browser_navigate({ url: 'http://localhost:3000/leave/settings' });
browser_wait_for({ time: 2 });
browser_snapshot();
// Verify all saved values are still populated in form
```

**Test 2.10.25 - Submit with Validation Errors**
```typescript
// Navigate to accrual settings tab
browser_navigate({ url: 'http://localhost:3000/leave/settings' });

// Clear required field
browser_click({
  element: "Global Accrual Rate field",
  ref: "[name='global_accrual_rate']"
});
browser_press_key({ key: "Control+a" });
browser_press_key({ key: "Delete" });

// Attempt to save
browser_click({ element: "Save button", ref: "[type='submit']" });
browser_snapshot();
// Expected: Error messages display
// Expected: "Global accrual rate is required" error visible
// Expected: Form NOT submitted (no success message)
// Expected: Page stays on form (no redirect)
```

**Test 2.10.26 - API Error Handling**
```typescript
// This test requires backend to be stopped or mocked to fail
// Stop backend: pkill -f "python manage.py runserver"

// Fill valid data and attempt to save
browser_click({ element: "Save button", ref: "[type='submit']" });
browser_wait_for({ time: 5 });
browser_snapshot();
// Expected: User-friendly error message
// Example: "Failed to save settings. Please try again."
// Expected: No success message
// Expected: Form data preserved (not lost)

// Restart backend for subsequent tests
```

---

## Phase 3: Blackout Periods Tab Testing (15 tests)

### Section 3.1: Tab Navigation

**Test 3.1.1 - Navigate to Blackout Periods Tab**
```typescript
browser_navigate({ url: 'http://localhost:3000/leave/settings' });

// Click Blackout Periods tab
browser_click({
  element: "Blackout Periods tab",
  ref: "[role='tab'][name*='Blackout']"
});
browser_snapshot();
// Expected: Tab becomes active (visual indicator)
// Expected: Blackout periods list/table displays
// Expected: "Add Blackout Period" button visible
```

### Section 3.2: Create Blackout Period

**Test 3.2.2 - Open Create Blackout Form**
```typescript
// Click Add button
browser_click({
  element: "Add Blackout Period button",
  ref: "button:has-text('Add Blackout Period')"
});
browser_wait_for({ time: 1 });
browser_snapshot();
// Expected: Modal or form panel opens
// Expected: Empty form with required fields
// Expected: Save and Cancel buttons visible
```

**Test 3.2.3 - Fill Required Fields (Valid Data)**
```typescript
// Name (min 3 characters)
browser_type({
  element: "Blackout Period Name field",
  ref: "[name='name']",
  text: "Christmas Break 2025"
});

// Description (optional, max 500 chars)
browser_type({
  element: "Description field",
  ref: "[name='description']",
  text: "Annual holiday period - all departments"
});

// Start Date
browser_click({
  element: "Start Date picker",
  ref: "[name='start_date_obj']"
});
// Select date (e.g., 24 Dec 2025)
// Note: Date picker interaction may require specific Playwright commands

// End Date
browser_click({
  element: "End Date picker",
  ref: "[name='end_date_obj']"
});
// Select date after start date (e.g., 2 Jan 2026)

// Departments (multi-select)
browser_click({
  element: "Departments dropdown",
  ref: "[name='departments']"
});
// Select at least one department
browser_click({
  element: "Department option",
  ref: "option:has-text('Operations')"
});

// Leave Types (multi-select)
browser_click({
  element: "Leave Types dropdown",
  ref: "[name='leave_types']"
});
// Select at least one leave type
browser_click({
  element: "Leave Type option",
  ref: "option:has-text('Annual Leave')"
});

browser_snapshot();
```

**Test 3.2.4 - Validation: Name Too Short**
```typescript
// Open create form
browser_click({
  element: "Add Blackout Period button",
  ref: "button:has-text('Add Blackout Period')"
});

// Enter name with less than 3 characters
browser_type({
  element: "Blackout Period Name field",
  ref: "[name='name']",
  text: "AB"
});

// Attempt to save
browser_click({ element: "Save button", ref: "button:has-text('Save')" });
browser_snapshot();
// Expected: Error message "Name must be at least 3 characters"
// Expected: Form NOT submitted
```

**Test 3.2.5 - Validation: End Date Before Start Date**
```typescript
// Fill name
browser_type({
  element: "Blackout Period Name field",
  ref: "[name='name']",
  text: "Test Period"
});

// Set start date to future date (e.g., 1 Jan 2026)
browser_click({
  element: "Start Date picker",
  ref: "[name='start_date_obj']"
});
// Select 1 Jan 2026

// Set end date to earlier date (e.g., 31 Dec 2025)
browser_click({
  element: "End Date picker",
  ref: "[name='end_date_obj']"
});
// Select 31 Dec 2025

// Attempt to save
browser_click({ element: "Save button", ref: "button:has-text('Save')" });
browser_snapshot();
// Expected: Error message "End date must be after start date"
```

**Test 3.2.6 - Validation: No Departments Selected**
```typescript
// Fill required fields except departments
browser_type({
  element: "Name field",
  ref: "[name='name']",
  text: "Test Period"
});
// Fill dates...

// Leave departments empty
// Attempt to save
browser_click({ element: "Save button", ref: "button:has-text('Save')" });
browser_snapshot();
// Expected: Error "At least one department must be selected"
```

**Test 3.2.7 - Validation: No Leave Types Selected**
```typescript
// Fill required fields except leave types
browser_type({
  element: "Name field",
  ref: "[name='name']",
  text: "Test Period"
});
// Fill dates and departments...

// Leave leave_types empty
// Attempt to save
browser_click({ element: "Save button", ref: "button:has-text('Save')" });
browser_snapshot();
// Expected: Error "At least one leave type must be selected"
```

**Test 3.2.8 - Recurring Period Configuration**
```typescript
// Fill basic required fields
browser_type({
  element: "Name field",
  ref: "[name='name']",
  text: "Annual Summer Shutdown"
});

// Toggle is_recurring ON
browser_evaluate({
  element: "Is Recurring toggle",
  ref: "[name='is_recurring']",
  function: "(element) => { element.click(); }"
});
browser_snapshot();
// Expected: recurrence_type dropdown appears

// Select recurrence type
browser_click({
  element: "Recurrence Type dropdown",
  ref: "[name='recurrence_type']"
});
browser_snapshot();
// Expected options: yearly, monthly

browser_select_option({
  element: "Recurrence Type",
  ref: "[name='recurrence_type']",
  values: ["yearly"]
});
```

**Test 3.2.9 - Submit Valid Blackout Period**
```typescript
// Fill all required fields correctly
browser_type({
  element: "Name field",
  ref: "[name='name']",
  text: "Easter Holiday 2025"
});

browser_type({
  element: "Description field",
  ref: "[name='description']",
  text: "Easter weekend blackout"
});

// Set dates (valid range)
// Select departments
// Select leave types

// Click Save
browser_click({ element: "Save button", ref: "button:has-text('Save')" });
browser_wait_for({ time: 3 });
browser_snapshot();
// Expected: Success message appears
// Expected: Modal closes
// Expected: New period appears in list
// Verify: Period details match input data
```

### Section 3.3: Edit Blackout Period

**Test 3.3.10 - Open Edit Form**
```typescript
// Navigate to blackout periods tab
browser_click({
  element: "Blackout Periods tab",
  ref: "[role='tab'][name*='Blackout']"
});

// Click edit icon on first period in list
browser_click({
  element: "Edit button for first period",
  ref: "[aria-label*='Edit']:first"
});
browser_snapshot();
// Expected: Edit modal opens
// Expected: Form pre-populated with existing data
// Verify: Name field contains existing name
// Verify: Dates match existing values
```

**Test 3.3.11 - Update and Save Blackout Period**
```typescript
// Modify description
browser_click({
  element: "Description field",
  ref: "[name='description']"
});
browser_press_key({ key: "Control+a" });
browser_type({
  element: "Description field",
  ref: "[name='description']",
  text: "Updated description for testing"
});

// Click Save
browser_click({ element: "Save button", ref: "button:has-text('Save')" });
browser_wait_for({ time: 3 });
browser_snapshot();
// Expected: Success message
// Expected: Modal closes
// Verify: Updated description visible in list
```

### Section 3.4: Delete Blackout Period

**Test 3.4.12 - Delete with Confirmation**
```typescript
// Click delete icon
browser_click({
  element: "Delete button for test period",
  ref: "[aria-label*='Delete'][data-id='test-period']"
});
browser_snapshot();
// Expected: Confirmation dialog appears
// Expected: Warning message about deletion

// Click Cancel
browser_click({
  element: "Cancel button",
  ref: "button:has-text('Cancel')"
});
browser_snapshot();
// Expected: Dialog closes
// Expected: Period still exists in list

// Click delete again
browser_click({
  element: "Delete button",
  ref: "[aria-label*='Delete'][data-id='test-period']"
});

// Click Confirm/Delete
browser_click({
  element: "Confirm Delete button",
  ref: "button:has-text('Delete')"
});
browser_wait_for({ time: 3 });
browser_snapshot();
// Expected: Success message
// Expected: Period removed from list
```

### Section 3.5: Activate/Deactivate Periods

**Test 3.5.13 - Toggle Active Status**
```typescript
// Toggle is_active switch for a period
browser_evaluate({
  element: "Active toggle for period",
  ref: "[data-period-id='1'] [name='is_active']",
  function: "(element) => { element.click(); }"
});
browser_wait_for({ time: 2 });
browser_snapshot();
// Expected: Status updates in UI
// Expected: Success message or visual confirmation
```

**Test 3.5.14 - Verify Inactive Period Styling**
```typescript
// Deactivate a period
browser_evaluate({
  element: "Active toggle",
  ref: "[data-period-id='2'] [name='is_active']",
  function: "(element) => { if (element.checked) element.click(); }"
});

browser_snapshot();
// Expected: Inactive period has visual indicator
// Examples: Greyed out text, "Inactive" badge, opacity change
// Verify: Clear distinction from active periods
```

**Test 3.5.15 - Filter by Active Status (if available)**
```typescript
// Check for filter dropdown/toggle
browser_snapshot();
// If filter exists:
browser_click({
  element: "Status filter",
  ref: "[aria-label*='Filter']"
});

// Select "Active Only"
browser_click({
  element: "Active only option",
  ref: "option:has-text('Active')"
});
browser_snapshot();
// Expected: Only active periods displayed

// Select "Inactive Only"
// Verify only inactive periods shown

// Select "All"
// Verify all periods shown
```

---

## Phase 4: Notifications Tab Testing (3 tests)

**Test 4.1 - Navigate to Notifications Tab**
```typescript
browser_click({
  element: "Notifications tab",
  ref: "[role='tab'][name*='Notification']"
});
browser_snapshot();
// Expected: Tab becomes active
```

**Test 4.2 - Verify Current Implementation State**
```typescript
browser_snapshot();
// Document findings:
// - Is it a placeholder with message?
// - Are notification settings implemented?
// - What fields are available?
```

**Test 4.3 - Test Available Functionality**
```typescript
// If placeholder:
// - Verify appropriate message displays
// - Example: "Notification settings coming soon"

// If implemented:
// - Test email notification toggles
// - Test SMS notification toggles
// - Test notification frequency settings
// - Test save functionality
```

---

## Phase 5: Integrations Tab Testing (3 tests)

**Test 5.1 - Navigate to Integrations Tab**
```typescript
browser_click({
  element: "Integrations tab",
  ref: "[role='tab'][name*='Integration']"
});
browser_snapshot();
// Expected: Tab becomes active
```

**Test 5.2 - Verify Current State**
```typescript
browser_snapshot();
// Document:
// - Is integration configuration available?
// - What integrations are listed?
// - Is it placeholder content?
```

**Test 5.3 - Test Integration Settings (if available)**
```typescript
// If implemented:
// - Test Deputy integration toggle
// - Test API key configuration
// - Test connection testing
// - Test save functionality

// If placeholder:
// - Verify appropriate message
```

---

## Phase 6: System Health Tab Testing (5 tests)

**Test 6.1 - Navigate to System Health Tab**
```typescript
browser_click({
  element: "System Health tab",
  ref: "[role='tab'][name*='System Health']"
});
browser_snapshot();
// Expected: Tab becomes active
// Expected: Health metrics display
```

**Test 6.2 - Verify Metrics Display**
```typescript
browser_snapshot();
// Verify presence of:
// - Total leave balances metric
// - Pending requests count
// - Active policies count
// - System status indicators
// - Any charts or visualizations

// Check for loading errors
browser_console_messages({ onlyErrors: true });
```

**Test 6.3 - Verify Metric Accuracy**
```typescript
// Cross-check displayed metrics with database/API
// Example: If showing "15 pending requests"
// - Query API: GET /api/v1/leave/requests/?status=pending
// - Verify count matches UI display

// Document any discrepancies
```

**Test 6.4 - Verify Visual Indicators**
```typescript
browser_snapshot();
// Check:
// - Status colors (green = healthy, yellow = warning, red = error)
// - Icons display correctly (checkmarks, warnings, errors)
// - Charts render without errors
// - Responsive design (if mobile view needed)
```

**Test 6.5 - Test Refresh Functionality**
```typescript
// Look for refresh button
browser_click({
  element: "Refresh health data button",
  ref: "[aria-label*='Refresh']"
});
browser_wait_for({ time: 2 });
browser_snapshot();
// Expected: Data refreshes
// Expected: Loading indicator shows briefly
// Expected: Updated timestamps (if displayed)
```

---

## Phase 7: Cross-Tab Navigation & State Management (5 tests)

**Test 7.1 - Sequential Tab Switching**
```typescript
const tabs = [
  'Accrual Settings',
  'Blackout Periods',
  'Notifications',
  'Integrations',
  'System Health'
];

for (const tabName of tabs) {
  browser_click({
    element: `${tabName} tab`,
    ref: `[role='tab'][name*='${tabName}']`
  });
  browser_wait_for({ time: 1 });
  browser_snapshot();

  // Check console for errors
  const errors = browser_console_messages({ onlyErrors: true });
  // Expected: No console errors
}
```

**Test 7.2 - Data Persistence Across Tab Switches**
```typescript
// Fill form in Accrual Settings (don't save)
browser_click({
  element: "Accrual Settings tab",
  ref: "[role='tab'][name*='Accrual']"
});

browser_type({
  element: "Global Accrual Rate field",
  ref: "[name='global_accrual_rate']",
  text: "99.99"
});

// Switch to another tab
browser_click({
  element: "Blackout Periods tab",
  ref: "[role='tab'][name*='Blackout']"
});

// Return to Accrual Settings
browser_click({
  element: "Accrual Settings tab",
  ref: "[role='tab'][name*='Accrual']"
});

browser_snapshot();
// Expected behavior (one of):
// 1. Unsaved data persists (value "99.99" still in field)
// 2. Unsaved data lost with warning shown
// 3. Warning before switching tabs

// Document actual behavior
```

**Test 7.3 - Unsaved Changes Warning**
```typescript
// Modify field
browser_type({
  element: "Global Accrual Rate field",
  ref: "[name='global_accrual_rate']",
  text: "88.88"
});

// Attempt to navigate away
browser_navigate({ url: 'http://localhost:3000/dashboard' });
browser_snapshot();
// Expected (if implemented):
// - Warning dialog appears
// - Options: "Save Changes", "Discard Changes", "Cancel"

// If no warning:
// - Document as potential improvement
```

**Test 7.4 - URL State Persistence**
```typescript
// Click each tab and check URL
browser_click({
  element: "Accrual Settings tab",
  ref: "[role='tab'][name*='Accrual']"
});
// Check if URL contains hash or query param (e.g., #accrual or ?tab=accrual)

browser_click({
  element: "Blackout Periods tab",
  ref: "[role='tab'][name*='Blackout']"
});
// Check URL change

// Refresh page
browser_navigate({ url: 'http://localhost:3000/leave/settings#blackout' });
browser_snapshot();
// Expected: Blackout Periods tab active after refresh
// If not implemented: Document as enhancement
```

**Test 7.5 - Keyboard Navigation**
```typescript
// Test Tab key navigation
browser_navigate({ url: 'http://localhost:3000/leave/settings' });

browser_press_key({ key: "Tab" });
browser_snapshot(); // First focusable element

browser_press_key({ key: "Tab" });
browser_snapshot(); // Second focusable element

// Test through entire form
// Verify logical tab order
// Verify no focus traps

// Test Enter key on Save button
browser_click({
  element: "Global Accrual Rate field",
  ref: "[name='global_accrual_rate']"
});
browser_type({
  element: "Global Accrual Rate field",
  ref: "[name='global_accrual_rate']",
  text: "20"
});
// Navigate to Save button via Tab
browser_press_key({ key: "Enter" }); // Should submit form

// Test Escape key on modal (if Blackout form uses modal)
browser_click({
  element: "Add Blackout Period button",
  ref: "button:has-text('Add Blackout Period')"
});
browser_press_key({ key: "Escape" });
browser_snapshot();
// Expected: Modal closes
```

---

## Phase 8: Error Handling & Edge Cases (8 tests)

**Test 8.1 - Network Error Simulation**
```typescript
// Offline test not directly possible via Playwright MCP
// Alternative: Stop backend server

// Fill valid data
browser_type({
  element: "Global Accrual Rate field",
  ref: "[name='global_accrual_rate']",
  text: "20"
});

// Stop backend (in separate terminal): pkill -f "python manage.py runserver"

// Attempt to save
browser_click({ element: "Save button", ref: "[type='submit']" });
browser_wait_for({ time: 5 });
browser_snapshot();
// Expected: User-friendly error message
// Example: "Unable to save. Please check your connection."
// NOT: Raw error like "NetworkError" or "ERR_CONNECTION_REFUSED"

// Restart backend for subsequent tests
```

**Test 8.2 - API 500 Error**
```typescript
// Requires backend modification to force 500 error
// Or use mock service worker

// Attempt operation that triggers 500
browser_click({ element: "Save button", ref: "[type='submit']" });
browser_wait_for({ time: 3 });
browser_snapshot();
// Expected: Graceful error handling
// Example: "An error occurred. Please try again or contact support."
```

**Test 8.3 - Permission Error (403 Forbidden)**
```typescript
// Login as non-admin user (if available)
// Navigate to leave settings
browser_navigate({ url: 'http://localhost:3000/leave/settings' });
browser_snapshot();
// Expected: Access denied message
// OR: Redirect to dashboard with error message
// Example: "You don't have permission to access this page."

// Re-login as admin for subsequent tests
```

**Test 8.4 - Session Timeout**
```typescript
// Login
browser_navigate({ url: 'http://localhost:3000/login' });
browser_type({
  element: "Username field",
  ref: "[name='username']",
  text: "Ctrindex"
});
browser_type({
  element: "Password field",
  ref: "[name='password']",
  text: "Test123456"
});
browser_click({ element: "Login button", ref: "[type='submit']" });

// Clear auth token from localStorage
browser_evaluate({
  element: "window",
  ref: "window",
  function: "() => { localStorage.removeItem('authToken'); localStorage.removeItem('accessToken'); }"
});

// Attempt to save settings
browser_click({ element: "Save button", ref: "[type='submit']" });
browser_wait_for({ time: 3 });
browser_snapshot();
// Expected: Redirect to login with message
// Example: "Your session has expired. Please log in again."
```

**Test 8.5 - Concurrent Edits (Optimistic Locking)**
```typescript
// This test requires two browser sessions
// Simplified version:

// Browser 1: Load settings
// Browser 2: Load same settings
// Browser 2: Modify and save
// Browser 1: Modify and save
// Expected: Conflict warning or last-write-wins behavior

// Document actual behavior
```

**Test 8.6 - Browser Back/Forward Navigation**
```typescript
// Navigate to settings
browser_navigate({ url: 'http://localhost:3000/leave/settings' });

// Navigate to different page
browser_navigate({ url: 'http://localhost:3000/dashboard' });

// Use browser back
browser_navigate_back();
browser_snapshot();
// Expected: Returns to leave settings
// Verify: State preserved or fresh load

// Use browser forward
browser_navigate({ url: 'http://localhost:3000/dashboard' });
browser_snapshot();
// Verify navigation works correctly
```

**Test 8.7 - Page Refresh During Edit**
```typescript
// Start editing form
browser_type({
  element: "Global Accrual Rate field",
  ref: "[name='global_accrual_rate']",
  text: "88"
});

// Refresh page
browser_navigate({ url: 'http://localhost:3000/leave/settings' });
browser_snapshot();
// Expected behavior:
// 1. Warning before refresh (browser default), OR
// 2. Auto-save functionality preserves changes, OR
// 3. Changes lost (document as improvement needed)
```

**Test 8.8 - XSS Prevention**
```typescript
// Attempt to inject script in text fields
browser_type({
  element: "Blackout Period Name field",
  ref: "[name='name']",
  text: "<script>alert('XSS')</script>"
});

browser_click({ element: "Save button", ref: "button:has-text('Save')" });
browser_wait_for({ time: 2 });
browser_snapshot();

// Navigate to blackout periods list
browser_snapshot();
// Expected: Script NOT executed
// Verify: Text displayed as plain text with escaped brackets
// Example: "&lt;script&gt;alert('XSS')&lt;/script&gt;"

// Test in description field
browser_type({
  element: "Description field",
  ref: "[name='description']",
  text: "<img src=x onerror=alert('XSS')>"
});
// Verify proper escaping
```

---

## Test Execution Checklist

### Pre-Execution
- [ ] Backend running on `http://localhost:8000`
- [ ] Frontend running on `http://localhost:3000`
- [ ] Database has test data (leave types, departments)
- [ ] Test credentials confirmed: Ctrindex / Test123456
- [ ] Playwright MCP tools tested and working
- [ ] Clean test environment (or known state documented)

### During Execution
- [ ] Take screenshots at key decision points
- [ ] Log all console errors
- [ ] Document actual behavior vs expected
- [ ] Note any UI inconsistencies
- [ ] Track test execution time
- [ ] Capture network requests (if possible)

### Post-Execution
- [ ] Compile test results (pass/fail counts)
- [ ] Create bug reports for failures
- [ ] Document edge cases discovered
- [ ] Note improvement recommendations
- [ ] Archive screenshots and logs
- [ ] Update test plan based on findings

---

## Test Results Template

```markdown
# Leave Settings Test Results
**Date:** YYYY-MM-DD
**Tester:** [Name]
**Environment:** Development
**Total Tests:** 76
**Passed:** XX
**Failed:** XX
**Skipped:** XX

## Phase Results

### Phase 1: Setup & Authentication
- 1.1 Backend Availability: ✅ PASS
- 1.2 Frontend Availability: ✅ PASS
- 1.3 Login Navigation: ✅ PASS
- 1.4 Admin Login: ✅ PASS
- 1.5 Navigate to Settings: ✅ PASS

### Phase 2: Accrual Settings (30 tests)
- 2.1.1 Default Accrual Method: ❌ FAIL - [Reason]
- 2.1.2 Global Accrual Rate Validation: ✅ PASS
- ...

[Continue for all tests]

## Bugs Found

### BUG-001: Critical
**Title:** Carryover limit not required when method is "partial"
**Steps to Reproduce:**
1. Set carryover method to "partial"
2. Leave carryover_limit empty
3. Click Save
**Expected:** Validation error
**Actual:** Form submits successfully
**Severity:** High
**Screenshot:** bug-001.png

[Continue for all bugs]

## Recommendations
1. Add unsaved changes warning
2. Implement URL state persistence
3. Add loading indicators on save
4. Improve error messages
```

---

## Success Criteria

### Critical Path (Must Pass)
- ✅ All Phase 1 tests (authentication and navigation)
- ✅ At least 90% of Phase 2 tests (accrual settings)
- ✅ CRUD operations in Phase 3 (blackout periods)
- ✅ Form validation working correctly
- ✅ Data persistence after save and refresh

### Nice to Have
- URL state preservation
- Unsaved changes warning
- Keyboard navigation
- Offline error handling

### Blockers
- Cannot login as admin
- Page doesn't load (404/500)
- Save functionality completely broken
- No form validation working

---

## Test Data Requirements

### Leave Types (minimum 3)
```json
[
  { "id": 1, "name": "Annual Leave", "color_code": "#0078d4" },
  { "id": 2, "name": "Sick Leave", "color_code": "#107c10" },
  { "id": 3, "name": "Personal Leave", "color_code": "#ff8c00" }
]
```

### Departments (minimum 2)
```json
[
  "Operations",
  "Security",
  "Management"
]
```

### Employment Types
```json
[
  { "id": 1, "name": "Full-time" },
  { "id": 2, "name": "Part-time" },
  { "id": 3, "name": "Contract" }
]
```

---

## Appendix: Playwright MCP Commands Reference

### Navigation
```typescript
browser_navigate({ url: "http://localhost:3000/leave/settings" });
browser_navigate_back();
```

### Page Interaction
```typescript
browser_click({ element: "Save button", ref: "[type='submit']" });
browser_type({ element: "Field", ref: "[name='field']", text: "value" });
browser_select_option({ element: "Dropdown", ref: "[name='dropdown']", values: ["option"] });
browser_press_key({ key: "Enter" });
```

### Verification
```typescript
browser_snapshot(); // Accessibility snapshot
browser_take_screenshot({ filename: "test-result.png" });
browser_console_messages({ onlyErrors: true });
```

### Evaluation
```typescript
browser_evaluate({
  element: "Toggle",
  ref: "[name='toggle']",
  function: "(element) => { element.click(); }"
});
```

### Waiting
```typescript
browser_wait_for({ time: 3 }); // Wait 3 seconds
browser_wait_for({ text: "Success message" }); // Wait for text
```

---

**End of Test Plan**
