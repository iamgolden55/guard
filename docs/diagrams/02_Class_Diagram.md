# Class Diagram - Security Staff Management System

## Overview

This document contains Mermaid class diagrams covering all 60+ Django models across 4 apps (`api`, `leave_management`, `finance_integrations`, `shifts`). The models are organized into 7 domain subdiagrams for readability:

1. **Core User & Multi-Tenant** - User, StaffProfile, SecurityCompany, Membership
2. **Shift Management** - Shift, ShiftTemplate, ShiftExchange, OpenShiftRequest, checks
3. **Leave Management** - LeaveType, LeavePolicy, LeaveRequest, LeaveBalance, BlackoutPeriod
4. **Finance & Invoicing** - Invoice, InvoiceItem, PayRate, accounting integrations
5. **Compliance & Regulation** - WorkingHoursRegulation, ComplianceProfile, ComplianceViolation
6. **Deputy Integration & Notifications** - DeputyConfig, DeputyEmployee, SNSDeviceToken
7. **Reporting & System Config** - ReportTemplate, ReportJob, SystemSettings, EmploymentType

**Audience**: Developers, architects, and technical stakeholders needing to understand model relationships, key fields, and domain boundaries.

---

## 1. Core User & Multi-Tenant Domain

```mermaid
classDiagram
    direction TB

    class SecurityCompany {
        <<Model>>
        +UUID id
        +String name
        +String slug
        +String registration_number
        +String country_code
        +String industry_type
        +String company_size
        +String subscription_tier
        +DateTime subscription_start_date
        +DateTime subscription_end_date
        +Boolean is_active
        +Boolean is_trial
        +DateTime trial_end_date
        +JSON features_enabled
        +JSON custom_settings
        +Integer staff_capacity
        +Integer venue_capacity
        +get_subscription_status()
        +has_feature_access(feature)
        +can_add_staff() bool
        +can_add_venue() bool
    }

    class UserCompanyMembership {
        <<Model>>
        +UUID id
        +String role
        +Boolean is_owner
        +Boolean is_active
        +String invitation_status
        +JSON permissions
        +JSON access_restrictions
        +DateTime joined_at
        +has_permission(name) bool
        +is_invitation_valid() bool
    }

    class User {
        <<AbstractUser>>
        +String role
        +JSON security_roles
        +Boolean is_active
        +Integer failed_login_attempts
        +DateTime account_locked_until
        +DateTime password_last_changed
        +has_security_role(role) bool
        +get_pending_earnings() dict
        +get_estimated_weekly_earnings() dict
    }

    class StaffProfile {
        <<Model>>
        +String phone_number
        +Date date_of_birth
        +String national_insurance_number
        +String street
        +String city
        +String postal_code
        +URLField profile_image_url
        +Boolean is_approved
        +is_eligible_for_shifts() bool
    }

    class EmergencyContact {
        <<Model>>
        +String name
        +String relationship
        +String phone_number
    }

    class BankDetails {
        <<Model>>
        +String account_name
        +String account_number
        +String sort_code
        +String bank_name
    }

    class SIALicense {
        <<Model>>
        +String license_number
        +String license_type
        +String level
        +Date issue_date
        +Date expiry_date
        +String status
        +URL document_url
    }

    class SecurityQualification {
        <<Model>>
        +String qualification_type
        +String provider
        +String certificate_number
        +Date issue_date
        +Date expiry_date
        +URL document_url
    }

    class StaffAvailability {
        <<Model>>
        +Integer day_of_week
    }

    class CompanyOnboarding {
        <<Model>>
        +UUID id
        +Integer current_step
        +Boolean company_info_completed
        +Boolean regional_setup_completed
        +Boolean staff_setup_completed
        +Boolean integrations_completed
        +Boolean finalization_completed
        +JSON step_data
        +progress_percentage() int
        +get_next_step() int
    }

    class CompanyIntegration {
        <<Model>>
        +UUID id
        +String integration_type
        +String name
        +String status
        +String health_status
        +JSON configuration
        +JSON credentials
        +String sync_frequency
        +Boolean auto_sync_enabled
        +test_connection() bool
        +perform_sync() bool
    }

    class PasswordResetToken {
        <<Model>>
        +String token
        +DateTime expires_at
        +Boolean is_used
    }

    SecurityCompany "1" --> "*" UserCompanyMembership : memberships
    User "1" --> "*" UserCompanyMembership : company_memberships
    SecurityCompany "1" --> "0..1" CompanyOnboarding : onboarding
    SecurityCompany "1" --> "*" CompanyIntegration : integrations
    User "1" --> "0..1" StaffProfile : profile
    StaffProfile "1" --> "*" EmergencyContact : emergency_contacts
    StaffProfile "1" --> "0..1" BankDetails : bank_details
    StaffProfile "1" --> "*" SIALicense : sia_licenses
    StaffProfile "1" --> "*" SecurityQualification : qualifications
    StaffProfile "1" --> "*" StaffAvailability : availability
    User "1" --> "*" PasswordResetToken
    StaffProfile --> EmploymentType : employment_type
    SecurityCompany --> ComplianceProfile : compliance_profile
```

