# Query Parser Documentation

The Query Parser is the core natural language processing component that transforms human language into structured data that agents can understand and act upon.

## 📝 Overview

The Query Parser performs multi-stage analysis of natural language queries to extract:
- **Query Type**: Which domain the query belongs to (analytics, payroll, shifts)
- **Intent**: Specific action within the domain (late_starts, pay_summary, create_shift)
- **Entities**: Staff names, venues, dates, times, and other relevant data
- **Confidence Score**: How certain the parser is about the classification

## 🧠 Architecture

### Core Components

#### 1. QueryParser (`parsers/query_parser.py`)
Main orchestrator that coordinates all parsing activities.

```python
class QueryParser:
    def __init__(self):
        self.classifier = QueryClassifier()
        self._setup_patterns()
    
    async def parse_query(self, query: str) -> ParsedQuery:
        """Parse a natural language query into structured data"""
        # 1. Classify query type and intent
        query_type, intent, confidence = await self.classifier.classify(query)
        
        # 2. Extract entities
        staff_names = self._extract_staff_names(query)
        venue_names = self._extract_venue_names(query)
        date_references = self._extract_date_references(query)
        time_references = self._extract_time_references(query)
        
        # 3. Build parameters
        parameters = await self._extract_parameters(
            query, intent, staff_names, venue_names, 
            date_references, time_references
        )
        
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
```

#### 2. QueryClassifier (`parsers/query_parser.py`)
Determines what type of query this is and what the user wants to do.

```python
class QueryClassifier:
    def __init__(self):
        self._setup_classification_rules()
    
    async def classify(self, query: str) -> Tuple[QueryType, QueryIntent, float]:
        """Classify query and return type, intent, and confidence"""
        query_lower = query.lower()
        best_match = (QueryType.UNKNOWN, QueryIntent.UNKNOWN, 0.0)
        
        for query_type, intents in self.classification_rules.items():
            for intent, patterns in intents.items():
                for pattern in patterns:
                    if re.search(pattern, query_lower):
                        confidence = self._calculate_confidence(pattern, query_lower)
                        if confidence > best_match[2]:
                            best_match = (query_type, intent, confidence)
        
        return best_match
```

## 🎯 Query Types and Intents

### Analytics Queries
```python
QueryType.ANALYTICS = {
    QueryIntent.LATE_STARTS: [
        r'how many times.*late',
        r'late start.*count',
        r'started.*shift.*late',
        r'punctuality.*issues'
    ],
    QueryIntent.ATTENDANCE_STATS: [
        r'attendance.*statistics',
        r'how many.*shifts',
        r'attendance.*rate',
        r'show.*attendance'
    ],
    QueryIntent.PERFORMANCE_TRENDS: [
        r'performance.*trends',
        r'reliability.*score',
        r'punctuality.*trends',
        r'overtime.*analysis'
    ]
}
```

### Payroll Queries
```python
QueryType.PAYROLL = {
    QueryIntent.PAY_SUMMARY: [
        r'total.*pay',
        r'salary.*summary',
        r'earnings.*for',
        r'how much.*paid',
        r'weekly.*pay'
    ],
    QueryIntent.MARK_PAID: [
        r'mark.*paid',
        r'salary.*paid',
        r'payment.*complete',
        r'paid.*status'
    ]
}
```

### Shift Management Queries
```python
QueryType.SHIFT_MANAGEMENT = {
    QueryIntent.CREATE_SHIFT: [
        r'give.*shifts',
        r'create.*shift',
        r'schedule.*shift',
        r'assign.*shift',
        r'from.*to.*everyday'
    ],
    QueryIntent.COPY_SHIFTS: [
        r'copy.*shifts',
        r'duplicate.*shifts',
        r'repeat.*shifts'
    ]
}
```

## 🔍 Entity Extraction

### Staff Name Extraction
The parser identifies staff members using multiple patterns:

```python
staff_patterns = [
    r'(?:MR|MS|DR|Miss|Mr|Ms|Dr)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',  # Formal titles
    r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',  # General names
]

def _extract_staff_names(self, query: str) -> List[str]:
    """Extract staff names with intelligent matching"""
    names = []
    for pattern in self.staff_patterns:
        matches = re.finditer(pattern, query, re.IGNORECASE)
        for match in matches:
            name = match.group(1).strip()
            if name and name not in names:
                names.append(name)
    return names
```

**Example Extractions**:
```python
"How many times did MR John Smith start late?" → ["John Smith"]
"Schedule Sarah and Mike for tomorrow" → ["Sarah", "Mike"]  
"Give Dr. Johnson shifts at Store1" → ["Johnson"]
```

