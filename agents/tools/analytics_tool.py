"""
Analytics tool for data analysis and reporting operations.
"""
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta

from tools.base_tool import BaseTool
from api.client import ShiftManagementAPI

logger = logging.getLogger(__name__)


class AnalyticsTool(BaseTool):
    """Tool for data analysis and reporting"""
    
    def __init__(self):
        super().__init__(
            name="analytics_tool",
            description="Perform data analysis and generate insights"
        )
        self.api_client = ShiftManagementAPI()
    
    async def execute(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute analytics operations"""
        action = parameters.get("action", "analyze")
        
        if action == "late_starts":
            return await self.get_late_start_count(
                parameters.get("staff_id"),
                parameters.get("start_date"),
                parameters.get("end_date")
            )
        elif action == "pay_summary":
            return await self.calculate_pay_summary(
                parameters.get("staff_id"),
                parameters.get("period_start"),
                parameters.get("period_end")
            )
        elif action == "attendance_stats":
            return await self.get_attendance_stats(parameters)
        elif action == "performance_trends":
            return await self.analyze_performance_trends(
                parameters.get("metric"),
                parameters.get("time_range")
            )
        else:
            return {"error": f"Unknown analytics action: {action}"}
    
    async def get_late_start_count(
        self,
        staff_id: int,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """Count how many times a staff member started their shift late"""
        try:
            # Set default date range if not provided
            if not end_date:
                end_date = datetime.now().strftime("%Y-%m-%d")
            if not start_date:
                # Default to 3 months ago
                start_dt = datetime.now() - timedelta(days=90)
                start_date = start_dt.strftime("%Y-%m-%d")
            
            # Get shifts for the staff member in the date range
            filters = {
                "staff_user": staff_id,
                "start_time__gte": start_date,
                "start_time__lte": end_date
            }
            
            shifts = await self.api_client.get_shifts(filters)
            
            late_count = 0
            total_shifts = len(shifts)
            late_minutes_total = 0
            late_shifts = []
            
            for shift in shifts:
                if self._is_late_start(shift):
                    late_count += 1
                    late_minutes = self._calculate_late_minutes(shift)
                    late_minutes_total += late_minutes
                    late_shifts.append({
                        "date": shift.get("start_time", "").split("T")[0],
                        "venue": shift.get("venue_name", "Unknown"),
                        "scheduled_time": shift.get("start_time", ""),
                        "actual_time": shift.get("check_in_time", ""),
                        "late_minutes": late_minutes
                    })
            
            # Calculate statistics
            late_percentage = (late_count / total_shifts * 100) if total_shifts > 0 else 0
            avg_late_minutes = (late_minutes_total / late_count) if late_count > 0 else 0
            
            return {
                "staff_id": staff_id,
                "period": {"start": start_date, "end": end_date},
                "total_shifts": total_shifts,
                "late_starts": late_count,
                "late_percentage": round(late_percentage, 1),
                "average_late_minutes": round(avg_late_minutes, 1),
                "total_late_minutes": late_minutes_total,
                "late_shift_details": late_shifts
            }
            
        except Exception as e:
            logger.error(f"Error analyzing late starts: {e}")
            return {"error": f"Failed to analyze late starts: {str(e)}"}
    
    async def calculate_pay_summary(
        self,
        staff_id: int,
        period_start: str,
        period_end: str
    ) -> Dict[str, Any]:
        """Calculate total pay for a staff member over a period"""
        try:
            # Get invoices for the staff member in the period
            invoices = await self.api_client.get_invoices({
                "staff_user": staff_id,
                "start_date__gte": period_start,
                "end_date__lte": period_end
            })
            
            total_pay = 0
            total_hours = 0
            shift_count = 0
            venues = set()
            
            # Get detailed invoice items if available
            for invoice in invoices:
                total_pay += float(invoice.get("total_amount", 0))
                total_hours += float(invoice.get("total_hours", 0))
                
                # Get invoice items for more details
                invoice_items = await self.api_client.get_invoice_items(invoice["id"])
                for item in invoice_items:
                    shift_count += 1
                    venues.add(item.get("venue_name", "Unknown"))
            
            # If no invoices, calculate from shifts directly
            if not invoices:
                shifts = await self.api_client.get_shifts({
                    "staff_user": staff_id,
                    "start_time__gte": period_start,
                    "start_time__lte": period_end,
                    "status__in": ["completed", "approved"]
                })
                
                for shift in shifts:
                    shift_hours = self._calculate_shift_hours(shift)
                    total_hours += shift_hours
                    shift_count += 1
                    venues.add(shift.get("venue_name", "Unknown"))
                
                # Estimate pay (would need pay rates from database)
                avg_rate = 12.0  # Default rate - should come from PayRate model
                total_pay = total_hours * avg_rate
            
            # Calculate overtime (assuming 8 hours per day standard)
            regular_hours = min(total_hours, shift_count * 8)
            overtime_hours = max(0, total_hours - regular_hours)
            
            return {
                "staff_id": staff_id,
                "period": {"start": period_start, "end": period_end},
                "total_pay": round(total_pay, 2),
                "total_hours": round(total_hours, 1),
                "regular_hours": round(regular_hours, 1),
                "overtime_hours": round(overtime_hours, 1),
                "shifts_worked": shift_count,
                "venues": list(venues),
                "average_hourly_rate": round(total_pay / total_hours, 2) if total_hours > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Error calculating pay summary: {e}")
            return {"error": f"Failed to calculate pay: {str(e)}"}
    
    async def get_attendance_stats(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        """Get attendance statistics"""
        try:
            # Apply filters to get relevant shifts
            shift_filters = {}
            
            if filters.get("staff_filter"):
                # Find staff by name
                staff_result = await self.api_client.get_staff(search_query=filters["staff_filter"])
                if staff_result:
                    shift_filters["staff_user"] = staff_result[0]["id"]
            
            if filters.get("venue_filter"):
                venues = await self.api_client.get_venues()
                venue = next((v for v in venues if filters["venue_filter"].lower() in v["name"].lower()), None)
                if venue:
                    shift_filters["venue"] = venue["id"]
            
            if filters.get("start_date"):
                shift_filters["start_time__gte"] = filters["start_date"]
            if filters.get("end_date"):
                shift_filters["start_time__lte"] = filters["end_date"]
            
            shifts = await self.api_client.get_shifts(shift_filters)
            
            # Calculate statistics
            total_shifts = len(shifts)
            completed_shifts = len([s for s in shifts if s.get("status") == "completed"])
            cancelled_shifts = len([s for s in shifts if s.get("status") == "cancelled"])
            no_show_shifts = len([s for s in shifts if s.get("check_in_time") is None and s.get("status") != "cancelled"])
            late_starts = len([s for s in shifts if self._is_late_start(s)])
            
            attendance_rate = (completed_shifts / total_shifts * 100) if total_shifts > 0 else 0
            punctuality_rate = ((completed_shifts - late_starts) / completed_shifts * 100) if completed_shifts > 0 else 0
            
            return {
                "period": filters,
                "total_shifts": total_shifts,
                "completed_shifts": completed_shifts,
                "cancelled_shifts": cancelled_shifts,
                "no_show_shifts": no_show_shifts,
                "late_starts": late_starts,
                "attendance_rate": round(attendance_rate, 1),
                "punctuality_rate": round(punctuality_rate, 1),
                "cancellation_rate": round(cancelled_shifts / total_shifts * 100, 1) if total_shifts > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Error getting attendance stats: {e}")
            return {"error": f"Failed to get attendance statistics: {str(e)}"}
    
    async def analyze_performance_trends(
        self,
        metric: str,
        time_range: str = "last_month"
    ) -> Dict[str, Any]:
        """Analyze performance trends over time"""
        try:
            # Calculate date range
            end_date = datetime.now()
            if time_range == "last_week":
                start_date = end_date - timedelta(days=7)
            elif time_range == "last_month":
                start_date = end_date - timedelta(days=30)
            elif time_range == "last_quarter":
                start_date = end_date - timedelta(days=90)
            else:
                start_date = end_date - timedelta(days=30)
            
            # Get shifts for the period
            shifts = await self.api_client.get_shifts({
                "start_time__gte": start_date.strftime("%Y-%m-%d"),
                "start_time__lte": end_date.strftime("%Y-%m-%d")
            })
            
            # Analyze based on metric type
            if metric == "reliability":
                return await self._analyze_reliability_trends(shifts)
            elif metric == "punctuality":
                return await self._analyze_punctuality_trends(shifts)
            elif metric == "overtime":
                return await self._analyze_overtime_trends(shifts)
            elif metric == "hours_worked":
                return await self._analyze_hours_trends(shifts)
            else:
                return {"error": f"Unknown metric: {metric}"}
                
        except Exception as e:
            logger.error(f"Error analyzing performance trends: {e}")
            return {"error": f"Failed to analyze trends: {str(e)}"}
    
    def _is_late_start(self, shift: Dict[str, Any]) -> bool:
        """Check if a shift was started late"""
        try:
            start_time = shift.get("start_time")
            check_in_time = shift.get("check_in_time")
            
            if not start_time or not check_in_time:
                return False
            
            start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
            checkin_dt = datetime.fromisoformat(check_in_time.replace("Z", "+00:00"))
            
            # Consider late if more than 15 minutes after scheduled start
            late_threshold = timedelta(minutes=15)
            return checkin_dt > (start_dt + late_threshold)
            
        except Exception:
            return False
    
    def _calculate_late_minutes(self, shift: Dict[str, Any]) -> int:
        """Calculate how many minutes late a shift was started"""
        try:
            start_time = shift.get("start_time")
            check_in_time = shift.get("check_in_time")
            
            if not start_time or not check_in_time:
                return 0
            
            start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
            checkin_dt = datetime.fromisoformat(check_in_time.replace("Z", "+00:00"))
            
            if checkin_dt > start_dt:
                return int((checkin_dt - start_dt).total_seconds() / 60)
            
            return 0
            
        except Exception:
            return 0
    
    def _calculate_shift_hours(self, shift: Dict[str, Any]) -> float:
        """Calculate total hours for a shift"""
        try:
            start_time = shift.get("start_time")
            end_time = shift.get("end_time")
            
            if not start_time or not end_time:
                return 0.0
            
            start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
            end_dt = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
            
            duration = end_dt - start_dt
            return duration.total_seconds() / 3600
            
        except Exception:
            return 0.0
    
    async def _analyze_reliability_trends(self, shifts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze reliability trends"""
        # Group by staff and calculate reliability scores
        staff_stats = {}
        
        for shift in shifts:
            staff_id = shift.get("staff_user")
            if not staff_id:
                continue
                
            if staff_id not in staff_stats:
                staff_stats[staff_id] = {
                    "total_shifts": 0,
                    "completed": 0,
                    "cancelled": 0,
                    "no_shows": 0
                }
            
            staff_stats[staff_id]["total_shifts"] += 1
            
            status = shift.get("status", "")
            if status == "completed":
                staff_stats[staff_id]["completed"] += 1
            elif status == "cancelled":
                staff_stats[staff_id]["cancelled"] += 1
            elif not shift.get("check_in_time"):
                staff_stats[staff_id]["no_shows"] += 1
        
        # Calculate reliability scores
        reliability_scores = []
        for staff_id, stats in staff_stats.items():
            if stats["total_shifts"] > 0:
                reliability = stats["completed"] / stats["total_shifts"] * 100
                reliability_scores.append({
                    "staff_id": staff_id,
                    "reliability_score": round(reliability, 1),
                    "total_shifts": stats["total_shifts"],
                    "completed": stats["completed"]
                })
        
        # Sort by reliability score
        reliability_scores.sort(key=lambda x: x["reliability_score"], reverse=True)
        
        return {
            "metric": "reliability",
            "top_performers": reliability_scores[:5],
            "average_reliability": round(sum(s["reliability_score"] for s in reliability_scores) / len(reliability_scores), 1) if reliability_scores else 0
        }
    
    async def _analyze_punctuality_trends(self, shifts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze punctuality trends"""
        staff_punctuality = {}
        
        for shift in shifts:
            staff_id = shift.get("staff_user")
            if not staff_id or shift.get("status") != "completed":
                continue
            
            if staff_id not in staff_punctuality:
                staff_punctuality[staff_id] = {"on_time": 0, "late": 0}
            
            if self._is_late_start(shift):
                staff_punctuality[staff_id]["late"] += 1
            else:
                staff_punctuality[staff_id]["on_time"] += 1
        
        # Calculate punctuality scores
        punctuality_scores = []
        for staff_id, stats in staff_punctuality.items():
            total = stats["on_time"] + stats["late"]
            if total > 0:
                punctuality = stats["on_time"] / total * 100
                punctuality_scores.append({
                    "staff_id": staff_id,
                    "punctuality_score": round(punctuality, 1),
                    "total_shifts": total,
                    "on_time": stats["on_time"],
                    "late": stats["late"]
                })
        
        punctuality_scores.sort(key=lambda x: x["punctuality_score"], reverse=True)
        
        return {
            "metric": "punctuality",
            "top_performers": punctuality_scores[:5],
            "average_punctuality": round(sum(s["punctuality_score"] for s in punctuality_scores) / len(punctuality_scores), 1) if punctuality_scores else 0
        }
    
    async def _analyze_overtime_trends(self, shifts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze overtime trends"""
        # Implementation for overtime analysis
        return {"metric": "overtime", "message": "Overtime analysis not yet implemented"}
    
    async def _analyze_hours_trends(self, shifts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze hours worked trends"""
        # Implementation for hours analysis
        return {"metric": "hours_worked", "message": "Hours analysis not yet implemented"}