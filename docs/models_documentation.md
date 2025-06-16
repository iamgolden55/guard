# Security Management System Models Documentation

## Core Models

### User
The base user model that extends Django's AbstractUser.
- **Purpose**: Manages all users in the system (admin, managers, and security staff)
- **Key Features**:
  - Role-based access (admin, manager, staff)
  - Security role tracking for staff (door supervisor, CCTV operator, etc.)
  - Activity tracking (created_at, last_login)
- **Important Methods**:
  - `has_security_role(role)`: Checks if staff has specific security qualification

### StaffProfile
Extended information about security staff members.
- **Purpose**: Stores detailed personal and professional information
- **Key Fields**:
  - Personal details (DOB, NI number, contact info)
  - Address information
  - Profile image and notes
  - Password management

### EmergencyContact
Emergency contact information for staff members.
- **Purpose**: Maintains emergency contact details for each staff member
- **Key Fields**:
  - Contact name and relationship
  - Emergency contact number

### BankDetails
Staff payment information.
- **Purpose**: Manages staff payment details
- **Key Fields**:
  - Bank account details (encrypted)
  - Account holder name
  - Sort code and account number

## Qualification Models

### SIALicense
Security Industry Authority license information.
- **Purpose**: Tracks staff security licenses and qualifications
- **Key Features**:
  - Multiple license types (Door Supervisor, CCTV, etc.)
  - License validity tracking
  - Document storage
  - Expiry management

### SecurityQualification
Additional security-related qualifications.
- **Purpose**: Tracks additional certifications and training
- **Key Features**:
  - Various qualification types (First Aid, Conflict Management, etc.)
  - Certificate tracking
  - Expiry date management
  - Document storage

## Venue Management

### Venue
Locations where security services are provided.
- **Purpose**: Manages all venue information and requirements
- **Key Features**:
  - Location details with Google Maps integration
  - Capacity management
  - Contact information
  - Required checks configuration (fire safety, capacity, toilets)
  - Terms and conditions management
- **Important Methods**:
  - `verify_location(lat, lng)`: Validates staff location during check-in/out
  - `update_coordinates()`: Automatically updates venue coordinates using Google Maps

### VenueTermsAcceptance
Tracks staff acceptance of venue terms.
- **Purpose**: Ensures staff have read and accepted venue-specific terms
- **Key Features**:
  - Version control for terms
  - Acceptance tracking
  - One-time acceptance requirement

### PreferredVenue
Staff venue preferences.
- **Purpose**: Tracks which venues staff prefer to work at
- **Used for**: Shift allocation and staff scheduling

## Shift Management

### ShiftTemplate
Template for recurring shifts.
- **Purpose**: Creates repeatable shift patterns
- **Key Features**:
  - Day of week scheduling
  - Required security roles
  - Minimum staff requirements
- **Important Methods**:
  - `generate_shift(target_date)`: Creates actual shifts from template

### Shift
Individual security shifts.
- **Purpose**: Core shift management
- **Key Features**:
  - Staff assignment
  - Time tracking
  - Location verification
  - Status management
  - Digital signatures
- **Important Methods**:
  - `check_in()`: Staff shift start with location verification
  - `check_out()`: Staff shift end with location verification
  - `clone_to_date()`: Creates copy of shift for different date
  - `release_to_pool()`: Makes shift available for other staff

### ShiftExchange
Manages shift swaps between staff.
- **Purpose**: Handles staff shift exchanges
- **Key Features**:
  - Request and approval workflow
  - Qualification verification
  - Schedule conflict checking
- **Important Methods**:
  - `accept_by_target()`: Target staff accepts exchange
  - `approve()`: Manager approval
  - `reject()`: Manager rejection

### OpenShiftRequest
Manages shifts available for any qualified staff.
- **Purpose**: Handles shifts released to general pool
- **Key Features**:
  - Shift claiming system
  - Qualification verification
  - Schedule conflict checking
- **Important Methods**:
  - `claim_shift()`: Staff claims available shift
  - `get_available_shifts()`: Lists shifts available to specific staff

## Shift Checks

### ShiftCheck (Abstract Base Class)
Base class for all types of venue checks.
- **Purpose**: Common functionality for all check types
- **Key Features**:
  - Timestamp tracking
  - Photo evidence support
  - Location tracking
  - Notes

### FireExitCheck
Fire safety checks during shifts.
- **Purpose**: Ensures fire exits are properly maintained
- **Key Features**:
  - Exit accessibility checking
  - Proper marking verification
  - Issue tracking

### CapacityCheck
Venue capacity monitoring.
- **Purpose**: Tracks venue occupancy
- **Key Features**:
  - Current count tracking
  - Capacity limit monitoring
  - Automatic status updates

### ToiletCheck
Facility checks during shifts.
- **Purpose**: Monitors facility conditions
- **Key Features**:
  - Condition tracking
  - Supply monitoring
  - Issue reporting

## Financial Management

### Invoice
Staff payment invoices.
- **Purpose**: Manages staff payment processing
- **Key Features**:
  - Date range billing
  - Rate calculation
  - Status tracking
  - PDF generation

