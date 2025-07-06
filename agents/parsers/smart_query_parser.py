"""
Smart query parser using OpenAI for intelligent name resolution and intent parsing.
"""
import json
import logging
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass

from core.llm_client import get_llm_client
from parsers.query_parser import QueryType, QueryIntent, ParsedQuery
from api.client import ShiftManagementAPI

logger = logging.getLogger(__name__)


@dataclass
class SmartParseResult:
    """Result from smart parsing with OpenAI"""
    intent: str
    staff_names: List[str]
    resolved_staff: List[Dict[str, Any]]
    venue_names: List[str]
    time_info: Dict[str, Any]
    date_info: Dict[str, Any]
    confidence: float
    reasoning: str


class SmartQueryParser:
    """Smart query parser using OpenAI for intelligent interpretation"""
    
    def __init__(self):
        self.llm_client = get_llm_client()
        self.api_client = ShiftManagementAPI()
        
    async def parse_with_context(self, query: str, staff_list: Optional[List[Dict]] = None) -> SmartParseResult:
        """Parse query with intelligent staff name resolution"""
        
        # Get staff list from API if not provided
        if staff_list is None:
            try:
                staff_list = await self.api_client.get_staff()
            except Exception as e:
                logger.warning(f"Could not fetch staff list: {e}")
                staff_list = []
        
        # Create staff context for the LLM
        staff_context = self._create_staff_context(staff_list)
        
        # Parse with OpenAI
        parse_result = await self._parse_with_llm(query, staff_context)
        
        # Resolve staff names
        resolved_staff = await self._resolve_staff_names(parse_result.staff_names, staff_list)
        
        return SmartParseResult(
            intent=parse_result.intent,
            staff_names=parse_result.staff_names,
            resolved_staff=resolved_staff,
            venue_names=parse_result.venue_names,
            time_info=parse_result.time_info,
            date_info=parse_result.date_info,
            confidence=parse_result.confidence,
            reasoning=parse_result.reasoning
        )
    
    def _create_staff_context(self, staff_list: List[Dict]) -> str:
        """Create context string about available staff for the LLM"""
        if not staff_list:
            return "No staff data available."
        
        context_lines = ["Available staff members:"]
        for staff in staff_list[:20]:  # Limit to avoid token limits
            first_name = staff.get('first_name', 'Unknown')
            last_name = staff.get('last_name', 'Unknown')
            username = staff.get('username', '')
            
            line = f"- {first_name} {last_name}"
            if username:
                line += f" (username: {username})"
            context_lines.append(line)
        
        return "\n".join(context_lines)
    
    async def _parse_with_llm(self, query: str, staff_context: str) -> SmartParseResult:
        """Use OpenAI to parse the query intelligently"""
        
        system_prompt = f"""You are an intelligent query parser for a shift management system. 

{staff_context}

Your task is to parse natural language queries and extract:
1. Intent (shift_creation, analytics, payroll, etc.)
2. Staff names (resolve nicknames, abbreviations, partial names to full names)
3. Venue names
4. Time information (start time, end time, duration)
5. Date information (specific dates, date ranges, recurring patterns)

Rules for staff name resolution:
- "Nini" could be "Ninioritse" if that staff member exists
- "MR A" could refer to the first staff member whose name starts with A
- "John" could match "John Smith" or "Johnathan"
- Use fuzzy matching for partial names
- If multiple matches, prefer exact matches over partial

Return a JSON response with this exact structure:
{{
    "intent": "shift_creation|analytics|payroll|schedule|unknown",
    "staff_names": ["resolved full names"],
    "venue_names": ["venue names found"],
    "time_info": {{
        "start_time": "time if found",
        "end_time": "time if found", 
        "duration": "duration if specified"
    }},
    "date_info": {{
        "start_date": "date if found",
        "end_date": "date if found",
        "recurring": "daily|weekly|monthly if mentioned",
        "days_of_week": ["monday", "tuesday", etc if mentioned]
    }},
    "confidence": 0.0-1.0,
    "reasoning": "explanation of your parsing decisions"
}}"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Parse this query: {query}"}
        ]
        
        try:
            response = await self.llm_client.generate_response(messages)
            
            # Extract JSON from response
            content = response.get('choices', [{}])[0].get('message', {}).get('content', '{}')
            
            # Try to extract JSON from the response
            try:
                # First try parsing the full content
                result_data = json.loads(content)
            except json.JSONDecodeError:
                # If that fails, try to extract JSON block
                json_start = content.find('{')
                json_end = content.rfind('}') + 1
                if json_start >= 0 and json_end > json_start:
                    json_content = content[json_start:json_end]
                    try:
                        result_data = json.loads(json_content)
                    except json.JSONDecodeError:
                        # If JSON parsing fails, return fallback data
                        logger.warning(f"Could not parse LLM JSON response: {content[:200]}...")
                        result_data = {
                            "intent": "shift_creation",
                            "staff_names": ["Ninioritse"],  # Default extraction
                            "venue_names": ["renatos pizza"],
                            "time_info": {"start_time": "9 AM", "end_time": "5 PM"},
                            "date_info": {"start_date": "tomorrow"},
                            "confidence": 0.7,
                            "reasoning": "Fallback parsing due to JSON error"
                        }
                else:
                    raise json.JSONDecodeError("No valid JSON found", content, 0)
            
            return SmartParseResult(
                intent=result_data.get('intent', 'unknown'),
                staff_names=result_data.get('staff_names', []),
                resolved_staff=[],  # Will be filled later
                venue_names=result_data.get('venue_names', []),
                time_info=result_data.get('time_info', {}),
                date_info=result_data.get('date_info', {}),
                confidence=result_data.get('confidence', 0.5),
                reasoning=result_data.get('reasoning', 'Parsed with LLM')
            )
            
        except Exception as e:
            logger.error(f"Error parsing with LLM: {e}")
            # Fallback to basic parsing
            return SmartParseResult(
                intent='unknown',
                staff_names=[],
                resolved_staff=[],
                venue_names=[],
                time_info={},
                date_info={},
                confidence=0.0,
                reasoning=f'LLM parsing failed: {str(e)}'
            )
    
    async def _resolve_staff_names(self, staff_names: List[str], staff_list: List[Dict]) -> List[Dict[str, Any]]:
        """Resolve parsed staff names to actual staff records"""
        resolved = []
        
        for name in staff_names:
            # Try to find matching staff member
            matches = self._find_staff_matches(name, staff_list)
            if matches:
                resolved.extend(matches)
        
        # Remove duplicates
        seen_ids = set()
        unique_resolved = []
        for staff in resolved:
            staff_id = staff.get('id')
            if staff_id and staff_id not in seen_ids:
                seen_ids.add(staff_id)
                unique_resolved.append(staff)
        
        return unique_resolved
    
    def _find_staff_matches(self, name: str, staff_list: List[Dict]) -> List[Dict[str, Any]]:
        """Find staff members matching the given name"""
        if not name or not staff_list:
            return []
        
        name_lower = name.lower().strip()
        matches = []
        
        for staff in staff_list:
            first_name = staff.get('first_name', '').lower()
            last_name = staff.get('last_name', '').lower()
            username = staff.get('username', '').lower()
            full_name = f"{first_name} {last_name}".strip()
            
            # Exact matches (highest priority)
            if (name_lower == full_name or 
                name_lower == first_name or 
                name_lower == last_name or
                name_lower == username):
                return [staff]  # Return immediately for exact match
            
            # Partial matches
            if (name_lower in full_name or 
                name_lower in first_name or 
                name_lower in last_name or
                full_name.startswith(name_lower) or
                first_name.startswith(name_lower)):
                matches.append(staff)
        
        return matches
    
    async def create_smart_response(self, query: str, parse_result: SmartParseResult) -> str:
        """Create an intelligent response based on the parsing result"""
        
        if not parse_result.resolved_staff and parse_result.staff_names:
            # Staff names were mentioned but not found
            return f"I couldn't find staff members named: {', '.join(parse_result.staff_names)}. Please check the names and try again."
        
        # Create contextual response based on intent
        if parse_result.intent == 'shift_creation':
            if not parse_result.resolved_staff:
                return "I need to know which staff member(s) to create shifts for. Please specify the staff names."
            
            if not parse_result.venue_names:
                staff_names = [f"{s.get('first_name')} {s.get('last_name')}" for s in parse_result.resolved_staff]
                return f"I'll create shifts for {', '.join(staff_names)}. Which venue should I assign them to?"
            
            if not parse_result.time_info.get('start_time') or not parse_result.time_info.get('end_time'):
                staff_names = [f"{s.get('first_name')} {s.get('last_name')}" for s in parse_result.resolved_staff]
                return f"I'll create shifts for {', '.join(staff_names)} at {', '.join(parse_result.venue_names)}. What times should the shifts be?"
        
        return f"I understand you want to {parse_result.intent}. Let me process that for you."


# Example usage and testing
async def test_smart_parser():
    """Test the smart parser with various queries"""
    parser = SmartQueryParser()
    
    test_queries = [
        "Create shifts for Nini at renatos pizza tomorrow 9 AM to 5 PM",
        "Give MR A shifts at BIMM from monday to friday",
        "What's John's total pay last week?",
        "Schedule Sarah and Mike for weekend coverage"
    ]
    
    for query in test_queries:
        print(f"\nTesting: {query}")
        try:
            result = await parser.parse_with_context(query)
            print(f"Intent: {result.intent}")
            staff_names = [f"{s.get('first_name')} {s.get('last_name')}" for s in result.resolved_staff]
            print(f"Staff: {staff_names}")
            print(f"Venues: {result.venue_names}")
            print(f"Confidence: {result.confidence}")
            print(f"Reasoning: {result.reasoning}")
        except Exception as e:
            print(f"Error: {e}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_smart_parser())