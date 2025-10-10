# How to Find Companies in the Multi-Tenant System

**Date**: 2025-10-08
**Author**: System Documentation

## Overview

This document explains how to query and manage companies in the multi-tenant security staff management system.

---

## Current Company Status

As of 2025-10-08, the system has **3 active companies**:

| Company Name | Slug | Total Staff | Breakdown |
|-------------|------|-------------|-----------|
| **Mead Security** | `mead-security` | 19 | 3 Owners, 1 Manager, 15 Staff |
| **CTR Security** | `ctr-security` | 3 | 1 Owner, 2 Staff |
| **Staffline Security Agency** | `staffline-security-agency` | 2 | 1 Owner, 1 Staff |

---

## Database Architecture

### Multi-Tenant Structure

The system uses a multi-tenant architecture with the following key tables:

1. **`security_companies`** - Main company/tenant table
2. **`user_company_memberships`** - Junction table linking users to companies
3. **`users`** - User accounts (can belong to multiple companies)

### Key Relationships

```
security_companies (1) ──< (N) user_company_memberships (N) >── (1) users
                    │
                    ├──< employment_types
                    ├──< venues
                    ├──< company_onboarding
                    ├──< company_integrations
                    └──< system_settings
```

---

## How to Find Companies

### Step 1: Identify the Correct Database

The application uses PostgreSQL database: **`security_management`**

Check the [.env](../backend/.env) file:
```bash
DB_NAME=security_management
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
```

**Important**: Do NOT query the `postgres` database - it's empty. Always use `security_management`.

### Step 2: Query Companies

#### List All Companies

```sql
psql -U postgres -d security_management -c "
SELECT id, name, slug, subscription_tier, company_size, is_active
FROM security_companies
ORDER BY name;
"
```

#### Get Companies with Staff Counts

```sql
psql -U postgres -d security_management -c "
SELECT
    sc.name as \"Company Name\",
    sc.slug as \"Slug\",
    COUNT(DISTINCT ucm.user_id) as \"Total Staff\",
    COUNT(DISTINCT CASE WHEN ucm.role = 'owner' THEN ucm.user_id END) as \"Owners\",
    COUNT(DISTINCT CASE WHEN ucm.role = 'admin' THEN ucm.user_id END) as \"Admins\",
    COUNT(DISTINCT CASE WHEN ucm.role = 'manager' THEN ucm.user_id END) as \"Managers\",
    COUNT(DISTINCT CASE WHEN ucm.role = 'staff' THEN ucm.user_id END) as \"Staff\"
FROM security_companies sc
LEFT JOIN user_company_memberships ucm ON ucm.company_id = sc.id AND ucm.is_active = true
GROUP BY sc.id, sc.name, sc.slug
ORDER BY sc.name;
"
```

### Step 3: Understanding User-Company Relationships

Users are linked to companies through the `user_company_memberships` table, NOT directly on the `users` table.

#### Get Users for a Specific Company

```sql
SELECT
    u.id,
    u.username,
    u.email,
    u.first_name,
    u.last_name,
    ucm.role as company_role,
    ucm.is_owner,
    ucm.is_active
FROM users u
JOIN user_company_memberships ucm ON ucm.user_id = u.id
JOIN security_companies sc ON sc.id = ucm.company_id
WHERE sc.slug = 'mead-security'
    AND ucm.is_active = true
ORDER BY u.username;
```

---

## Common Queries

### 1. Total Companies and Staff Summary

```sql
SELECT
    COUNT(DISTINCT sc.id) as \"Total Companies\",
    COUNT(DISTINCT ucm.user_id) as \"Total Unique Staff\",
    SUM(CASE WHEN sc.is_active = true THEN 1 ELSE 0 END) as \"Active Companies\"
FROM security_companies sc
LEFT JOIN user_company_memberships ucm ON ucm.company_id = sc.id AND ucm.is_active = true;
```

### 2. Find Companies by Name Pattern

```sql
SELECT id, name, slug, is_active
FROM security_companies
WHERE name ILIKE '%security%'
ORDER BY name;
```

### 3. Check Company Resources

```sql
-- Get venues for a company
SELECT v.id, v.name, v.address, v.city
FROM venues v
JOIN security_companies sc ON sc.id = v.company_id
WHERE sc.slug = 'mead-security';

-- Get employment types for a company
SELECT et.id, et.name, et.default_hourly_rate
FROM employment_types et
JOIN security_companies sc ON sc.id = et.company_id
WHERE sc.slug = 'mead-security';
```

---

## Deleting Companies (Admin Task)

### Important Considerations