### InvoiceItem
Individual items on invoices.
- **Purpose**: Detailed breakdown of invoice charges
- **Key Features**:
  - Shift-specific charges
  - Rate tracking
  - Amount calculation

### PayRate
Staff payment rates.
- **Purpose**: Manages different payment rates
- **Key Features**:
  - Venue-specific rates
  - Default rates
  - Rate history

## Deputy Integration

### DeputyConfig
Deputy workforce management integration settings.
- **Purpose**: Configures Deputy integration
- **Key Features**:
  - API configuration
  - Sync management
  - Status tracking

### DeputyEmployee
Deputy employee mapping.
- **Purpose**: Maps Deputy employees to system users
- **Key Features**:
  - Employee data synchronization
  - User mapping

### DeputyTimesheet
Deputy timesheet integration.
- **Purpose**: Syncs timesheets with Deputy
- **Key Features**:
  - Timesheet synchronization
  - Shift mapping
  - Status tracking

## Status Tracking

### ShiftStatusHistory
Tracks all shift status changes.
- **Purpose**: Audit trail for shift status changes
- **Key Features**:
  - Change tracking
  - User attribution
  - Timestamp logging

## Model Relationships

### User-Related Relationships
```
User
├── StaffProfile (1-to-1)
│   ├── EmergencyContact (1-to-many)
│   ├── BankDetails (1-to-1)
│   └── PreferredVenue (many-to-many with Venue)
├── SIALicense (1-to-many)
├── SecurityQualification (1-to-many)
└── Shifts (1-to-many)
```

### Venue-Related Relationships
```
Venue
├── Shifts (1-to-many)
├── ShiftTemplates (1-to-many)
├── VenueTermsAcceptance (1-to-many)
│   └── User (many-to-1)
└── PreferredVenue (many-to-many with StaffProfile)
```

### Shift-Related Relationships
```
Shift
├── Venue (many-to-1)
├── Staff User (many-to-1)
├── ShiftTemplate (many-to-1, optional)
├── ShiftChecks
│   ├── FireExitCheck (1-to-many)
│   ├── CapacityCheck (1-to-many)
│   └── ToiletCheck (1-to-many)
├── ShiftExchange (1-to-many)
├── OpenShiftRequest (1-to-many)
└── ShiftStatusHistory (1-to-many)
```

### Financial Relationships
```
Invoice
├── InvoiceItem (1-to-many)
│   ├── Shift (many-to-1)
│   └── PayRate (many-to-1)
└── User (many-to-1)

PayRate
├── Venue (many-to-1, optional)
└── User (many-to-1)
```

### Deputy Integration Relationships
```
DeputyConfig
└── Organization-wide settings

DeputyEmployee
├── User (1-to-1)
└── DeputyTimesheet (1-to-many)

DeputyTimesheet
├── Shift (1-to-1)
└── DeputyEmployee (many-to-1)
```

## Key Relationship Details

1. **User & Profile Management**
   - Each User has one StaffProfile
   - StaffProfile contains personal and professional details
   - Users can have multiple emergency contacts
   - Each user has one set of bank details
   - Users can have multiple SIA licenses and qualifications

2. **Venue & Staff Relations**
   - Staff can have multiple preferred venues
   - Venues track which staff have accepted their terms
   - Venues can have multiple shift templates
   - Each venue has its own set of required checks

3. **Shift Management Flow**
   - Shifts are created from templates or manually
   - Each shift is linked to one venue and optionally one staff member
   - Shifts can have multiple types of checks (fire, capacity, toilet)
   - Shift exchanges and open requests track shift reassignment
   - All status changes are logged in ShiftStatusHistory

4. **Financial Tracking**
   - Invoices contain multiple invoice items
   - Each invoice item relates to a specific shift
   - Pay rates can be venue-specific or default
   - All financial transactions are linked to users

5. **Deputy Integration Chain**
   - DeputyConfig manages organization-wide settings
   - Each user can have one Deputy employee record
   - Deputy timesheets are linked to shifts for synchronization

## Important Constraints

1. **Data Integrity**
   - Shifts must have a venue but can have no staff (open shifts)
   - Staff can't be deleted if they have historical shifts
   - Venues can't be deleted if they have active shifts

2. **Business Rules**
   - Staff must accept venue terms before working shifts
   - Staff must have valid SIA license for security roles
   - Shift exchanges require manager approval
   - Pay rates must exist for invoice generation

3. **Time-Based Rules**
   - Shifts can't be exchanged after they start
   - Expired qualifications prevent shift assignment
   - Templates generate shifts for future dates only

4. **Location Verification**
   - Check-in/out requires staff to be at venue location
   - Venue coordinates are automatically updated when address changes
   - Location verification has fallback calculation method

This relationship structure ensures:
- Clear ownership and responsibility tracking
- Proper security role enforcement
- Accurate financial calculations
- Complete audit trail of all activities
- Flexible shift management
- Proper integration with external systems 