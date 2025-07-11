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
        elif action == "create_shifts_with_ids":
            return await self.create_shifts_with_ids(
                parameters.get("staff_ids", []),
                parameters.get("venue_ids", []),
                parameters.get("staff_names", []),  # For display purposes
                parameters.get("venue_names", []),  # For display purposes
                parameters.get("time_range"),
                parameters.get("date_range"),
                parameters.get("frequency")
            )
        elif action == "delete_shifts":
            return await self.delete_shifts(
                parameters.get("staff_names", []),
                parameters.get("venue_names", []),
                parameters.get("date_range"),
                parameters.get("time_range")
            )
        elif action == "list_shifts":
            return await self.list_shifts(
                parameters.get("staff_names", []),
                parameters.get("venue_names", []),
                parameters.get("date_range")
            )
        elif action == "reschedule_shifts":
            return await self.reschedule_shifts(
                parameters.get("staff_names", []),
                parameters.get("venue_names", []),
                parameters.get("date_range"),
                parameters.get("time_range"),
                parameters.get("update_info", {})
            )
        elif action == "update_shifts":
            return await self.update_shifts(
                parameters.get("staff_names", []),
                parameters.get("venue_names", []),
                parameters.get("date_range"),
                parameters.get("time_range"),
                parameters.get("update_info", {})
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
    
    async def create_shifts_with_ids(
        self,
        staff_ids: List[int],
        venue_ids: List[int],
        staff_names: List[str] = None,  # For display purposes
        venue_names: List[str] = None,  # For display purposes
        time_range: Optional[Dict[str, Any]] = None,
        date_range: Optional[Dict[str, Any]] = None,
        frequency: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create shifts using pre-resolved staff and venue IDs"""
        try:
            if not staff_ids:
                return {"error": "No staff IDs provided"}
            
            if not venue_ids:
                return {"error": "No venue IDs provided"}
            
            if not time_range:
                return {"error": "No time range provided"}
            
            # Get staff data from IDs
            staff_members = []
            for staff_id in staff_ids:
                try:
                    staff_data = await self.api_client.get_staff_by_id(staff_id)
                    if staff_data:
                        staff_members.append(staff_data)
                    else:
                        return {"error": f"Staff member with ID {staff_id} not found"}
                except Exception as e:
                    logger.error(f"Error fetching staff ID {staff_id}: {e}")
                    return {"error": f"Could not fetch staff member with ID {staff_id}"}
            
            # Get venue data from IDs
            venues = []
            for venue_id in venue_ids:
                try:
                    venue_data = await self.api_client.get_venue_by_id(venue_id)
                    if venue_data:
                        venues.append(venue_data)
                    else:
                        return {"error": f"Venue with ID {venue_id} not found"}
                except Exception as e:
                    logger.error(f"Error fetching venue ID {venue_id}: {e}")
                    return {"error": f"Could not fetch venue with ID {venue_id}"}
            
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
                "venue_names": venue_names or [v['name'] for v in venues],
                "date_range": date_range,
                "time_range": time_range,
                "created_shifts": created_shifts
            }
            
        except Exception as e:
            logger.error(f"Error creating shifts with IDs: {e}")
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
            
            # Handle AM/PM format conversion
            if 'AM' in start_time or 'PM' in start_time:
                try:
                    start_time = datetime.strptime(start_time, '%I %p').strftime('%H:%M')
                except ValueError:
                    start_time = datetime.strptime(start_time, '%I:%M %p').strftime('%H:%M')
            
            if 'AM' in end_time or 'PM' in end_time:
                try:
                    end_time = datetime.strptime(end_time, '%I %p').strftime('%H:%M')
                except ValueError:
                    end_time = datetime.strptime(end_time, '%I:%M %p').strftime('%H:%M')
            
            # Convert to datetime objects
            start_datetime_obj = datetime.strptime(f"{shift_date} {start_time}", '%Y-%m-%d %H:%M')
            end_datetime_obj = datetime.strptime(f"{shift_date} {end_time}", '%Y-%m-%d %H:%M')
            
            # Fix: If end time is before start time, assume it's next day
            if end_datetime_obj <= start_datetime_obj:
                from datetime import timedelta
                end_datetime_obj = end_datetime_obj + timedelta(days=1)
                logger.info(f"🔧 End time adjusted to next day: {end_datetime_obj}")
            
            logger.info(f"🔍 TIME CONVERSION: {time_range.get('start_time')} → {start_time}, {time_range.get('end_time')} → {end_time}")
            logger.info(f"🔍 DATETIME OBJECTS: Start: {start_datetime_obj}, End: {end_datetime_obj}")
            
            # Convert to ISO format with .000Z suffix (exact backend format)
            start_iso = start_datetime_obj.isoformat() + '.000Z'
            end_iso = end_datetime_obj.isoformat() + '.000Z'
            
            shift_data = {
                "staff_user": staff['id'],
                "venue": venue['id'],
                "start_time": start_iso,
                "end_time": end_iso,
                "status": "scheduled",
                "required_security_role": "sg",
                "notes": "",  # Required empty field
                "shift_group": None  # Required null field
            }
            
            # Debug: Log exactly what we're sending
            logger.info(f"🔍 AI SENDING TO API: {shift_data}")
            
            return shift_data
            
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
    
    def _convert_time_to_datetime(self, date_str: str, time_str: str) -> str:
        """Convert time string to full datetime ISO format"""
        try:
            from datetime import datetime
            
            # Handle AM/PM format conversion
            if 'AM' in time_str or 'PM' in time_str:
                try:
                    time_obj = datetime.strptime(time_str, '%I:%M %p')
                except ValueError:
                    time_obj = datetime.strptime(time_str, '%I %p')
                time_24h = time_obj.strftime('%H:%M')
            else:
                time_24h = time_str
            
            # Combine date and time
            datetime_str = f"{date_str} {time_24h}"
            datetime_obj = datetime.strptime(datetime_str, '%Y-%m-%d %H:%M')
            
            return datetime_obj.isoformat() + 'Z'
            
        except Exception as e:
            logger.error(f"Error converting time to datetime: {e}")
            return time_str
    
    def _parse_date(self, date_str: str) -> 'datetime':
        """Parse date string to datetime object"""
        try:
            from datetime import datetime, timedelta
            
            if date_str.lower() == 'today':
                return datetime.now()
            elif date_str.lower() == 'tomorrow':
                return datetime.now() + timedelta(days=1)
            else:
                return datetime.strptime(date_str, '%Y-%m-%d')
                
        except Exception as e:
            logger.error(f"Error parsing date: {e}")
            from datetime import datetime
            return datetime.now()
    
    async def delete_shifts(self, staff_names: List[str], venue_names: List[str], 
                           date_range: Dict[str, Any], time_range: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Delete shifts based on criteria"""
        try:
            # Find shifts to delete
            shifts_to_delete = await self._find_shifts_by_criteria(staff_names, venue_names, date_range, time_range)
            
            if not shifts_to_delete:
                return {
                    "success": False,
                    "message": "No shifts found matching the criteria",
                    "shifts_deleted": 0
                }
            
            deleted_count = 0
            failed_deletions = []
            
            for shift in shifts_to_delete:
                try:
                    success = await self.api_client.delete_shift(shift['id'])
                    if success:
                        deleted_count += 1
                        logger.info(f"✅ Deleted shift {shift['id']} for {shift.get('staff_name', 'Unknown')} at {shift.get('venue_name', 'Unknown')}")
                    else:
                        failed_deletions.append(shift)
                except Exception as e:
                    logger.error(f"❌ Failed to delete shift {shift['id']}: {e}")
                    failed_deletions.append(shift)
            
            return {
                "success": deleted_count > 0,
                "message": f"Successfully deleted {deleted_count} shift(s)" + 
                          (f", {len(failed_deletions)} failed" if failed_deletions else ""),
                "shifts_deleted": deleted_count,
                "failed_deletions": len(failed_deletions),
                "deleted_shifts": shifts_to_delete[:deleted_count]
            }
            
        except Exception as e:
            logger.error(f"Error deleting shifts: {e}")
            return {
                "success": False,
                "message": f"Error deleting shifts: {str(e)}",
                "shifts_deleted": 0
            }
    
    async def list_shifts(self, staff_names: List[str], venue_names: List[str], 
                         date_range: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """List shifts based on criteria"""
        try:
            # Find shifts
            shifts = await self._find_shifts_by_criteria(staff_names, venue_names, date_range)
            
            if not shifts:
                return {
                    "success": True,
                    "message": "No shifts found matching the criteria",
                    "shifts_count": 0,
                    "shifts": []
                }
            
            # Format shifts for display
            formatted_shifts = []
            for shift in shifts:
                formatted_shifts.append({
                    "id": shift.get('id'),
                    "staff_name": shift.get('staff_name', 'Unknown'),
                    "venue_name": shift.get('venue_name', 'Unknown'),
                    "start_time": shift.get('start_time'),
                    "end_time": shift.get('end_time'),
                    "status": shift.get('status', 'unknown'),
                    "date": shift.get('start_time', '').split('T')[0] if shift.get('start_time') else 'Unknown'
                })
            
            return {
                "success": True,
                "message": f"Found {len(shifts)} shift(s)",
                "shifts_count": len(shifts),
                "shifts": formatted_shifts
            }
            
        except Exception as e:
            logger.error(f"Error listing shifts: {e}")
            return {
                "success": False,
                "message": f"Error listing shifts: {str(e)}",
                "shifts_count": 0,
                "shifts": []
            }
    
    async def reschedule_shifts(self, staff_names: List[str], venue_names: List[str], 
                               date_range: Dict[str, Any], time_range: Optional[Dict[str, Any]],
                               update_info: Dict[str, Any]) -> Dict[str, Any]:
        """Reschedule shifts to new times/dates"""
        try:
            # Find shifts to reschedule
            shifts_to_update = await self._find_shifts_by_criteria(staff_names, venue_names, date_range, time_range)
            
            if not shifts_to_update:
                return {
                    "success": False,
                    "message": "No shifts found matching the criteria",
                    "shifts_rescheduled": 0
                }
            
            rescheduled_count = 0
            failed_updates = []
            
            for shift in shifts_to_update:
                try:
                    # Prepare update data
                    update_data = {}
                    
                    # Update time if provided
                    if update_info.get('new_start_time'):
                        new_start = self._convert_time_to_datetime(
                            shift.get('start_time', '').split('T')[0],  # Current date
                            update_info['new_start_time']
                        )
                        update_data['start_time'] = new_start
                    
                    if update_info.get('new_end_time'):
                        new_end = self._convert_time_to_datetime(
                            shift.get('start_time', '').split('T')[0],  # Current date
                            update_info['new_end_time']
                        )
                        update_data['end_time'] = new_end
                    
                    # Update date if provided
                    if update_info.get('new_date'):
                        new_date = self._parse_date(update_info['new_date'])
                        if shift.get('start_time'):
                            current_start = datetime.fromisoformat(shift['start_time'].replace('Z', '+00:00'))
                            new_start = current_start.replace(
                                year=new_date.year,
                                month=new_date.month,
                                day=new_date.day
                            )
                            update_data['start_time'] = new_start.isoformat() + 'Z'
                        
                        if shift.get('end_time'):
                            current_end = datetime.fromisoformat(shift['end_time'].replace('Z', '+00:00'))
                            new_end = current_end.replace(
                                year=new_date.year,
                                month=new_date.month,
                                day=new_date.day
                            )
                            update_data['end_time'] = new_end.isoformat() + 'Z'
                    
                    if update_data:
                        updated_shift = await self.api_client.update_shift(shift['id'], update_data)
                        if updated_shift:
                            rescheduled_count += 1
                            logger.info(f"✅ Rescheduled shift {shift['id']} for {shift.get('staff_name', 'Unknown')}")
                        else:
                            failed_updates.append(shift)
                    
                except Exception as e:
                    logger.error(f"❌ Failed to reschedule shift {shift['id']}: {e}")
                    failed_updates.append(shift)
            
            return {
                "success": rescheduled_count > 0,
                "message": f"Successfully rescheduled {rescheduled_count} shift(s)" + 
                          (f", {len(failed_updates)} failed" if failed_updates else ""),
                "shifts_rescheduled": rescheduled_count,
                "failed_updates": len(failed_updates),
                "updated_shifts": shifts_to_update[:rescheduled_count]
            }
            
        except Exception as e:
            logger.error(f"Error rescheduling shifts: {e}")
            return {
                "success": False,
                "message": f"Error rescheduling shifts: {str(e)}",
                "shifts_rescheduled": 0
            }
    
    async def update_shifts(self, staff_names: List[str], venue_names: List[str], 
                           date_range: Dict[str, Any], time_range: Optional[Dict[str, Any]],
                           update_info: Dict[str, Any]) -> Dict[str, Any]:
        """Update shift details (venue, staff, etc.)"""
        try:
            # Find shifts to update
            shifts_to_update = await self._find_shifts_by_criteria(staff_names, venue_names, date_range, time_range)
            
            if not shifts_to_update:
                return {
                    "success": False,
                    "message": "No shifts found matching the criteria",
                    "shifts_updated": 0
                }
            
            updated_count = 0
            failed_updates = []
            
            for shift in shifts_to_update:
                try:
                    update_data = {}
                    
                    # Update venue if provided
                    if update_info.get('new_venue'):
                        # Resolve venue name to ID
                        venues = await self.api_client.get_venues(search_query=update_info['new_venue'])
                        if venues:
                            update_data['venue'] = venues[0]['id']
                    
                    if update_data:
                        updated_shift = await self.api_client.update_shift(shift['id'], update_data)
                        if updated_shift:
                            updated_count += 1
                            logger.info(f"✅ Updated shift {shift['id']} for {shift.get('staff_name', 'Unknown')}")
                        else:
                            failed_updates.append(shift)
                    
                except Exception as e:
                    logger.error(f"❌ Failed to update shift {shift['id']}: {e}")
                    failed_updates.append(shift)
            
            return {
                "success": updated_count > 0,
                "message": f"Successfully updated {updated_count} shift(s)" + 
                          (f", {len(failed_updates)} failed" if failed_updates else ""),
                "shifts_updated": updated_count,
                "failed_updates": len(failed_updates),
                "updated_shifts": shifts_to_update[:updated_count]
            }
            
        except Exception as e:
            logger.error(f"Error updating shifts: {e}")
            return {
                "success": False,
                "message": f"Error updating shifts: {str(e)}",
                "shifts_updated": 0
            }
    
    async def _find_shifts_by_criteria(self, staff_names: List[str], venue_names: List[str], 
                                     date_range: Optional[Dict[str, Any]] = None,
                                     time_range: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Find shifts matching the given criteria"""
        try:
            # Build filters for API call
            filters = {}
            
            # Add date filters
            if date_range:
                if date_range.get('start_date'):
                    start_date = self._parse_date(date_range['start_date'])
                    filters['start_time__gte'] = start_date.strftime('%Y-%m-%d')
                
                if date_range.get('end_date'):
                    end_date = self._parse_date(date_range['end_date'])
                    filters['start_time__lte'] = end_date.strftime('%Y-%m-%d')
            
            # Get all shifts
            all_shifts = await self.api_client.get_shifts(filters)
            
            if not all_shifts:
                return []
            
            # Filter by staff names if provided
            filtered_shifts = []
            for shift in all_shifts:
                # Check staff match
                staff_match = True
                if staff_names:
                    staff_match = False
                    staff_name = f"{shift.get('staff_user_first_name', '')} {shift.get('staff_user_last_name', '')}".strip()
                    for name in staff_names:
                        if name.lower() in staff_name.lower():
                            staff_match = True
                            break
                
                # Check venue match
                venue_match = True
                if venue_names:
                    venue_match = False
                    venue_name = shift.get('venue_name', '').lower()
                    for name in venue_names:
                        if name.lower() in venue_name:
                            venue_match = True
                            break
                
                # Check time match if provided
                time_match = True
                if time_range:
                    shift_start = shift.get('start_time', '')
                    shift_end = shift.get('end_time', '')
                    
                    if time_range.get('start_time') and shift_start:
                        shift_start_time = shift_start.split('T')[1][:5] if 'T' in shift_start else ''
                        if time_range['start_time'] not in shift_start_time:
                            time_match = False
                    
                    if time_range.get('end_time') and shift_end:
                        shift_end_time = shift_end.split('T')[1][:5] if 'T' in shift_end else ''
                        if time_range['end_time'] not in shift_end_time:
                            time_match = False
                
                if staff_match and venue_match and time_match:
                    # Add formatted staff and venue names for display
                    shift['staff_name'] = f"{shift.get('staff_user_first_name', '')} {shift.get('staff_user_last_name', '')}".strip()
                    shift['venue_name'] = shift.get('venue_name', 'Unknown')
                    filtered_shifts.append(shift)
            
            return filtered_shifts
            
        except Exception as e:
            logger.error(f"Error finding shifts by criteria: {e}")
            return []