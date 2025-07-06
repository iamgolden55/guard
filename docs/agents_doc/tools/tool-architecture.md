# Tool Architecture

Comprehensive guide to the tool-based architecture that powers the AI Agents System, enabling modular, reusable operations across different agents.

## 🔧 Overview

The Tool Architecture provides a standardized way for agents to interact with data sources, perform calculations, and execute operations. Tools are modular, composable components that can be shared across different agents and combined to handle complex scenarios.

## 🏗️ Architecture Principles

### 1. Modular Design
- **Single Responsibility**: Each tool has one clear purpose
- **Reusability**: Tools can be used by multiple agents
- **Composability**: Tools can be combined for complex operations
- **Testability**: Each tool can be tested independently

### 2. Standardized Interface
- **Common Base Class**: All tools inherit from `BaseTool`
- **Consistent Method Signatures**: Predictable `execute()` method
- **Error Handling**: Standardized error responses
- **Logging**: Built-in execution tracking

### 3. Async Operations
- **Non-blocking I/O**: All operations are asynchronous
- **Concurrent Execution**: Multiple tools can run simultaneously
- **Timeout Handling**: Configurable timeout for operations
- **Resource Management**: Proper cleanup and connection management

## 🛠️ Base Tool Interface

### BaseTool Class
```python
class BaseTool(ABC):
    """Abstract base class for all agent tools"""
    
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
    
    @abstractmethod
    async def execute(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the tool with given parameters"""
        pass
    
    async def validate_parameters(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Validate tool parameters (override in subclasses if needed)"""
        return parameters
    
    def log_execution(self, parameters: Dict[str, Any], result: Dict[str, Any]) -> None:
        """Log tool execution for debugging and audit"""
        logger.info(f"Tool {self.name} executed", extra={
            "tool": self.name,
            "parameters": parameters,
            "success": "error" not in result
        })
```

### Tool Execution Pattern
```python
async def use_tool(self, tool: BaseTool, parameters: Dict[str, Any]) -> Dict[str, Any]:
    """Standard pattern for tool execution"""
    try:
        # Validate parameters
        validated_params = await tool.validate_parameters(parameters)
        
        # Execute tool
        result = await tool.execute(validated_params)
        
        # Log execution
        tool.log_execution(validated_params, result)
        
        return result
        
    except Exception as e:
        error_result = {"error": f"Tool execution failed: {str(e)}"}
        tool.log_execution(parameters, error_result)
        return error_result
```

## 🔄 Tool Categories

### 1. Data Access Tools
Tools that retrieve and query data from various sources.

**Examples**:
- **StaffTool**: Staff lookup and management
- **VenueTool**: Venue information retrieval
- **ShiftDataTool**: Raw shift data access

**Characteristics**:
- Read-only operations
- Database/API connectivity
- Search and filtering capabilities
- Data transformation and normalization

### 2. Analysis Tools
Tools that perform calculations, aggregations, and analysis on data.

**Examples**:
- **AnalyticsTool**: Statistical analysis and reporting
- **PerformanceTool**: Performance metric calculations
- **TrendTool**: Trend analysis and pattern recognition

**Characteristics**:
- Mathematical operations
- Statistical functions
- Data aggregation
- Pattern recognition

### 3. Operation Tools
Tools that perform actions and modify system state.

**Examples**:
- **ShiftTool**: Shift creation and management
- **PayrollTool**: Payment processing operations
- **NotificationTool**: Communication and alerts

**Characteristics**:
- State-changing operations
- Transaction handling
- Validation and conflict checking
- Rollback capabilities

### 4. Integration Tools
Tools that handle external service integration and communication.

**Examples**:
- **APIClientTool**: Backend API communication
- **EmailTool**: Email notifications
- **WebhookTool**: External system notifications

**Characteristics**:
- External service connectivity
- Protocol handling (HTTP, SMTP, etc.)
- Authentication management
- Error recovery and retries

## 📊 Tool Implementation Examples

### 1. Data Access Tool Example

#### StaffTool Implementation
```python
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
        elif action == "list_all":
            return await self.list_all_staff(parameters.get("filters", {}))
        else:
            return {"error": f"Unknown action: {action}"}
    
    async def find_staff_by_name(self, name: str) -> Dict[str, Any]:
        """Find staff member by name with intelligent matching"""
        try:
            # Search for staff using the API
            staff_list = await self.api_client.get_staff(search_query=name)
            
            if not staff_list:
                return {
                    "found": False,
                    "message": f"No staff member found with name '{name}'"
                }
            
            # Intelligent matching algorithm
            exact_matches = []
            partial_matches = []
            
            name_lower = name.lower()
            
            for staff in staff_list:
                full_name = f"{staff.get('first_name', '')} {staff.get('last_name', '')}".strip().lower()
                
                if name_lower == full_name:
                    exact_matches.append(staff)
                elif name_lower in full_name:
                    partial_matches.append(staff)
            
            # Return best match
            if exact_matches:
                return {"found": True, "staff": exact_matches[0], "match_type": "exact"}
            elif len(partial_matches) == 1:
                return {"found": True, "staff": partial_matches[0], "match_type": "partial"}
            else:
                return {
                    "found": False,
                    "message": f"Multiple matches found for '{name}'",
                    "suggestions": partial_matches
                }
                
        except Exception as e:
            return {"error": f"Failed to search for staff: {str(e)}"}
```

