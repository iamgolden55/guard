# 🛡️ Guard - Security Staff Management System

A comprehensive, modern security staff management platform built for security companies to efficiently manage staff, shifts, venues, compliance, and operations.

## ✨ Features

### 🔐 Authentication & Role Management
- **JWT-based authentication** with refresh tokens
- **Role-based access control** (Staff, Manager, Admin)
- **Secure onboarding workflow** for new companies
- **Multi-tenant architecture** for company isolation

### 👥 Staff Management
- **Complete staff profiles** with SIA licenses and qualifications
- **Digital signature capture** for shift verification
- **Leave management system** with auto-accrual calculations
- **Attendance tracking** with GPS location verification

### 📍 Venue & Shift Management
- **GPS-based check-in/out** with location verification
- **Real-time shift tracking** with digital signatures
- **Shift scheduling and approval workflow**
- **Venue management** with capacity limits and requirements

### 📊 Compliance & Reporting
- **Regional compliance management** (UK, EU regulations)
- **Automated report generation** with multiple export formats
- **Compliance monitoring** and violation tracking
- **Real-time analytics dashboard**

### 💰 Finance & Integration
- **Automated invoicing** based on approved shifts
- **Deputy workforce management** integration
- **Xero, QuickBooks, Sage** accounting integrations
- **Pay rate management** and timesheet processing

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript for type safety
- **Vite** for fast development and building
- **Tailwind CSS** for responsive styling
- **Fluent UI** for consistent Microsoft-style components
- **React Router v7** for client-side routing
- **Formik + Yup** for form validation
- **Chart.js** for data visualization

### Backend Stack
- **Django 5.2** with Django REST Framework
- **PostgreSQL** for robust data storage
- **JWT authentication** with SimpleJWT
- **Django Channels** for WebSocket support
- **Celery** for background task processing
- **Redis** for caching and session storage

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and npm
- **Python** 3.9+ and pip
- **PostgreSQL** 13+
- **Redis** 6+ (for production)

### 1. Clone the Repository
```bash
git clone https://github.com/iamgolden55/guard.git
cd guard
```

### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Environment setup
cp .env.example .env
# Edit .env with your database credentials

# Database setup
python manage.py migrate
python manage.py createsuperuser

# Start development server
python manage.py runserver
```

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### 4. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/swagger/
- **Admin Panel**: http://localhost:8000/admin/

## 📁 Project Structure

```
guard/
├── 📁 frontend/                 # React TypeScript frontend
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   ├── contexts/            # React context providers
│   │   ├── hooks/               # Custom React hooks
│   │   ├── pages/               # Page components
│   │   ├── services/            # API service layer
│   │   ├── types/               # TypeScript type definitions
│   │   └── utils/               # Utility functions
│   ├── public/                  # Static assets
│   └── dist/                    # Built application
│
├── 📁 backend/                  # Django backend
│   ├── api/                     # Main API application
│   │   ├── models.py           # Database models
│   │   ├── serializers.py      # DRF serializers
│   │   ├── views.py            # API views
│   │   └── urls.py             # URL routing
│   ├── core/                    # Django project settings
│   ├── leave_management/        # Leave system module
│   ├── migrations/              # Database migrations
│   └── media/                   # User uploaded files
│
├── 📁 docs/                     # Documentation
├── 📁 agent_memory/             # AI agent coordination
└── 📁 monitoring/               # Performance monitoring
```

## 🔧 Development Commands

### Frontend Commands
```bash
cd frontend

npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run linter and type checking
npm run format       # Format code with Biome
npm run test         # Run Jest tests
npm run preview      # Preview production build
```

### Backend Commands
```bash
cd backend

# Development
python manage.py runserver       # Start Django server
python manage.py shell          # Django shell
python manage.py migrate        # Apply migrations
python manage.py makemigrations # Create new migrations

# Testing
pytest                          # Run all tests
python manage.py test          # Run Django tests

# Production
python manage.py collectstatic  # Collect static files
python manage.py createsuperuser # Create admin user
```

## 🗄️ Database Schema

### Core Models
- **User/StaffProfile**: Extended user model with SIA licenses, qualifications, bank details
- **SecurityCompany**: Multi-tenant company management
- **Venue**: Locations with GPS coordinates and requirements
- **Shift**: Time tracking with location verification and signatures
- **Invoice**: Payment processing with detailed line items

### Leave Management
- **LeavePolicy**: Company leave policies and accrual rules
- **LeaveRequest**: Staff leave applications and approvals
- **LeaveBalance**: Auto-calculated leave balances

### Compliance
- **ComplianceProfile**: Regional compliance requirements
- **WorkingHoursRegulation**: Legal working time limits
- **IncidentReport**: Security incident tracking

## 🌐 API Documentation

The API follows RESTful conventions with comprehensive documentation available at:
- **Swagger UI**: http://localhost:8000/swagger/
- **ReDoc**: http://localhost:8000/redoc/

### Key Endpoints
```
Authentication:
POST /api/v1/auth/login/         # User login
POST /api/v1/auth/refresh/       # Token refresh
POST /api/v1/auth/register/      # User registration