---

## 2. Shift Management Domain

```mermaid
classDiagram
    direction TB

    class Venue {
        <<Model>>
        +String name
        +String address
        +String city
        +Decimal latitude
        +Decimal longitude
        +Integer check_radius
        +Integer capacity
        +Boolean is_active
        +Boolean requires_fire_safety_checks
        +Boolean requires_capacity_monitoring
        +Boolean requires_toilet_checks
        +String terms_and_conditions
        +update_coordinates() bool
        +verify_location(lat, lng) bool
    }

    class ShiftTemplate {
        <<Model>>
        +String name
        +JSON days_of_week
        +Time start_time
        +Time end_time
        +String required_security_role
        +Integer min_staff_required
        +Boolean is_active
        +generate_shifts_for_month(year, month)
        +bulk_create_shifts(start, end)
    }

    class Shift {
        <<Model>>
        +DateTime start_time
        +DateTime end_time
        +String required_security_role
        +String status
        +String shift_group
        +DateTime check_in_time
        +DateTime check_out_time
        +JSON check_in_location
        +JSON check_out_location
        +Text start_signature
        +Text end_signature
        +Text check_in_photo
        +Text check_out_photo
        +Boolean manager_approved
        +Decimal actual_hours_worked
        +Integer break_duration
        +Decimal hourly_rate
        +Boolean is_special_event
        +Boolean auto_checkout
        +check_in(lat, lng, sig, photo)
        +check_out(lat, lng, sig, photo)
        +calculate_payment() Decimal
        +get_effective_hourly_rate() Decimal
        +can_auto_checkout() bool
        +perform_auto_checkout() bool
        +release_to_pool(reason)
        +clone_to_date(date)
    }

    class ShiftStatusHistory {
        <<Model>>
        +String status
        +Text notes
        +DateTime created_at
    }

    class TimeAdjustment {
        <<Model>>
        +DateTime original_check_in_time
        +DateTime original_check_out_time
        +Decimal original_actual_hours
        +DateTime adjusted_check_in_time
        +DateTime adjusted_check_out_time
        +Decimal adjusted_actual_hours
        +Text reason
        +Text manager_signature
    }

    class OpenShiftRequest {
        <<Model>>
        +String status
        +Text request_reason
        +DateTime claim_time
        +Text manager_notes
        +claim_shift(user)
        +approve_claim(manager, notes)
        +reject_claim(manager, notes)
    }

    class ShiftExchange {
        <<Model>>
        +String status
        +Text request_reason
        +Text target_response
        +Text manager_notes
        +accept_by_target(response) bool
        +approve(manager, notes)
        +reject(manager, notes)
        +cancel(user)
    }

    class VenueTermsAcceptance {
        <<Model>>
        +String terms_version
        +DateTime accepted_at
        +has_accepted_terms(user, venue)$ bool
    }

    class PreferredVenue {
        <<Model>>
        +DateTime created_at
    }

    class ShiftCheck {
        <<Abstract>>
        +DateTime timestamp
        +URL photo_evidence
        +JSON location
        +Text notes
        +String shift_group
    }

    class FireExitCheck {
        <<Model>>
        +String exit_name
        +Boolean is_clear
        +Boolean is_properly_marked
        +Boolean is_accessible
    }

    class CapacityCheck {
        <<Model>>
        +Integer current_count
        +Integer venue_capacity
        +Boolean is_at_capacity
        +Text action_taken
    }

    class ToiletCheck {
        <<Model>>
        +String location_name
        +String condition
        +Boolean needs_attention
        +Boolean is_out_of_order
        +Text supplies_needed
    }

    class VenueHandover {
        <<Model>>
        +Text notes
        +Boolean issues_flagged
        +Boolean acknowledged
        +DateTime acknowledged_at
    }

    class EnforcementVisit {
        <<Model>>
        +String officer_name
        +String officer_badge
        +Text reason_for_visit
        +Text action_taken
        +Text outcome
    }

    class IncidentReport {
        <<Model>>
        +DateTime incident_time
        +Text description
        +String severity
        +Text actions_taken
        +Boolean requires_followup
        +Boolean resolved
        +DateTime resolved_at
    }

    class CapacityFlow {
        <<Model>>
        +Integer entry_count
        +Integer exit_count
        +Integer current_total
        +Text notes
    }

    class LatenessRecord {
        <<Model>>
        +Integer minutes_late
        +Text reason
        +Boolean acknowledged
        +get_monthly_late_count(user, month, year)$
    }

    Venue "1" --> "*" Shift : shifts
    Venue "1" --> "*" ShiftTemplate : shift_templates
    SecurityCompany "1" --> "*" Venue : venues
    ShiftTemplate "1" --> "*" Shift : generated_shifts
    User "1" --> "*" Shift : shifts
    Shift "1" --> "*" ShiftStatusHistory : status_history
    Shift "1" --> "*" TimeAdjustment : time_adjustments
    Shift "1" --> "*" OpenShiftRequest : open_requests
    Shift "1" --> "*" ShiftExchange : exchange_requests
    Shift "1" --> "*" FireExitCheck
    Shift "1" --> "*" CapacityCheck
    Shift "1" --> "*" ToiletCheck
    Shift "1" --> "*" EnforcementVisit : enforcement_visits
    Shift "1" --> "*" IncidentReport : incident_reports
    Shift "1" --> "*" CapacityFlow : capacity_flows
    Shift "1" --> "*" LatenessRecord : lateness_records
    ShiftCheck <|-- FireExitCheck
    ShiftCheck <|-- CapacityCheck
    ShiftCheck <|-- ToiletCheck
    Shift --> Shift : outgoing_handovers via VenueHandover
    VenueHandover --> Shift : outgoing_shift
    VenueHandover --> Shift : incoming_shift
    User "1" --> "*" VenueTermsAcceptance
    Venue "1" --> "*" VenueTermsAcceptance
    StaffProfile "1" --> "*" PreferredVenue
    Venue "1" --> "*" PreferredVenue
    OpenShiftRequest --> User : requesting_user
    OpenShiftRequest --> User : claimed_by
    ShiftExchange --> User : requesting_user
    ShiftExchange --> User : target_user
    ShiftExchange --> Shift : target_shift
```