### Venue Name Extraction
Identifies business locations and venues:

```python
venue_patterns = [
    r'(?:at|@)\s+([A-Z][A-Z0-9]+)',  # At BIMM, @STORE1
    r'(?:venue|location|site)\s+([A-Z][A-Z0-9]+)',  # venue CAFE1
]

def _extract_venue_names(self, query: str) -> List[str]:
    """Extract venue identifiers"""
    venues = []
    for pattern in self.venue_patterns:
        matches = re.finditer(pattern, query, re.IGNORECASE)
        for match in matches:
            venue = match.group(1).strip()
            if venue and venue not in venues:
                venues.append(venue)
    return venues
```

**Example Extractions**:
```python
"Create shifts at BIMM for John" → ["BIMM"]
"Schedule team at Store1 and Store2" → ["Store1", "Store2"]
"Meeting at venue CAFE1" → ["CAFE1"]
```

### Date and Time Extraction
Handles various date and time formats:

```python
date_patterns = [
    r'(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)',  # Weekdays
    r'(?:last|this|next)\s+(?:week|month|year)',  # Relative periods
    r'(?:today|tomorrow|yesterday)',  # Relative days
    r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}',  # Numeric dates
]

time_patterns = [
    r'\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)',  # 9:00 AM
    r'\d{1,2}\s*(?:am|pm|AM|PM)',  # 9 AM
    r'(?:from|between)\s+\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)\s+(?:to|and)\s+\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)',  # Time ranges
]
```

**Example Extractions**:
```python
"Schedule John from monday to friday" → ["monday", "friday"]
"Create shifts from 9 AM to 5 PM" → ["9 AM to 5 PM"]
"Show data for last week" → ["last week"]
"Meeting tomorrow at 2:30 PM" → ["tomorrow", "2:30 PM"]
```

## 📊 Confidence Scoring

The parser calculates confidence scores to help agents decide if they can handle a query:

```python
def _calculate_confidence(self, pattern: str, query: str) -> float:
    """Calculate confidence score for pattern match"""
    # Base confidence for any match
    confidence = 0.7
    
    # Bonus for pattern specificity
    pattern_words = len(pattern.split())
    if pattern_words > 3:
        confidence += 0.1  # More specific patterns get higher confidence
    if pattern_words > 5:
        confidence += 0.1
    
    # Bonus for query complexity
    query_words = len(query.split())
    if query_words > 10:
        confidence += 0.05  # Longer queries often have clearer intent
    
    # Penalty for ambiguous terms
    ambiguous_terms = ['help', 'show', 'get', 'find']
    if any(term in query.lower() for term in ambiguous_terms):
        confidence -= 0.1
    
    return min(confidence, 1.0)  # Cap at 1.0
```

**Confidence Levels**:
- **0.9-1.0**: Very confident - specific patterns and clear intent
- **0.7-0.8**: Confident - good pattern match
- **0.5-0.6**: Moderate - partial match or ambiguous query
- **0.0-0.4**: Low confidence - unclear or no match

## 🛠️ Parameter Extraction

After classification, the parser extracts specific parameters for each intent:

```python
async def _extract_parameters(
    self, 
    query: str, 
    intent: QueryIntent, 
    staff_names: List[str], 
    venue_names: List[str], 
    date_references: List[str], 
    time_references: List[str]
) -> Dict[str, Any]:
    """Extract intent-specific parameters"""
    parameters = {}
    
    # Common parameters
    if staff_names:
        parameters['staff_names'] = staff_names
    if venue_names:
        parameters['venue_names'] = venue_names
    
    # Intent-specific extraction
    if intent == QueryIntent.LATE_STARTS:
        parameters['action'] = 'late_starts'
        if 'how many times' in query.lower():
            parameters['count_only'] = True
        if 'this month' in query.lower():
            parameters['period'] = 'this_month'
    
    elif intent == QueryIntent.CREATE_SHIFT:
        parameters['action'] = 'create_shift'
        if 'everyday' in query.lower():
            parameters['frequency'] = 'daily'
        if time_references:
            parameters['time_range'] = self._parse_time_range(time_references[0])
    
    return parameters
```

## 🧪 Testing and Validation

### Unit Tests for Parser Components

