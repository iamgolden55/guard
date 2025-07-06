"""
Query parser for natural language processing and classification.
"""
import re
import logging
from typing import Any, Dict, List, Optional, Tuple
from enum import Enum
from dataclasses import dataclass

logger = logging.getLogger(__name__)


class QueryType(Enum):
    """Types of queries the system can handle"""
    ANALYTICS = "analytics"
    PAYROLL = "payroll"
    SHIFT_MANAGEMENT = "shift_management"
    PERFORMANCE = "performance"
    SCHEDULE = "schedule"
    UNKNOWN = "unknown"


class QueryIntent(Enum):
    """Specific intents within query types"""
    # Analytics intents
    LATE_STARTS = "late_starts"
    ATTENDANCE_STATS = "attendance_stats"
    PERFORMANCE_TRENDS = "performance_trends"
    HOURS_WORKED = "hours_worked"
    
    # Payroll intents
    PAY_SUMMARY = "pay_summary"
    MARK_PAID = "mark_paid"
    INVOICE_STATUS = "invoice_status"
    PAY_RATE_UPDATE = "pay_rate_update"
    
    # Shift management intents
    CREATE_SHIFT = "create_shift"
    COPY_SHIFTS = "copy_shifts"
    DELETE_SHIFT = "delete_shift"
    UPDATE_SHIFT = "update_shift"
    
    # Performance intents
    RELIABILITY_SCORE = "reliability_score"
    PUNCTUALITY_SCORE = "punctuality_score"
    OVERTIME_ANALYSIS = "overtime_analysis"
    
    # Schedule intents
    STAFF_AVAILABILITY = "staff_availability"
    VENUE_SCHEDULE = "venue_schedule"
    SCHEDULE_CONFLICTS = "schedule_conflicts"
    
    UNKNOWN = "unknown"


@dataclass
class ParsedQuery:
    """Parsed query with extracted information"""
    original_query: str
    query_type: QueryType
    intent: QueryIntent
    confidence: float
    parameters: Dict[str, Any]
    staff_names: List[str]
    venue_names: List[str]
    date_references: List[str]
    time_references: List[str]


