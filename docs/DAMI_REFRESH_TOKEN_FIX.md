# Dami Refresh Token Fix

## Problem

iOS users were experiencing unexpected logouts when JWT refresh token rotation was enabled. After token rotation, the old token was blacklisted, but the mobile app continued using the old token on the next refresh request. This caused a 401 Unauthorized response, triggering an automatic logout.

## Root Cause

**Backend Issue**: The token refresh endpoint was using `str(token)` which just serialized the same token object instead of generating a new one with fresh claims (JTI, exp, iat).

**Mobile Issue**: The token refresh handler was only extracting and storing the access token from the response, completely ignoring the rotated refresh token. It continued using the old (now blacklisted) refresh token.

## Solution

### Backend (api/views.py)
Changed the token generation from serializing the existing token to properly generating a new token using the SimpleJWT library:
- **Before**: `refresh_token = str(token)` 
- **After**: `rotated_token = RefreshToken.for_user(user)` followed by `refresh_token = str(rotated_token)`

The backend now:
1. Generates a completely new refresh token with unique JTI and claims
2. Returns both access and refresh tokens in the response body (for mobile/Safari compatibility)
3. Blacklists the old token only after the new one is ready

### Mobile (mobile/src/store/api/baseApi.ts)
Added proper type safety and token storage:
- Added `RefreshTokenResponse` type definition and `isRefreshTokenResponse()` type guard
- Changed from extracting only access token to extracting both tokens
- Now stores the rotated refresh token: `SecureStore.setItemAsync('refreshToken', refresh)`

## Result

✓ Token rotation works seamlessly without interrupting user sessions
✓ iOS users no longer experience unexpected logouts
✓ Sessions persist across app restarts
✓ All existing authentication tests pass
