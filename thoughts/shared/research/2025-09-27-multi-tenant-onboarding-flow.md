---
date: 2025-09-27 16:42:26 BST
researcher: Claude Code
git_commit: 26a4d4e9f938998cfa06db1bb79c599662ecba8b
branch: main
repository: remix2
topic: "Multi-tenant onboarding flow research after codebase conversion"
tags: [research, codebase, multi-tenant, onboarding, authentication, company-registration]
status: complete
last_updated: 2025-09-27
last_updated_by: Claude Code
---

# Research: Multi-Tenant Onboarding Flow After Codebase Conversion

**Date**: 2025-09-27 16:42:26 BST
**Researcher**: Claude Code
**Git Commit**: 26a4d4e9f938998cfa06db1bb79c599662ecba8b
**Branch**: main
**Repository**: remix2

## Research Question
How does the multi-tenant onboarding flow work after the codebase conversion to a multi-tenant application? The user registered a new user and went through the onboarding flow to understand how the system works, particularly referencing the fixed authentication race conditions described in `/docs/verified_docs/onboarding_fix.md`.

## Summary
The system implements a sophisticated multi-tenant architecture with a comprehensive 5-step company onboarding wizard that creates isolated tenant environments. After fixing the authentication race conditions documented in the onboarding fix, the system now provides a seamless flow from user registration through company creation and role-based access to dashboards. The architecture supports multiple companies per user, granular role-based permissions, and comprehensive integration management while maintaining strict data isolation between tenants.

## Detailed Findings

### Authentication System Architecture
The multi-tenant authentication system uses JWT tokens with automatic refresh mechanisms and eliminates the race conditions that previously caused infinite redirect loops:

- **AuthContext Implementation** (`frontend/src/contexts/AuthContext.tsx`): Unified initialization effect prevents competing useEffect race conditions
- **Token Management** (`frontend/src/services/api.ts`): Automatic token refresh with 401 interceptors and retry logic
- **Multi-Company Context** (`frontend/src/contexts/CompanyContext.tsx`): Company switching with role-based permissions per tenant
- **Route Protection**: Hierarchical guards supporting authentication, authorization, onboarding completion, and company association

### 5-Step Onboarding Flow
The system implements a comprehensive onboarding wizard that creates the complete tenant environment:

**Step 1: Company Information** (`CompanyInfoStep.tsx`)
- Creates `SecurityCompany` record with UUID primary key
- Business details, registration number, industry type
- Creates `UserCompanyMembership` with owner role

**Step 2: Regional Compliance** (`RegionalComplianceStep.tsx`)
- Compliance profile configuration per region
- Data protection level settings (GDPR, Enhanced, Enterprise)
- Working hours and regulatory requirements

**Step 3: Staff Operations** (`StaffOperationsStep.tsx`)
- Staff capacity planning and growth projections
- Operational capacity limits and shift patterns
- Special operation requirements

**Step 4: Integrations Setup** (`IntegrationsSetupStep.tsx`)
- Deputy workforce management integration
- Accounting systems (Xero, QuickBooks, Sage)
- Communication platforms (Slack, Teams, WhatsApp)
- Creates `CompanyIntegration` records with encrypted credentials

**Step 5: Account Finalization** (`AccountFinalizationStep.tsx`)
- Admin user creation and role assignment
- Security policy configuration
- Billing and subscription setup

### Database Multi-Tenant Architecture
The database implements comprehensive tenant isolation with sophisticated relationship management:

**Core Tenant Models:**
- **SecurityCompany** (`api/models.py:26-275`): Main tenant entity with UUID isolation, subscription management, and feature controls
- **UserCompanyMembership** (`api/models.py:281-401`): Many-to-many user-company relationships with granular roles and invitation system
- **CompanyOnboarding** (`api/models.py:403-569`): Step-by-step progress tracking with session persistence and validation

### Role-Based Access Control and Dashboard Routing
The system provides three distinct role-based dashboard experiences:

