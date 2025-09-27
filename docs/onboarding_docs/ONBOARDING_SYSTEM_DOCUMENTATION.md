# Onboarding System Documentation

## Overview

The onboarding system is a comprehensive 5-step wizard that guides new security companies through the initial setup of their accounts. It handles company registration, compliance configuration, staff operations setup, integrations, and account finalization.

## Architecture Overview

### Component Structure
```
OnboardingWizard (Main Container)
├── OnboardingProgress (Step Navigation Sidebar)
├── OnboardingHeader (Step Title/Description)
├── StepTransition (Animation Container)
├── ValidationSummary (Error Display)
├── OnboardingNavigation (Next/Back/Skip buttons)
└── Step Components:
    ├── CompanyInfoStep
    ├── RegionalComplianceStep
    ├── StaffOperationsStep
    ├── IntegrationsSetupStep
    └── AccountFinalizationStep
```

### Key Services
- **OnboardingService**: API communication and local storage management
- **AuthContext**: Authentication state and onboarding status integration
- **OnboardingGuard**: Route protection for incomplete onboarding

## Onboarding Flow

### Step 1: Company Information (CompanyInfoStep)
**Purpose**: Collect basic company details and primary contact information

**Required Fields**:
- Company Name *
- Registration Number *
- Business Type * (Private Limited, Public Limited, Partnership, etc.)
- Industry * (Security Services, Event Security, etc.)
- Founded Year *
- Company Address * (Street, City, State, Postal Code, Country)
- Primary Contact * (First Name, Last Name, Email, Phone, Position)

**Optional Fields**:
- Website URL
- Company Description

**Validation Rules**:
- All required fields must be filled
- Email must be valid format
- Phone number validation (international format supported)
- Founded year must be between 1900 and current year
- Postal code format validation

**API Integration**:
- On first completion, calls `/onboarding/initiate/` to create SecurityCompany record
- On subsequent edits, updates company information via API
- Maps form data to backend SecurityCompany model with proper field transformations

**Failure Scenarios**:
- **Network Issues**: Shows error message, data persists in localStorage
- **Validation Errors**: Highlights specific fields with error messages
- **API Errors**: Displays server error messages, prevents progression
- **Company Creation Failure**: Falls back to showing detailed error, allows retry

### Step 2: Regional Compliance
**Purpose**: Configure regional compliance settings and data protection levels

**Key Features**:
- Primary region selection
- Operating regions (multi-select)
- Compliance profile configuration
- Data protection level selection
- Special requirements handling

### Step 3: Staff Operations
**Purpose**: Define operational capacity and staff requirements

**Key Features**:
- Staff size range selection
- Growth projections (6 months, 1 year, 2 years)
- Operational capacity limits
- Shift patterns configuration
- Special operations requirements

### Step 4: Integrations Setup
**Purpose**: Configure third-party integrations

**Key Integrations**:
- Deputy workforce management
- Accounting systems (Xero, QuickBooks, Sage, Zoho)
- Payroll systems
- Communication channels (SMS, Email, WhatsApp)
- Custom integrations

**Special Features**:
- Optional step (can be skipped)
- Test connection functionality
- OAuth flow support for accounting providers

### Step 5: Account Finalization
**Purpose**: Complete account setup with admin users and security settings

**Key Features**:
- Admin user creation
- Security policy configuration
- Billing information
- System preferences
- Final account activation

## OnboardingGuard Logic

### Route Protection Strategy
The `OnboardingGuard` component protects routes that require completed onboarding:

```typescript
// Protection Logic Flow
1. Check if user is authenticated
   - No: Redirect to /login

2. Check if onboarding is completed
   - Yes: Allow access to protected routes
   - No: Check current path
     - If already on /onboarding: Allow access
     - If not: Redirect to current onboarding step

3. Check if user has company assigned
   - No: Redirect to step 1 (shouldn't happen after completion)
   - Yes: Render protected content
```

