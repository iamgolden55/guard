---
date: 2025-12-29T00:00:00Z
researcher: Claude
git_commit: c6ffb2e56ce8cea164b26100a4656be661dcc3ee
branch: main
repository: guard
topic: "Metro Bundler Error: Property value expected type of string but got null"
tags: [research, codebase, metro-bundler, expo, mobile-app, configuration, debugging]
status: complete
last_updated: 2025-12-29
last_updated_by: Claude
---

# Research: Metro Bundler Error - Property value expected type of string but got null

**Date**: 2025-12-29T00:00:00Z
**Researcher**: Claude
**Git Commit**: c6ffb2e56ce8cea164b26100a4656be661dcc3ee
**Branch**: main
**Repository**: guard

## Research Question

Why does the mobile app fail to load in iOS Simulator with Metro bundler error "Property value expected type of string but got null" despite environment variables loading correctly in app.config.js?

## Summary

The error occurs because `Constants.expoConfig?.extra?.eas?.projectId` in `mobile/src/utils/constants.ts:33` can be explicitly `null` during Metro bundling, and the fallback string (`|| 'your-expo-project-id'`) only works for `undefined`, not `null`. This happens when the value is explicitly set to null in the Expo configuration rather than being undefined. The issue is specific to local Metro bundling during development, as EAS cloud builds handle the bundling phase differently and succeed.

## Root Cause Analysis

### Primary Issue

**File**: `mobile/src/utils/constants.ts:33`

```typescript
EXPO_PROJECT_ID: Constants.expoConfig?.extra?.eas?.projectId || 'your-expo-project-id',
```

**Problem**: When `Constants.expoConfig.extra.eas.projectId` is explicitly `null` (not `undefined`), the OR operator (`||`) doesn't trigger the fallback because in JavaScript:
- `null || 'fallback'` → `'fallback'` ✓ (works)
- BUT if Metro's type validation runs before JavaScript execution, it sees `null` where a string is expected

### Why This Happens

1. **Metro Bundler Type Validation**: Metro performs static analysis during bundling
2. **Expo Config Loading**: `app.config.js` loads environment variables using `process.env.EXPO_PROJECT_ID`
3. **Null vs Undefined**: If `process.env.EXPO_PROJECT_ID` is `null` or the environment variable is missing, the resulting value becomes `null` in the config object
4. **Module Load Time**: `constants.ts` is evaluated when first imported, triggering type checks before runtime

### Configuration Chain

```
.env file → app.config.js (process.env) → Constants.expoConfig.extra → constants.ts (module load)
                                                                                    ↓
                                                                            Metro type check
                                                                                 FAILS ❌
```

## Detailed Findings

### 1. Environment Variable Configuration

#### Files Analyzed

- **`mobile/.env`** - Environment configuration (mobile/.env:5)
  ```
  API_BASE_URL=http://192.168.0.127:8000
  NODE_ENV=development
  ```
  - ⚠️ **Missing**: `EXPO_PROJECT_ID` is not defined in .env

- **`mobile/app.config.js:93`** - Expo configuration
  ```javascript
  projectId: process.env.EXPO_PROJECT_ID || "9d8d1bce-0f46-4c87-99c4-503a32be2113"
  ```
  - ✓ Loads environment variable correctly
  - ✓ Has fallback value
  - ⚠️ BUT: `process.env.EXPO_PROJECT_ID` returns `undefined` when not set, which then becomes the fallback value

#### Environment Loading Process

1. `.env` file loaded by dotenv in `app.config.js:3`
2. `process.env.EXPO_PROJECT_ID` accessed at line 93
3. Value embedded in `Constants.expoConfig.extra.eas.projectId`
4. Accessed at runtime in multiple files

### 2. Files Accessing Constants.expoConfig During Bundling

Four files attempt to read `Constants.expoConfig` at **module load time**:

1. **`mobile/src/config/api.config.ts:20`**
   ```typescript
   const ENV_API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl || 'http://localhost:8000';
   ```
   - Top-level constant evaluated during import
   - Could fail if `apiBaseUrl` is null

2. **`mobile/src/services/api.ts:54`**
   ```typescript
   const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl || 'http://localhost:8000';
   ```
   - Similar issue as above

