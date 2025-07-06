# Payroll Agent

The Payroll Agent specializes in payment calculations, invoice management, and salary-related operations for the shift management system.

## 💰 Overview

The Payroll Agent handles all financial aspects of staff management, including calculating pay summaries, managing invoice statuses, and processing payment operations. It provides both individual staff queries and bulk payroll operations.

## 🎯 Capabilities

### Core Capabilities
- **Pay Summary Calculations**: Calculate total pay for staff over specified periods
- **Invoice Management**: Mark invoices as paid, check payment status
- **Payment Tracking**: Monitor outstanding payments and payment history
- **Payroll Reports**: Generate comprehensive payroll summaries
- **Multi-Staff Operations**: Handle bulk payment operations
- **Time Period Analysis**: Calculate pay across different time periods

### Supported Query Types
1. **Pay Summary Queries**: Individual and group pay calculations
2. **Payment Status Queries**: Invoice and payment tracking
3. **Mark as Paid Operations**: Update payment statuses
4. **Payroll Reports**: Comprehensive financial summaries
5. **Rate Management**: Pay rate updates and queries

## 🔍 Query Classification

### Intent Recognition
The Payroll Agent identifies payment-related intents using specific patterns:

```python
# Pay summary patterns
pay_summary_patterns = [
    r'total.*pay',
    r'salary.*summary', 
    r'earnings.*for',
    r'how much.*paid',
    r'weekly.*pay',
    r'monthly.*pay'
]

# Mark as paid patterns
mark_paid_patterns = [
    r'mark.*paid',
    r'salary.*paid',
    r'payment.*complete',
    r'paid.*status'
]
```

### Confidence Scoring
Confidence is calculated based on:
- **Financial Keywords**: pay, salary, invoice, payment
- **Action Keywords**: mark, calculate, show, total
- **Time Indicators**: week, month, period
- **Staff References**: specific staff names

## 📝 Supported Queries

### Pay Summary Calculations
**Query Examples**:
```
"What is the total pay for John last week?"
"Calculate Sarah's monthly earnings"
"Show me pay summary for Mike this month"
"How much did Lisa earn in the last 30 days?"
```

**Response Format**:
```json
{
  "staff_id": 123,
  "period": {"start": "2024-01-01", "end": "2024-01-07"},
  "total_pay": 480.00,
  "total_hours": 40.0,
  "regular_hours": 40.0,
  "overtime_hours": 0.0,
  "shifts_worked": 5,
  "venues": ["Store1", "Store2"],
  "average_hourly_rate": 12.00
}
```

**Human-Readable Response**:
```
Pay Summary for John Smith from 2024-01-01 to 2024-01-07:

💰 Total Pay: $480.00
⏰ Total Hours: 40.0 hours
📊 Regular Hours: 40.0 hours
⚡ Overtime Hours: 0.0 hours
🏢 Shifts Worked: 5
💵 Average Rate: $12.00/hour
🏪 Venues: Store1, Store2
```

### Mark as Paid Operations
**Query Examples**:
```
"Mark John and Sarah's salary as paid"
"Update payment status for Mike's invoice"
"Mark all pending invoices as paid for Lisa"
"Set Alex's salary to paid status"
```

**Response Format**:
```json
{
  "results": [
    {
      "staff_name": "John Smith",
      "success": true,
      "message": "Successfully marked 3 invoices as paid"
    },
    {
      "staff_name": "Sarah Johnson", 
      "success": true,
      "message": "Successfully marked 2 invoices as paid"
    }
  ]
}
```

**Human-Readable Response**:
```
Successfully marked payments as paid for 2 staff member(s):
• John Smith: Successfully marked 3 invoices as paid
• Sarah Johnson: Successfully marked 2 invoices as paid
```

### Invoice Status Queries
**Query Examples**:
```
"Show me invoice status"
"What payments are pending?"
"List all outstanding invoices"
"Check payment status for this week"
```