Companies have many foreign key relationships. To delete a company, you must delete related records in this order:

1. **recruitment_applications** (references employment_types)
2. **staff_profiles.employment_type_id** (set to NULL or delete)
3. **user_company_memberships** (company memberships)
4. **company_onboarding** (onboarding records)
5. **company_integrations** (integration configs)
6. **employment_types** (job types)
7. **system_settings** (company settings)
8. **venues** (and cascading: shifts, invoices, etc.)
9. **security_companies** (the company itself)

### Example: Delete Test Companies

```sql
BEGIN;

-- Companies to delete
WITH companies_to_delete AS (
    SELECT id FROM security_companies
    WHERE slug NOT IN ('mead-security', 'ctr-security', 'staffline-security-agency')
),
employment_types_to_delete AS (
    SELECT et.id FROM employment_types et
    WHERE et.company_id IN (SELECT id FROM companies_to_delete)
)

-- 1. Update staff profiles to remove employment type references
, step1 AS (
    UPDATE staff_profiles
    SET employment_type_id = NULL
    WHERE employment_type_id IN (SELECT id FROM employment_types_to_delete)
    RETURNING id
)
-- 2. Delete recruitment applications
, step2 AS (
    DELETE FROM recruitment_applications
    WHERE employment_type_id IN (SELECT id FROM employment_types_to_delete)
    RETURNING id
)
-- 3. Delete user company memberships
, step3 AS (
    DELETE FROM user_company_memberships
    WHERE company_id IN (SELECT id FROM companies_to_delete)
    RETURNING id
)
-- 4. Delete company onboarding
, step4 AS (
    DELETE FROM company_onboarding
    WHERE company_id IN (SELECT id FROM companies_to_delete)
    RETURNING id
)
-- 5. Delete company integrations
, step5 AS (
    DELETE FROM company_integrations
    WHERE company_id IN (SELECT id FROM companies_to_delete)
    RETURNING id
)
-- 6. Delete employment types
, step6 AS (
    DELETE FROM employment_types
    WHERE company_id IN (SELECT id FROM companies_to_delete)
    RETURNING id
)
-- 7. Delete system settings
, step7 AS (
    DELETE FROM system_settings
    WHERE company_id IN (SELECT id FROM companies_to_delete)
    RETURNING id
)
-- 8. Delete venues (cascades to shifts, etc.)
, step8 AS (
    DELETE FROM venues
    WHERE company_id IN (SELECT id FROM companies_to_delete)
    RETURNING id
)
-- 9. Finally delete companies
DELETE FROM security_companies
WHERE id IN (SELECT id FROM companies_to_delete);

COMMIT;
```

---

## Database Models Reference

### SecurityCompany Model

**File**: [backend/api/models.py:26](../backend/api/models.py#L26)

Key fields:
- `id` (UUID) - Primary key
- `name` - Company name
- `slug` - URL-friendly identifier
- `subscription_tier` - Subscription level
- `company_size` - Employee count category
- `is_active` - Active status
- `created_by_id` - Foreign key to creating user

### UserCompanyMembership Model

**File**: [backend/api/models.py](../backend/api/models.py) (search for `UserCompanyMembership`)

Key fields:
- `user_id` - Foreign key to users
- `company_id` - Foreign key to security_companies
- `role` - Role within company (owner, admin, manager, staff)
- `is_owner` - Boolean flag for company owner
- `is_active` - Active membership status

---

## Troubleshooting

### Issue: No Companies Found

**Problem**: Query returns 0 rows
```sql
SELECT COUNT(*) FROM security_companies;
-- Returns: 0
```

**Solution**: Check you're querying the correct database
```bash
# Wrong database
psql -U postgres -d postgres

# Correct database
psql -U postgres -d security_management
```

### Issue: Users Not Showing Company Association

**Problem**: Users table doesn't have `company_id` column

**Solution**: Use the `user_company_memberships` junction table instead:
```sql
-- ❌ WRONG - company_id doesn't exist on users
SELECT * FROM users WHERE company_id = '...';

-- ✅ CORRECT - use junction table
SELECT u.*
FROM users u
JOIN user_company_memberships ucm ON ucm.user_id = u.id
WHERE ucm.company_id = '...' AND ucm.is_active = true;
```

---

## Summary

- **Database**: `security_management` (not `postgres`)
- **Main Table**: `security_companies`
- **User Association**: Through `user_company_memberships` (many-to-many)
- **Current Production Companies**: Mead Security, CTR Security, Staffline Security Agency
- **Total Active Staff**: 24 users across all companies

For API access to companies, see the Django REST endpoints in the backend API documentation.