---

## 3. Leave Management Domain

```mermaid
classDiagram
    direction TB

    class LeaveType {
        <<Model>>
        +String name
        +String code
        +Text description
        +String color_code
        +Boolean is_active
        +Boolean requires_approval
        +Integer min_notice_days
        +Integer max_consecutive_days
    }

    class LeavePolicy {
        <<Model>>
        +String name
        +String accrual_method
        +Decimal accrual_rate
        +Decimal max_accrual_per_year
        +Decimal max_balance
        +JSON service_brackets
        +String carryover_method
        +Decimal carryover_limit
        +Integer carryover_expiry_months
        +Integer probation_months
        +Boolean allow_negative_balance
        +Decimal negative_balance_limit
        +Boolean is_active
        +Date effective_date
        +Date expiry_date
        +calculate_monthly_accrual(user, date)
        +calculate_annual_accrual(user, year)
        +is_applicable_to_user(user) bool
        +get_carryover_amount(balance) Decimal
    }

    class LeaveRequest {
        <<Model>>
        +Date start_date
        +Date end_date
        +String request_type
        +Time start_time
        +Time end_time
        +Decimal days_requested
        +Text reason
        +Boolean emergency
        +String status
        +DateTime submitted_at
        +DateTime approved_at
        +Text manager_notes
        +Boolean balance_deducted
        +approve(manager, notes)
        +reject(manager, notes)
        +cancel()
    }

    class LeaveBalance {
        <<Model>>
        +Integer year
        +Decimal opening_balance
        +Decimal accrued_balance
        +Decimal used_balance
        +Decimal pending_balance
        +Decimal adjustment_balance
        +Date last_accrual_date
        +current_balance() Decimal
        +available_balance() Decimal
        +add_accrual(amount, date)
        +use_leave(amount)
        +can_take_leave(amount) bool
    }

    class LeaveEntitlement {
        <<Model>>
        +Integer year
        +Decimal annual_entitlement
        +Decimal carried_over
        +Decimal accrued_to_date
        +Decimal used_to_date
        +Date last_accrual_date
        +Date carryover_expiry_date
        +current_balance() Decimal
        +update_accrued_amount(amount, date)
        +use_leave(days)
        +can_take_leave(days) bool
        +process_carryover_from_previous_year(prev)
    }

    class BlackoutPeriod {
        <<Model>>
        +String name
        +Text description
        +Date start_date
        +Date end_date
        +String restriction_level
        +Integer max_staff_percentage
        +Boolean allow_manager_override
        +Boolean is_active
        +is_applicable_to_request(req) bool
        +get_restriction_message() String
    }

    class SystemConfig {
        <<Model>>
        +String config_key
        +JSON config_data
        +Text description
    }

    class ContractorUnavailability {
        <<Model>>
        +Date start_date
        +Date end_date
        +Text reason
        +is_user_available(user, date)$ bool
        +get_unavailable_dates_in_range(user, start, end)$
    }

    class BankHoliday {
        <<Model>>
        +String name
        +Date date
        +Boolean is_active
        +populate_uk_defaults(company, year)$
        +get_holidays_in_range(company, start, end)$
    }

    class StaffLeaveDailyRate {
        <<Model>>
        +Decimal daily_rate
        +Date effective_from
    }

    LeaveType "1" --> "*" LeavePolicy : policies
    LeaveType "1" --> "*" LeaveRequest : requests
    LeaveType "1" --> "*" LeaveBalance : balances
    LeavePolicy "1" --> "*" LeaveEntitlement : entitlements
    User "1" --> "*" LeaveRequest : leave_requests
    User "1" --> "*" LeaveBalance : leave_balances
    User "1" --> "*" LeaveEntitlement : leave_entitlements
    User "1" --> "*" ContractorUnavailability : unavailability_periods
    User "1" --> "0..1" StaffLeaveDailyRate : leave_daily_rate
    LeaveRequest --> User : approved_by
    BlackoutPeriod --> Venue : venue
    BlackoutPeriod "*" --> "*" LeaveType : leave_types
    LeaveType "*" --> "*" EmploymentType : employment_types
    LeavePolicy "*" --> "*" EmploymentType : employment_types
    SecurityCompany "1" --> "*" BankHoliday : bank_holidays
    SecurityCompany "1" --> "*" ContractorUnavailability
    SecurityCompany "1" --> "*" StaffLeaveDailyRate
    SystemConfig --> User : updated_by
```

