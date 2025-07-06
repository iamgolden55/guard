"""
Intent parser for extracting specific intents and entities from queries.
"""
import re
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class TimeRange:
    """Time range representation"""
    start_time: str
    end_time: str
    timezone: Optional[str] = None


@dataclass
class DateRange:
    """Date range representation"""
    start_date: str
    end_date: str
    frequency: Optional[str] = None  # daily, weekly, monthly


class IntentParser:
    """Parser for extracting specific intents and structured data from queries"""
    
    def __init__(self):
        self._setup_patterns()
    
    def _setup_patterns(self):
        """Setup regex patterns for entity extraction"""
        # Time patterns with capture groups
        self.time_patterns = {
            'time_range': r'(?:from|between)\s+(\d{1,2}:\d{2})\s*(?:am|pm|AM|PM)?\s+(?:to|and)\s+(\d{1,2}:\d{2})\s*(?:am|pm|AM|PM)?',
            'single_time': r'(\d{1,2}:\d{2})\s*(am|pm|AM|PM)?',
            'time_with_am_pm': r'(\d{1,2})\s*(am|pm|AM|PM)',
        }
        
        # Date patterns
        self.date_patterns = {
            'day_range': r'(?:from|between)\s+(\w+)\s+(?:to|and)\s+(\w+)',
            'specific_date': r'(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})',
            'relative_date': r'(last|this|next)\s+(week|month|year)',
            'weekday': r'(monday|tuesday|wednesday|thursday|friday|saturday|sunday)',
            'frequency': r'(everyday|daily|weekly|monthly)',
        }
        
        # Staff patterns
        self.staff_patterns = {
            'formal_name': r'(?:MR|MS|DR|Miss|Mr|Ms|Dr)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
            'full_name': r'([A-Z][a-z]+\s+[A-Z][a-z]+)',
            'first_name': r'([A-Z][a-z]+)',
        }
        
        # Venue patterns
        self.venue_patterns = {
            'at_venue': r'(?:at|@)\s+([A-Z][A-Z0-9]+)',
            'venue_keyword': r'(?:venue|location|site)\s+([A-Z][A-Z0-9]+)',
        }
        
        # Frequency patterns
        self.frequency_patterns = {
            'daily': r'(?:everyday|daily|each day)',
            'weekly': r'(?:weekly|each week|every week)',
            'monthly': r'(?:monthly|each month|every month)',
        }
    
    async def parse_time_range(self, query: str) -> Optional[TimeRange]:
        """Extract time range from query"""
        try:
            # Try to find time range pattern
            for pattern_name, pattern in self.time_patterns.items():
                match = re.search(pattern, query, re.IGNORECASE)
                if match:
                    if pattern_name == 'time_range':
                        start_time = match.group(1)
                        end_time = match.group(2)
                        
                        # Handle AM/PM
                        if 'pm' in query.lower() and ':' in start_time:
                            if not start_time.endswith('pm'):
                                start_time += ' PM'
                        if 'pm' in query.lower() and ':' in end_time:
                            if not end_time.endswith('pm'):
                                end_time += ' PM'
                        
                        return TimeRange(start_time=start_time, end_time=end_time)
            
            return None
            
        except Exception as e:
            logger.error(f"Error parsing time range: {e}")
            return None
    
    async def parse_date_range(self, query: str) -> Optional[DateRange]:
        """Extract date range from query"""
        try:
            # Check for day range (monday to saturday)
            day_match = re.search(self.date_patterns['day_range'], query, re.IGNORECASE)
            if day_match:
                start_day = day_match.group(1).lower()
                end_day = day_match.group(2).lower()
                
                # Convert to actual dates (this week)
                start_date = self._get_date_for_weekday(start_day)
                end_date = self._get_date_for_weekday(end_day)
                
                # Check for frequency
                frequency = None
                if re.search(self.frequency_patterns['daily'], query, re.IGNORECASE):
                    frequency = 'daily'
                elif re.search(self.frequency_patterns['weekly'], query, re.IGNORECASE):
                    frequency = 'weekly'
                
                return DateRange(
                    start_date=start_date,
                    end_date=end_date,
                    frequency=frequency
                )
            
            # Check for relative dates (last week, this month, etc.)
            relative_match = re.search(self.date_patterns['relative_date'], query, re.IGNORECASE)
            if relative_match:
                modifier = relative_match.group(1).lower()
                period = relative_match.group(2).lower()
                
                start_date, end_date = self._calculate_relative_date_range(modifier, period)
                return DateRange(start_date=start_date, end_date=end_date)
            
            return None
            
        except Exception as e:
            logger.error(f"Error parsing date range: {e}")
            return None
    
    async def parse_staff_names(self, query: str) -> List[str]:
        """Extract staff names from query with better accuracy"""
        try:
            staff_names = []
            
            # Try formal names first (MR A, MS B, etc.)
            formal_matches = re.finditer(self.staff_patterns['formal_name'], query, re.IGNORECASE)
            for match in formal_matches:
                name = match.group(1).strip()
                if name and name not in staff_names:
                    staff_names.append(name)
            
            # If no formal names, try full names
            if not staff_names:
                full_name_matches = re.finditer(self.staff_patterns['full_name'], query)
                for match in full_name_matches:
                    name = match.group(1).strip()
                    if name and name not in staff_names:
                        staff_names.append(name)
            
            # Handle multiple staff with "and" connector
            if ' and ' in query:
                parts = query.split(' and ')
                for part in parts:
                    for pattern in self.staff_patterns.values():
                        match = re.search(pattern, part, re.IGNORECASE)
                        if match:
                            name = match.group(1).strip()
                            if name and name not in staff_names:
                                staff_names.append(name)
            
            return staff_names
            
        except Exception as e:
            logger.error(f"Error parsing staff names: {e}")
            return []
    
    async def parse_venue_names(self, query: str) -> List[str]:
        """Extract venue names from query"""
        try:
            venue_names = []
            
            for pattern_name, pattern in self.venue_patterns.items():
                matches = re.finditer(pattern, query, re.IGNORECASE)
                for match in matches:
                    venue = match.group(1).strip()
                    if venue and venue not in venue_names:
                        venue_names.append(venue)
            
            return venue_names
            
        except Exception as e:
            logger.error(f"Error parsing venue names: {e}")
            return []
    
    async def parse_frequency(self, query: str) -> Optional[str]:
        """Extract frequency information from query"""
        try:
            for freq_type, pattern in self.frequency_patterns.items():
                if re.search(pattern, query, re.IGNORECASE):
                    return freq_type
            return None
            
        except Exception as e:
            logger.error(f"Error parsing frequency: {e}")
            return None
    
    async def parse_shift_creation_intent(self, query: str) -> Dict[str, Any]:
        """Parse shift creation intent with all parameters"""
        try:
            result = {
                'action': 'create_shift',
                'staff_names': await self.parse_staff_names(query),
                'venue_names': await self.parse_venue_names(query),
                'time_range': await self.parse_time_range(query),
                'date_range': await self.parse_date_range(query),
                'frequency': await self.parse_frequency(query),
            }
            
            # Add any missing defaults
            if not result['date_range'] and result['frequency'] == 'daily':
                # Default to this week if daily frequency is specified
                result['date_range'] = DateRange(
                    start_date=datetime.now().strftime('%Y-%m-%d'),
                    end_date=(datetime.now() + timedelta(days=6)).strftime('%Y-%m-%d'),
                    frequency='daily'
                )
            
            return result
            
        except Exception as e:
            logger.error(f"Error parsing shift creation intent: {e}")
            return {'action': 'create_shift', 'error': str(e)}
    
    def _get_date_for_weekday(self, weekday: str) -> str:
        """Get the date for a specific weekday in the current week"""
        try:
            weekdays = {
                'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3,
                'friday': 4, 'saturday': 5, 'sunday': 6
            }
            
            if weekday.lower() not in weekdays:
                return datetime.now().strftime('%Y-%m-%d')
            
            today = datetime.now()
            days_ahead = weekdays[weekday.lower()] - today.weekday()
            
            if days_ahead <= 0:  # Target day already happened this week
                days_ahead += 7
            
            target_date = today + timedelta(days=days_ahead)
            return target_date.strftime('%Y-%m-%d')
            
        except Exception as e:
            logger.error(f"Error calculating weekday date: {e}")
            return datetime.now().strftime('%Y-%m-%d')
    
    def _calculate_relative_date_range(self, modifier: str, period: str) -> tuple:
        """Calculate date range for relative dates"""
        try:
            today = datetime.now()
            
            if period == 'week':
                if modifier == 'last':
                    start_date = today - timedelta(weeks=1)
                    end_date = today - timedelta(days=1)
                elif modifier == 'this':
                    start_date = today - timedelta(days=today.weekday())
                    end_date = start_date + timedelta(days=6)
                else:  # next
                    start_date = today + timedelta(days=7-today.weekday())
                    end_date = start_date + timedelta(days=6)
            
            elif period == 'month':
                if modifier == 'last':
                    start_date = today.replace(day=1) - timedelta(days=1)
                    start_date = start_date.replace(day=1)
                    end_date = today.replace(day=1) - timedelta(days=1)
                elif modifier == 'this':
                    start_date = today.replace(day=1)
                    next_month = today.replace(day=28) + timedelta(days=4)
                    end_date = next_month - timedelta(days=next_month.day)
                else:  # next
                    next_month = today.replace(day=28) + timedelta(days=4)
                    start_date = next_month.replace(day=1)
                    end_date = (start_date + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            
            else:  # year
                if modifier == 'last':
                    start_date = today.replace(year=today.year-1, month=1, day=1)
                    end_date = today.replace(year=today.year-1, month=12, day=31)
                elif modifier == 'this':
                    start_date = today.replace(month=1, day=1)
                    end_date = today.replace(month=12, day=31)
                else:  # next
                    start_date = today.replace(year=today.year+1, month=1, day=1)
                    end_date = today.replace(year=today.year+1, month=12, day=31)
            
            return start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')
            
        except Exception as e:
            logger.error(f"Error calculating relative date range: {e}")
            return today.strftime('%Y-%m-%d'), today.strftime('%Y-%m-%d')