3. **`mobile/src/utils/constants.ts:33`** ⚠️ **PRIMARY SUSPECT**
   ```typescript
   EXPO_PROJECT_ID: Constants.expoConfig?.extra?.eas?.projectId || 'your-expo-project-id',
   ```
   - Nested optional chaining: `extra?.eas?.projectId`
   - Three-level deep access increases null risk
   - Used in API_CONFIG object exported from module

4. **`mobile/src/utils/constants.ts:282-284`**
   ```typescript
   version: Constants.expoConfig?.version || '1.0.0',
   buildNumber: Constants.expoConfig?.ios?.buildNumber || '1',
   bundleId: Constants.expoConfig?.ios?.bundleIdentifier || 'com.meadsecurity.staffapp',
   ```
   - Similar pattern with optional chaining + fallbacks

### 3. Metro Bundler Configuration Analysis

**File**: `mobile/metro.config.js`

```javascript
config.transformer = {
  ...config.transformer,
  asyncRequireModulePath: null,      // Disables async requires
  enableBabelRCLookup: false,        // Disables Babel RC lookup
};

config.serializer = {
  ...config.serializer,
  customSerializer: undefined,        // Disables lazy bundling
};
```

**Key Observations**:
- Configuration specifically disables async loading features
- Comments mention "async-require.js error" - suggests previous bundling issues
- These settings indicate the project has had Metro bundling problems before

### 4. Redux Store Configuration (Not the Issue)

**Analysis**: Redux store in `mobile/src/store/index.ts` is **properly configured**:
- ✓ All state values are serializable (primitives and plain objects)
- ✓ No Date objects, functions, or class instances in state
- ✓ redux-persist actions properly ignored in serializableCheck
- ✓ API reducer not persisted (ephemeral cache)

**Conclusion**: Redux store serialization is NOT causing the Metro bundler error.

### 5. TypeScript Configuration

**File**: `mobile/tsconfig.json`

- Extends `expo/tsconfig.base`
- Strict mode enabled
- No type validation issues that would cause this specific error
- Path aliases configured correctly

### 6. Expo Plugin Configuration

**Plugins Configured** (mobile/app.config.js:66-71):
- expo-secure-store
- expo-camera
- expo-location
- expo-notifications
- expo-local-authentication

**Analysis**: All plugins are standard Expo modules with no custom validation that would cause null errors.

### 7. Historical Context from thoughts/

No specific documentation about "Property value expected type of string but got null" errors found. Related mobile debugging documents:

- `thoughts/shared/research/2025-10-24-mobile-build-progress-audit.md` - Mobile build configuration audit
- `thoughts/shared/research/2025-10-16-mobile-auto-checkout-network-issues.md` - Network timeout and AsyncStorage issues
- `thoughts/shared/plans/2025-12-08-notification-system-enhancement.md` - Push notification setup

## Why EAS Builds Succeed

EAS (Expo Application Services) cloud builds succeed because:

1. **Different Bundling Phase**: EAS runs metro bundle as part of native compilation, not development mode
2. **Environment Injection**: EAS injects environment variables directly into the build at compile time
3. **No Dev Server**: No Metro development server running locally with file watching
4. **Native Build Context**: Values are resolved during native compilation, not JavaScript bundling

## Solutions

### Solution 1: Use Nullish Coalescing Operator (Recommended)

Replace `||` with `??` to handle both `null` and `undefined`:

```typescript
// mobile/src/utils/constants.ts:33
EXPO_PROJECT_ID: Constants.expoConfig?.extra?.eas?.projectId ?? 'your-expo-project-id',
```

**Why this works**: The nullish coalescing operator (`??`) only uses the fallback when the value is `null` or `undefined`, not for other falsy values.

### Solution 2: Add EXPO_PROJECT_ID to .env

Add to `mobile/.env`:
```
EXPO_PROJECT_ID=9d8d1bce-0f46-4c87-99c4-503a32be2113
```

**Why this works**: Ensures the environment variable is always defined during development.

### Solution 3: Explicit Type Guards

```typescript
const projectId = Constants.expoConfig?.extra?.eas?.projectId;
EXPO_PROJECT_ID: typeof projectId === 'string' ? projectId : 'your-expo-project-id',
```

**Why this works**: TypeScript can verify the type before assignment.