```python
class TestQueryParser:
    @pytest.mark.asyncio
    async def test_staff_name_extraction(self):
        parser = QueryParser()
        
        # Test formal titles
        query = "How many times did MR John Smith start late?"
        result = await parser.parse_query(query)
        assert "John Smith" in result.staff_names
        
        # Test multiple names
        query = "Schedule Sarah and Mike for tomorrow"
        result = await parser.parse_query(query)
        assert "Sarah" in result.staff_names
        assert "Mike" in result.staff_names
    
    @pytest.mark.asyncio
    async def test_analytics_classification(self):
        parser = QueryParser()
        
        query = "How many times did John start his shift late this month?"
        result = await parser.parse_query(query)
        
        assert result.query_type == QueryType.ANALYTICS
        assert result.intent == QueryIntent.LATE_STARTS
        assert result.confidence > 0.7
    
    @pytest.mark.asyncio
    async def test_payroll_classification(self):
        parser = QueryParser()
        
        query = "What is the total pay for Sarah last week?"
        result = await parser.parse_query(query)
        
        assert result.query_type == QueryType.PAYROLL
        assert result.intent == QueryIntent.PAY_SUMMARY
        assert result.confidence > 0.7
```

### Integration Tests

```python
class TestQueryParserIntegration:
    @pytest.mark.asyncio
    async def test_complex_shift_query(self):
        parser = QueryParser()
        
        query = "Give MR John shifts at BIMM from monday to saturday everyday at 5:00 pm to 10:00pm"
        result = await parser.parse_query(query)
        
        # Verify classification
        assert result.query_type == QueryType.SHIFT_MANAGEMENT
        assert result.intent == QueryIntent.CREATE_SHIFT
        
        # Verify entity extraction
        assert "John" in result.staff_names
        assert "BIMM" in result.venue_names
        assert "monday" in result.date_references
        assert "saturday" in result.date_references
        assert any("5:00 pm" in ref for ref in result.time_references)
        
        # Verify parameters
        assert result.parameters['action'] == 'create_shift'
        assert result.parameters['frequency'] == 'daily'
```

## 🎨 Query Pattern Examples

### Analytics Patterns
```python
# Late start queries
"How many times did John start late this month?"
"Show me late start statistics for Store1"  
"Which employees are consistently late?"
"What's the average late arrival time?"

# Attendance queries
"What's the attendance rate for this week?"
"Show attendance statistics for all venues"
"How many no-shows did we have yesterday?"
"Compare attendance across locations"

# Performance queries
"Show me performance trends for the quarter"
"Who are our most reliable staff members?"
"Analyze punctuality improvements over time"
```

### Payroll Patterns
```python
# Pay calculation queries
"What is the total pay for Sarah last week?"
"Calculate monthly earnings for the team"
"How much did Mike earn in overtime?"
"Show pay summary for December"

# Payment status queries
"Mark John and Sarah's salary as paid"
"Update payment status for Store1 staff"
"Show me all pending invoices"
"Which payments are overdue?"
```

### Shift Management Patterns
```python
# Basic shift creation
"Create a shift for John at Store1 tomorrow 9-5"
"Schedule Sarah for the evening shift"
"Assign Mike to weekend duty"

# Recurring schedules
"Give John shifts at BIMM from monday to saturday everyday at 5pm-10pm"
"Schedule the team for weekly shifts"
"Create daily coverage for Store1"

# Multi-staff assignments
"Schedule John, Sarah, and Mike for weekend shifts"
"Assign the whole team to holiday coverage"
"Create backup shifts for all venues"
```

## 🔧 Configuration and Customization

### Adding New Patterns
```python
# In query_parser.py
def add_custom_patterns(self):
    """Add business-specific patterns"""
    
    # Custom venue patterns for your business
    self.venue_patterns.extend([
        r'(?:store|shop)\s+(\d+)',  # store 1, shop 2
        r'(?:location|site)\s+([A-Z]+\d*)',  # location A1
    ])
    
    # Custom staff patterns
    self.staff_patterns.extend([
        r'(?:employee|worker)\s+(\w+)',  # employee John
        r'(\w+)\s+(?:from|in)\s+(?:store|department)',  # John from store
    ])
```

### Confidence Tuning
```python
class ConfidenceConfig:
    """Configuration for confidence calculation"""
    
    # Base confidence levels
    BASE_CONFIDENCE = 0.7
    SPECIFICITY_BONUS = 0.1
    COMPLEXITY_BONUS = 0.05
    AMBIGUITY_PENALTY = 0.1
    
    # Minimum confidence thresholds
    MIN_CONFIDENCE_ACCEPT = 0.6
    MIN_CONFIDENCE_CERTAIN = 0.8
```

The Query Parser forms the foundation of natural language understanding in the AI Agents system, enabling human-friendly interactions while maintaining the precision needed for reliable automated operations.