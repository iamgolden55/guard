"""
Staff tool for managing staff-related operations.
"""
import logging
from typing import Any, Dict, List, Optional

from tools.base_tool import BaseTool
from api.client import ShiftManagementAPI

logger = logging.getLogger(__name__)


class StaffTool(BaseTool):
    """Tool for staff-related operations"""
    
    def __init__(self):
        super().__init__(
            name="staff_tool",
            description="Find and manage staff information"
        )
        self.api_client = ShiftManagementAPI()
    
    async def execute(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute staff tool operations"""
        action = parameters.get("action", "find_by_name")
        
        if action == "find_by_name":
            return await self.find_staff_by_name(parameters.get("name"))
        elif action == "get_availability":
            return await self.get_staff_availability(
                parameters.get("staff_id"),
                parameters.get("date_range")
            )
        elif action == "list_all":
            return await self.list_all_staff(parameters.get("filters", {}))
        else:
            return {"error": f"Unknown action: {action}"}
    
    async def find_staff_by_name(self, name: str) -> Dict[str, Any]:
        """Find staff member by name"""
        try:
            # Search for staff using the API
            staff_list = await self.api_client.get_staff(search_query=name)
            
            if not staff_list:
                return {
                    "found": False,
                    "message": f"No staff member found with name '{name}'"
                }
            
            # Find best match (exact match first, then partial)
            exact_matches = []
            partial_matches = []
            
            name_lower = name.lower()
            
            for staff in staff_list:
                full_name = f"{staff.get('first_name', '')} {staff.get('last_name', '')}".strip().lower()
                username = staff.get('username', '').lower()
                
                if (name_lower == full_name or 
                    name_lower == username or
                    name_lower == staff.get('first_name', '').lower() or
                    name_lower == staff.get('last_name', '').lower()):
                    exact_matches.append(staff)
                elif (name_lower in full_name or 
                      name_lower in username):
                    partial_matches.append(staff)
            
            if exact_matches:
                staff_member = exact_matches[0]
                return {
                    "found": True,
                    "staff": staff_member,
                    "match_type": "exact"
                }
            elif partial_matches:
                if len(partial_matches) == 1:
                    return {
                        "found": True,
                        "staff": partial_matches[0],
                        "match_type": "partial"
                    }
                else:
                    return {
                        "found": False,
                        "message": f"Multiple staff members found matching '{name}': {[s.get('first_name', '') + ' ' + s.get('last_name', '') for s in partial_matches]}",
                        "suggestions": partial_matches
                    }
            else:
                return {
                    "found": False,
                    "message": f"No staff member found matching '{name}'"
                }
                
        except Exception as e:
            logger.error(f"Error finding staff by name: {e}")
            return {"error": f"Failed to search for staff: {str(e)}"}
    
    async def get_staff_availability(
        self, 
        staff_id: int, 
        date_range: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Get staff availability for a date range"""
        try:
            # Get staff shifts for the date range
            filters = {"staff_user": staff_id}
            if date_range:
                if date_range.get("start_date"):
                    filters["start_time__gte"] = date_range["start_date"]
                if date_range.get("end_date"):
                    filters["start_time__lte"] = date_range["end_date"]
            
            shifts = await self.api_client.get_shifts(filters)
            
            # Analyze availability
            total_shifts = len(shifts)
            scheduled_hours = sum(
                self._calculate_shift_hours(shift) 
                for shift in shifts
            )
            
            return {
                "staff_id": staff_id,
                "date_range": date_range,
                "total_shifts": total_shifts,
                "scheduled_hours": scheduled_hours,
                "shifts": shifts
            }
            
        except Exception as e:
            logger.error(f"Error getting staff availability: {e}")
            return {"error": f"Failed to get availability: {str(e)}"}
    
    async def list_all_staff(self, filters: Dict[str, Any] = None) -> Dict[str, Any]:
        """List all staff members with optional filters"""
        try:
            staff_list = await self.api_client.get_staff(filters)
            
            return {
                "staff_count": len(staff_list),
                "staff_list": staff_list
            }
            
        except Exception as e:
            logger.error(f"Error listing staff: {e}")
            return {"error": f"Failed to list staff: {str(e)}"}
    
    def _calculate_shift_hours(self, shift: Dict[str, Any]) -> float:
        """Calculate hours for a shift"""
        try:
            from datetime import datetime
            
            start_time = datetime.fromisoformat(shift.get("start_time", "").replace("Z", "+00:00"))
            end_time = datetime.fromisoformat(shift.get("end_time", "").replace("Z", "+00:00"))
            
            duration = end_time - start_time
            return duration.total_seconds() / 3600
            
        except Exception:
            return 0.0