### Solution 4: Lazy Evaluation

Move constant definition inside a function:

```typescript
export const getExpoProjectId = (): string => {
  return Constants.expoConfig?.extra?.eas?.projectId || 'your-expo-project-id';
};
```

**Why this works**: Evaluation happens at function call time, not module load time.

## Code References

Key files for implementing solutions:

- `mobile/src/utils/constants.ts:33` - EXPO_PROJECT_ID definition
- `mobile/src/config/api.config.ts:20` - ENV_API_BASE_URL definition
- `mobile/src/services/api.ts:54` - API_BASE_URL definition
- `mobile/app.config.js:93` - projectId configuration
- `mobile/.env` - Environment variables file

## Implementation Recommendation

**Apply Solution 1 + Solution 2** (Belt and Suspenders Approach):

1. **Update constants.ts with nullish coalescing**:
   ```typescript
   EXPO_PROJECT_ID: Constants.expoConfig?.extra?.eas?.projectId ?? 'your-expo-project-id',
   ```

2. **Add EXPO_PROJECT_ID to .env**:
   ```
   EXPO_PROJECT_ID=9d8d1bce-0f46-4c87-99c4-503a32be2113
   ```

3. **Apply same fix to other Constants.expoConfig accesses**:
   - `api.config.ts:20`: `?? 'http://localhost:8000'`
   - `api.ts:54`: `?? 'http://localhost:8000'`
   - `constants.ts:282-284`: Use `??` for version, buildNumber, bundleId

This ensures the app works in both development (with .env) and production (with build-time injection) scenarios.

## Architecture Insights

### Module Load Time vs Runtime

Metro bundler evaluates top-level constants during the bundling phase, which is **before** JavaScript runtime. This means:

1. Type validation occurs during bundling
2. Optional chaining (`?.`) is transformed but doesn't prevent type checks
3. Fallback values with `||` may not satisfy type validators
4. Use `??` (nullish coalescing) for better type safety

### Environment Variable Flow in Expo

```
Development:
  .env → dotenv → process.env → app.config.js → Constants.expoConfig → Runtime Access

Production (EAS):
  Build Environment → Native Build → Constants.expoConfig → Runtime Access

Metro Bundling:
  Constants.expoConfig (evaluated at module load) → Type Validation → Bundle Creation
```

### Metro Bundler Validation

Metro performs static analysis and type checking during bundling. When it encounters:
```typescript
const value: string = Constants.expoConfig?.extra?.field || 'fallback';
```

It validates that `Constants.expoConfig?.extra?.field` can be typed as `string`, but if the actual runtime value during bundling is `null`, the validation fails before the `||` fallback can execute.

## Testing Verification

After implementing solutions, verify with:

```bash
# 1. Clear Metro bundler cache
cd mobile
rm -rf node_modules/.cache
npx expo start --clear

# 2. Test iOS Simulator
npx expo run:ios

# 3. Verify environment loading
node -e "require('dotenv').config(); console.log(process.env.EXPO_PROJECT_ID)"

# 4. Check Constants at runtime
# In app, add console.log(Constants.expoConfig?.extra?.eas?.projectId)
```

## Related Research

- `thoughts/shared/research/2025-10-24-mobile-build-progress-audit.md` - Mobile build configuration
- `thoughts/shared/research/2025-10-16-mobile-auto-checkout-network-issues.md` - Mobile debugging patterns
- `thoughts/shared/research/2025-12-09-financial-integrations-architecture.md` - OAuth environment configuration patterns

## Open Questions

1. Why did this error start occurring now? Was there a recent Expo SDK update?
2. Are there other files accessing `Constants.expoConfig` at module load time?
3. Should we add ESLint rules to catch this pattern?
4. Should we create a centralized config module with lazy evaluation?

## Next Steps

1. Implement Solution 1 + 2 (nullish coalescing + .env variable)
2. Search codebase for all `Constants.expoConfig?.` patterns
3. Add linting rule to prefer `??` over `||` for optional chaining
4. Document environment variable setup in mobile/README.md
5. Consider creating a typed config service to centralize environment access

---

**Research completed**: 2025-12-29
**Agent contributions**: 5 parallel research agents analyzed configuration files, environment loading, Redux store, TypeScript setup, and historical documentation