**Response Format**:
```json
{
  "total_invoices": 45,
  "paid_invoices": 38,
  "pending_invoices": 6,
  "overdue_invoices": 1,
  "total_amount_due": 1250.00
}
```

**Human-Readable Response**:
```
Invoice Status Summary:

📋 Total Invoices: 45
✅ Paid: 38
⏳ Pending: 6
🔴 Overdue: 1
💰 Total Amount Due: $1,250.00
```

## 🛠️ Implementation Details

### Agent Structure
```python
class PayrollAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="payroll_agent",
            description="Handle payroll, payments, and invoice queries",
            capabilities=[
                "Calculate staff payment summaries",
                "Mark invoices as paid",
                "Check payment status", 
                "Update pay rates",
                "Generate payroll reports",
                "Handle salary queries"
            ]
        )
        
        self.staff_tool = StaffTool()
        self.payroll_tool = PayrollTool()
        self.query_parser = QueryParser()
```

### Query Processing Flow
1. **Intent Classification**: Identify payroll-specific intent
2. **Staff Resolution**: Find staff members by name
3. **Parameter Extraction**: Extract time periods and amounts
4. **Data Retrieval**: Fetch invoices and payment data
5. **Calculation**: Perform financial calculations
6. **Status Updates**: Update payment statuses if required
7. **Response Formatting**: Create readable response

### Tool Integration
The Payroll Agent uses the `PayrollTool` for financial operations:

```python
async def _handle_pay_summary(self, parsed_query, session_id: str):
    # Find staff member
    staff_result = await self.staff_tool.find_staff_by_name(staff_name)
    
    # Calculate pay summary
    pay_summary = await self.payroll_tool.execute({
        'action': 'calculate_pay_summary',
        'staff_id': staff_id,
        'period': period
    })
    
    # Format response
    return self._format_pay_summary_response(staff_name, pay_summary)
```

## 💼 Financial Calculations

### Pay Summary Calculation
The agent calculates comprehensive pay summaries including:

1. **Total Pay**: Sum of all earnings for the period
2. **Total Hours**: Sum of worked hours
3. **Regular Hours**: Standard working hours
4. **Overtime Hours**: Hours exceeding standard limits
5. **Average Rate**: Total pay divided by total hours
6. **Venue Breakdown**: Pay distribution across venues

```python
async def calculate_pay_summary(self, staff_id: int, period: str):
    # Get invoices for period
    invoices = await self.api_client.get_invoices({
        "staff_user": staff_id,
        "start_date__gte": period_start,
        "end_date__lte": period_end
    })
    
    # Calculate totals
    total_pay = sum(float(i.get("total_amount", 0)) for i in invoices)
    total_hours = sum(float(i.get("total_hours", 0)) for i in invoices)
    
    # Calculate overtime (assuming 40 hours standard)
    regular_hours = min(total_hours, 40)
    overtime_hours = max(0, total_hours - 40)
    
    return {
        "total_pay": round(total_pay, 2),
        "total_hours": round(total_hours, 1),
        "regular_hours": round(regular_hours, 1),
        "overtime_hours": round(overtime_hours, 1),
        "average_hourly_rate": round(total_pay / total_hours, 2) if total_hours > 0 else 0
    }
```

### Time Period Support
- **Relative Periods**: "last week", "this month", "last quarter"
- **Specific Dates**: Custom date ranges
- **Payroll Periods**: Standard payroll cycles

### Payment Status Management
```python
async def mark_as_paid(self, staff_id: int, payment_type: str):
    # Get pending invoices
    invoices = await self.api_client.get_invoices({
        "staff_user": staff_id,
        "status": "pending"
    })
    
    # Update each invoice
    updated_count = 0
    for invoice in invoices:
        await self.api_client.update_invoice_status(invoice["id"], "paid")
        updated_count += 1
    
    return {
        "success": True,
        "invoices_updated": updated_count
    }
```

## 📊 Data Sources and Integration