**Staff Dashboard** (`pages/staff/Dashboard.tsx`):
- Personal earnings tracking with real-time updates
- Active shift management and quick actions
- Profile completion enforcement

**Manager Dashboard** (`pages/manager/Dashboard.tsx`):
- Pending approvals workflow with bulk operations
- Staff activity oversight
- Searchable approval history

**Admin Dashboard** (`pages/admin/Dashboard.tsx`):
- System overview with comprehensive statistics
- Deputy integration status monitoring
- Full administrative access to all features

**Route Protection Implementation:**
```typescript
// Hierarchical role access with inheritance
<Route element={<AuthGuard requireOnboarding={true} allowedRoles={[UserRole.ADMIN]} />}>
  <Route path="/admin/staff" element={<StaffManagement />} />
</Route>
```

### API Architecture for Multi-Tenant Support
The backend provides comprehensive API support for onboarding and tenant management:

**Onboarding Endpoints:**
- `POST /api/v1/onboarding/initiate/` - Creates company and starts onboarding
- `PUT /api/v1/onboarding/company-info/` - Saves step 1 data
- `PUT /api/v1/onboarding/complete/` - Finalizes onboarding process

**Multi-Tenant Isolation:**
- Custom permission classes: `IsCompanyMember`, `IsCompanyOwnerOrAdmin`
- Automatic company context headers: `X-Company-ID`
- Query filtering by company membership
- Company-scoped caching strategies

### Integration Systems in Multi-Tenant Context
The system manages both company-specific and global integrations:

**Company-Specific Integrations** (`CompanyIntegration` model):
- Per-tenant Deputy, payroll, accounting, and communication integrations
- Encrypted credential storage per company
- Health monitoring and error tracking
- Configuration during onboarding process

**Global Finance Integrations** (`finance_integrations/`):
- Xero, QuickBooks, Sage provider connections
- OAuth-based authentication with encrypted tokens
- Webhook event handling for real-time sync
- Cross-company payment processing

## Code References
- `frontend/src/contexts/AuthContext.tsx:223-385` - Fixed authentication race conditions and unified initialization
- `backend/api/views.py:4902` - Company onboarding initiation endpoint
- `backend/api/models.py:26-275` - SecurityCompany multi-tenant model
- `frontend/src/components/onboarding/OnboardingWizard.tsx` - Complete 5-step wizard implementation
- `backend/api/models.py:571-720` - CompanyIntegration multi-tenant configuration
- `frontend/src/pages/admin/Dashboard.tsx` - Role-based dashboard example

## Architecture Insights
The multi-tenant conversion demonstrates several key patterns:

1. **UUID-Based Isolation**: All tenant entities use UUIDs for security and enumeration prevention
2. **Hierarchical Role Inheritance**: Managers inherit staff permissions, admins inherit all permissions
3. **Company Context Switching**: Users can belong to multiple companies with different roles
4. **Progressive Onboarding**: Step-by-step validation ensures complete tenant setup
5. **Encrypted Credential Management**: All integration credentials stored with encryption
6. **Webhook-Based Sync**: Real-time data synchronization from external systems
7. **Performance Optimization**: Company-scoped caching and optimized query patterns

## Historical Context (from thoughts/)
The system builds upon the authentication fixes documented in `/docs/verified_docs/onboarding_fix.md`, which resolved critical race conditions in the AuthContext that prevented users from accessing their dashboards after login. The fix unified competing useEffects into a single initialization flow, eliminating infinite redirect loops and ensuring deterministic authentication recovery.

## Related Research
This research complements the existing onboarding fix documentation by providing a comprehensive view of the entire multi-tenant architecture that the authentication system supports.

## Open Questions
1. How does the system handle company data migration when users switch between companies?
2. What are the subscription tier limitations and how are they enforced?
3. How does the Deputy integration handle employee mapping conflicts?
4. What are the backup and disaster recovery procedures for multi-tenant data?