---

## 4. Finance & Invoicing Domain

```mermaid
classDiagram
    direction TB

    class Invoice {
        <<Model>>
        +Date start_date
        +Date end_date
        +Decimal total_hours
        +Decimal hourly_rate
        +Decimal total_amount
        +String status
        +URL pdf_url
        +String source
        +Integer version
        +DateTime last_recalculated_at
        +generate_for_staff_period(user, start, end)$
        +recalculate_from_shifts()
        +get_payment_breakdown() dict
    }

    class InvoiceItem {
        <<Model>>
        +String item_type
        +Date date
        +String description
        +Decimal hours_worked
        +Decimal days
        +Decimal rate
        +Decimal amount
    }

    class PayRate {
        <<Model>>
        +Decimal hourly_rate
        +Boolean is_default
    }

    class AccountingProvider {
        <<Model>>
        +String provider_key
        +String display_name
        +Boolean is_active
        +String oauth_client_id
        +Encrypted oauth_client_secret
        +Text oauth_scopes
        +URL api_base_url
    }

    class ProviderConnection {
        <<Model>>
        +String company_name
        +String tenant_id
        +Encrypted access_token
        +Encrypted refresh_token
        +DateTime token_expires_at
        +String status
        +Boolean is_sandbox
        +Boolean auto_sync_invoices
        +Boolean auto_sync_payroll
        +is_token_valid() bool
    }

    class AccountMapping {
        <<Model>>
        +String mapping_type
        +String local_account_name
        +String provider_account_id
        +String provider_account_name
        +Boolean is_default
    }

    class VATCodeMapping {
        <<Model>>
        +String local_vat_code
        +Decimal local_vat_rate
        +String provider_vat_code
        +String provider_vat_name
    }

    class EarningsTypeMapping {
        <<Model>>
        +String local_earnings_name
        +Decimal local_hourly_rate
        +String provider_earnings_code
        +String provider_earnings_name
    }

    class ContactMapping {
        <<Model>>
        +String contact_type
        +String provider_contact_id
        +String provider_contact_name
        +DateTime last_synced_at
    }

    class InvoiceExport {
        <<Model>>
        +String provider_invoice_id
        +String provider_invoice_number
        +String status
        +JSON export_data
        +JSON provider_response
        +Text error_message
        +DateTime completed_at
    }

    class PayrollExport {
        <<Model>>
        +String export_type
        +Date pay_period_start
        +Date pay_period_end
        +String provider_payrun_id
        +String status
        +JSON export_data
        +DateTime completed_at
    }

    class WebhookEvent {
        <<Model>>
        +String event_type
        +String event_id
        +JSON raw_payload
        +String signature
        +String status
        +JSON processed_data
        +DateTime processed_at
    }

    class SyncLog {
        <<Model>>
        +String operation
        +String level
        +Text message
        +JSON metadata
    }

    User "1" --> "*" Invoice : invoices
    Invoice "1" --> "*" InvoiceItem : items
    InvoiceItem --> Shift : shift
    InvoiceItem --> BankHoliday : bank_holiday
    InvoiceItem --> LeaveRequest : leave_request
    InvoiceItem --> Venue : venue
    User "1" --> "*" PayRate : pay_rates
    PayRate --> Venue : venue
    AccountingProvider "1" --> "*" ProviderConnection : connections
    ProviderConnection "1" --> "*" AccountMapping : account_mappings
    ProviderConnection "1" --> "*" VATCodeMapping : vat_mappings
    ProviderConnection "1" --> "*" EarningsTypeMapping : earnings_mappings
    ProviderConnection "1" --> "*" ContactMapping : contact_mappings
    ProviderConnection "1" --> "*" InvoiceExport : invoice_exports
    ProviderConnection "1" --> "*" PayrollExport : payroll_exports
    ProviderConnection "1" --> "*" WebhookEvent : webhook_events
    ProviderConnection "1" --> "*" SyncLog : sync_logs
    InvoiceExport --> Invoice : local_invoice
    ContactMapping --> User : local_user
    PayrollExport "*" --> "*" User : staff_users
    Invoice --> User : created_by
```

