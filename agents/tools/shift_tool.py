"""
Shift tool for handling shift creation, scheduling, and management operations.
"""
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta

from tools.base_tool import BaseTool
from tools.staff_tool import StaffTool
from api.client import ShiftManagementAPI

logger = logging.getLogger(__name__)


class ShiftTool(BaseTool):
    """Tool for shift management operations"""
    
    def __init__(self):
        super().__init__(
            name="shift_tool",
            description="Handle shift creation, scheduling, and management operations"
        )
        self.api_client = ShiftManagementAPI()
        self.staff_tool = StaffTool()
    
    async def execute(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute shift management operations"""
        action = parameters.get("action", "create_shifts")
        
        if action == "create_shifts":
            return await self.create_shifts(
                parameters.get("staff_names", []),
                parameters.get("venue_names", []),
                parameters.get("time_range"),
                parameters.get("date_range"),
                parameters.get("frequency")
            )
        elif action == "copy_shifts":
            return await self.copy_shifts(
                parameters.get("source_shifts", []),
                parameters.get("target_dates", []),
                parameters.get("staff_mapping", {})
            )
        elif action == "delete_shifts":
            return await self.delete_shifts(
                parameters.get("shift_ids", [])
            )
        elif action == "update_shifts":
            return await self.update_shifts(
                parameters.get("shift_updates", [])
            )
        elif action == "bulk_create":
            return await self.bulk_create_shifts(
                parameters.get("shift_data", [])
            )
        else:
            return {"error": f"Unknown shift action: {action}"}
    
    async def create_shifts(
        self,
        staff_names: List[str],
        venue_names: List[str],
        time_range: Optional[Dict[str, Any]] = None,
        date_range: Optional[Dict[str, Any]] = None,
        frequency: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create shifts for staff members"""
        try:
            if not staff_names:
                return {"error": "No staff names provided"}
            
            if not venue_names:
                return {"error": "No venue names provided"}
            
            if not time_range:
                return {"error": "No time range provided"}
            
            # Find staff members
            staff_members = []
            for staff_name in staff_names:
                staff_result = await self.staff_tool.find_staff_by_name(staff_name)
                if staff_result.get('found'):
                    staff_members.append(staff_result['staff'])
                else:
                    return {"error": f"Staff member '{staff_name}' not found"}
            
            # Find venues
            venues = []
            for venue_name in venue_names:
                venue_result = await self.api_client.get_venues(search_query=venue_name)
                if venue_result:
                    # Find best match
                    venue = next(
                        (v for v in venue_result if venue_name.upper() in v.get('name', '').upper()),
                        venue_result[0] if venue_result else None
                    )
                    if venue:
                        venues.append(venue)
                    else:
                        return {"error": f"Venue '{venue_name}' not found"}
                else:
                    return {"error": f"Venue '{venue_name}' not found"}
            
            # Generate shift dates
            shift_dates = self._generate_shift_dates(date_range, frequency)
            
            if not shift_dates:
                return {"error": "No valid shift dates generated"}
            
            # Create shifts
            created_shifts = []
            total_shifts = 0
            
            for staff in staff_members:
                for venue in venues:
                    for shift_date in shift_dates:
                        shift_data = await self._create_shift_data(
                            staff, venue, shift_date, time_range
                        )
                        
                        try:
                            if len(staff_members) > 1:
                                # Use multi-staff shift creation
                                result = await self.api_client.create_multi_staff_shift(shift_data)
                            else:
                                # Use single shift creation
                                result = await self.api_client.create_shift(shift_data)
                            
                            created_shifts.append({
                                'staff_name': f"{staff['first_name']} {staff['last_name']}",
                                'venue_name': venue['name'],
                                'date': shift_date,
                                'time': f"{time_range.get('start_time', '')} to {time_range.get('end_time', '')}",
                                'shift_id': result.get('id')
                            })
                            total_shifts += 1
                            
                        except Exception as e:
                            logger.error(f"Error creating shift for {staff['first_name']} {staff['last_name']}: {e}")
                            # Continue with other shifts
                            continue
            
            return {
                "success": True,
                "shifts_created": total_shifts,
                "staff_count": len(staff_members),
                "venue_names": [v['name'] for v in venues],
                "date_range": date_range,
                "time_range": time_range,
                "created_shifts": created_shifts
            }
            
        except Exception as e:
            logger.error(f"Error creating shifts: {e}")
            return {"error": f"Failed to create shifts: {str(e)}"}
    
    async def copy_shifts(
        self,
        source_shifts: List[Dict[str, Any]],
        target_dates: List[str],
        staff_mapping: Dict[str, str] = None
    ) -> Dict[str, Any]:
        """Copy existing shifts to new dates"""
        try:
            if not source_shifts:
                return {"error": "No source shifts provided"}
            
            if not target_dates:
                return {"error": "No target dates provided"}
            
            copied_shifts = []
            total_copied = 0
            
            for source_shift in source_shifts:
                for target_date in target_dates:
                    # Create new shift data based on source
                    new_shift_data = source_shift.copy()
                    
                    # Update date
                    new_shift_data['start_time'] = self._update_shift_date(
                        source_shift['start_time'], target_date
                    )
                    new_shift_data['end_time'] = self._update_shift_date(
                        source_shift['end_time'], target_date
                    )
                    
                    # Apply staff mapping if provided
                    if staff_mapping and source_shift.get('staff_user') in staff_mapping:
                        new_shift_data['staff_user'] = staff_mapping[source_shift['staff_user']]
                    
                    # Remove ID to create new shift
                    new_shift_data.pop('id', None)
                    
                    try:
                        result = await self.api_client.create_shift(new_shift_data)
                        copied_shifts.append(result)
                        total_copied += 1
                    except Exception as e:
                        logger.error(f"Error copying shift: {e}")
                        continue
            
            return {
                "success": True,
                "shifts_copied": total_copied,
                "copied_shifts": copied_shifts
            }
            
        except Exception as e:
            logger.error(f"Error copying shifts: {e}")
            return {"error": f"Failed to copy shifts: {str(e)}"}
    
    async def delete_shifts(self, shift_ids: List[int]) -> Dict[str, Any]:
        """Delete shifts by IDs"""
        try:
            if not shift_ids:
                return {"error": "No shift IDs provided"}
            
            deleted_count = 0
            errors = []
            
            for shift_id in shift_ids:
                try:
                    success = await self.api_client.delete_shift(shift_id)
                    if success:
                        deleted_count += 1
                    else:
                        errors.append(f"Failed to delete shift {shift_id}")
                except Exception as e:
                    errors.append(f"Error deleting shift {shift_id}: {str(e)}")
            
            return {
                "success": deleted_count > 0,
                "shifts_deleted": deleted_count,
                "errors": errors
            }
            
        except Exception as e:
            logger.error(f"Error deleting shifts: {e}")
            return {"error": f"Failed to delete shifts: {str(e)}"}
    
    async def update_shifts(self, shift_updates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Update multiple shifts"""
        try:
            if not shift_updates:
                return {"error": "No shift updates provided"}
            
            updated_count = 0
            errors = []
            
            for update in shift_updates:
                shift_id = update.get('id')
                if not shift_id:
                    errors.append("Missing shift ID in update")
                    continue
                
                update_data = update.copy()
                update_data.pop('id', None)
                
                try:
                    result = await self.api_client.update_shift(shift_id, update_data)
                    updated_count += 1
                except Exception as e:
                    errors.append(f"Error updating shift {shift_id}: {str(e)}")
            
            return {
                "success": updated_count > 0,
                "shifts_updated": updated_count,
                "errors": errors
            }
            
        except Exception as e:
            logger.error(f"Error updating shifts: {e}")
            return {"error": f"Failed to update shifts: {str(e)}"}
    
    async def bulk_create_shifts(self, shift_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create multiple shifts in bulk"""
        try:
            if not shift_data:
                return {"error": "No shift data provided"}
            
            created_count = 0
            created_shifts = []
            errors = []
            
            for shift in shift_data:
                try:
                    result = await self.api_client.create_shift(shift)
                    created_shifts.append(result)
                    created_count += 1
                except Exception as e:
                    errors.append(f"Error creating shift: {str(e)}")
            
            return {
                "success": created_count > 0,
                "shifts_created": created_count,
                "created_shifts": created_shifts,
                "errors": errors
            }
            
        except Exception as e:
            logger.error(f"Error bulk creating shifts: {e}")
            return {"error": f"Failed to bulk create shifts: {str(e)}"}
    
    def _generate_shift_dates(
        self, 
        date_range: Optional[Dict[str, Any]], 
        frequency: Optional[str]
    ) -> List[str]:
        """Generate list of shift dates based on date range and frequency"""
        try:
            if not date_range:
                # Default to today
                return [datetime.now().strftime('%Y-%m-%d')]
            
            start_date_str = date_range.get('start_date')
            end_date_str = date_range.get('end_date')
            
            if not start_date_str:
                return [datetime.now().strftime('%Y-%m-%d')]
            
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
            
            if not end_date_str:
                return [start_date_str]
            
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
            
            # Generate dates based on frequency
            dates = []
            current_date = start_date
            
            if frequency == 'daily' or date_range.get('frequency') == 'daily':
                while current_date <= end_date:
                    dates.append(current_date.strftime('%Y-%m-%d'))
                    current_date += timedelta(days=1)
            elif frequency == 'weekly' or date_range.get('frequency') == 'weekly':
                while current_date <= end_date:
                    dates.append(current_date.strftime('%Y-%m-%d'))
                    current_date += timedelta(weeks=1)
            else:
                # Single date or date range without frequency
                if start_date == end_date:
                    dates.append(start_date_str)
                else:
                    # Default to daily for date ranges
                    while current_date <= end_date:
                        dates.append(current_date.strftime('%Y-%m-%d'))
                        current_date += timedelta(days=1)
            
            return dates
            
        except Exception as e:
            logger.error(f"Error generating shift dates: {e}")
            return []
    
    async def _create_shift_data(
        self,
        staff: Dict[str, Any],
        venue: Dict[str, Any],
        shift_date: str,
        time_range: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create shift data for API call"""
        try:
            start_time = time_range.get('start_time', '09:00')
            end_time = time_range.get('end_time', '17:00')
            
            # Convert to datetime objects
            start_datetime = f"{shift_date} {start_time}"
            end_datetime = f"{shift_date} {end_time}"
            
            # Convert to ISO format
            start_iso = datetime.strptime(start_datetime, '%Y-%m-%d %H:%M').isoformat()
            end_iso = datetime.strptime(end_datetime, '%Y-%m-%d %H:%M').isoformat()
            
            return {
                "staff_user": staff['id'],
                "venue": venue['id'],
                "start_time": start_iso,
                "end_time": end_iso,
                "status": "scheduled",
                "required_security_role": "sg",  # Default security role
                "manager_approved": False,
                "terms_accepted": False,
                "break_duration": 0,
                "notes": f"Created by AI agent"
            }
            
        except Exception as e:
            logger.error(f"Error creating shift data: {e}")
            return {}
    
    def _update_shift_date(self, original_datetime: str, new_date: str) -> str:
        """Update the date portion of a datetime string"""
        try:
            # Parse original datetime
            original_dt = datetime.fromisoformat(original_datetime.replace('Z', '+00:00'))
            
            # Parse new date
            new_date_dt = datetime.strptime(new_date, '%Y-%m-%d')
            
            # Combine new date with original time
            updated_dt = original_dt.replace(
                year=new_date_dt.year,
                month=new_date_dt.month,
                day=new_date_dt.day
            )
            
            return updated_dt.isoformat()
            
        except Exception as e:
            logger.error(f"Error updating shift date: {e}")
            return original_datetime