### 2. Analysis Tool Example

#### AnalyticsTool Implementation
```python
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
        elif action == "attendance_stats":
            return await self.get_attendance_stats(parameters)
        else:
            return {"error": f"Unknown analytics action: {action}"}
    
    async def get_late_start_count(self, staff_id: int, start_date: str, end_date: str) -> Dict[str, Any]:
        """Analyze late start patterns with detailed insights"""
        try:
            # Get shifts for the staff member
            shifts = await self.api_client.get_shifts({
                "staff_user": staff_id,
                "start_time__gte": start_date,
                "start_time__lte": end_date
            })
            
            # Analyze late starts
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
            return {"error": f"Failed to analyze late starts: {str(e)}"}
    
    def _is_late_start(self, shift: Dict[str, Any]) -> bool:
        """Determine if a shift was started late"""
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
```

### 3. Operation Tool Example

#### ShiftTool Implementation
```python
class ShiftTool(BaseTool):
    """Tool for shift creation and management"""
    
    def __init__(self):
        super().__init__(
            name="shift_tool",
            description="Handle shift creation, scheduling, and management"
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
        elif action == "bulk_create":
            return await self.bulk_create_shifts(parameters.get("shift_data", []))
        else:
            return {"error": f"Unknown shift action: {action}"}
    
    async def create_shifts(self, staff_names: List[str], venue_names: List[str], 
                          time_range: Dict, date_range: Dict, frequency: str) -> Dict[str, Any]:
        """Create shifts with comprehensive validation and error handling"""
        try:
            # Validate inputs
            if not staff_names:
                return {"error": "No staff names provided"}
            if not venue_names:
                return {"error": "No venue names provided"}
            if not time_range:
                return {"error": "No time range provided"}
            
            # Resolve staff members
            staff_members = []
            for staff_name in staff_names:
                staff_result = await self.staff_tool.find_staff_by_name(staff_name)
                if staff_result.get('found'):
                    staff_members.append(staff_result['staff'])
                else:
                    return {"error": f"Staff member '{staff_name}' not found"}
            
            # Resolve venues
            venues = []
            for venue_name in venue_names:
                venue_result = await self._find_venue(venue_name)
                if venue_result:
                    venues.append(venue_result)
                else:
                    return {"error": f"Venue '{venue_name}' not found"}
            
            # Generate shift dates
            shift_dates = self._generate_shift_dates(date_range, frequency)
            
            # Create shifts
            created_shifts = []
            total_shifts = 0
            
            for staff in staff_members:
                for venue in venues:
                    for shift_date in shift_dates:
                        try:
                            shift_data = await self._create_shift_data(
                                staff, venue, shift_date, time_range
                            )
                            
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
                            # Log error but continue with other shifts
                            logger.error(f"Error creating shift: {e}")
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
            return {"error": f"Failed to create shifts: {str(e)}"}
```

## 🔗 Tool Composition and Chaining

### Tool Composition Pattern
```python
class CompositeOperation:
    """Example of combining multiple tools for complex operations"""
    
    def __init__(self):
        self.staff_tool = StaffTool()
        self.analytics_tool = AnalyticsTool()
        self.payroll_tool = PayrollTool()
    
    async def generate_staff_performance_report(self, staff_name: str, period: str) -> Dict[str, Any]:
        """Combine multiple tools to generate comprehensive report"""
        
        # Step 1: Find staff member
        staff_result = await self.staff_tool.execute({
            "action": "find_by_name",
            "name": staff_name
        })
        
        if not staff_result.get("found"):
            return {"error": f"Staff member '{staff_name}' not found"}
        
        staff_id = staff_result["staff"]["id"]
        
        # Step 2: Get analytics data
        analytics_result = await self.analytics_tool.execute({
            "action": "performance_summary",
            "staff_id": staff_id,
            "period": period
        })
        
        # Step 3: Get payroll data
        payroll_result = await self.payroll_tool.execute({
            "action": "calculate_pay_summary",
            "staff_id": staff_id,
            "period": period
        })
        
        # Step 4: Combine results
        return {
            "staff_info": staff_result["staff"],
            "performance_metrics": analytics_result,
            "financial_summary": payroll_result,
            "report_generated": datetime.now().isoformat()
        }
```

### Parallel Tool Execution
```python
async def execute_parallel_analysis(self, staff_list: List[str]) -> Dict[str, Any]:
    """Execute multiple tool operations in parallel for efficiency"""
    
    tasks = []
    
    # Create parallel tasks for each staff member
    for staff_name in staff_list:
        task = self.analyze_single_staff(staff_name)
        tasks.append(task)
    
    # Execute all tasks concurrently
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Process results
    successful_results = []
    errors = []
    
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            errors.append(f"Error analyzing {staff_list[i]}: {str(result)}")
        else:
            successful_results.append(result)
    
    return {
        "successful_analyses": len(successful_results),
        "errors": len(errors),
        "results": successful_results,
        "error_details": errors
    }
```