---

## 5. Compliance & Regulation Domain

```mermaid
classDiagram
    direction TB

    class WorkingHoursRegulation {
        <<Model>>
        +String country_code
        +String country_name
        +Decimal standard_weekly_hours
        +Decimal standard_daily_hours
        +Decimal overtime_threshold_hours
        +Decimal overtime_multiplier_1
        +Decimal overtime_threshold_2
        +Decimal overtime_multiplier_2
        +Decimal max_daily_hours
        +Decimal max_weekly_hours
        +Integer max_consecutive_days
        +Decimal min_rest_between_shifts_hours
        +Decimal min_weekly_rest_hours
        +Integer break_duration_minutes
        +Decimal break_trigger_hours
        +JSON special_rules
        +JSON security_sector_overrides
        +JSON break_requirements
        +JSON night_shift_rules
        +JSON opt_out_provisions
        +JSON state_overrides
        +Boolean is_active
        +get_overtime_rate(hours) float
        +validate_daily_hours(hours) bool
        +validate_weekly_hours(hours) bool
        +get_break_requirements(hours) dict
        +get_night_work_limits() dict
        +validate_security_shift(data) dict
    }

    class ComplianceProfile {
        <<Model>>
        +String name
        +Text description
        +Decimal override_max_daily_hours
        +Decimal override_max_weekly_hours
        +Integer override_max_consecutive_days
        +Decimal daily_hours_warning_threshold
        +Decimal weekly_hours_warning_threshold
        +Integer consecutive_days_warning_threshold
        +Boolean auto_approve_overtime
        +Boolean require_manager_approval
        +Boolean notify_on_warnings
        +Boolean notify_on_violations
        +JSON notification_recipients
        +Integer grace_period_minutes
        +JSON custom_rules
        +JSON exception_roles
        +Boolean is_active
        +get_max_daily_hours() Decimal
        +get_max_weekly_hours() Decimal
        +check_daily_hours_warning(hours) bool
        +check_weekly_hours_warning(hours) bool
    }

    class ComplianceViolation {
        <<Model>>
        +String violation_type
        +String severity
        +DateTime period_start
        +DateTime period_end
        +Text description
        +JSON calculated_values
        +Decimal threshold_exceeded
        +JSON evidence_data
        +Boolean system_generated
        +String resolution_status
        +Text resolution_notes
        +DateTime resolved_at
        +Boolean exception_granted
        +Text exception_reason
        +Decimal financial_impact
        +Decimal compliance_score_impact
        +resolve(user, notes, exception, reason)
        +dismiss(user, reason)
        +is_resolved() bool
    }

    class WorkingHoursMetrics {
        <<Model>>
        +Date week_start
        +Date week_end
        +Decimal total_hours
        +Integer total_shifts
        +Integer consecutive_days
        +Decimal longest_shift_hours
        +Decimal shortest_rest_hours
        +Boolean daily_limit_exceeded
        +Boolean weekly_limit_exceeded
        +Boolean consecutive_days_exceeded
        +Boolean rest_period_violated
        +Decimal overtime_hours
        +JSON shift_details
    }

    WorkingHoursRegulation "1" --> "*" ComplianceProfile : compliance_profiles
    ComplianceProfile "1" --> "*" SecurityCompany : companies
    ComplianceViolation --> User : user
    ComplianceViolation --> Shift : shift
    ComplianceViolation "*" --> "*" Shift : related_shifts
    ComplianceViolation --> User : resolved_by
    ComplianceViolation --> User : approved_by
    WorkingHoursMetrics --> User : user
    WorkingHoursMetrics --> ComplianceProfile : compliance_profile
```