class QueryParser:
    """Parser for natural language queries"""
    
    def __init__(self):
        self.classifier = QueryClassifier()
        self._setup_patterns()
    
    def _setup_patterns(self):
        """Setup regex patterns for parsing"""
        # Staff name patterns
        self.staff_patterns = [
            r'(?:MR|MS|DR|Miss|Mr|Ms|Dr)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
            r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',  # General name pattern
        ]
        
        # Venue patterns
        self.venue_patterns = [
            r'(?:at|@)\s+([A-Z][A-Z0-9]+)',  # At BIMM, @LOCATION
            r'(?:venue|location|site)\s+([A-Z][A-Z0-9]+)',
        ]
        
        # Date patterns
        self.date_patterns = [
            r'(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)',
            r'(?:last|this|next)\s+(?:week|month|year)',
            r'(?:today|tomorrow|yesterday)',
            r'(?:from|between)\s+\w+\s+(?:to|and)\s+\w+',
            r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}',
        ]
        
        # Time patterns
        self.time_patterns = [
            r'\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)',
            r'\d{1,2}\s*(?:am|pm|AM|PM)',
            r'(?:from|between)\s+\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)\s+(?:to|and)\s+\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)',
        ]
    
    async def parse_query(self, query: str) -> ParsedQuery:
        """Parse a natural language query"""
        try:
            # Classify the query
            query_type, intent, confidence = await self.classifier.classify(query)
            
            # Extract entities
            staff_names = self._extract_staff_names(query)
            venue_names = self._extract_venue_names(query)
            date_references = self._extract_date_references(query)
            time_references = self._extract_time_references(query)
            
            # Extract parameters based on intent
            parameters = await self._extract_parameters(query, intent, staff_names, venue_names, date_references, time_references)
            
            return ParsedQuery(
                original_query=query,
                query_type=query_type,
                intent=intent,
                confidence=confidence,
                parameters=parameters,
                staff_names=staff_names,
                venue_names=venue_names,
                date_references=date_references,
                time_references=time_references
            )
            
        except Exception as e:
            logger.error(f"Error parsing query: {e}")
            return ParsedQuery(
                original_query=query,
                query_type=QueryType.UNKNOWN,
                intent=QueryIntent.UNKNOWN,
                confidence=0.0,
                parameters={},
                staff_names=[],
                venue_names=[],
                date_references=[],
                time_references=[]
            )
    
    def _extract_staff_names(self, query: str) -> List[str]:
        """Extract staff names from query"""
        names = []
        for pattern in self.staff_patterns:
            matches = re.finditer(pattern, query, re.IGNORECASE)
            for match in matches:
                name = match.group(1).strip()
                if name and name not in names:
                    names.append(name)
        return names
    
    def _extract_venue_names(self, query: str) -> List[str]:
        """Extract venue names from query"""
        venues = []
        for pattern in self.venue_patterns:
            matches = re.finditer(pattern, query, re.IGNORECASE)
            for match in matches:
                venue = match.group(1).strip()
                if venue and venue not in venues:
                    venues.append(venue)
        return venues
    
    def _extract_date_references(self, query: str) -> List[str]:
        """Extract date references from query"""
        dates = []
        for pattern in self.date_patterns:
            matches = re.finditer(pattern, query, re.IGNORECASE)
            for match in matches:
                date = match.group(0).strip()
                if date and date not in dates:
                    dates.append(date)
        return dates
    
    def _extract_time_references(self, query: str) -> List[str]:
        """Extract time references from query"""
        times = []
        for pattern in self.time_patterns:
            matches = re.finditer(pattern, query, re.IGNORECASE)
            for match in matches:
                time = match.group(0).strip()
                if time and time not in times:
                    times.append(time)
        return times
    
    async def _extract_parameters(
        self, 
        query: str, 
        intent: QueryIntent, 
        staff_names: List[str], 
        venue_names: List[str], 
        date_references: List[str], 
        time_references: List[str]
    ) -> Dict[str, Any]:
        """Extract parameters based on intent"""
        parameters = {}
        
        # Common parameters
        if staff_names:
            parameters['staff_names'] = staff_names
        if venue_names:
            parameters['venue_names'] = venue_names
        if date_references:
            parameters['date_references'] = date_references
        if time_references:
            parameters['time_references'] = time_references
        
        # Intent-specific parameters
        if intent == QueryIntent.LATE_STARTS:
            parameters['action'] = 'late_starts'
            if 'how many times' in query.lower():
                parameters['count_only'] = True
        
        elif intent == QueryIntent.PAY_SUMMARY:
            parameters['action'] = 'pay_summary'
            if 'total pay' in query.lower():
                parameters['summary_type'] = 'total'
            elif 'weekly' in query.lower() or 'week' in query.lower():
                parameters['period'] = 'week'
            elif 'monthly' in query.lower() or 'month' in query.lower():
                parameters['period'] = 'month'
        
        elif intent == QueryIntent.MARK_PAID:
            parameters['action'] = 'mark_paid'
            if 'salary' in query.lower():
                parameters['payment_type'] = 'salary'
            elif 'invoice' in query.lower():
                parameters['payment_type'] = 'invoice'
        
        elif intent == QueryIntent.CREATE_SHIFT:
            parameters['action'] = 'create_shift'
            if 'everyday' in query.lower() or 'daily' in query.lower():
                parameters['frequency'] = 'daily'
            elif 'weekly' in query.lower():
                parameters['frequency'] = 'weekly'
        
        elif intent == QueryIntent.ATTENDANCE_STATS:
            parameters['action'] = 'attendance_stats'
            if 'this week' in query.lower():
                parameters['period'] = 'this_week'
            elif 'last week' in query.lower():
                parameters['period'] = 'last_week'
            elif 'this month' in query.lower():
                parameters['period'] = 'this_month'
        
        elif intent == QueryIntent.PERFORMANCE_TRENDS:
            parameters['action'] = 'performance_trends'
            if 'reliability' in query.lower():
                parameters['metric'] = 'reliability'
            elif 'punctuality' in query.lower():
                parameters['metric'] = 'punctuality'
            elif 'overtime' in query.lower():
                parameters['metric'] = 'overtime'
        
        return parameters


