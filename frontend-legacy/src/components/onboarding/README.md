# Onboarding Wizard Components

A comprehensive 5-step onboarding wizard for security firms to set up their organization in the system.

## Overview

The onboarding wizard guides new security firms through the complete setup process, including company information, regional compliance configuration, staff operations, integrations, and account finalization.

## Components

### Main Wizard
- **OnboardingWizard**: Main container component that orchestrates the entire flow

### Step Components
- **CompanyInfoStep**: Company details, registration, and contact information
- **RegionalComplianceStep**: Country/region selection and compliance auto-configuration
- **StaffOperationsStep**: Staff size, capacity, and operational requirements
- **IntegrationsSetupStep**: Deputy, accounting, and other third-party integrations
- **AccountFinalizationStep**: Admin users, security settings, and billing information

### Supporting Components
- **OnboardingProgress**: Visual progress indicator with step tracking
- **OnboardingHeader**: Consistent header with step information
- **OnboardingNavigation**: Navigation controls with validation
- **ValidationSummary**: Error and warning display

## Features

### Form Management
- **Formik Integration**: Form state management and validation
- **Yup Validation**: Schema-based validation for all steps
- **Persistent State**: Data saved to localStorage across sessions
- **Error Handling**: Comprehensive error display and field-level validation

### API Integration
- **Service Layer**: Dedicated onboardingService for API calls
- **Step-by-step Submission**: Each step validated and saved individually
- **Test Connections**: Integration testing for external services
- **Progress Tracking**: Real-time progress updates and completion tracking

### UI/UX Features
- **Responsive Design**: Mobile-friendly layouts
- **Fluent UI Integration**: Consistent with existing application styling
- **Progress Visualization**: Step indicators and completion percentages
- **Smart Validation**: Real-time validation feedback
- **Accessible**: ARIA labels and keyboard navigation support

## Usage

### Basic Implementation
```tsx
import { OnboardingWizard } from '../components/onboarding';

function OnboardingPage() {
  return <OnboardingWizard />;
}
```

### Integration with Router
```tsx
// In your Router.tsx or routing setup
import { OnboardingWizard } from '../components/onboarding';

<Route path="/onboarding" element={<OnboardingWizard />} />
```

### Access Control
The onboarding wizard should be accessible to:
- New company administrators during initial setup
- Existing admin users who need to complete setup
- Users with proper authentication tokens

## Data Flow

### Step 1: Company Information
- Company details (name, registration, address)
- Primary contact information
- Business type and industry selection

### Step 2: Regional Compliance
- Primary and additional operating regions
- Auto-generated compliance profiles
- Data protection level selection
- Special requirements configuration

### Step 3: Staff Operations
- Current staff size and growth projections
- Operational capacity settings
- Shift pattern definitions
- Special operations configuration

### Step 4: Integrations Setup
- Deputy workforce management integration
- Accounting system connections (Xero, QuickBooks, etc.)
- Payroll system integration
- Communication platform setup

### Step 5: Account Finalization
- Administrator user creation
- Security policy configuration
- Billing information setup
- System preferences

## API Endpoints

The wizard interacts with these backend endpoints:
- `POST /api/v1/onboarding/company/` - Company information
- `GET /api/v1/onboarding/regions/` - Available regions
- `POST /api/v1/onboarding/compliance/` - Compliance settings
- `POST /api/v1/onboarding/staff-operations/` - Staff operations
- `POST /api/v1/onboarding/integrations/test/` - Test integrations
- `POST /api/v1/onboarding/integrations/` - Save integrations
- `POST /api/v1/onboarding/finalize/` - Complete setup

## Validation

### Client-side Validation
- Required field validation
- Email format validation
- Phone number format validation
- Password policy enforcement
- Business logic validation

### Server-side Validation
- Data integrity checks
- Business rule validation
- External system verification
- Duplicate prevention

## State Management

### Local Storage
- Form data persistence across sessions
- Progress tracking
- Step completion status
- Validation state

### Component State
- Current step tracking
- Form field values
- Loading states
- Error handling

## Styling

### Fluent UI Integration
- Consistent component usage
- Theme integration
- Responsive breakpoints
- Accessibility features

### Custom Styling
- Tailwind CSS for layout
- Custom animations (prepared for Framer Motion)
- Brand-consistent colors
- Progressive disclosure patterns

## Error Handling

### Validation Errors
- Field-level error messages
- Step-level error summaries
- Required field indicators
- Format validation feedback

### API Errors
- Network error handling
- Server validation errors
- Integration test failures
- Retry mechanisms

### User Experience
- Clear error messages
- Actionable feedback
- Progressive enhancement
- Graceful degradation

## Testing Considerations

### Unit Tests
- Component rendering
- Form validation logic
- State management
- Error handling

### Integration Tests
- API service calls
- Form submission flow
- Navigation between steps
- Data persistence

### E2E Tests
- Complete onboarding flow
- Error scenarios
- Mobile responsiveness
- Accessibility compliance

## Performance

### Optimization Features
- Lazy loading of step components
- Debounced validation
- Optimistic updates
- Efficient re-rendering

### Bundle Size
- Tree-shakable exports
- Minimal dependencies
- Conditional imports
- Code splitting ready

## Security

### Data Protection
- Secure form handling
- Sensitive data masking
- Input sanitization
- CSRF protection

### Authentication
- Token-based auth
- Session management
- Role-based access
- Audit logging

## Future Enhancements

### Animation System
- Step transition animations
- Progress indicator animations
- Form validation feedback
- Loading state animations

### Advanced Features
- Multi-language support
- Custom branding
- Advanced integrations
- Bulk user import

### Analytics
- Step completion rates
- Drop-off analysis
- Time-to-complete metrics
- Error frequency tracking