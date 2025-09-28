// Onboarding wizard types
export interface OnboardingWizardData {
  companyInfo: CompanyInfoData;
  regionalCompliance: RegionalComplianceData;
  staffOperations: StaffOperationsData;
  integrationsSetup: IntegrationsSetupData;
  accountFinalization: AccountFinalizationData;
}

// Step 1: Company Information
export interface CompanyInfoData {
  companyName: string;
  registrationNumber: string;
  businessType: BusinessType;
  industry: string;
  foundedYear: number;
  websiteUrl?: string;
  description?: string;
  address: CompanyAddress;
  primaryContact: ContactInfo;
}

export interface CompanyAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface ContactInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
}

export enum BusinessType {
  PRIVATE_LIMITED = 'private_limited',
  PUBLIC_LIMITED = 'public_limited',
  PARTNERSHIP = 'partnership',
  SOLE_PROPRIETORSHIP = 'sole_proprietorship',
  NON_PROFIT = 'non_profit',
  OTHER = 'other'
}

// Step 2: Regional Compliance
export interface RegionalComplianceData {
  primaryRegion: string;
  operatingRegions: string[];
  complianceProfile: ComplianceProfile;
  specialRequirements: string[];
  dataProtectionLevel: DataProtectionLevel;
}

export interface ComplianceProfile {
  workingHoursRegulation: string;
  overtimeRules: string;
  breakRequirements: string;
  holidayEntitlements: string;
  leaveRequirements: string;
  healthSafetyStandards: string[];
}

export enum DataProtectionLevel {
  BASIC = 'basic',
  GDPR_COMPLIANT = 'gdpr_compliant',
  ENHANCED = 'enhanced',
  ENTERPRISE = 'enterprise'
}

// Step 3: Staff Operations
export interface StaffOperationsData {
  staffSize: StaffSizeRange;
  expectedGrowth: GrowthProjection;
  operationalCapacity: OperationalCapacity;
  shiftPatterns: ShiftPattern[];
  specialOperations: SpecialOperation[];
}

export enum StaffSizeRange {
  SMALL = '1-10',
  MEDIUM = '11-50',
  LARGE = '51-200',
  ENTERPRISE = '200+'
}

export interface GrowthProjection {
  sixMonths: number;
  oneYear: number;
  twoYears: number;
}

export interface OperationalCapacity {
  maxConcurrentShifts: number;
  peakHoursCapacity: number;
  emergencyStaffing: number;
  specialEventCapacity: number;
}

export interface ShiftPattern {
  name: string;
  startTime: string;
  endTime: string;
  frequency: FrequencyType;
  staffRequired: number;
  skillsRequired: string[];
}

export enum FrequencyType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  ON_DEMAND = 'on_demand'
}

export interface SpecialOperation {
  type: string;
  description: string;
  frequency: string;
  staffRequirement: number;
  specialSkills: string[];
}

// Step 4: Integrations Setup
export interface IntegrationsSetupData {
  deputy: DeputyIntegration;
  accounting: AccountingIntegration;
  payroll: PayrollIntegration;
  communication: CommunicationIntegration;
  customIntegrations: CustomIntegration[];
}

export interface DeputyIntegration {
  enabled: boolean;
  apiKey?: string;
  subdomain?: string;
  syncFrequency: SyncFrequency;
  syncOptions: DeputySyncOptions;
}

export interface DeputySyncOptions {
  employees: boolean;
  timesheets: boolean;
  rosters: boolean;
  locations: boolean;
  departments: boolean;
}

export interface AccountingIntegration {
  provider: AccountingProvider;
  enabled: boolean;
  credentials?: AccountingCredentials;
  syncOptions: AccountingSyncOptions;
}

export enum AccountingProvider {
  XERO = 'xero',
  QUICKBOOKS = 'quickbooks',
  SAGE = 'sage',
  ZOHO = 'zoho',
  NONE = 'none'
}

