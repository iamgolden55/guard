# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive security staff management system built with:
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Fluent UI
- **Backend**: Django 5.2 + Django REST Framework + PostgreSQL
- **Authentication**: JWT-based authentication with role-based access control
- **Integration**: Deputy workforce management system integration

The system manages security staff shifts, qualifications, venues, invoicing, and includes comprehensive shift tracking with location verification and digital signatures.

## Development Commands

### Frontend (React/Vite)
```bash
cd security-staff-portal
npm run dev          # Start development server on port 3000
npm run build        # Build for production
npm run lint         # Run Biome linter and TypeScript check
npm run format       # Format code with Biome
npm run test         # Run Jest tests
npm run preview      # Preview production build
```

### Backend (Django)
```bash
cd backend
python manage.py runserver                # Start Django server on port 8000
python manage.py migrate                  # Apply database migrations
python manage.py createsuperuser         # Create admin user
python manage.py shell                   # Django shell
python manage.py collectstatic           # Collect static files
pytest                                   # Run tests
```

### Database Management
```bash
cd backend
python manage.py makemigrations          # Create new migrations
python manage.py migrate                 # Apply migrations
python manage.py flush                   # Clear database
```

## Architecture

### Frontend Structure
- **Authentication**: JWT-based with refresh tokens, role-based routing
- **State Management**: React Context API for authentication state
- **UI Framework**: Fluent UI components with custom Tailwind styling
- **Routing**: React Router v7 with protected routes by role (Staff/Manager/Admin)
- **Forms**: Formik + Yup for validation
- **API Layer**: Axios-based service layer in `src/services/`

### Backend Structure
- **Authentication**: Django REST Framework + SimpleJWT
- **Models**: Complex relational model with User, StaffProfile, Venue, Shift, Invoice systems
- **API**: RESTful endpoints with role-based permissions
- **Integration**: Deputy workforce management API integration
- **Location**: Google Maps integration for venue location verification

### Key Components

#### User Roles & Permissions
- **Staff**: Basic users who work shifts, manage profiles, view invoices
- **Manager**: Can approve shifts, manage staff shifts, view reports
- **Admin**: Full system access, venue management, invoicing, Deputy integration

#### Core Models
- **User/StaffProfile**: Extended user model with SIA licenses, qualifications, bank details
- **Venue**: Locations with GPS coordinates, capacity limits, required checks
- **Shift**: Core shift management with check-in/out, location verification, digital signatures
- **Invoice**: Staff payment processing with detailed line items
- **Deputy Integration**: Employee and timesheet synchronization

#### Security Features
- Location verification for shift check-in/out using GPS coordinates
- Digital signature capture for shift start/end
- SIA license validation and expiry tracking
- Role-based access control throughout the system

## API Integration

### Backend API Base URL
- Development: `http://localhost:8000/api/v1/`
- API Documentation: `http://localhost:8000/swagger/`

### Frontend API Configuration
- Configured in `vite.config.ts` as `REACT_APP_API_URL`
- Service layer in `src/services/` handles all API calls
- Authentication tokens managed in AuthContext

## Testing

### Frontend Tests
```bash
cd security-staff-portal
npm test                                 # Run all tests
npm test -- --watch                     # Run tests in watch mode
```

### Backend Tests
```bash
cd backend
pytest                                  # Run all tests
pytest api/tests.py                     # Run specific test file
pytest -v                               # Verbose output
```

## Environment Configuration

### Backend (.env in backend/)
```
DJANGO_SECRET_KEY=your-secret-key
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

### Frontend
Environment variables defined in `vite.config.ts` define section.

## Code Quality Tools

### Frontend
- **Biome**: Linting and formatting (configured in `biome.json`)
- **TypeScript**: Strict type checking
- **Prettier**: Code formatting (via Biome)

### Backend
- **Black**: Code formatting
- **Flake8**: Linting
- **isort**: Import sorting

## Deployment

### Frontend Deployment
```bash
cd security-staff-portal
./deploy.sh                             # Creates deployment zip in ../deploy/
```

### Backend Deployment
Standard Django deployment with PostgreSQL database and proper environment variables.

## Important Notes

- The system uses location verification for shift management - staff must be physically at venues to check in/out
- SIA licenses must be valid and not expired for staff to work security shifts
- All shifts require manager approval before payment processing
- Deputy integration allows synchronization with external workforce management
- Digital signatures are captured for legal compliance on shift start/end
- The system handles complex shift exchanges and open shift claiming
- Invoice generation is automated based on approved shifts and configured pay rates

## Database Schema

The system uses a complex relational schema with the following key relationships:
- Users have one-to-one StaffProfile with multiple SIA licenses and qualifications
- Venues have multiple shifts and define required check types
- Shifts connect users to venues with time tracking and location verification
- Invoices aggregate approved shifts for payment processing
- Deputy integration maintains employee and timesheet synchronization

Refer to `docs/models_documentation.md` for detailed model relationships and `database_schema/api_endpoints_documentation.md` for complete API documentation.