Staff Management:
GET  /api/v1/staff/              # List staff
POST /api/v1/staff/              # Create staff
GET  /api/v1/staff/{id}/         # Staff details

Shift Management:
GET  /api/v1/shifts/             # List shifts
POST /api/v1/shifts/             # Create shift
PUT  /api/v1/shifts/{id}/checkin/ # Check in
PUT  /api/v1/shifts/{id}/checkout/ # Check out

Leave Management:
GET  /api/v1/leave/requests/     # Leave requests
POST /api/v1/leave/requests/     # Submit leave
GET  /api/v1/leave/balances/     # Leave balances
```

## 🔒 Security Features

- **JWT Authentication** with access and refresh tokens
- **Role-based permissions** throughout the application
- **Location verification** for shift check-in/out using GPS
- **Digital signature** capture for legal compliance
- **SIA license validation** and expiry tracking
- **GDPR compliant** data handling and storage
- **Encrypted sensitive data** with Django's built-in encryption

## 🎯 User Roles & Permissions

### 👤 Staff
- Manage personal profile and qualifications
- Check in/out of shifts with location verification
- Submit leave requests and view balances
- View assigned shifts and invoices
- Digital signature for shift verification

### 👨‍💼 Manager
- Approve shifts and leave requests
- View team analytics and reports
- Manage staff assignments
- Monitor compliance violations
- Export timesheet and attendance reports

### 👑 Admin
- Full system access and configuration
- Venue and company management
- Integration setup (Deputy, accounting systems)
- Advanced reporting and analytics
- User management and permissions

## 🔗 Integrations

### Workforce Management
- **Deputy**: Employee synchronization and timesheet import
- **Custom API**: Flexible integration with other workforce systems

### Accounting Systems
- **Xero**: Automated invoice and payment sync
- **QuickBooks**: Financial data integration
- **Sage**: Accounting software connection
- **Zoho Books**: Cloud accounting integration

### Location Services
- **Google Maps**: Venue location and verification
- **GPS Tracking**: Real-time location for check-in/out

## 📊 Performance & Monitoring

### Frontend Optimization
- **Code splitting** with React lazy loading
- **Performance monitoring** with custom hooks
- **Optimized bundle size** with Vite
- **Responsive design** for mobile and desktop

### Backend Optimization
- **Database indexing** for fast queries
- **Caching strategy** with Redis
- **Background tasks** with Celery
- **WebSocket support** for real-time updates

### Monitoring
- **Performance metrics** tracking
- **Error logging** and monitoring
- **API response time** optimization
- **Database query** performance analysis

## 🚢 Deployment

### Production Environment Variables
```env
# Backend (.env)
DJANGO_SECRET_KEY=your-secret-key
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=yourdomain.com
DATABASE_URL=postgresql://user:password@host:port/dbname
REDIS_URL=redis://localhost:6379/0
```

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build individual containers
docker build -t guard-frontend ./frontend
docker build -t guard-backend ./backend
```

### Production Checklist
- [ ] Set `DEBUG=False` in Django settings
- [ ] Configure production database (PostgreSQL)
- [ ] Set up Redis for caching and sessions
- [ ] Configure static file serving (S3/CloudFront)
- [ ] Set up SSL certificates
- [ ] Configure monitoring and logging
- [ ] Set up backup strategy

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit your changes**: `git commit -m 'Add amazing feature'`
4. **Push to the branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines
- Follow TypeScript best practices for frontend
- Use Django conventions for backend development
- Write tests for new features
- Update documentation for API changes
- Follow the existing code style and formatting

## 🧪 Testing

### Frontend Testing
```bash
cd frontend
npm run test                 # Run all tests
npm run test:watch          # Run tests in watch mode
npm run test:coverage       # Run with coverage report
```

### Backend Testing
```bash
cd backend
pytest                      # Run all tests
pytest --cov              # Run with coverage
pytest api/tests/          # Run specific test directory
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- **API Documentation**: `/docs/` directory
- **Frontend Components**: Fluent UI documentation
- **Backend Models**: Django model documentation

### Getting Help
- **Issues**: Create a GitHub issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions
- **Email**: Contact the development team

## 🎯 Roadmap

### Phase 1: Core Features ✅
- [x] Authentication system
- [x] Staff and venue management
- [x] Shift tracking with GPS
- [x] Basic reporting

### Phase 2: Enhanced Features ✅
- [x] Leave management system
- [x] Compliance monitoring
- [x] Digital signatures
- [x] WebSocket real-time updates

### Phase 3: Integrations 🚀
- [x] Deputy workforce integration
- [x] Accounting system connections
- [ ] Mobile app development
- [ ] Advanced analytics

### Phase 4: Enterprise Features 📋
- [ ] Multi-company management
- [ ] Advanced compliance reporting
- [ ] AI-powered scheduling
- [ ] Biometric check-in/out

---

**Built with ❤️ by the Guard Development Team**

For more information, visit our [documentation](./docs/) or check out the [API reference](http://localhost:8000/swagger/).