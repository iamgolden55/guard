# Mobile App Security Best Practices

**Production-Safe Development Guidelines**

This document outlines critical security practices for the mobile application to prevent data leaks, ensure privacy compliance, and maintain production security.

---

## Table of Contents
1. [Logging & Debugging](#logging--debugging)
2. [Data Privacy](#data-privacy)
3. [Authentication & Tokens](#authentication--tokens)
4. [API Communication](#api-communication)
5. [Production Checklist](#production-checklist)

---

## Logging & Debugging

### ❌ NEVER Do This (Security Risk)

```typescript
// BAD - Logs entire user object with sensitive data
console.log('Login successful:', result.user);

// BAD - Logs sensitive fields
console.log('User password:', password);
console.log('Bank details:', user.bankDetails);
console.log('Token:', accessToken);
```

**Why it's dangerous:**
- Exposes sensitive data in production logs
- Violates GDPR and data privacy regulations
- Can be captured by crash reporting tools
- May be stored in device logs accessible to other apps

### ✅ Always Do This (Production-Safe)

```typescript
import { logger } from '@utils/logger';

// GOOD - Only logs in development, minimal info
logger.logAuth('login', userId);
logger.info('User profile updated');
logger.error('API call failed', error);
```

**Our Logger Features:**
- Only logs detailed info in development (`__DEV__`)
- Automatically sanitizes sensitive fields
- Production logs only show minimal, safe information
- Specialized methods for common operations

---

## Using the Logger

### Import the Logger
```typescript
import { logger } from '../utils/logger';
```

### Authentication Logging
```typescript
// Login
logger.logAuth('login', user.id);

// Logout
logger.logAuth('logout', user.id);

// Biometric
logger.logAuth('biometric', user.id);
```

**Development output:**
```
[AUTH] LOGIN - User ID: 5
```

**Production output:**
```
(Nothing logged - silent in production)
```

---

### API Call Logging
```typescript
logger.logApiCall('POST', '/api/v1/shifts/check-in', 200);
logger.logApiCall('GET', '/api/v1/profile');
```

**Development output:**
```
[API] POST /api/v1/shifts/check-in - 200
[API] GET /api/v1/profile
```

---

### Error Logging
```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', error);
  // Show user-friendly message
  Alert.alert('Error', 'Something went wrong. Please try again.');
}
```

**Development output:**
```
[ERROR] Operation failed
{full error stack trace}
```

**Production output:**
```
[ERROR] Operation failed
(no stack trace)
```

---

### Info & Debug Logging
```typescript
// General information
logger.info('Shift check-in started');

// Detailed debugging (development only)
logger.debug('Processing shift data', { shiftId: 123 });
```

**Development output:**
```
[INFO] Shift check-in started
[DEBUG] Processing shift data { shiftId: 123 }
```

**Production output:**
```
(Nothing logged)
```

---

### Navigation Logging
```typescript
logger.logNavigation('DashboardScreen', { from: 'LoginScreen' });
```

**Development output:**
```
[NAV] → DashboardScreen { from: 'LoginScreen' }
```

---

## Data Privacy

### Sensitive Fields to NEVER Log

The logger automatically removes these fields:

- `password`
- `token`, `accessToken`, `refreshToken`
- `bankDetails`, `bank_details`
- `accountNumber`, `account_number`
- `sortCode`, `sort_code`
- `national_insurance_number`
- `date_of_birth`
- `phone_number`
- `email`
- `street`, `postal_code`
- `siaLicenses`, `sia_licenses`

### GDPR Compliance

**❌ Don't:**
```typescript
// Logs full user profile with personal data
console.log(userProfile);

// Stores sensitive data in AsyncStorage without encryption
AsyncStorage.setItem('user_data', JSON.stringify(user));
```

**✅ Do:**
```typescript
// Only log non-sensitive identifiers
logger.info('Profile loaded', { userId: user.id, role: user.role });

// Use secure storage for tokens
await SecureStore.setItemAsync('access_token', token);
```

---

## Authentication & Tokens

### Token Storage

**❌ Never:**
```typescript
// Bad - tokens visible in logs
console.log('Access token:', token);

// Bad - insecure storage
AsyncStorage.setItem('token', accessToken);
```

**✅ Always:**
```typescript
import * as SecureStore from 'expo-secure-store';

// Good - secure storage
await SecureStore.setItemAsync('access_token', token);
await SecureStore.setItemAsync('refresh_token', refreshToken);

// Good - secure retrieval
const token = await SecureStore.getItemAsync('access_token');
```

### Token Handling

```typescript
// ✅ Good - no logging of token
const response = await api.post('/endpoint', data, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

// ❌ Bad - token in logs
console.log('Making request with token:', token);
```

---

## API Communication

### Request Logging

**❌ Don't:**
```typescript
// Bad - logs request body with potential sensitive data
console.log('API Request:', { url, method, body });
```

**✅ Do:**
```typescript
// Good - logs only method and endpoint
logger.logApiCall(method, endpoint);
```

### Response Logging

**❌ Don't:**
```typescript
// Bad - logs entire response with user data
console.log('API Response:', response.data);
```

**✅ Do:**
```typescript
// Good - logs only status
logger.logApiCall(method, endpoint, response.status);

// If you need to debug response in dev
if (__DEV__) {
  logger.debug('Response received', { status: response.status });
}
```

### Error Handling

**❌ Don't:**
```typescript
catch (error) {
  console.log('Error:', error);
  Alert.alert('Error', error.message); // Shows technical error to user
}
```

**✅ Do:**
```typescript
catch (error: any) {
  logger.error('API call failed', error);
  Alert.alert('Error', 'Unable to complete request. Please try again.');
}
```

---

## Production Checklist

Before releasing to production, verify:

### 1. No Direct Console Logs
```bash
# Search for console.log in your code
grep -r "console\." src/

# Should only find logger imports or TODO comments
```

### 2. Use Logger Everywhere
- ✅ All authentication uses `logger.logAuth()`
- ✅ All API calls use `logger.logApiCall()`
- ✅ All errors use `logger.error()`
- ✅ No direct `console.log/error/warn` calls

### 3. Secure Storage
- ✅ Tokens stored in SecureStore (not AsyncStorage)
- ✅ No sensitive data in AsyncStorage
- ✅ No sensitive data in Redux state (or properly secured)

### 4. Network Security
- ✅ All API calls use HTTPS
- ✅ Certificate pinning implemented (if required)
- ✅ No hardcoded API keys or secrets

### 5. Error Messages
- ✅ User-facing errors are generic and friendly
- ✅ Technical details only logged in development
- ✅ No stack traces shown to users

---

## Common Scenarios

### Scenario 1: Login Flow

```typescript
const handleLogin = async () => {
  try {
    const result = await login({ username, password });

    if (result.success) {
      // ✅ Correct - minimal logging
      logger.logAuth('login', result.user?.id);
    } else {
      // ✅ Correct - generic error to user
      Alert.alert('Login Failed', 'Invalid credentials');
    }
  } catch (error) {
    // ✅ Correct - log error for debugging, show generic message
    logger.error('Login failed', error);
    Alert.alert('Error', 'Network error. Please try again.');
  }
};
```

### Scenario 2: API Data Fetch

```typescript
const fetchUserProfile = async () => {
  try {
    logger.logApiCall('GET', '/api/v1/profile');
    const response = await api.get('/api/v1/profile');

    // ✅ Don't log the response data
    return response.data;
  } catch (error) {
    logger.error('Failed to fetch profile', error);
    throw error;
  }
};
```

### Scenario 3: Shift Check-In

```typescript
const handleCheckIn = async (shiftId: number) => {
  try {
    logger.info('Starting shift check-in', { shiftId });

    const response = await api.post('/api/v1/shifts/check-in', {
      shift_id: shiftId,
      location: currentLocation,
    });

    logger.logApiCall('POST', '/api/v1/shifts/check-in', response.status);

    Alert.alert('Success', 'Checked in successfully');
  } catch (error) {
    logger.error('Check-in failed', error);
    Alert.alert('Error', 'Unable to check in. Please try again.');
  }
};
```

### Scenario 4: Form Validation Error

```typescript
const validateForm = () => {
  if (!email) {
    // ✅ User input validation - no need to log
    Alert.alert('Validation Error', 'Please enter your email');
    return false;
  }

  if (!isValidEmail(email)) {
    Alert.alert('Validation Error', 'Please enter a valid email');
    return false;
  }

  return true;
};
```

---

## Tools & Utilities

### Check for Security Issues

```bash
# Find all console.log statements
grep -rn "console.log" src/

# Find all console.error statements
grep -rn "console.error" src/

# Find potential password logging
grep -rn "password" src/ | grep "console"

# Find potential token logging
grep -rn "token" src/ | grep "console"
```

### Pre-Commit Hook (Recommended)

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# Check for console.log in staged files
if git diff --cached --name-only | grep "\.tsx\?$" | xargs grep -n "console\.log" > /dev/null; then
    echo "Error: console.log found in staged files"
    echo "Use logger from @utils/logger instead"
    exit 1
fi
```

---

## Summary

### Quick Rules

1. **Always use `logger`** instead of `console.*`
2. **Never log** passwords, tokens, or personal data
3. **Keep error messages generic** for users
4. **Log technical details** only in development
5. **Use SecureStore** for sensitive data
6. **Sanitize data** before logging (logger does this automatically)

### Import & Use

```typescript
import { logger } from '@utils/logger';

// Auth
logger.logAuth('login', userId);

// API
logger.logApiCall('GET', '/endpoint', 200);

// Errors
logger.error('Operation failed', error);

// Info (dev only)
logger.info('Processing data');

// Debug (dev only)
logger.debug('Detailed info', data);
```

---

## Questions?

If you're unsure whether to log something:
1. **Is it sensitive data?** → Don't log it
2. **Is it a token/password?** → Never log it
3. **Is it for debugging?** → Use `logger.debug()` (dev only)
4. **Is it an error?** → Use `logger.error()` (sanitized in production)

**When in doubt, don't log it!**