---

## 6. Deputy Integration & Notifications Domain

```mermaid
classDiagram
    direction TB

    class DeputyConfig {
        <<Model>>
        +URL api_endpoint
        +String api_key
        +Boolean is_active
        +DateTime last_sync_date
    }

    class DeputyEmployee {
        <<Model>>
        +String deputy_id
        +String first_name
        +String last_name
        +String email
        +String phone
        +Boolean is_active
    }

    class DeputyTimesheet {
        <<Model>>
        +String deputy_id
        +DateTime start_time
        +DateTime end_time
        +Integer break_length
        +String status
        +Text comments
    }

    class SNSDeviceToken {
        <<Model>>
        +String platform
        +String device_token
        +String endpoint_arn
        +Boolean is_active
        +DateTime last_used
    }

    class NotificationPreferences {
        <<Model>>
        +Boolean shift_reminders
        +Boolean shift_updates
        +Boolean shift_approvals
        +Boolean leave_updates
        +Boolean compliance_alerts
        +Boolean invoice_notifications
        +Boolean system_announcements
        +Integer reminder_hours_before
        +Boolean email_enabled
        +Boolean push_enabled
        +Boolean sms_enabled
    }

    class QualificationReminder {
        <<Model>>
        +String qualification_type
        +Date expiry_date
        +Boolean reminder_sent
        +Date reminder_date
        +Boolean reminder_acknowledged
    }

    DeputyEmployee --> User : mapped_to_user
    DeputyEmployee "1" --> "*" DeputyTimesheet : timesheets
    DeputyTimesheet --> Shift : mapped_to_shift
    User "1" --> "*" SNSDeviceToken : device_tokens
    User "1" --> "0..1" NotificationPreferences
    User "1" --> "*" QualificationReminder : qualification_reminders
```