export interface AccountingCredentials {
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface AccountingSyncOptions {
  invoices: boolean;
  expenses: boolean;
  payroll: boolean;
  taxes: boolean;
}

export interface PayrollIntegration {
  provider: string;
  enabled: boolean;
  credentials?: Record<string, string>;
  payFrequency: PayFrequency;
}

export enum PayFrequency {
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly'
}

export interface CommunicationIntegration {
  sms: SmsIntegration;
  email: EmailIntegration;
  whatsapp: WhatsAppIntegration;
}

export interface SmsIntegration {
  enabled: boolean;
  provider: string;
  apiKey?: string;
}

export interface EmailIntegration {
  enabled: boolean;
  provider: string;
  smtpSettings?: SmtpSettings;
}

export interface SmtpSettings {
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: string;
}

export interface WhatsAppIntegration {
  enabled: boolean;
  businessAccountId?: string;
  phoneNumberId?: string;
  accessToken?: string;
}

export interface CustomIntegration {
  name: string;
  type: string;
  endpoint: string;
  apiKey?: string;
  headers?: Record<string, string>;
  enabled: boolean;
}

export enum SyncFrequency {
  REALTIME = 'realtime',
  EVERY_HOUR = 'every_hour',
  EVERY_4_HOURS = 'every_4_hours',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MANUAL = 'manual'
}

// Step 5: Account Finalization
export interface AccountFinalizationData {
  adminUsers: AdminUser[];
  securitySettings: SecuritySettings;
  billingInfo: BillingInfo;
  preferences: SystemPreferences;
}

export interface AdminUser {
  firstName: string;
  lastName: string;
  email: string;
  role: AdminRole;
  permissions: Permission[];
}

export enum AdminRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MANAGER = 'manager',
  HR_ADMIN = 'hr_admin',
  FINANCE_ADMIN = 'finance_admin'
}

export interface Permission {
  resource: string;
  actions: string[];
}

export interface SecuritySettings {
  passwordPolicy: PasswordPolicy;
  sessionTimeout: number;
  mfaRequired: boolean;
  ipWhitelist: string[];
  auditLogging: boolean;
  dataRetentionPeriod: number;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  expiryDays: number;
}

export interface BillingInfo {
  planType: PlanType;
  billingCycle: BillingCycle;
  paymentMethod: PaymentMethod;
  billingAddress: CompanyAddress;
}

export enum PlanType {
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
  CUSTOM = 'custom'
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual'
}

export interface PaymentMethod {
  type: PaymentType;
  cardLast4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  billingName?: string;
}

export enum PaymentType {
  CREDIT_CARD = 'credit_card',
  BANK_TRANSFER = 'bank_transfer',
  INVOICE = 'invoice'
}

export interface SystemPreferences {
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  currency: string;
  language: string;
  notifications: NotificationPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  pushNotifications: boolean;
  systemAlerts: boolean;
  shiftReminders: boolean;
  complianceAlerts: boolean;
}

// Wizard step configuration
export interface WizardStep {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  isCompleted: boolean;
  isActive: boolean;
  isAccessible: boolean;
}

// API response types
export interface OnboardingResponse {
  success: boolean;
  message: string;
  data?: any;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// Regional data types
export interface Region {
  id: string;
  name: string;
  code: string;
  country: string;
  currency: string;
  timezone: string;
  complianceProfile: ComplianceProfile;
}

// Progress tracking
export interface OnboardingProgress {
  currentStep: number;
  completedSteps: number[];
  totalSteps: number;
  isCompleted: boolean;
  startedAt: string;
  lastUpdatedAt: string;
  estimatedCompletion: string;
}

// Multi-tenant Company Types
export interface SecurityCompany {
  id: string;
  name: string;
  registrationNumber?: string;
  countryCode: string;
  complianceProfileId?: number;
  staffCapacity: number;
  subscriptionTier: SubscriptionTier;
  industry?: string;
  website?: string;
  phone?: string;
  logoUrl?: string;
  createdAt: string;
  updatedAt: string;
  onboardingCompleted: boolean;
  onboardingStep: number;
}

export enum SubscriptionTier {
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise'
}

export interface UserCompanyMembership {
  id: string;
  userId: number;
  companyId: string;
  role: CompanyRole;
  isOwner: boolean;
  permissions: CompanyPermission[];
  joinedAt: string;
}

export enum CompanyRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MANAGER = 'manager',
  STAFF = 'staff'
}

