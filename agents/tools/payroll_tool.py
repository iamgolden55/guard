"""
Payroll tool for handling payment, invoice, and salary operations.
"""
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta

from tools.base_tool import BaseTool
from api.client import ShiftManagementAPI

logger = logging.getLogger(__name__)


class PayrollTool(BaseTool):
    """Tool for payroll and payment operations"""
    
    def __init__(self):
        super().__init__(
            name="payroll_tool",
            description="Handle payroll, payments, and invoice operations"
        )
        self.api_client = ShiftManagementAPI()
    
    async def execute(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute payroll operations"""
        action = parameters.get("action", "calculate_pay_summary")
        
        if action == "calculate_pay_summary":
            return await self.calculate_pay_summary(
                parameters.get("staff_id"),
                parameters.get("period", "week")
            )
        elif action == "mark_as_paid":
            return await self.mark_as_paid(
                parameters.get("staff_id"),
                parameters.get("payment_type", "salary")
            )
        elif action == "get_invoice_status":
            return await self.get_invoice_status(
                parameters.get("staff_names"),
                parameters.get("filters", {})
            )
        elif action == "update_pay_rate":
            return await self.update_pay_rate(
                parameters.get("staff_id"),
                parameters.get("venue_id"),
                parameters.get("new_rate")
            )
        elif action == "generate_payroll_report":
            return await self.generate_payroll_report(
                parameters.get("period"),
                parameters.get("filters", {})
            )
        else:
            return {"error": f"Unknown payroll action: {action}"}
    
    async def calculate_pay_summary(self, staff_id: int, period: str) -> Dict[str, Any]:
        """Calculate pay summary for a staff member"""
        try:
            # Calculate date range based on period
            period_start, period_end = self._calculate_period_dates(period)
            
            # Get invoices for the staff member
            invoices = await self.api_client.get_invoices({
                "staff_user": staff_id,
                "start_date__gte": period_start,
                "end_date__lte": period_end
            })
            
            total_pay = 0
            total_hours = 0
            invoices_count = len(invoices)
            
            # Calculate from invoices if available
            if invoices:
                for invoice in invoices:
                    total_pay += float(invoice.get("total_amount", 0))
                    total_hours += float(invoice.get("total_hours", 0))
                
                # Get shifts for additional details
                shifts = await self.api_client.get_shifts({
                    "staff_user": staff_id,
                    "start_time__gte": period_start,
                    "start_time__lte": period_end,
                    "status__in": ["completed", "approved"]
                })
                
                shift_count = len(shifts)
                venues = set()
                
                for shift in shifts:
                    venue_name = shift.get("venue_name", "Unknown")
                    if venue_name != "Unknown":
                        venues.add(venue_name)
            
            else:
                # Calculate from shifts if no invoices
                shifts = await self.api_client.get_shifts({
                    "staff_user": staff_id,
                    "start_time__gte": period_start,
                    "start_time__lte": period_end,
                    "status__in": ["completed", "approved"]
                })
                
                shift_count = len(shifts)
                venues = set()
                
                for shift in shifts:
                    shift_hours = self._calculate_shift_hours(shift)
                    total_hours += shift_hours
                    
                    venue_name = shift.get("venue_name", "Unknown")
                    if venue_name != "Unknown":
                        venues.add(venue_name)
                
                # Get pay rates for calculation
                pay_rates = await self.api_client.get_pay_rates(staff_id)
                
                if pay_rates:
                    # Use actual pay rates
                    for shift in shifts:
                        venue_id = shift.get("venue")
                        shift_hours = self._calculate_shift_hours(shift)
                        
                        # Find matching pay rate
                        rate = next(
                            (r for r in pay_rates if r.get("venue") == venue_id),
                            None
                        )
                        
                        if rate:
                            hourly_rate = float(rate.get("hourly_rate", 12.0))
                            total_pay += shift_hours * hourly_rate
                        else:
                            # Use default rate
                            total_pay += shift_hours * 12.0
                else:
                    # Use default rate
                    total_pay = total_hours * 12.0
            
            # Calculate overtime (assuming 40 hours per week standard)
            regular_hours = min(total_hours, 40)
            overtime_hours = max(0, total_hours - 40)
            
            # Calculate average hourly rate
            average_rate = total_pay / total_hours if total_hours > 0 else 0
            
            return {
                "staff_id": staff_id,
                "period": {"start": period_start, "end": period_end},
                "total_pay": round(total_pay, 2),
                "total_hours": round(total_hours, 1),
                "regular_hours": round(regular_hours, 1),
                "overtime_hours": round(overtime_hours, 1),
                "shifts_worked": shift_count,
                "invoices_count": invoices_count,
                "venues": list(venues),
                "average_hourly_rate": round(average_rate, 2)
            }
            
        except Exception as e:
            logger.error(f"Error calculating pay summary: {e}")
            return {"error": f"Failed to calculate pay summary: {str(e)}"}
    
    async def mark_as_paid(self, staff_id: int, payment_type: str = "salary") -> Dict[str, Any]:
        """Mark invoices as paid for a staff member"""
        try:
            # Get pending invoices for the staff member
            invoices = await self.api_client.get_invoices({
                "staff_user": staff_id,
                "status": "pending"
            })
            
            if not invoices:
                return {
                    "success": True,
                    "message": "No pending invoices found for this staff member",
                    "invoices_updated": 0
                }
            
            # Mark each invoice as paid
            updated_count = 0
            errors = []
            
            for invoice in invoices:
                try:
                    result = await self.api_client.update_invoice_status(
                        invoice["id"], 
                        "paid"
                    )
                    updated_count += 1
                except Exception as e:
                    errors.append(f"Invoice {invoice['id']}: {str(e)}")
            
            if errors:
                return {
                    "success": updated_count > 0,
                    "message": f"Updated {updated_count} invoices with {len(errors)} errors",
                    "invoices_updated": updated_count,
                    "errors": errors
                }
            else:
                return {
                    "success": True,
                    "message": f"Successfully marked {updated_count} invoices as paid",
                    "invoices_updated": updated_count
                }
                
        except Exception as e:
            logger.error(f"Error marking as paid: {e}")
            return {"error": f"Failed to mark as paid: {str(e)}"}
    
    async def get_invoice_status(
        self, 
        staff_names: Optional[List[str]] = None, 
        filters: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Get invoice status summary"""
        try:
            invoice_filters = {}
            
            # Apply filters if provided
            if filters:
                invoice_filters.update(filters)
            
            # If staff names provided, filter by staff
            if staff_names:
                # This would need to be implemented to find staff IDs first
                # For now, return general status
                pass
            
            # Get all invoices
            invoices = await self.api_client.get_invoices(invoice_filters)
            
            # Calculate statistics
            total_invoices = len(invoices)
            paid_invoices = len([i for i in invoices if i.get("status") == "paid"])
            pending_invoices = len([i for i in invoices if i.get("status") == "pending"])
            overdue_invoices = len([i for i in invoices if i.get("status") == "overdue"])
            
            # Calculate amounts
            total_amount_due = sum(
                float(i.get("total_amount", 0)) 
                for i in invoices 
                if i.get("status") in ["pending", "overdue"]
            )
            
            return {
                "total_invoices": total_invoices,
                "paid_invoices": paid_invoices,
                "pending_invoices": pending_invoices,
                "overdue_invoices": overdue_invoices,
                "total_amount_due": round(total_amount_due, 2),
                "invoices": invoices
            }
            
        except Exception as e:
            logger.error(f"Error getting invoice status: {e}")
            return {"error": f"Failed to get invoice status: {str(e)}"}
    
    async def update_pay_rate(
        self, 
        staff_id: int, 
        venue_id: int, 
        new_rate: float
    ) -> Dict[str, Any]:
        """Update pay rate for a staff member at a venue"""
        try:
            result = await self.api_client.update_pay_rate(staff_id, venue_id, new_rate)
            
            return {
                "success": True,
                "message": f"Successfully updated pay rate to ${new_rate:.2f}/hour",
                "pay_rate": result
            }
            
        except Exception as e:
            logger.error(f"Error updating pay rate: {e}")
            return {"error": f"Failed to update pay rate: {str(e)}"}
    
    async def generate_payroll_report(
        self, 
        period: str, 
        filters: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Generate a comprehensive payroll report"""
        try:
            period_start, period_end = self._calculate_period_dates(period)
            
            # Get all invoices for the period
            invoice_filters = {
                "start_date__gte": period_start,
                "end_date__lte": period_end
            }
            
            if filters:
                invoice_filters.update(filters)
            
            invoices = await self.api_client.get_invoices(invoice_filters)
            
            # Calculate totals
            total_payroll = sum(float(i.get("total_amount", 0)) for i in invoices)
            total_hours = sum(float(i.get("total_hours", 0)) for i in invoices)
            
            # Group by staff
            staff_summary = {}
            for invoice in invoices:
                staff_id = invoice.get("staff_user")
                if staff_id not in staff_summary:
                    staff_summary[staff_id] = {
                        "total_pay": 0,
                        "total_hours": 0,
                        "invoice_count": 0
                    }
                
                staff_summary[staff_id]["total_pay"] += float(invoice.get("total_amount", 0))
                staff_summary[staff_id]["total_hours"] += float(invoice.get("total_hours", 0))
                staff_summary[staff_id]["invoice_count"] += 1
            
            return {
                "period": {"start": period_start, "end": period_end},
                "total_payroll": round(total_payroll, 2),
                "total_hours": round(total_hours, 1),
                "total_invoices": len(invoices),
                "staff_count": len(staff_summary),
                "staff_summary": staff_summary,
                "average_hourly_rate": round(total_payroll / total_hours, 2) if total_hours > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Error generating payroll report: {e}")
            return {"error": f"Failed to generate payroll report: {str(e)}"}
    
    def _calculate_period_dates(self, period: str) -> tuple:
        """Calculate start and end dates for a period"""
        try:
            today = datetime.now()
            
            if period == "week" or period == "this_week":
                start_date = today - timedelta(days=today.weekday())
                end_date = start_date + timedelta(days=6)
            elif period == "last_week":
                start_date = today - timedelta(days=today.weekday() + 7)
                end_date = start_date + timedelta(days=6)
            elif period == "month" or period == "this_month":
                start_date = today.replace(day=1)
                next_month = today.replace(day=28) + timedelta(days=4)
                end_date = next_month - timedelta(days=next_month.day)
            elif period == "last_month":
                start_date = today.replace(day=1) - timedelta(days=1)
                start_date = start_date.replace(day=1)
                end_date = today.replace(day=1) - timedelta(days=1)
            else:
                # Default to current week
                start_date = today - timedelta(days=today.weekday())
                end_date = start_date + timedelta(days=6)
            
            return start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d")
            
        except Exception as e:
            logger.error(f"Error calculating period dates: {e}")
            return today.strftime("%Y-%m-%d"), today.strftime("%Y-%m-%d")
    
    def _calculate_shift_hours(self, shift: Dict[str, Any]) -> float:
        """Calculate hours for a shift"""
        try:
            start_time = shift.get("start_time")
            end_time = shift.get("end_time")
            
            if not start_time or not end_time:
                return 0.0
            
            start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
            end_dt = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
            
            duration = end_dt - start_dt
            return duration.total_seconds() / 3600
            
        except Exception as e:
            logger.error(f"Error calculating shift hours: {e}")
            return 0.0