### Usage in Routes
```typescript
// All main application routes are wrapped with OnboardingGuard
<Route element={<OnboardingGuard><ProtectedRoute /></OnboardingGuard>}>
  {/* Protected routes only accessible after onboarding completion */}
</Route>

// Onboarding routes bypass the guard
<Route path="/onboarding/*" element={<OnboardingWizard />} />
```

## AuthContext Integration

### Onboarding State Management
The AuthContext manages onboarding status with these properties:

```typescript
interface OnboardingStatus {
  isCompleted: boolean;      // Has user completed all steps?
  currentStep: number;       // Current step (1-5)
  completedSteps: number[];  // Array of completed step numbers
  hasCompany: boolean;       // Does user have a company assigned?
  companyId?: string;        // ID of associated company
}
```

### State Persistence
- **localStorage**: Progress and form data persisted locally
- **API Sync**: Periodic sync with backend for progress tracking
- **Context Updates**: Real-time updates across the application

### Key Methods
- `updateOnboardingStatus()`: Updates current progress
- `completeOnboarding()`: Marks onboarding as complete
- `fetchOnboardingStatus()`: Loads status from API/localStorage

## Form Validation and Error Handling

### Validation Strategy
1. **Real-time Validation**: Field-level validation on change
2. **Step Validation**: Complete step validation before progression
3. **Server Validation**: API validation with detailed error responses

### Error Types
```typescript
interface ValidationError {
  field: string;      // Field identifier (e.g., 'companyName', 'address.city')
  message: string;    // Human-readable error message
  code: string;       // Error code for programmatic handling
}
```

### Error Display
- **Field Errors**: Inline error messages under specific fields
- **Global Errors**: Summary at top of step for general failures
- **Validation Summary**: Collapsible summary of all current errors

### Error Recovery
- **Network Failures**: Retry mechanisms with exponential backoff
- **Validation Failures**: Clear field highlighting and guidance
- **API Errors**: Detailed error messages with suggested actions

## Local Storage Persistence

### Data Structure
```typescript
// Storage Keys
STORAGE_KEYS = {
  PROGRESS: 'onboarding_progress',        // Step progress tracking
  WIZARD_DATA: 'onboarding_wizard_data'   // Form data persistence
}

// Progress Structure
interface StoredProgress {
  currentStep: number;
  completedSteps: number[];
  companyId?: string;
  isCompleted?: boolean;
  lastUpdated: string;
}

// Wizard Data Structure
interface StoredWizardData extends Partial<OnboardingWizardData> {
  // All step data persisted incrementally
}
```

### Persistence Strategy
- **Automatic Saving**: Form data saved on every change
- **Progress Tracking**: Step completion saved immediately
- **Recovery**: Data restored on page refresh/reload
- **Cleanup**: Data cleared on successful completion

## State Management Architecture

### Data Flow
```
User Input → Component State → OnboardingWizard State → Local Storage
    ↓                                    ↓
Form Validation ← API Validation ← Step Submission → Backend API
    ↓                                    ↓
Error Display ← AuthContext Update ← Success Response → Next Step
```

### State Synchronization
1. **Component Level**: Local form state for immediate UI updates
2. **Wizard Level**: Consolidated wizard data for step management
3. **Context Level**: Global onboarding status for route protection
4. **Storage Level**: Persistent data for recovery scenarios

## API Integration Points

### Onboarding Endpoints
- `POST /onboarding/initiate/` - Create new company and start onboarding
- `PUT /onboarding/company-info/` - Update company information
- `PUT /onboarding/regional-setup/` - Save compliance settings
- `PUT /onboarding/staff-configuration/` - Save operations config
- `PUT /onboarding/integrations/` - Configure integrations
- `PUT /onboarding/account-setup/` - Finalize account
- `POST /onboarding/complete/` - Complete onboarding process

### Data Transformation
The system handles data transformation between frontend models and backend API:

```typescript
// Frontend → Backend Mapping Example
const companyData = {
  company: {
    name: wizardData.companyInfo?.companyName || '',
    registration_number: wizardData.companyInfo?.registrationNumber || '',
    country_code: countryMapping[wizardData.companyInfo?.address?.country || ''] || 'GBR',
    // ... additional field mappings
  }
};
```