class QueryClassifier:
    """Classifier for determining query type and intent"""
    
    def __init__(self):
        self._setup_classification_rules()
    
    def _setup_classification_rules(self):
        """Setup classification rules"""
        self.classification_rules = {
            # Analytics patterns
            QueryType.ANALYTICS: {
                QueryIntent.LATE_STARTS: [
                    r'how many times.*late',
                    r'late start.*count',
                    r'started.*shift.*late',
                    r'punctuality.*issues',
                ],
                QueryIntent.ATTENDANCE_STATS: [
                    r'attendance.*statistics',
                    r'how many.*shifts',
                    r'attendance.*rate',
                    r'show.*attendance',
                ],
                QueryIntent.PERFORMANCE_TRENDS: [
                    r'performance.*trends',
                    r'reliability.*score',
                    r'punctuality.*trends',
                    r'overtime.*analysis',
                ],
                QueryIntent.HOURS_WORKED: [
                    r'hours.*worked',
                    r'total.*hours',
                    r'weekly.*hours',
                    r'monthly.*hours',
                ],
            },
            
            # Payroll patterns
            QueryType.PAYROLL: {
                QueryIntent.PAY_SUMMARY: [
                    r'total.*pay',
                    r'salary.*summary',
                    r'earnings.*for',
                    r'how much.*paid',
                    r'weekly.*pay',
                    r'monthly.*pay',
                ],
                QueryIntent.MARK_PAID: [
                    r'mark.*paid',
                    r'salary.*paid',
                    r'payment.*complete',
                    r'paid.*status',
                ],
                QueryIntent.INVOICE_STATUS: [
                    r'invoice.*status',
                    r'payment.*status',
                    r'outstanding.*invoices',
                ],
            },
            
            # Shift management patterns
            QueryType.SHIFT_MANAGEMENT: {
                QueryIntent.CREATE_SHIFT: [
                    r'give.*shifts',
                    r'create.*shift',
                    r'schedule.*shift',
                    r'assign.*shift',
                    r'from.*to.*everyday',
                ],
                QueryIntent.COPY_SHIFTS: [
                    r'copy.*shifts',
                    r'duplicate.*shifts',
                    r'repeat.*shifts',
                ],
                QueryIntent.DELETE_SHIFT: [
                    r'delete.*shift',
                    r'remove.*shift',
                    r'cancel.*shift',
                ],
            },
        }
    
    async def classify(self, query: str) -> Tuple[QueryType, QueryIntent, float]:
        """Classify a query and return type, intent, and confidence"""
        query_lower = query.lower()
        best_match = (QueryType.UNKNOWN, QueryIntent.UNKNOWN, 0.0)
        
        for query_type, intents in self.classification_rules.items():
            for intent, patterns in intents.items():
                for pattern in patterns:
                    if re.search(pattern, query_lower):
                        # Calculate confidence based on pattern match strength
                        confidence = self._calculate_confidence(pattern, query_lower)
                        if confidence > best_match[2]:
                            best_match = (query_type, intent, confidence)
        
        return best_match
    
    def _calculate_confidence(self, pattern: str, query: str) -> float:
        """Calculate confidence score for a pattern match"""
        # Simple confidence calculation based on pattern length and query length
        pattern_words = len(pattern.split())
        query_words = len(query.split())
        
        # Base confidence for a match
        confidence = 0.7
        
        # Adjust based on pattern specificity
        if pattern_words > 3:
            confidence += 0.1
        if pattern_words > 5:
            confidence += 0.1
        
        # Adjust based on query complexity
        if query_words > 10:
            confidence += 0.05
        
        return min(confidence, 1.0)