### Invoice Data
- **Invoice Records**: Payment amounts and hours
- **Payment Status**: Paid, pending, overdue
- **Invoice Items**: Detailed line items
- **Staff Associations**: Invoice-to-staff mappings

### Shift Data Integration
When invoice data is unavailable, the agent calculates from shift data:
- **Shift Hours**: Calculate from start/end times
- **Pay Rates**: Retrieve from pay rate configurations
- **Venue Rates**: Different rates for different venues

### Pay Rate Management
```python
async def update_pay_rate(self, staff_id: int, venue_id: int, new_rate: float):
    # Find existing pay rate
    pay_rates = await self.api_client.get_pay_rates(staff_id)
    existing_rate = next((rate for rate in pay_rates if rate.get("venue") == venue_id), None)
    
    if existing_rate:
        # Update existing rate
        result = await self.api_client.patch(f"/api/v1/pay-rates/{existing_rate['id']}/", {
            "hourly_rate": new_rate
        })
    else:
        # Create new rate
        result = await self.api_client.post("/api/v1/pay-rates/", {
            "staff_user": staff_id,
            "venue": venue_id,
            "hourly_rate": new_rate
        })
    
    return result
```

## 🔧 Configuration

### Payroll Settings
```python
class PayrollConfig:
    # Standard work week
    STANDARD_WORK_HOURS_PER_WEEK = 40
    
    # Overtime multiplier
    OVERTIME_MULTIPLIER = 1.5
    
    # Default pay rate (fallback)
    DEFAULT_HOURLY_RATE = 12.00
    
    # Payment status options
    PAYMENT_STATUSES = ["pending", "paid", "overdue"]
    
    # Payroll periods
    PAYROLL_PERIODS = {
        "weekly": 7,
        "biweekly": 14,
        "monthly": 30
    }
```

## 🚀 Performance Features

### Bulk Operations
The agent supports efficient bulk operations for multiple staff:

```python
async def process_bulk_payments(self, staff_list: List[str]):
    results = []
    
    for staff_name in staff_list:
        # Process each staff member
        staff_result = await self.staff_tool.find_staff_by_name(staff_name)
        if staff_result.get('found'):
            payment_result = await self.mark_as_paid(staff_result['staff']['id'])
            results.append({
                'staff_name': staff_name,
                'success': payment_result.get('success', False),
                'invoices_updated': payment_result.get('invoices_updated', 0)
            })
    
    return results
```

### Caching Strategy
- **Pay Rate Caching**: Cache frequently accessed pay rates
- **Invoice Caching**: Cache recent invoice queries
- **Staff Information**: Cache staff lookups

## 🧪 Testing

### Unit Tests
```python
async def test_pay_summary_calculation():
    agent = PayrollAgent()
    
    response = await agent.process_query(
        "What is the total pay for John last week?",
        "test_session"
    )
    
    assert response.success == True
    assert "Pay Summary" in response.message
    assert response.data['total_pay'] > 0
```

### Financial Accuracy Tests
- **Calculation Verification**: Ensure accurate financial calculations
- **Rounding Tests**: Verify proper currency rounding
- **Edge Cases**: Handle zero hours, negative values

## 📈 Use Case Examples

### Individual Pay Queries
```
"How much did John earn this week?"
"Show me Sarah's monthly pay summary"
"What are Mike's total earnings for Q1?"
```

### Bulk Payment Operations
```
"Mark John, Sarah, and Mike's salaries as paid"
"Update payment status for all Store1 staff"
"Process payments for the evening shift team"
```

### Financial Reporting
```
"Show me this month's payroll summary" 
"What's the total amount owed to staff?"
"Generate a payment report for last week"
```

### Administrative Operations
```
"Which invoices are overdue?"
"Show me all pending payments"
"Update John's hourly rate to $15"
```

The Payroll Agent provides comprehensive financial management capabilities, ensuring accurate payment tracking and efficient payroll operations for the shift management system.