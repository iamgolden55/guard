"""
Shift management agent for handling shift creation, scheduling, and management queries.
"""
import logging
from typing import Any, Dict, List, Optional, Tuple

from agents.base_agent import BaseAgent, AgentResponse, AgentCapability
from tools.staff_tool import StaffTool
from tools.shift_tool import ShiftTool
from parsers.query_parser import QueryParser, QueryIntent
from parsers.intent_parser import IntentParser
from parsers.smart_query_parser import SmartQueryParser
from core.context_manager import ConversationContext

logger = logging.getLogger(__name__)


class ShiftManagementAgent(BaseAgent):
    """Agent for handling shift management queries"""
    
    def __init__(self):
        super().__init__(
            name="shift_management_agent",
            description="Handle shift creation, scheduling, and management queries"
        )
        
        self.query_parser = QueryParser()
        self.intent_parser = IntentParser()
        self.smart_parser = SmartQueryParser()
        self.vector_staff_resolver = None  # Will be injected by server on startup
        self.vector_venue_resolver = None  # Will be injected by server on startup
        
        # Conversation context storage
        self.conversation_contexts = {}  # session_id -> context
    
    def _initialize_capabilities(self) -> None:
        """Initialize the shift management agent's capabilities"""
        capabilities = [
            AgentCapability(
                name="create_shifts",
                description="Create shifts for staff members at venues",
                examples=["Create shifts for John at Store1 from 9 AM to 5 PM", "Give Sarah shifts at BIMM from monday to friday"]
            ),
            AgentCapability(
                name="schedule_recurring",
                description="Schedule recurring shifts (daily, weekly)",
                examples=["Schedule daily shifts for Mike next week"]
            ),
            AgentCapability(
                name="assign_multiple",
                description="Assign shifts to multiple staff members",
                examples=["Assign shifts to Sarah and John"]
            ),
            AgentCapability(
                name="copy_shifts",
                description="Copy existing shifts to new dates",
                examples=["Copy last week's shifts to this week"]
            ),
            AgentCapability(
                name="modify_shifts",
                description="Delete and modify existing shifts",
                examples=["Delete John's shift tomorrow", "Update Sarah's shift time"]
            ),
            AgentCapability(
                name="bulk_operations",
                description="Handle bulk shift operations",
                examples=["Create shifts for the whole team"]
            )
        ]
        
        for capability in capabilities:
            self.add_capability(capability)
    
    def _initialize_tools(self) -> None:
        """Initialize the shift management agent's tools"""
        self.staff_tool = StaffTool()
        self.shift_tool = ShiftTool()
        
        # Add API client for direct shift queries
        from api.client import ShiftManagementAPI
        self.api_client = ShiftManagementAPI()
        
        self.add_tool("staff_tool", self.staff_tool)
        self.add_tool("shift_tool", self.shift_tool)
    
    async def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> Tuple[bool, float]:
        """Check if this agent can handle the query"""
        try:
            parsed_query = await self.query_parser.parse_query(query)
            
            # Check for shift management intents
            shift_intents = [
                QueryIntent.CREATE_SHIFT,
                QueryIntent.COPY_SHIFTS,
                QueryIntent.DELETE_SHIFT,
                QueryIntent.UPDATE_SHIFT
            ]
            
            if parsed_query.intent in shift_intents:
                return True, parsed_query.confidence
            
            # Check for shift management keywords
            shift_keywords = [
                'shift', 'schedule', 'assign', 'create', 'give', 'copy',
                'delete', 'remove', 'update', 'modify', 'everyday', 'daily',
                'weekly', 'recurring', 'from', 'to', 'at', 'venue'
            ]
            
            query_lower = query.lower()
            keyword_matches = sum(1 for keyword in shift_keywords if keyword in query_lower)
            
            # Give highest priority to direct shift commands
            if 'create' in query_lower and ('shift' in query_lower or 'nini' in query_lower or 'staff' in query_lower or any(time_word in query_lower for time_word in ['pm', 'am', ':'])):
                return True, 0.99
            
            # High priority for CRUD operations with staff names (check before general keyword matching)
            if any(crud_word in query_lower for crud_word in ['delete', 'remove', 'update', 'modify', 'reschedule', 'show', 'list', 'view']):
                if 'shift' in query_lower or 'nini' in query_lower or any(staff_name in query_lower for staff_name in ['ninioritse', 'eruwa', 'azemi', 'fitame']):
                    return True, 0.98  # Higher than conversational agent (0.9)
            
            # High priority for any shift-related command (but lower than specific CRUD)
            if keyword_matches >= 2:
                return True, min(0.85, 0.6 + (keyword_matches * 0.1))  # Lower than CRUD operations
            
            return False, 0.0
            
        except Exception as e:
            logger.error(f"Error checking if shift management agent can handle query: {e}")
            return False, 0.0
    
    def _get_conversation_context(self, session_id: str) -> Dict[str, Any]:
        """Get conversation context for a session"""
        return self.conversation_contexts.get(session_id, {})
    
    def _update_conversation_context(self, session_id: str, context: Dict[str, Any]):
        """Update conversation context for a session"""
        if session_id not in self.conversation_contexts:
            self.conversation_contexts[session_id] = {}
        self.conversation_contexts[session_id].update(context)
        
        # Clean up old contexts (keep only last 10 sessions)
        if len(self.conversation_contexts) > 10:
            oldest_session = list(self.conversation_contexts.keys())[0]
            del self.conversation_contexts[oldest_session]
    
    def _check_for_follow_up(self, query: str, context: Dict[str, Any]) -> Tuple[bool, str]:
        """Check if query is a follow-up and reconstruct full context"""
        logger.info(f"Checking follow-up for query: '{query}', context: {context}")
        
        if not context.get('pending_action'):
            logger.info("No pending action found in context")
            return False, query
            
        # Check if query looks like a follow-up response
        query_lower = query.lower().strip()
        
        # Time patterns (user providing missing time info)
        time_patterns = [
            'am', 'pm', ':', 'to', 'from', 'until', 'start', 'end',
            'morning', 'afternoon', 'evening', 'night', 'noon', 'midnight',
            '6:', '7:', '8:', '9:', '10:', '11:', '12:', '1:', '2:', '3:', '4:', '5:'
        ]
        
        # Venue patterns (user providing missing venue info)
        venue_patterns = ['store', 'shop', 'location', 'place', 'venue', 'site']
        
        # Date patterns (user providing missing date info)
        date_patterns = ['today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 
                        'thursday', 'friday', 'saturday', 'sunday', 'next week']
        
        is_time_response = any(pattern in query_lower for pattern in time_patterns)
        is_venue_response = any(pattern in query_lower for pattern in venue_patterns) 
        is_date_response = any(pattern in query_lower for pattern in date_patterns)
        
        logger.info(f"Pattern checks - time: {is_time_response}, venue: {is_venue_response}, date: {is_date_response}")
        logger.info(f"Missing info: {context.get('missing_info')}")
        
        if is_time_response or is_venue_response or is_date_response:
            # Reconstruct the full query with context
            original_request = context.get('original_request', '')
            missing_info = context.get('missing_info', '')
            
            if missing_info == 'time' and is_time_response:
                full_query = f"{original_request} {query}"
                logger.info(f"Reconstructed query with time context: {full_query}")
                return True, full_query
            elif missing_info == 'venue' and is_venue_response:
                full_query = f"{original_request} at {query}"
                logger.info(f"Reconstructed query with venue context: {full_query}")
                return True, full_query
            elif missing_info == 'date' and is_date_response:
                full_query = f"{original_request} on {query}"
                logger.info(f"Reconstructed query with date context: {full_query}")
                return True, full_query
                
        return False, query

    async def process_query(self, query: str, session_id: str, user_id: Optional[str] = None) -> AgentResponse:
        """Process a shift management query with smart parsing and conversation context"""
        try:
            # Get conversation context
            context = self._get_conversation_context(session_id)
            
            # Check if this is a follow-up to a previous incomplete query
            is_follow_up, processed_query = self._check_for_follow_up(query, context)
            
            if is_follow_up:
                # Clear the pending action since we're now processing it
                self._update_conversation_context(session_id, {'pending_action': None, 'missing_info': None})
                query = processed_query
            # Use smart parser for intelligent name resolution
            smart_result = await self.smart_parser.parse_with_context(query)
            
            logger.info(f"Smart parse result - Intent: {smart_result.intent}, Staff: {len(smart_result.resolved_staff)}, Confidence: {smart_result.confidence}")
            
            # Route based on intent and keywords
            reasoning_lower = smart_result.reasoning.lower()
            
            if smart_result.intent == 'shift_deletion' or 'delete' in reasoning_lower:
                return await self._handle_smart_shift_deletion(smart_result, session_id)
            elif smart_result.intent == 'shift_reschedule' or any(word in reasoning_lower for word in ['reschedule', 'move time', 'change time', 'change date']):
                return await self._handle_smart_shift_reschedule(smart_result, session_id)
            elif smart_result.intent == 'shift_update' or ('change' in reasoning_lower or 'modify' in reasoning_lower or 'update' in reasoning_lower):
                return await self._handle_smart_shift_modification(smart_result, session_id)
            elif smart_result.intent == 'shift_view' or any(word in reasoning_lower for word in ['show', 'list', 'view', 'get']):
                return await self._handle_smart_shift_view(smart_result, session_id)
            elif smart_result.intent == 'shift_creation' or 'create' in reasoning_lower:
                return await self._handle_smart_shift_creation(smart_result, session_id)
            else:
                return await self._handle_general_shift_query_smart(smart_result, session_id)
                
        except Exception as e:
            logger.error(f"Error processing shift management query: {e}")
            return AgentResponse(
                content=f"I encountered an error processing your shift management query: {str(e)}",
                data={"error": str(e)}
            )
    
    async def _handle_create_shift(self, parsed_query, session_id: str) -> AgentResponse:
        """Handle shift creation queries"""
        try:
            # Parse shift creation intent with detailed parameters
            shift_params = await self.intent_parser.parse_shift_creation_intent(parsed_query.original_query)
            
            if not shift_params.get('staff_names'):
                return AgentResponse(
                    content="I need to know which staff member(s) to create shifts for. Please specify the staff names."
                )
            
            if not shift_params.get('time_range'):
                return AgentResponse(
                    content="I need to know the shift times. Please specify the start and end times (e.g., '9:00 AM to 5:00 PM')."
                )
            
            if not shift_params.get('venue_names'):
                return AgentResponse(
                    content="I need to know which venue to create shifts at. Please specify the venue name."
                )
            
            # Create shifts using the shift tool
            result = await self.shift_tool.execute({
                'action': 'create_shifts',
                'staff_names': shift_params['staff_names'],
                'venue_names': shift_params['venue_names'],
                'time_range': shift_params['time_range'],
                'date_range': shift_params['date_range'],
                'frequency': shift_params['frequency']
            })
            
            if 'error' in result:
                return AgentResponse(
                    content=f"I couldn't create the shifts: {result['error']}"
                )
            
            # Format the response
            message = self._format_shift_creation_response(result)
            
            return AgentResponse(
                content=message,
                data=result
            )
            
        except Exception as e:
            logger.error(f"Error handling create shift: {e}")
            return AgentResponse(
                content=f"I encountered an error creating the shifts: {str(e)}"
            )
    
    async def _handle_copy_shifts(self, parsed_query, session_id: str) -> AgentResponse:
        """Handle shift copying queries"""
        try:
            # Implementation for copying shifts
            return AgentResponse(
                content="Shift copying functionality is not yet implemented. Please create new shifts manually."
            )
            
        except Exception as e:
            logger.error(f"Error handling copy shifts: {e}")
            return AgentResponse(
                content=f"I encountered an error copying shifts: {str(e)}"
            )
    
    async def _handle_delete_shift(self, parsed_query, session_id: str) -> AgentResponse:
        """Handle shift deletion queries"""
        try:
            # Implementation for deleting shifts
            return AgentResponse(
                content="Shift deletion functionality is not yet implemented. Please delete shifts manually."
            )
            
        except Exception as e:
            logger.error(f"Error handling delete shift: {e}")
            return AgentResponse(
                content=f"I encountered an error deleting shifts: {str(e)}"
            )
    
    async def _handle_update_shift(self, parsed_query, session_id: str) -> AgentResponse:
        """Handle shift update queries"""
        try:
            # Implementation for updating shifts
            return AgentResponse(
                content="Shift update functionality is not yet implemented. Please update shifts manually."
            )
            
        except Exception as e:
            logger.error(f"Error handling update shift: {e}")
            return AgentResponse(
                content=f"I encountered an error updating shifts: {str(e)}"
            )
    
    async def _handle_general_shift_query(self, parsed_query, session_id: str) -> AgentResponse:
        """Handle general shift management queries"""
        try:
            message = "I can help you with shift management tasks. Here are some things I can do:\n\n"
            message += "• Create shifts for staff members\n"
            message += "• Schedule recurring shifts (daily, weekly)\n"
            message += "• Assign shifts to multiple staff at once\n"
            message += "• Copy existing shifts to new dates\n"
            message += "• Delete and modify existing shifts\n"
            message += "• Handle bulk shift operations\n\n"
            message += "For example, you can say:\n"
            message += "- 'Give MR A shifts at BIMM from monday to saturday everyday at 5:00 pm to 10:00pm'\n"
            message += "- 'Create shifts for MR B at LOCATION1 from 9 AM to 5 PM'\n"
            message += "- 'Schedule daily shifts for MR C next week'"
            
            return AgentResponse(
                content=message,
                data={'capabilities': [cap.name for cap in self.capabilities]}
            )
            
        except Exception as e:
            logger.error(f"Error handling general shift query: {e}")
            return AgentResponse(
                content=f"I encountered an error processing your shift query: {str(e)}"
            )
    
    def _format_shift_creation_response(self, result: Dict[str, Any]) -> str:
        """Format shift creation response"""
        try:
            shifts_created = result.get('shifts_created', 0)
            staff_count = result.get('staff_count', 0)
            venue_names = result.get('venue_names', [])
            date_range = result.get('date_range', {})
            time_range = result.get('time_range', {})
            
            message = f"Successfully created {shifts_created} shifts!\n\n"
            message += f"👥 Staff: {staff_count} member(s)\n"
            
            if venue_names:
                message += f"🏢 Venue(s): {', '.join(venue_names)}\n"
            
            if date_range:
                start_date = date_range.get('start_date', '')
                end_date = date_range.get('end_date', '')
                frequency = date_range.get('frequency', '')
                
                if start_date and end_date:
                    message += f"📅 Dates: {start_date} to {end_date}"
                    if frequency:
                        message += f" ({frequency})"
                    message += "\n"
            
            if time_range:
                start_time = time_range.get('start_time', '')
                end_time = time_range.get('end_time', '')
                
                if start_time and end_time:
                    message += f"⏰ Time: {start_time} to {end_time}\n"
            
            # Add details about created shifts
            created_shifts = result.get('created_shifts', [])
            if created_shifts:
                message += f"\n📋 Created shifts:\n"
                for shift in created_shifts[:5]:  # Show first 5 shifts
                    staff_name = shift.get('staff_name', 'Unknown')
                    venue_name = shift.get('venue_name', 'Unknown')
                    date = shift.get('date', 'Unknown')
                    message += f"• {staff_name} at {venue_name} on {date}\n"
                
                if len(created_shifts) > 5:
                    message += f"... and {len(created_shifts) - 5} more shifts\n"
            
            return message
            
        except Exception as e:
            logger.error(f"Error formatting shift creation response: {e}")
            return f"Created {result.get('shifts_created', 0)} shifts successfully!"
    
    async def _handle_smart_shift_creation(self, smart_result, session_id: str) -> AgentResponse:
        """Handle shift creation with smart parsing results"""
        try:
            # Debug logging
            logger.info(f"DEBUG: smart_result.resolved_staff = {smart_result.resolved_staff}")
            logger.info(f"DEBUG: type = {type(smart_result.resolved_staff)}")
            logger.info(f"DEBUG: len = {len(smart_result.resolved_staff) if smart_result.resolved_staff else 'None'}")
            
            # Check if we have enough information
            if not smart_result.resolved_staff:
                if smart_result.staff_names:
                    return AgentResponse(
                        content=f"I couldn't find staff members named: {', '.join(smart_result.staff_names)}. Please check the names and try again."
                    )
                else:
                    return AgentResponse(
                        content="I need to know which staff member(s) to create shifts for. Please specify the staff names."
                    )
            
            if not smart_result.venue_names:
                staff_names = [f"{s.get('first_name')} {s.get('last_name')}" for s in smart_result.resolved_staff]
                # Store context for follow-up
                self._update_conversation_context(session_id, {
                    'pending_action': 'create_shift',
                    'original_request': f"Create shifts for {', '.join(staff_names)}",
                    'missing_info': 'venue',
                    'staff_info': smart_result.resolved_staff,
                    'date_info': smart_result.date_info
                })
                return AgentResponse(
                    content=f"I'll create shifts for {', '.join(staff_names)}. Which venue should I assign them to?"
                )
            
            if not smart_result.time_info.get('start_time') or not smart_result.time_info.get('end_time'):
                staff_names = [f"{s.get('first_name')} {s.get('last_name')}" for s in smart_result.resolved_staff]
                # Store context for follow-up
                self._update_conversation_context(session_id, {
                    'pending_action': 'create_shift',
                    'original_request': f"Create shifts for {', '.join(staff_names)} at {', '.join(smart_result.venue_names)}",
                    'missing_info': 'time',
                    'staff_info': smart_result.resolved_staff,
                    'venue_names': smart_result.venue_names,
                    'date_info': smart_result.date_info
                })
                return AgentResponse(
                    content=f"I'll create shifts for {', '.join(staff_names)} at {', '.join(smart_result.venue_names)}. What times should the shifts be?"
                )
            
            # We have enough information - create the shifts
            staff_names = [f"{s.get('first_name')} {s.get('last_name')}" for s in smart_result.resolved_staff]
            
            # Actually create the shifts using the shift tool
            try:
                # Convert relative dates to proper format
                date_range = smart_result.date_info.copy()
                if date_range.get('start_date') == 'tomorrow':
                    from datetime import datetime, timedelta
                    tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
                    date_range['start_date'] = tomorrow
                    if not date_range.get('end_date'):
                        date_range['end_date'] = tomorrow
                
                # Fix: Update old years to current year (2025)
                if date_range.get('start_date') and date_range['start_date'].startswith('2023'):
                    date_range['start_date'] = date_range['start_date'].replace('2023', '2025')
                    logger.info(f"🔧 Fixed year in start_date: {date_range['start_date']}")
                
                if date_range.get('end_date') and date_range['end_date'].startswith('2023'):
                    date_range['end_date'] = date_range['end_date'].replace('2023', '2025')
                    logger.info(f"🔧 Fixed year in end_date: {date_range['end_date']}")

                # Try to resolve venue names to IDs using vector resolver
                resolved_venue_ids = []
                use_id_based_creation = True
                
                if self.vector_venue_resolver:
                    for venue_name in smart_result.venue_names:
                        success, venue_data, message = await self.vector_venue_resolver.resolve_venue_with_fallback(venue_name)
                        if success:
                            resolved_venue_ids.append(venue_data['id'])
                            logger.info(f"✅ Resolved venue '{venue_name}' to ID {venue_data['id']}")
                        else:
                            logger.error(f"❌ Failed to resolve venue '{venue_name}': {message}")
                            # Don't fail completely, fall back to name-based creation
                            use_id_based_creation = False
                            break
                else:
                    logger.warning("⚠️ No venue resolver available, using name-based creation")
                    use_id_based_creation = False

                # Create shifts using the appropriate method
                if use_id_based_creation and resolved_venue_ids:
                    # Use ID-based creation (more reliable)
                    staff_ids = [s.get('id') for s in smart_result.resolved_staff]
                    logger.info(f"DEBUG: Creating shifts with staff IDs: {staff_ids}, venue IDs: {resolved_venue_ids}")

                    result = await self.shift_tool.execute({
                        'action': 'create_shifts_with_ids',
                        'staff_ids': staff_ids,
                        'venue_ids': resolved_venue_ids,
                        'staff_names': [f"{s.get('first_name')} {s.get('last_name')}" for s in smart_result.resolved_staff],
                        'venue_names': smart_result.venue_names,
                        'time_range': smart_result.time_info,
                        'date_range': date_range,
                        'frequency': smart_result.date_info.get('recurring', 'once')
                    })
                else:
                    # Fallback to name-based creation
                    logger.info("DEBUG: Using name-based shift creation as fallback")
                    result = await self.shift_tool.execute({
                        'action': 'create_shifts',
                        'staff_names': [f"{s.get('username')}" for s in smart_result.resolved_staff],
                        'venue_names': smart_result.venue_names,
                        'time_range': smart_result.time_info,
                        'date_range': date_range,
                        'frequency': smart_result.date_info.get('recurring', 'once')
                    })
            except Exception as e:
                logger.error(f"Error creating real shifts: {e}")
                # Fallback to mock result if real creation fails
                result = {
                    'shifts_created': len(smart_result.resolved_staff),
                    'staff_count': len(smart_result.resolved_staff),
                    'venue_names': smart_result.venue_names,
                    'time_range': smart_result.time_info,
                    'date_range': smart_result.date_info,
                    'error': f'Real shift creation failed: {str(e)}',
                    'created_shifts': [
                        {
                            'staff_name': staff_name,
                            'venue_name': smart_result.venue_names[0],
                            'date': smart_result.date_info.get('start_date', 'tomorrow'),
                            'start_time': smart_result.time_info.get('start_time'),
                            'end_time': smart_result.time_info.get('end_time')
                        }
                        for staff_name in staff_names
                    ]
                }
            
            # Format the response
            message = self._format_smart_shift_creation_response(smart_result, result)
            
            return AgentResponse(
                content=message,
                data=result
            )
            
        except Exception as e:
            logger.error(f"Error handling smart shift creation: {e}")
            return AgentResponse(
                content=f"I encountered an error creating the shifts: {str(e)}"
            )
    
    async def _handle_general_shift_query_smart(self, smart_result, session_id: str) -> AgentResponse:
        """Handle general shift queries with smart parsing"""
        try:
            if smart_result.confidence < 0.3:
                # Low confidence, provide general help
                message = "I can help you with shift management tasks. Here are some things I can do:\n\n"
                message += "• Create shifts for staff members\n"
                message += "• Schedule recurring shifts (daily, weekly)\n"
                message += "• Assign shifts to multiple staff at once\n\n"
                message += "For example, you can say:\n"
                message += "- 'Create shifts for Nini at renatos pizza tomorrow 9 AM to 5 PM'\n"
                message += "- 'Give MR A shifts at BIMM from monday to friday'\n"
                message += "- 'Schedule daily shifts for Sarah next week'"
            else:
                # Higher confidence, provide contextual response
                message = await self.smart_parser.create_smart_response(smart_result.reasoning, smart_result)
            
            return AgentResponse(
                content=message,
                data={'capabilities': [cap.name for cap in self.capabilities], 'smart_result': smart_result.reasoning}
            )
            
        except Exception as e:
            logger.error(f"Error handling general smart shift query: {e}")
            return AgentResponse(
                content=f"I encountered an error processing your shift query: {str(e)}"
            )
    
    def _format_smart_shift_creation_response(self, smart_result, result: Dict[str, Any]) -> str:
        """Format smart shift creation response"""
        try:
            staff_names = [f"{s.get('first_name')} {s.get('last_name')}" for s in smart_result.resolved_staff]
            shifts_created = result.get('shifts_created', 0)
            
            message = f"✅ Successfully created {shifts_created} shifts!\n\n"
            message += f"👥 Staff: {', '.join(staff_names)}\n"
            
            if smart_result.venue_names:
                message += f"🏢 Venue: {', '.join(smart_result.venue_names)}\n"
            
            if smart_result.time_info:
                start_time = smart_result.time_info.get('start_time', '')
                end_time = smart_result.time_info.get('end_time', '')
                if start_time and end_time:
                    message += f"⏰ Time: {start_time} to {end_time}\n"
            
            if smart_result.date_info:
                if smart_result.date_info.get('start_date'):
                    message += f"📅 Date: {smart_result.date_info['start_date']}\n"
                elif smart_result.date_info.get('recurring'):
                    message += f"🔄 Recurring: {smart_result.date_info['recurring']}\n"
            
            message += f"\n🧠 AI Reasoning: {smart_result.reasoning}"
            
            return message
            
        except Exception as e:
            logger.error(f"Error formatting smart shift creation response: {e}")
            return f"Created {result.get('shifts_created', 0)} shifts successfully!"
    
    async def _handle_smart_shift_deletion(self, smart_result, session_id: str) -> AgentResponse:
        """Handle shift deletion with smart parsing results"""
        try:
            # Check if we have enough information
            if not smart_result.resolved_staff:
                if smart_result.staff_names:
                    return AgentResponse(
                        content=f"I couldn't find staff members named: {', '.join(smart_result.staff_names)}. Please check the names and try again."
                    )
                else:
                    return AgentResponse(
                        content="I need to know which staff member's shift to delete. Please specify the staff name."
                    )
            
            if not smart_result.date_info.get('start_date'):
                staff_names = [f"{s.get('first_name')} {s.get('last_name')}" for s in smart_result.resolved_staff]
                return AgentResponse(
                    content=f"I need to know which date to delete shifts for {', '.join(staff_names)}. Please specify the date."
                )
            
            # Find existing shifts for the staff member on the specified date
            shifts_to_delete = []
            staff_member = smart_result.resolved_staff[0]
            target_date = smart_result.date_info['start_date']
            
            # Get all shifts for this staff member (we'll need to implement a method to get shifts by staff and date)
            existing_shifts = await self._find_shifts_by_staff_and_date(staff_member['id'], target_date)
            
            if not existing_shifts:
                staff_name = f"{staff_member.get('first_name')} {staff_member.get('last_name')}"
                return AgentResponse(
                    content=f"No shifts found for {staff_name} on {target_date}."
                )
            
            # Delete the shifts
            shift_ids = [shift['id'] for shift in existing_shifts]
            result = await self.shift_tool.execute({
                'action': 'delete_shifts',
                'shift_ids': shift_ids
            })
            
            if 'error' in result:
                return AgentResponse(
                    content=f"I couldn't delete the shifts: {result['error']}"
                )
            
            # Format the response
            staff_name = f"{staff_member.get('first_name')} {staff_member.get('last_name')}"
            shifts_deleted = result.get('shifts_deleted', 0)
            
            message = f"✅ Successfully deleted {shifts_deleted} shift(s) for {staff_name} on {target_date}!"
            
            return AgentResponse(
                content=message,
                data=result
            )
            
        except Exception as e:
            logger.error(f"Error handling smart shift deletion: {e}")
            return AgentResponse(
                content=f"I encountered an error deleting the shifts: {str(e)}"
            )
    
    async def _handle_smart_shift_modification(self, smart_result, session_id: str) -> AgentResponse:
        """Handle shift time modification with smart parsing results"""
        try:
            # Check if we have enough information
            if not smart_result.resolved_staff:
                if smart_result.staff_names:
                    return AgentResponse(
                        content=f"I couldn't find staff members named: {', '.join(smart_result.staff_names)}. Please check the names and try again."
                    )
                else:
                    return AgentResponse(
                        content="I need to know which staff member's shift to modify. Please specify the staff name."
                    )
            
            if not smart_result.date_info.get('start_date'):
                staff_names = [f"{s.get('first_name')} {s.get('last_name')}" for s in smart_result.resolved_staff]
                return AgentResponse(
                    content=f"I need to know which date to modify shifts for {', '.join(staff_names)}. Please specify the date."
                )
            
            if not smart_result.time_info.get('start_time') or not smart_result.time_info.get('end_time'):
                staff_names = [f"{s.get('first_name')} {s.get('last_name')}" for s in smart_result.resolved_staff]
                return AgentResponse(
                    content=f"I need to know the new time for {', '.join(staff_names)}'s shift. Please specify the start and end times."
                )
            
            # Find existing shifts for the staff member on the specified date
            staff_member = smart_result.resolved_staff[0]
            target_date = smart_result.date_info['start_date']
            
            existing_shifts = await self._find_shifts_by_staff_and_date(staff_member['id'], target_date)
            
            if not existing_shifts:
                staff_name = f"{staff_member.get('first_name')} {staff_member.get('last_name')}"
                return AgentResponse(
                    content=f"No shifts found for {staff_name} on {target_date} to modify."
                )
            
            # Prepare update data with new times
            from datetime import datetime
            start_time = smart_result.time_info['start_time']
            end_time = smart_result.time_info['end_time']
            
            # Convert times to 24-hour format if needed
            if 'AM' in start_time or 'PM' in start_time:
                # Handle both "12:00 PM" and "12 PM" formats
                try:
                    start_time = datetime.strptime(start_time, '%I:%M %p').strftime('%H:%M')
                except ValueError:
                    start_time = datetime.strptime(start_time, '%I %p').strftime('%H:%M')
            if 'AM' in end_time or 'PM' in end_time:
                # Handle both "8:00 PM" and "8 PM" formats
                try:
                    end_time = datetime.strptime(end_time, '%I:%M %p').strftime('%H:%M')
                except ValueError:
                    end_time = datetime.strptime(end_time, '%I %p').strftime('%H:%M')
            
            logger.info(f"DEBUG: Converting times - start_time: {start_time}, end_time: {end_time}")
            
            # Update each shift with new times
            shift_updates = []
            for shift in existing_shifts:
                # Create new datetime strings with the target date and new times
                start_datetime = f"{target_date} {start_time}"
                end_datetime = f"{target_date} {end_time}"
                
                # Convert to ISO format
                start_iso = datetime.strptime(start_datetime, '%Y-%m-%d %H:%M').isoformat()
                end_iso = datetime.strptime(end_datetime, '%Y-%m-%d %H:%M').isoformat()
                
                # Preserve all existing shift data and only update times
                update_data = {
                    'id': shift['id'],
                    'start_time': start_iso,
                    'end_time': end_iso,
                    'staff_user': shift.get('staff_user'),
                    'venue': shift.get('venue'),
                    'status': shift.get('status', 'scheduled'),
                    'required_security_role': shift.get('required_security_role', 'sg'),
                    'manager_approved': shift.get('manager_approved', False),
                    'terms_accepted': shift.get('terms_accepted', False),
                    'break_duration': shift.get('break_duration', 0),
                    'notes': shift.get('notes', '')
                }
                shift_updates.append(update_data)
            
            # Update the shifts
            result = await self.shift_tool.execute({
                'action': 'update_shifts',
                'shift_updates': shift_updates
            })
            
            if 'error' in result:
                return AgentResponse(
                    content=f"I couldn't modify the shifts: {result['error']}"
                )
            
            # Format the response
            staff_name = f"{staff_member.get('first_name')} {staff_member.get('last_name')}"
            shifts_updated = result.get('shifts_updated', 0)
            
            message = f"✅ Successfully updated {shifts_updated} shift(s) for {staff_name} on {target_date}!"
            message += f"\n🕐 New time: {start_time} to {end_time}"
            
            return AgentResponse(
                content=message,
                data=result
            )
            
        except Exception as e:
            logger.error(f"Error handling smart shift modification: {e}")
            return AgentResponse(
                content=f"I encountered an error modifying the shifts: {str(e)}"
            )
    
    async def _find_shifts_by_staff_and_date(self, staff_id: int, target_date: str) -> List[Dict[str, Any]]:
        """Find existing shifts for a staff member on a specific date"""
        try:
            # Get all shifts from the API (we'll need to implement this method in the API client)
            # For now, we'll make a direct API call
            shifts = await self.api_client.get_shifts({
                'staff_user': staff_id,
                'date': target_date
            })
            
            return shifts if shifts else []
            
        except Exception as e:
            logger.error(f"Error finding shifts by staff and date: {e}")
            return []
    
    async def _resolve_staff_ultra_fast(self, name: str) -> Tuple[bool, Dict[str, Any], str]:
        """
        Ultra-fast staff resolution using vector database if available,
        with fallback to traditional search
        """
        try:
            # Use vector resolver if available (10x faster)
            if self.vector_staff_resolver:
                return await self.vector_staff_resolver.resolve_staff_with_fallback(name)
            
            # Fallback to traditional staff tool
            result = await self.staff_tool.find_staff_by_name(name)
            
            if result.get('found'):
                staff = result['staff']
                match_type = f"traditional_{result.get('match_type', 'unknown')}"
                return True, staff, match_type
            
            return False, {}, "not_found"
            
        except Exception as e:
            logger.error(f"Error in ultra-fast staff resolution: {e}")
            return False, {}, f"error_{str(e)}"
    
    async def _handle_smart_shift_reschedule(self, smart_result, session_id: str) -> AgentResponse:
        """Handle shift rescheduling with smart parsing results"""
        try:
            # Check if we have enough information
            if not smart_result.resolved_staff:
                if smart_result.staff_names:
                    return AgentResponse(
                        content=f"I couldn't find staff members named: {', '.join(smart_result.staff_names)}. Please check the names and try again."
                    )
                else:
                    return AgentResponse(
                        content="I need to know which staff member's shift to reschedule. Please specify the staff name."
                    )
            
            # Check if we have update information
            update_info = smart_result.update_info
            if not update_info.get('new_date') and not update_info.get('new_start_time') and not update_info.get('new_end_time'):
                staff_names = [f"{s.get('first_name')} {s.get('last_name')}" for s in smart_result.resolved_staff]
                return AgentResponse(
                    content=f"I need to know what to reschedule for {', '.join(staff_names)}. Please specify the new date, time, or both."
                )
            
            # Build criteria for finding shifts to reschedule
            staff_names = [f"{s.get('first_name')} {s.get('last_name')}" for s in smart_result.resolved_staff]
            venue_names = smart_result.venue_names
            
            # Convert relative dates to proper format
            date_range = smart_result.date_info.copy()
            if date_range.get('start_date') == 'tomorrow':
                from datetime import datetime, timedelta
                tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
                date_range['start_date'] = tomorrow
                if not date_range.get('end_date'):
                    date_range['end_date'] = tomorrow
            
            # Default to today if no date specified
            if not date_range.get('start_date'):
                from datetime import datetime
                today = datetime.now().strftime('%Y-%m-%d')
                date_range['start_date'] = today
                date_range['end_date'] = today
            
            # Reschedule shifts using the shift tool
            result = await self.shift_tool.execute({
                'action': 'reschedule_shifts',
                'staff_names': staff_names,
                'venue_names': venue_names,
                'date_range': date_range,
                'time_range': smart_result.time_info,
                'update_info': update_info
            })
            
            # Format the response
            if result.get('success'):
                rescheduled_count = result.get('shifts_rescheduled', 0)
                message = f"✅ Successfully rescheduled {rescheduled_count} shift(s)!\n\n"
                
                if staff_names:
                    message += f"👥 Staff: {', '.join(staff_names)}\n"
                if venue_names:
                    message += f"🏢 Venue: {', '.join(venue_names)}\n"
                
                if update_info.get('new_date'):
                    message += f"📅 New date: {update_info['new_date']}\n"
                if update_info.get('new_start_time'):
                    message += f"⏰ New start time: {update_info['new_start_time']}\n"
                if update_info.get('new_end_time'):
                    message += f"⏰ New end time: {update_info['new_end_time']}\n"
                
                failed_count = result.get('failed_updates', 0)
                if failed_count > 0:
                    message += f"\n⚠️ {failed_count} shift(s) could not be rescheduled"
            else:
                message = f"❌ {result.get('message', 'Could not reschedule shifts')}"
                
            return AgentResponse(
                content=message,
                data=result
            )
            
        except Exception as e:
            logger.error(f"Error handling smart shift reschedule: {e}")
            return AgentResponse(
                content=f"I encountered an error rescheduling shifts: {str(e)}"
            )
    
    async def _handle_smart_shift_view(self, smart_result, session_id: str) -> AgentResponse:
        """Handle shift viewing/listing with smart parsing results"""
        try:
            # Build criteria for finding shifts to view
            staff_names = [f"{s.get('first_name')} {s.get('last_name')}" for s in smart_result.resolved_staff]
            venue_names = smart_result.venue_names
            
            # Convert relative dates to proper format
            date_range = smart_result.date_info.copy()
            if date_range.get('start_date') == 'tomorrow':
                from datetime import datetime, timedelta
                tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
                date_range['start_date'] = tomorrow
                if not date_range.get('end_date'):
                    date_range['end_date'] = tomorrow
            
            # Default to today if no date specified and no staff/venue specified
            if not date_range.get('start_date') and not staff_names and not venue_names:
                from datetime import datetime
                today = datetime.now().strftime('%Y-%m-%d')
                date_range['start_date'] = today
                date_range['end_date'] = today
            
            # List shifts using the shift tool
            result = await self.shift_tool.execute({
                'action': 'list_shifts',
                'staff_names': staff_names,
                'venue_names': venue_names,
                'date_range': date_range if date_range.get('start_date') else None
            })
            
            # Format the response
            if result.get('success'):
                shifts_count = result.get('shifts_count', 0)
                shifts = result.get('shifts', [])
                
                if shifts_count == 0:
                    criteria_parts = []
                    if staff_names:
                        criteria_parts.append(f"staff: {', '.join(staff_names)}")
                    if venue_names:
                        criteria_parts.append(f"venue: {', '.join(venue_names)}")
                    if date_range.get('start_date'):
                        criteria_parts.append(f"date: {date_range['start_date']}")
                    
                    criteria_text = f" for {' | '.join(criteria_parts)}" if criteria_parts else ""
                    message = f"No shifts found{criteria_text}."
                else:
                    message = f"📋 Found {shifts_count} shift(s):\n\n"
                    
                    for shift in shifts[:10]:  # Show first 10 shifts
                        staff_name = shift.get('staff_name', 'Unknown')
                        venue_name = shift.get('venue_name', 'Unknown')
                        date = shift.get('date', 'Unknown')
                        start_time = shift.get('start_time', '').split('T')[1][:5] if 'T' in shift.get('start_time', '') else 'Unknown'
                        end_time = shift.get('end_time', '').split('T')[1][:5] if 'T' in shift.get('end_time', '') else 'Unknown'
                        status = shift.get('status', 'unknown')
                        
                        message += f"• {staff_name} at {venue_name}\n"
                        message += f"  📅 {date} | ⏰ {start_time} - {end_time} | 📊 {status}\n\n"
                    
                    if shifts_count > 10:
                        message += f"... and {shifts_count - 10} more shifts\n"
            else:
                message = f"❌ {result.get('message', 'Could not retrieve shifts')}"
                
            return AgentResponse(
                content=message,
                data=result
            )
            
        except Exception as e:
            logger.error(f"Error handling smart shift view: {e}")
            return AgentResponse(
                content=f"I encountered an error viewing shifts: {str(e)}"
            )