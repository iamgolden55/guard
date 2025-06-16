# Security Staff Management System Test Plan

## Overview
This document outlines the comprehensive testing strategy for the Security Staff Management System. It covers unit tests, integration tests, and end-to-end testing for all models and features.

## 1. User Model Testing

### Unit Tests
- Test user creation with required fields
- Test user roles (admin, manager, staff)
- Test password hashing and validation
- Test user permissions and groups
- Test custom user methods

### Integration Tests
- Test user authentication
- Test role-based access control
- Test user profile updates
- Test password reset flow

## 2. StaffProfile Testing

### Unit Tests
- Test profile creation with user relationship
- Test required field validation
- Test optional field handling
- Test profile updates

### Integration Tests
- Test profile creation during user registration
- Test profile data retrieval with user data
- Test profile updates with user updates

## 3. Venue Testing

### Unit Tests
- Test venue creation with required fields
- Test venue address validation
- Test venue capacity limits
- Test venue operating hours
- Test venue relationship with shifts

### Integration Tests
- Test venue assignment to shifts
- Test venue capacity monitoring
- Test venue terms acceptance flow

## 4. ShiftTemplate Testing

### Unit Tests
- Test template creation with all fields
- Test multiple days selection
- Test time validation (end time after start time)
- Test template to shift generation
- Test color code validation

### Integration Tests
- Test bulk shift creation from template
- Test template updates affecting future shifts
- Test template copying functionality
- Test template scheduling conflicts

## 5. Shift Management Testing

### Unit Tests
- Test shift creation from template
- Test shift assignment to staff
- Test shift status transitions
- Test shift timing validation
- Test shift location verification

### Integration Tests
- Test shift approval workflow
- Test shift exchange process
- Test open shift claiming
- Test geolocation verification
- Test shift completion and reporting

## 6. Security Checks Testing

### Unit Tests
#### Fire Exit Checks
- Test check creation and validation
- Test timestamp accuracy
- Test required fields
- Test photo evidence storage

#### Capacity Checks
- Test capacity limit validation
- Test timestamp recording
- Test overflow alerts
- Test historical data storage

#### Toilet Checks
- Test check completion
- Test scheduling
- Test issue reporting

### Integration Tests
- Test check scheduling system
- Test notification system
- Test reporting system
- Test photo upload and storage
- Test compliance tracking

## 7. Invoice and Payment Testing

### Unit Tests
- Test invoice generation
- Test invoice item creation
- Test payment calculations
- Test tax calculations
- Test status updates

### Integration Tests
- Test automatic invoice generation from shifts
- Test payment processing
- Test invoice approval workflow
- Test payment status tracking

## 8. Staff Availability Testing

### Unit Tests
- Test availability record creation
- Test date range validation
- Test conflict checking
- Test recurring availability

### Integration Tests
- Test availability in shift assignment
- Test availability updates
- Test conflict resolution
- Test calendar integration

## 9. Security Qualification Testing

### Unit Tests
- Test qualification creation
- Test expiry date validation
- Test required documents
- Test status updates

### Integration Tests
- Test qualification verification
- Test expiry notifications
- Test document upload
- Test compliance tracking

## 10. Performance Testing

### Load Tests
- Test system with 1000+ concurrent users
- Test shift template generation with 100+ venues
- Test real-time location tracking
- Test report generation

### Stress Tests
- Test system limits with bulk operations
- Test database performance
- Test file upload capacity
- Test notification system scaling

## 11. Security Testing

### Authentication Tests
- Test login security
- Test password policies
- Test session management
- Test API authentication

#### Role-Based Redirection Tests
- Test staff login redirects to staff dashboard
- Test manager login redirects to manager dashboard
- Test admin login redirects to admin dashboard
- Test proper permission assignment after login
- Test unauthorized access attempts to restricted pages
- Test permission persistence across user sessions
- Test logout and permission revocation

### Authorization Tests
- Test role-based access
- Test resource permissions
- Test data isolation
- Test audit logging

## 12. Mobile Responsiveness Testing

### UI Tests
- Test responsive design
- Test touch interactions
- Test offline capabilities
- Test photo capture
- Test geolocation features

## Test Execution Process

1. **Setup Test Environment**
   ```python
   python manage.py test --settings=core.settings.test
   ```

2. **Run Unit Tests**
   ```python
   python manage.py test api.tests.unit
   ```

3. **Run Integration Tests**
   ```python
   python manage.py test api.tests.integration
   ```

4. **Run End-to-End Tests**
   ```python
   python manage.py test api.tests.e2e
   ```

## Test Coverage Requirements

- Minimum unit test coverage: 90%
- Minimum integration test coverage: 80%
- Critical path coverage: 100%

## Continuous Integration

- All tests must pass before deployment
- Coverage reports generated automatically
- Performance benchmarks tracked
- Security scan results reviewed

## Test Data Management

- Use factories for test data generation
- Maintain separate test database
- Reset database state between tests
- Mock external services

## Bug Reporting Process

1. Identify test failure
2. Document reproduction steps
3. Capture relevant logs
4. Create issue ticket
5. Assign priority level
6. Track resolution

## Test Documentation

- Maintain up-to-date test documentation
- Document test scenarios
- Keep test data current
- Update test plan as needed

## Quality Gates

- All unit tests must pass
- Integration tests must pass
- No security vulnerabilities
- Performance benchmarks met
- Code coverage requirements met 

## Test Execution Tracking

### Completed Tests
- ✅ User authentication (login)
- ✅ User registration
- ✅ Password hashing and validation
- ✅ Role-based redirection (staff, manager, admin)
- ✅ Permission assignment verification
- ✅ Permission persistence across user sessions
- ✅ Permission revocation on logout
- ✅ Unauthorized access attempts
- ✅ User profile updates

### Pending Tests
- ⏳ Password reset flow
- ⏳ Staff profile creation during registration
- ⏳ Venue assignment to shifts
- ⏳ Shift template creation
- ⏳ Shift management
- ⏳ Security checks functionality
- ⏳ Invoice and payment processing
- ⏳ Staff availability tracking
- ⏳ Security qualification verification
- ⏳ Mobile responsiveness
- ⏳ Performance testing

### Next Priority Tests
1. Password reset flow
2. Staff profile creation during registration
3. Venue assignment to shifts 