---

## 7. Reporting & System Configuration Domain

```mermaid
classDiagram
    direction TB

    class SystemSettings {
        <<Model>>
        +String company_name
        +String support_email
        +Decimal default_hourly_rate
        +Decimal special_event_pay_rate
        +String default_payment_terms
        +String invoice_prefix
        +Boolean automatic_invoicing
        +Boolean email_notifications
        +Boolean sms_notifications
        +Boolean require_signatures
        +Boolean require_manager_approval
        +Integer session_timeout
        +Boolean allow_shift_exchange
        +Boolean auto_approve_shift_exchanges
        +Integer auto_checkout_grace_period
        +Integer auto_checkout_force_timeout
        +Boolean auto_checkout_enabled
        +get_settings(company)$ SystemSettings
    }

    class EmploymentType {
        <<Model>>
        +String name
        +Text description
        +String employment_category
        +Boolean is_active
    }

    class ReportTemplate {
        <<Model>>
        +String name
        +String report_type
        +Text description
        +JSON template_config
        +JSON default_filters
        +Boolean is_active
        +Boolean is_system_template
    }

    class ReportJob {
        <<Model>>
        +String status
        +JSON parameters
        +JSON result_metadata
        +URL result_file_url
        +Text error_message
        +DateTime started_at
        +DateTime completed_at
        +Integer progress_percentage
    }

    class ScheduledReport {
        <<Model>>
        +String schedule_type
        +String day_of_week
        +Integer day_of_month
        +Time time_of_day
        +JSON recipients
        +JSON parameters
        +Boolean is_active
        +DateTime last_run_at
        +DateTime next_run_at
    }

    class ExportConfiguration {
        <<Model>>
        +String name
        +String export_type
        +String format
        +JSON field_mappings
        +JSON filters
        +JSON formatting_options
        +Boolean include_headers
        +String date_format
        +String delimiter
        +Boolean is_active
    }

    class RecruitmentApplication {
        <<Model>>
        +String full_name
        +Date date_of_birth
        +String email
        +Boolean has_sia_licence
        +String sia_licence_number
        +JSON licence_types
        +Date licence_expiry_date
        +JSON certifications
        +String status
        +Text digital_signature
        +approve(admin, notes)
        +reject(admin, notes)
        +convert_to_user(admin) User
    }

    SecurityCompany "1" --> "0..1" SystemSettings : settings
    SecurityCompany "1" --> "*" EmploymentType : employment_types
    ReportTemplate "1" --> "*" ReportJob : jobs
    ReportTemplate "1" --> "*" ScheduledReport : scheduled_reports
    ReportJob --> User : requested_by
    ScheduledReport --> User : created_by
    ExportConfiguration --> User : created_by
    RecruitmentApplication --> EmploymentType : employment_type
    RecruitmentApplication --> User : converted_to_user
    RecruitmentApplication --> User : reviewed_by
```

---

## Legend

| Symbol | Meaning |
|--------|---------|
| `<<Model>>` | Django Model class |
| `<<AbstractUser>>` | Extends Django AbstractUser |
| `<<Abstract>>` | Abstract base class (no DB table) |
| `+` | Public field or method |
| `$` | Static/class method |
| `"1" --> "*"` | One-to-many relationship (ForeignKey) |
| `"1" --> "0..1"` | One-to-one relationship (OneToOneField) |
| `"*" --> "*"` | Many-to-many relationship (ManyToManyField) |
| `<\|--` | Inheritance (subclass) |
| `UUID` | UUID primary key |
| `JSON` | JSONField |
| `Encrypted` | EncryptedJSONField (encrypted at rest) |

