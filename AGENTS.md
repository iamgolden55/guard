# AGENTS.md - Agentic Coding Guidelines

This document provides essential information for AI coding agents working in this repository.

## Project Overview

Security staff management system with three main components:
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Fluent UI (`/frontend`)
- **Backend**: Django 5.2 + DRF + PostgreSQL (`/backend`)
- **Mobile**: React Native + Expo (`/mobile`)

## Build/Lint/Test Commands

### Frontend (`/frontend`)
```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run lint         # Biome lint + TypeScript check
npm run format       # Format with Biome
npm run test         # Run all Jest tests
npm run test -- --testPathPattern="ProfileUpdate"  # Single test file
npm run test -- -t "should update"                 # Single test by name
```

### Backend (`/backend`)
```bash
python manage.py runserver              # Start server (port 8000)
python manage.py migrate                # Apply migrations
pytest                                  # Run all tests
pytest api/tests/test_views.py          # Single test file
pytest api/tests/test_views.py::UserViewSetEligibleStaffTests  # Single class
pytest api/tests/test_views.py::UserViewSetEligibleStaffTests::test_get_eligible_staff  # Single test
pytest -k "test_name_pattern"           # Tests matching pattern
pytest -v                               # Verbose output
```

### Mobile (`/mobile`)
```bash
npm start            # Start Expo dev server
npm run ios          # Run on iOS
npm run android      # Run on Android
npm test             # Run Jest tests
npm run test:watch   # Watch mode
npm run test:coverage # With coverage
```

## Code Style Guidelines

### TypeScript/React (Frontend & Mobile)

**Imports** - Organized by Biome, order:
1. React/framework imports
2. Third-party libraries
3. Local components/services
4. Types (use `type` keyword for type-only imports)

```typescript
import type React from 'react';
import { useState, useEffect } from 'react';
import { Text, PrimaryButton } from '@fluentui/react';
import { MainLayout } from '../../layouts';
import { useAuth } from '../../contexts/AuthContext';
import type { Shift, Invoice } from '../../types';
```

**Formatting**:
- Indent: 2 spaces
- Quotes: Double quotes (`"`)
- Semicolons: Required
- Max line length: ~100 chars

**Naming Conventions**:
- Components: PascalCase (`StaffDashboard.tsx`)
- Functions/variables: camelCase (`getShifts`, `activeShift`)
- Types/interfaces: PascalCase (`ShiftStatus`, `Invoice`)
- Constants: UPPER_SNAKE_CASE for true constants
- Files: PascalCase for components, camelCase for services/utils

**Types**:
- Define types in `/frontend/src/types/` organized by domain
- Use explicit types; avoid `any` where possible
- Export enums as values, types with `type` keyword

```typescript
export type { Shift, ShiftTemplate } from './shift';
export { ShiftStatus, RecurringPatternType } from './shift';
```

**React Patterns**:
- Functional components with hooks
- Use `useCallback` for functions passed as props
- Destructure props at component level
- Handle loading/error states explicitly

```typescript
const StaffDashboard: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // ...
};
```

### Python/Django (Backend)

**Imports** - Standard order:
1. Standard library
2. Django imports
3. Third-party packages
4. Local imports

```python
import logging
import uuid
from decimal import Decimal

from django.db import models
from django.contrib.auth import get_user_model
from rest_framework import viewsets, status

from .models import User, StaffProfile, Shift
from .serializers import ShiftSerializer
```

**Formatting**:
- Black formatter (line length 88)
- isort for import sorting
- flake8 for linting

**Naming Conventions**:
- Classes: PascalCase (`StaffProfile`, `ShiftSerializer`)
- Functions/variables: snake_case (`get_shifts`, `active_shift`)
- Constants: UPPER_SNAKE_CASE
- Model fields: snake_case with descriptive names

**Django Patterns**:
- ViewSets for CRUD operations
- Serializers handle field aliasing (snake_case <-> camelCase)
- Use `get_user_model()` instead of importing User directly
- Log errors with context

```python
logger = logging.getLogger(__name__)

class ShiftViewSet(viewsets.ModelViewSet):
    queryset = Shift.objects.all()
    serializer_class = ShiftSerializer
    permission_classes = [IsAuthenticated]
```

**Serializer Conventions** - Handle frontend camelCase:
```python
class BankDetailsSerializer(serializers.ModelSerializer):
    accountName = serializers.CharField(source='account_name', required=False)
    sortCode = serializers.CharField(source='sort_code', required=False)
```

### Error Handling

**Frontend**:
```typescript
try {
  const data = await shiftService.getShifts();
  setShifts(data);
} catch (error: any) {
  console.error('Error fetching shifts:', error);
  setError(error.message || 'Failed to load shifts');
}
```

**Backend**:
```python
try:
    shift = Shift.objects.get(id=shift_id)
except Shift.DoesNotExist:
    logger.warning(f"Shift not found: {shift_id}")
    return Response({"error": "Shift not found"}, status=status.HTTP_404_NOT_FOUND)
```

## API Conventions

- Base URL: `/api/v1/`
- Authentication: JWT with refresh tokens
- Frontend uses Vite proxy in dev (empty baseURL)
- Pagination: `?page_size=N` for large lists

**Request/Response**:
- Frontend sends camelCase
- Backend accepts both, returns snake_case with camelCase aliases
- Always handle paginated responses: `response.data.results`

## Testing Patterns

**Frontend (Jest + Testing Library)**:
```typescript
import { render, screen, fireEvent } from '@testing-library/react';

describe('Component', () => {
  it('should render correctly', () => {
    render(<Component />);
    expect(screen.getByText('Expected')).toBeInTheDocument();
  });
});
```

**Backend (pytest-django)**:
```python
from rest_framework.test import APITestCase

class ShiftAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(...)
        self.client.force_authenticate(user=self.user)

    def test_list_shifts(self):
        response = self.client.get('/api/v1/shifts/')
        self.assertEqual(response.status_code, 200)
```

## Project Structure

```
/frontend/src/
  /components/     # Reusable UI components
  /contexts/       # React Context providers
  /layouts/        # Page layouts
  /pages/          # Route pages (admin/, staff/, manager/)
  /services/       # API service layer
  /types/          # TypeScript type definitions

/backend/
  /api/
    models.py      # Django models
    views.py       # ViewSets and API views
    serializers.py # DRF serializers
    urls.py        # URL routing
    /tests/        # Test files

/mobile/src/
  /screens/        # Screen components
  /components/     # Reusable components
  /services/       # API and device services
  /store/          # Redux store and slices
  /types/          # TypeScript types
```

## Key Domain Concepts

- **User Roles**: staff, manager, admin (role-based routing)
- **Shifts**: Core entity with check-in/out, GPS verification
- **Venues**: Locations with coordinates for location verification
- **Invoices**: Generated from approved shifts
- **Multi-tenant**: Companies via `SecurityCompany` model
- **Compliance**: Working hours regulations, SIA licenses

## Common Gotchas

1. **API paths**: Use `/api/v1/` prefix in frontend for Vite proxy
2. **Field naming**: Backend uses snake_case, frontend expects camelCase
3. **Auth tokens**: Stored in localStorage as fallback for Safari
4. **Pagination**: Check for `results` array in API responses
5. **Migrations**: Run `makemigrations` then `migrate` for model changes
