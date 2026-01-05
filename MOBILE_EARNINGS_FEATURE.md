# Mobile Earnings Feature Implementation

## Overview
Added an "Earnings" section to the mobile app's profile settings. This feature allows users to view their earnings (Month, Year-to-Date) and access their earnings statements (invoices).

## Changes

### 1. New Screen: `EarningsScreen`
- **Location**: `mobile/src/screens/profile/EarningsScreen.tsx`
- **Features**:
    - Displays total earnings for "This Month" and "Year to Date".
    - Shows stats like "Last Month" earnings and "Shifts Completed".
    - Includes a mock "Recent Statements" list with download simulation.
    - Uses `expo-linear-gradient` for a modern UI.

### 2. Navigation
- **Type Definitions**: Updated `mobile/src/types/navigation.ts` to include `Earnings` in `MainStackParamList`.
- **Navigator**: Registered `EarningsScreen` in `mobile/src/navigation/MainNavigator.tsx`.

### 3. Profile Screen Update
- **Location**: `mobile/src/screens/profile/ProfileScreen.tsx`
- **Change**: Added an "Earnings" button to the "Quick Actions" section.

## Future Work (Backend Integration)
Currently, the `EarningsScreen` uses mock data (`MOCK_EARNINGS`, `MOCK_STATEMENTS`). To fully implement this feature:
1.  **Backend API**: Create an API endpoint to fetch user earnings summaries and statement history.
    - Endpoint: `GET /api/v1/users/me/earnings/summary`
    - Endpoint: `GET /api/v1/users/me/earnings/statements`
2.  **Frontend Integration**:
    - Create a Redux slice (e.g., `earningsSlice`) or use RTK Query to fetch data.
    - Replace mock data in `EarningsScreen` with data from the store.
3.  **PDF Generation**: Implement actual PDF generation or download logic for the statements.