### Status/Choice Enumerations

| Model | Field | Choices |
|-------|-------|---------|
| User | role | admin, manager, staff |
| UserCompanyMembership | role | owner, admin, manager, staff, viewer |
| Shift | status | open, scheduled, active, in_progress, completed, pending_approval, approved, rejected, cancelled, no_show |
| Invoice | status | pending, paid, rejected |
| LeaveRequest | status | draft, pending, approved, rejected, cancelled, withdrawn |
| OpenShiftRequest | status | open, claimed, approved, rejected, cancelled |
| ShiftExchange | status | pending, accepted_by_target, approved, rejected, cancelled |
| ComplianceViolation | severity | info, warning, minor, major, critical |
| ComplianceViolation | resolution_status | open, investigating, pending_approval, approved_exception, resolved, false_positive, dismissed |
| SIALicense | status | valid, expired, pending |
| ProviderConnection | status | pending, connected, expired, error, disabled |
| InvoiceExport | status | pending, processing, completed, failed, cancelled |
| SecurityCompany | subscription_tier | starter, professional, enterprise, custom |
| EmploymentType | employment_category | permanent, contractor, temporary |
| RecruitmentApplication | status | pending, approved, rejected |
| InvoiceItem | item_type | shift, bank_holiday, annual_leave |

---

## Notes

- **Cross-reference**: See `01_ERD_Complete.md` for the full entity-relationship diagram with all field types.
- **Cross-reference**: See `07_State_Diagrams.md` for state machine diagrams of Shift, LeaveRequest, Invoice, OpenShiftRequest, ShiftExchange, and ComplianceViolation.
- **Cross-reference**: See `09_DFD_Context.md` and `10_DFD_Level1.md` for data flow diagrams showing how these models interact at the process level.
- The `shifts` app (`backend/shifts/models.py`) re-exports `Shift` and `ShiftStatusHistory` from `api.models`.
- `ShiftCheck` is an abstract model; `FireExitCheck`, `CapacityCheck`, and `ToiletCheck` inherit from it and have their own DB tables.
- Multi-tenancy is achieved via `SecurityCompany` + `UserCompanyMembership` -- users can belong to multiple companies.
- Accounting integration uses `EncryptedJSONField` for OAuth tokens and secrets.

---

## Source Files

| File | Models Covered |
|------|---------------|
| `backend/api/models.py` | SecurityCompany, UserCompanyMembership, CompanyOnboarding, CompanyIntegration, User, StaffProfile, EmergencyContact, BankDetails, SIALicense, SecurityQualification, StaffAvailability, Venue, VenueTermsAcceptance, PreferredVenue, ShiftStatusHistory, ShiftTemplate, OpenShiftRequest, Shift, TimeAdjustment, ShiftCheck, FireExitCheck, CapacityCheck, ToiletCheck, ShiftExchange, Invoice, InvoiceItem, PayRate, DeputyConfig, DeputyEmployee, DeputyTimesheet, LatenessRecord, IncidentReport, CapacityFlow, VenueHandover, QualificationReminder, SystemSettings, EmploymentType, ContractorUnavailability, BankHoliday, StaffLeaveDailyRate, RecruitmentApplication, EnforcementVisit, WorkingHoursRegulation, ComplianceProfile, ComplianceViolation, WorkingHoursMetrics, ReportTemplate, ReportJob, ScheduledReport, ExportConfiguration, SNSDeviceToken, NotificationPreferences, PasswordResetToken |
| `backend/leave_management/models.py` | LeaveType, LeavePolicy, LeaveRequest, LeaveBalance, BlackoutPeriod, LeaveEntitlement, SystemConfig |
| `backend/finance_integrations/models.py` | AccountingProvider, ProviderConnection, AccountMapping, VATCodeMapping, EarningsTypeMapping, ContactMapping, InvoiceExport, PayrollExport, WebhookEvent, SyncLog |
| `backend/shifts/models.py` | Re-exports Shift, ShiftStatusHistory from api.models |
