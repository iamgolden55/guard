⏺ Leave Management & Contractor Availability System - Complete Summary           
                                                                                 
  Overview                                                                       
                                                                                 
  This system implements differentiated leave/availability management based on   
  employment type:                                                               
  - Permanent employees: Formal leave system with paid holidays + annual leave on
   invoices                                                                      
  - Contractors: Simple unavailability marking (no paid leave, just scheduling   
  info with hard block)                                                          
  - Temporary staff: Configurable (defaults to contractor behavior)              
                                                                                 
  ---                                                                            
  Phase 1: Database Model Changes ✅                                             
                                                                                 
  1.1 Enhanced EmploymentType Model                                              
                                                                                 
  File: backend/api/models.py                                                    
  - Added employment_category field with choices: permanent, contractor,         
  temporary                                                                      
  - Allows differentiation between employment types for navigation and business  
  logic                                                                          
                                                                                 
  1.2 New Model: ContractorUnavailability                                        
                                                                                 
  File: backend/api/models.py                                                    
  - Tracks periods when contractors are unavailable for shifts                   
  - Fields: staff_user, company, start_date, end_date, reason, created_at        
  - Prevents overlapping periods via validation                                  
                                                                                 
  1.3 New Model: BankHoliday                                                     
                                                                                 
  File: backend/api/models.py                                                    
  - Manages bank holidays per company                                            
  - Fields: company, name, date, is_active                                       
  - Includes method to populate UK defaults                                      
                                                                                 
  1.4 New Model: StaffLeaveDailyRate                                             
                                                                                 
  File: backend/api/models.py                                                    
  - Stores admin-configured daily rate for leave pay per staff member            
  - Fields: staff_user, company, daily_rate, effective_from, updated_by          
                                                                                 
  1.5 Modified InvoiceItem Model                                                 
                                                                                 
  File: backend/api/models.py                                                    
  - Added item_type field with choices: shift, bank_holiday, annual_leave        
  - Added leave_request ForeignKey (nullable)                                    
  - Added bank_holiday ForeignKey (nullable) - used string reference to fix model
   ordering                                                                      
  - Added description field for leave item descriptions                          
                                                                                 
  ---                                                                            
  Phase 2: API Endpoints ✅                                                      
                                                                                 
  New Serializers                                                                
                                                                                 
  File: backend/api/serializers.py                                               
  - ContractorUnavailabilitySerializer - handles unavailability CRUD             
  - BankHolidaySerializer - handles bank holiday CRUD                            
  - StaffLeaveDailyRateSerializer - handles daily rate management                
  - Updated StaffProfileSerializer to include employment_type with               
  employment_category                                                            
                                                                                 
  New ViewSets                                                                   
                                                                                 
  File: backend/api/views.py                                                     
  - ContractorUnavailabilityViewSet - CRUD for contractor unavailability         
  - BankHolidayViewSet - CRUD for bank holidays with populate_uk_defaults action 
  - StaffLeaveDailyRateViewSet - CRUD for staff leave rates                      
                                                                                 
  URL Routes                                                                     
                                                                                 
  File: backend/api/urls.py                                                      
  GET/POST   /api/v1/contractor-unavailability/                                  
  GET/PUT/DELETE /api/v1/contractor-unavailability/{id}/                         
  GET        /api/v1/contractor-unavailability/check/?date=YYYY-MM-DD            
                                                                                 
  GET/POST   /api/v1/bank-holidays/                                              
  PUT/DELETE /api/v1/bank-holidays/{id}/                                         
  POST       /api/v1/bank-holidays/populate-uk-defaults/                         
                                                                                 
  GET        /api/v1/staff-leave-rates/                                          
  GET/PUT    /api/v1/staff-leave-rates/{user_id}/                                
                                                                                 
  ---                                                                            
  Phase 3: Business Logic ✅                                                     
                                                                                 
  Shift Assignment Blocking                                                      
                                                                                 
  File: backend/api/models.py - Shift.clean() method                             
  - Checks if staff is contractor → verifies not in ContractorUnavailability for 
  shift dates                                                                    
  - Checks if staff is permanent → verifies no approved LeaveRequest for shift   
  dates                                                                          
  - Raises ValidationError with clear message if blocked                         
                                                                                 
  Invoice Generation with Leave Items                                            
                                                                                 
  File: backend/api/models.py - Invoice.generate_for_staff_period()              
  - For permanent employees:                                                     
    a. Gets StaffLeaveDailyRate (skips leave items if not set)                   
    b. Finds BankHoliday entries in invoice period → creates InvoiceItems        
    c. Finds approved LeaveRequest entries in period → creates InvoiceItems per  
  day                                                                            
    d. Each leave day = one line item at daily_rate                              
                                                                                 
  ---                                                                            
  Phase 4: Mobile App Changes ✅                                                 
                                                                                 
  New Service                                                                    
                                                                                 
  File: mobile/src/services/contractorUnavailabilityService.ts                   
  - getMyUnavailability() - fetch all unavailability periods                     
  - createUnavailability() - add new period                                      
  - updateUnavailability() - edit existing period                                
  - deleteUnavailability() - remove period                                       
  - checkAvailability() - check if available on specific date                    
  - getUpcomingUnavailability() - filter to future dates only                    
                                                                                 
  New Screen: ContractorUnavailabilityScreen                                     
                                                                                 
  File: mobile/src/screens/leave/ContractorUnavailabilityScreen.tsx              
  - Calendar-style list of unavailable periods                                   
  - Add unavailability form with date range picker                               
  - Edit/delete existing periods                                                 
  - Optional reason field                                                        
  - Info banner explaining shift blocking                                        
                                                                                 
  Updated Types                                                                  
                                                                                 
  File: mobile/src/store/slices/authSlice.ts                                     
  - Added EmploymentCategory type: 'permanent' | 'contractor' | 'temporary'      
  - Added EmploymentType interface with employment_category                      
  - Added employment_type to StaffProfile interface                              
                                                                                 
  Conditional Navigation                                                         
                                                                                 
  File: mobile/src/screens/profile/ProfileScreen.tsx                             
  - Contractors/Temporary: Shows "Manage Availability" option                    
  - Permanent employees: Shows "Leave Balance", "Request Leave", "Leave History" 
                                                                                 
  Navigation Registration                                                        
                                                                                 
  Files:                                                                         
  - mobile/src/navigation/MainNavigator.tsx - Added screen import and route      
  - mobile/src/types/navigation.ts - Added ContractorUnavailability to param list
                                                                                 
  ---                                                                            
  Phase 5: Frontend Admin UI ✅                                                  
                                                                                 
  New Page: Bank Holiday Management                                              
                                                                                 
  File: frontend/src/pages/admin/BankHolidayManagement.tsx                       
  - List all bank holidays with year filter                                      
  - Add/edit/delete holidays                                                     
  - "Populate UK Defaults" button                                                
  - Toggle active status                                                         
                                                                                 
  Navigation Link                                                                
                                                                                 
  File: frontend/src/layouts/MainLayout.tsx                                      
  - Added "Bank Holidays" link in admin sidebar                                  
  - Added path detection for /admin/bank-holidays                                
                                                                                 
  Router Registration                                                            
                                                                                 
  File: frontend/src/Router.tsx                                                  
  - Added lazy import for BankHolidayManagement                                  
  - Added route /admin/bank-holidays                                             
                                                                                 
  Employment Types Enhancement                                                   
                                                                                 
  File: frontend/src/components/EmploymentTypesManagement.tsx (previous session) 
  - Added "Employment Category" dropdown in create/edit dialogs                  
  - Added "Category" column to table with visual badges                          
  - Updated TypeScript interfaces                                                
                                                                                 
  Frontend Services                                                              
                                                                                 
  Files: (previous session)                                                      
  - frontend/src/services/bankHolidayService.ts                                  
  - frontend/src/services/staffLeaveRateService.ts                               
  - Updated frontend/src/services/employmentTypeService.ts                       
                                                                                 
  ---                                                                            
  Phase 6: Invoice PDF Update ✅                                                 
                                                                                 
  File: backend/templates/invoice_pdf.html                                       
  - Updated template to handle three item types:                                 
    - Shift: {venue} | £{rate}/hr | {hours}hrs | £{amount}                       
    - Bank Holiday: Bank Holiday: {name} | £{rate}/day | 1 day | £{amount}       
    - Annual Leave: Annual Leave | £{rate}/day | 1 day | £{amount}               
  - Added total_leave_days note in invoice footer                                
                                                                                 
  File: backend/api/views.py                                                     
  - Updated PDF generation views to calculate and pass total_leave_days to       
  template context                                                               
                                                                                 
  ---                                                                            
  Database Migration ✅                                                          
                                                                                 
  File:                                                                          
  backend/api/migrations/0047_bankholiday_contractorunavailability_and_more.py   
  - Creates BankHoliday model                                                    
  - Creates ContractorUnavailability model                                       
  - Creates StaffLeaveDailyRate model                                            
  - Adds employment_category to EmploymentType                                   
  - Adds item_type, description, bank_holiday, leave_request to InvoiceItem      
                                                                                 
  ---                                                                            
  Bug Fixes During Implementation                                                
                                                                                 
  Model Ordering Issue                                                           
                                                                                 
  Problem: NameError: name 'BankHoliday' is not defined when running             
  makemigrations                                                                 
  Cause: InvoiceItem model referenced BankHoliday before it was defined in the   
  file                                                                           
  Fix: Changed BankHoliday to 'BankHoliday' (string reference) in the ForeignKey 
  definition - Django resolves string references after all models are loaded     
                                                                                 
  ---                                                                            
  Files Modified/Created Summary                                                 
                                                                                 
  Backend (9 files)                                                              
  File: backend/api/models.py                                                    
  Action: Modified - added 4 new models, enhanced EmploymentType, modified       
    InvoiceItem                                                                  
  ────────────────────────────────────────                                       
  File: backend/api/serializers.py                                               
  Action: Modified - added 4 new serializers, updated StaffProfileSerializer     
  ────────────────────────────────────────                                       
  File: backend/api/views.py                                                     
  Action: Modified - added 3 new ViewSets, updated PDF generation                
  ────────────────────────────────────────                                       
  File: backend/api/urls.py                                                      
  Action: Modified - added new endpoint routes                                   
  ────────────────────────────────────────                                       
  File: backend/templates/invoice_pdf.html                                       
  Action: Modified - support for leave line items                                
  ────────────────────────────────────────                                       
  File: backend/api/migrations/0047_*.py                                         
  Action: Created - database migration                                           
  Frontend (5 files)                                                             
  File: frontend/src/pages/admin/BankHolidayManagement.tsx                       
  Action: Created                                                                
  ────────────────────────────────────────                                       
  File: frontend/src/Router.tsx                                                  
  Action: Modified - added route                                                 
  ────────────────────────────────────────                                       
  File: frontend/src/layouts/MainLayout.tsx                                      
  Action: Modified - added nav link                                              
  ────────────────────────────────────────                                       
  File: frontend/src/services/bankHolidayService.ts                              
  Action: Created (previous session)                                             
  ────────────────────────────────────────                                       
  File: frontend/src/components/EmploymentTypesManagement.tsx                    
  Action: Modified (previous session)                                            
  Mobile (6 files)                                                               
  File: mobile/src/services/contractorUnavailabilityService.ts                   
  Action: Created                                                                
  ────────────────────────────────────────                                       
  File: mobile/src/screens/leave/ContractorUnavailabilityScreen.tsx              
  Action: Created                                                                
  ────────────────────────────────────────                                       
  File: mobile/src/store/slices/authSlice.ts                                     
  Action: Modified - added types                                                 
  ────────────────────────────────────────                                       
  File: mobile/src/screens/profile/ProfileScreen.tsx                             
  Action: Modified - conditional navigation                                      
  ────────────────────────────────────────                                       
  File: mobile/src/navigation/MainNavigator.tsx                                  
  Action: Modified - added screen                                                
  ────────────────────────────────────────                                       
  File: mobile/src/types/navigation.ts                                           
  Action: Modified - added type    