## 🧪 Tool Testing Strategy

### Unit Testing
```python
import pytest
from unittest.mock import AsyncMock, Mock

class TestStaffTool:
    """Unit tests for StaffTool"""
    
    @pytest.fixture
    def staff_tool(self):
        tool = StaffTool()
        tool.api_client = AsyncMock()
        return tool
    
    @pytest.mark.asyncio
    async def test_find_staff_exact_match(self, staff_tool):
        """Test exact name matching"""
        # Mock API response
        staff_tool.api_client.get_staff.return_value = [
            {"id": 1, "first_name": "John", "last_name": "Smith"}
        ]
        
        # Execute tool
        result = await staff_tool.find_staff_by_name("John Smith")
        
        # Assertions
        assert result["found"] == True
        assert result["match_type"] == "exact"
        assert result["staff"]["id"] == 1
    
    @pytest.mark.asyncio
    async def test_find_staff_not_found(self, staff_tool):
        """Test handling of staff not found"""
        # Mock empty API response
        staff_tool.api_client.get_staff.return_value = []
        
        # Execute tool
        result = await staff_tool.find_staff_by_name("Nonexistent Person")
        
        # Assertions
        assert result["found"] == False
        assert "not found" in result["message"].lower()
```

### Integration Testing
```python
class TestToolIntegration:
    """Integration tests for tool interactions"""
    
    @pytest.mark.asyncio
    async def test_shift_creation_workflow(self):
        """Test complete shift creation workflow"""
        # Setup tools
        staff_tool = StaffTool()
        shift_tool = ShiftTool()
        
        # Test parameters
        parameters = {
            "action": "create_shifts",
            "staff_names": ["John Smith"],
            "venue_names": ["Store1"],
            "time_range": {"start_time": "09:00", "end_time": "17:00"},
            "date_range": {"start_date": "2024-01-15", "end_date": "2024-01-15"}
        }
        
        # Execute shift creation
        result = await shift_tool.execute(parameters)
        
        # Verify success
        assert result["success"] == True
        assert result["shifts_created"] > 0
```

## 📊 Tool Performance and Monitoring

### Performance Metrics
```python
class ToolPerformanceMonitor:
    """Monitor tool performance and usage"""
    
    def __init__(self):
        self.execution_times = {}
        self.success_rates = {}
        self.error_counts = {}
    
    async def execute_with_monitoring(self, tool: BaseTool, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute tool with performance monitoring"""
        start_time = time.time()
        tool_name = tool.name
        
        try:
            result = await tool.execute(parameters)
            execution_time = time.time() - start_time
            
            # Record metrics
            self._record_execution_time(tool_name, execution_time)
            self._record_success(tool_name, "error" not in result)
            
            return result
            
        except Exception as e:
            execution_time = time.time() - start_time
            
            # Record error
            self._record_execution_time(tool_name, execution_time)
            self._record_error(tool_name, str(e))
            
            return {"error": f"Tool execution failed: {str(e)}"}
    
    def get_performance_report(self) -> Dict[str, Any]:
        """Generate performance report for all tools"""
        return {
            "execution_times": self.execution_times,
            "success_rates": self.success_rates,
            "error_counts": self.error_counts
        }
```

## 🔧 Tool Configuration and Customization

### Tool Configuration
```python
class ToolConfig:
    """Configuration for tool behavior"""
    
    # Timeout settings
    DEFAULT_TIMEOUT = 30.0  # seconds
    LONG_OPERATION_TIMEOUT = 120.0  # seconds
    
    # Retry settings
    MAX_RETRIES = 3
    RETRY_DELAY = 1.0  # seconds
    
    # Caching settings
    CACHE_TTL = 300  # seconds
    ENABLE_CACHING = True
    
    # Logging settings
    LOG_LEVEL = "INFO"
    LOG_TOOL_PARAMETERS = True
    LOG_TOOL_RESULTS = False  # May contain sensitive data
```

### Custom Tool Implementation
```python
class CustomAnalyticsTool(BaseTool):
    """Example of custom tool for specific business needs"""
    
    def __init__(self, custom_config: Dict[str, Any]):
        super().__init__(
            name="custom_analytics_tool",
            description="Custom analytics for specific business metrics"
        )
        self.config = custom_config
        self.api_client = ShiftManagementAPI()
    
    async def execute(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute custom analytics operations"""
        metric_type = parameters.get("metric_type")
        
        if metric_type == "customer_satisfaction_correlation":
            return await self._analyze_satisfaction_correlation(parameters)
        elif metric_type == "revenue_per_staff_hour":
            return await self._calculate_revenue_efficiency(parameters)
        else:
            return {"error": f"Unknown custom metric: {metric_type}"}
    
    async def _analyze_satisfaction_correlation(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Custom analysis for customer satisfaction vs staff performance"""
        # Implementation specific to business needs
        pass
```

The Tool Architecture provides a robust, scalable foundation for building complex agent capabilities while maintaining modularity, testability, and performance.