## User Experience Flows

### New User Registration
1. User registers via `/register`
2. Auto-login after successful registration
3. AuthContext detects incomplete onboarding
4. Redirect to `/onboarding/step/1`
5. Progress through 5-step wizard
6. Complete onboarding → redirect to dashboard

### Existing User with Incomplete Onboarding
1. User logs in via `/login`
2. AuthContext loads onboarding status
3. Detects incomplete status
4. Redirect to current step (e.g., `/onboarding/step/3`)
5. Continue from where left off
6. Complete remaining steps

### Returning User with Complete Onboarding
1. User logs in via `/login`
2. AuthContext confirms completed status
3. Direct access to dashboard and all features
4. OnboardingGuard allows full app access

### Error Recovery Scenarios
1. **Network Interruption**: Data persists locally, resume when connection restored
2. **Browser Crash**: Data recovered from localStorage on restart
3. **API Failures**: Detailed error messages with retry options
4. **Validation Errors**: Clear guidance on required corrections

## Technical Implementation Details

### Component Props Pattern
```typescript
interface StepProps {
  data: Partial<OnboardingWizardData>;        // Current wizard data
  onChange: (data: Partial<OnboardingWizardData>) => void;  // Update handler
  errors: ValidationError[];                   // Current validation errors
  isLoading: boolean;                         // Loading state
}
```

### Animation and Transitions
- **StepTransition**: Smooth animations between steps
- **Loading States**: Spinner animations during API calls
- **Error Animations**: Subtle animations for error states
- **Progress Indicators**: Visual progress feedback

### Performance Optimizations
- **Lazy Loading**: OnboardingWizard loaded lazily to reduce initial bundle
- **Memoization**: Step configurations and dropdown options memoized
- **Debounced Saving**: Form data saving debounced to prevent excessive API calls
- **Efficient Rendering**: useCallback and useMemo used strategically

### Security Considerations
- **Input Sanitization**: All form inputs sanitized before API submission
- **Token Management**: JWT tokens managed securely in AuthContext
- **Local Storage**: Sensitive data encrypted in localStorage
- **API Security**: All endpoints require authentication

## Testing Strategy

### Unit Testing
- Individual step components
- Validation logic
- Local storage operations
- State management functions

### Integration Testing
- Complete wizard flow
- API integration points
- Error handling scenarios
- Authentication integration

### E2E Testing
- Full onboarding process
- Browser refresh scenarios
- Network failure recovery
- Multi-step data persistence

## Troubleshooting Common Issues

### First Step Failures
**Symptom**: Step 1 cannot progress or shows API errors
**Causes**:
- Invalid company data format
- Missing required fields
- Network connectivity issues
- Backend API errors

**Solutions**:
1. Check network connectivity
2. Validate all required fields are filled
3. Check browser console for detailed errors
4. Verify backend API is accessible
5. Clear localStorage and retry if data corruption suspected

### Progress Not Persisting
**Symptom**: User loses progress between sessions
**Causes**:
- localStorage disabled/cleared
- Browser in private mode
- Storage quota exceeded

**Solutions**:
1. Enable localStorage in browser
2. Exit private/incognito mode
3. Clear other site data to free storage
4. Check browser localStorage permissions

### Validation Errors Not Clearing
**Symptom**: Error messages persist after correction
**Causes**:
- Validation state not updating
- Component re-render issues
- Cached validation results

**Solutions**:
1. Refresh the page
2. Clear form and re-enter data
3. Check for JavaScript errors in console
4. Verify validation logic in component

### Authentication Issues
**Symptom**: Redirected to login during onboarding
**Causes**:
- Session expired
- Token corruption
- Backend authentication failure

**Solutions**:
1. Re-login and retry
2. Clear authentication tokens
3. Check token expiration
4. Verify backend authentication service

This documentation provides a comprehensive overview of the onboarding system architecture, flow, and implementation details for both developers and system administrators.