export enum CompanyPermission {
  MANAGE_USERS = 'manage_users',
  MANAGE_VENUES = 'manage_venues',
  MANAGE_SHIFTS = 'manage_shifts',
  MANAGE_INVOICES = 'manage_invoices',
  MANAGE_SETTINGS = 'manage_settings',
  VIEW_REPORTS = 'view_reports',
  MANAGE_INTEGRATIONS = 'manage_integrations'
}

// Onboarding State Management
export interface OnboardingState {
  currentStep: number;
  totalSteps: number;
  formData: OnboardingWizardData;
  validation: ValidationState;
  isSubmitting: boolean;
  progress: number; // 0-100
  sessionId: string;
  lastSavedAt?: string;
  errors: Record<string, string>;
}

export interface ValidationState {
  [stepKey: string]: StepValidation;
}

export interface StepValidation {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

// Company Context State
export interface CompanyContextState {
  currentCompany: SecurityCompany | null;
  companies: SecurityCompany[]; // For users in multiple companies
  userMemberships: UserCompanyMembership[];
  isLoading: boolean;
  error: string | null;
}

// API Response Types for Company Management
export interface CompanyContextResponse {
  company: SecurityCompany;
  userRole: CompanyRole;
  permissions: CompanyPermission[];
  subscription: SubscriptionDetails;
  limits: CompanyLimits;
}

export interface SubscriptionDetails {
  tier: SubscriptionTier;
  status: 'active' | 'cancelled' | 'suspended';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
}

export interface CompanyLimits {
  staffCount: number;
  maxStaff: number;
  venuesCount: number;
  maxVenues: number;
  shiftsPerMonth: number;
  maxShiftsPerMonth: number;
  storageUsed: number; // in GB
  maxStorage: number; // in GB
}

// Regional Compliance Auto-Configuration
export interface RegionalComplianceConfig {
  countryCode: string;
  workingHoursLimits: WorkingHoursConfig;
  overtimeRules: OvertimeConfig;
  holidaySettings: HolidayConfig;
  licenseRequirements: LicenseConfig[];
}

export interface WorkingHoursConfig {
  maxDailyHours: number;
  maxWeeklyHours: number;
  minimumRestPeriod: number;
  nightShiftRegulations: NightShiftConfig;
}

export interface NightShiftConfig {
  startTime: string;
  endTime: string;
  maxConsecutiveNights: number;
  additionalBreaks: number;
}

export interface OvertimeConfig {
  dailyThreshold: number;
  weeklyThreshold: number;
  multiplier: number;
  requiresApproval: boolean;
}

export interface HolidayConfig {
  minimumAnnualLeave: number;
  publicHolidays: PublicHoliday[];
  leaveAccrualRate: number;
}

export interface PublicHoliday {
  date: string;
  name: string;
  isPaid: boolean;
}

export interface LicenseConfig {
  type: string;
  name: string;
  isRequired: boolean;
  validityPeriod: number; // months
  reminderDays: number;
}

// Company Initiation Data for API submission
export interface CompanyInitiationData {
  company: {
    name: string;
    registration_number: string;
    country_code: string; // ISO code like 'GBR'
    city: string;
    postal_code: string;
    address_line_1: string;
    billing_email: string;
    primary_contact_name: string;
    primary_contact_email: string;
    primary_contact_phone: string;
    industry_type: string;
    business_type: string;
    founded_year: number;
    // Optional fields
    trading_name?: string;
    website_url?: string;
    description?: string;
    tax_id?: string;
    state_province?: string;
    address_line_2?: string;
    subscription_tier?: string;
    company_size?: string;
  };
}