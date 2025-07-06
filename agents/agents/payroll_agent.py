"""
Payroll agent for handling payment and invoice-related queries.
"""
import logging
from typing import Any, Dict, List, Optional, Tuple

from agents.base_agent import BaseAgent, AgentResponse, AgentCapability
from tools.staff_tool import StaffTool
from tools.payroll_tool import PayrollTool
from parsers.query_parser import QueryParser, QueryIntent
from core.context_manager import ConversationContext

logger = logging.getLogger(__name__)


class PayrollAgent(BaseAgent):
    """Agent for handling payroll and payment queries"""
    
    def __init__(self):
        super().__init__(
            name="payroll_agent",
            description="Handle payroll, payments, and invoice queries"
        )
        
        self.query_parser = QueryParser()
    
    def _initialize_capabilities(self) -> None:
        """Initialize the payroll agent's capabilities"""
        capabilities = [
            AgentCapability(
                name="calculate_pay_summary",
                description="Calculate staff payment summaries for specified periods",
                examples=["What is the total pay for Sarah last week?", "Show John's salary this month"]
            ),
            AgentCapability(
                name="mark_paid",
                description="Mark invoices or salaries as paid",
                examples=["Mark Mike's salary as paid", "Mark all pending invoices as paid"]
            ),
            AgentCapability(
                name="check_payment_status",
                description="Check payment and invoice status",
                examples=["Show invoice status", "What payments are pending?"]
            ),
            AgentCapability(
                name="update_pay_rates",
                description="Update pay rates for staff members",
                examples=["Update John's hourly rate to $15"]
            ),
            AgentCapability(
                name="generate_reports",
                description="Generate payroll reports",
                examples=["Generate payroll report for this month"]
            )
        ]
        
        for capability in capabilities:
            self.add_capability(capability)
    
    def _initialize_tools(self) -> None:
        """Initialize the payroll agent's tools"""
        self.staff_tool = StaffTool()
        self.payroll_tool = PayrollTool()
        
        self.add_tool("staff_tool", self.staff_tool)
        self.add_tool("payroll_tool", self.payroll_tool)
    
    async def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> Tuple[bool, float]:
        """Check if this agent can handle the query"""
        try:
            parsed_query = await self.query_parser.parse_query(query)
            
            # Check for payroll-related intents
            payroll_intents = [
                QueryIntent.PAY_SUMMARY,
                QueryIntent.MARK_PAID,
                QueryIntent.INVOICE_STATUS,
                QueryIntent.PAY_RATE_UPDATE
            ]
            
            if parsed_query.intent in payroll_intents:
                return True, parsed_query.confidence
            
            # Check for payroll keywords
            payroll_keywords = [
                'pay', 'salary', 'payment', 'invoice', 'paid', 'earnings',
                'payroll', 'wage', 'compensation', 'total pay'
            ]
            
            query_lower = query.lower()
            if any(keyword in query_lower for keyword in payroll_keywords):
                return True, 0.7
            
            return False, 0.0
            
        except Exception as e:
            logger.error(f"Error checking if payroll agent can handle query: {e}")
            return False, 0.0
    
    async def process_query(self, query: str, session_id: str, user_id: Optional[str] = None) -> AgentResponse:
        """Process a payroll-related query"""
        try:
            # Parse the query
            parsed_query = await self.query_parser.parse_query(query)
            
            # Route to appropriate handler
            if parsed_query.intent == QueryIntent.PAY_SUMMARY:
                return await self._handle_pay_summary(parsed_query, session_id)
            elif parsed_query.intent == QueryIntent.MARK_PAID:
                return await self._handle_mark_paid(parsed_query, session_id)
            elif parsed_query.intent == QueryIntent.INVOICE_STATUS:
                return await self._handle_invoice_status(parsed_query, session_id)
            elif parsed_query.intent == QueryIntent.PAY_RATE_UPDATE:
                return await self._handle_pay_rate_update(parsed_query, session_id)
            else:
                return await self._handle_general_payroll_query(parsed_query, session_id)
                
        except Exception as e:
            logger.error(f"Error processing payroll query: {e}")
            return AgentResponse(
                content=f"I encountered an error processing your payroll query: {str(e)}",
                data={"error": str(e)}
            )
    
    async def _handle_pay_summary(self, parsed_query, session_id: str) -> AgentResponse:
        """Handle pay summary queries"""
        try:
            if not parsed_query.staff_names:
                return AgentResponse(
                    content="I need a staff member's name to calculate their pay summary. Please specify whose pay you'd like to see."
                )
            
            staff_name = parsed_query.staff_names[0]
            
            # Find the staff member
            staff_result = await self.staff_tool.find_staff_by_name(staff_name)
            if not staff_result.get('found'):
                return AgentResponse(
                    content=f"I couldn't find a staff member named '{staff_name}'. {staff_result.get('message', '')}"
                )
            
            staff_id = staff_result['staff']['id']
            
            # Determine the time period
            period = parsed_query.parameters.get('period', 'week')
            if 'last week' in parsed_query.original_query.lower():
                period = 'last_week'
            elif 'this week' in parsed_query.original_query.lower():
                period = 'this_week'
            elif 'last month' in parsed_query.original_query.lower():
                period = 'last_month'
            elif 'this month' in parsed_query.original_query.lower():
                period = 'this_month'
            
            # Calculate pay summary
            pay_summary = await self.payroll_tool.execute({
                'action': 'calculate_pay_summary',
                'staff_id': staff_id,
                'period': period
            })
            
            if 'error' in pay_summary:
                return AgentResponse(
                    content=f"I couldn't calculate the pay summary: {pay_summary['error']}"
                )
            
            # Format the response
            staff_full_name = f"{staff_result['staff']['first_name']} {staff_result['staff']['last_name']}"
            message = self._format_pay_summary_response(staff_full_name, pay_summary)
            
            return AgentResponse(
                content=message,
                data=pay_summary
            )
            
        except Exception as e:
            logger.error(f"Error handling pay summary: {e}")
            return AgentResponse(
                content=f"I encountered an error calculating the pay summary: {str(e)}"
            )
    
    async def _handle_mark_paid(self, parsed_query, session_id: str) -> AgentResponse:
        """Handle mark as paid queries"""
        try:
            if not parsed_query.staff_names:
                return AgentResponse(
                    content="I need staff member names to mark their payments as paid. Please specify whose salary/invoice should be marked as paid."
                )
            
            results = []
            
            for staff_name in parsed_query.staff_names:
                # Find the staff member
                staff_result = await self.staff_tool.find_staff_by_name(staff_name)
                if not staff_result.get('found'):
                    results.append({
                        'staff_name': staff_name,
                        'success': False,
                        'message': f"Staff member '{staff_name}' not found"
                    })
                    continue
                
                staff_id = staff_result['staff']['id']
                
                # Mark invoices as paid
                mark_paid_result = await self.payroll_tool.execute({
                    'action': 'mark_as_paid',
                    'staff_id': staff_id,
                    'payment_type': parsed_query.parameters.get('payment_type', 'salary')
                })
                
                staff_full_name = f"{staff_result['staff']['first_name']} {staff_result['staff']['last_name']}"
                
                if 'error' in mark_paid_result:
                    results.append({
                        'staff_name': staff_full_name,
                        'success': False,
                        'message': mark_paid_result['error']
                    })
                else:
                    results.append({
                        'staff_name': staff_full_name,
                        'success': True,
                        'message': f"Successfully marked {mark_paid_result.get('invoices_updated', 0)} invoices as paid"
                    })
            
            # Format response
            success_count = sum(1 for r in results if r['success'])
            total_count = len(results)
            
            if success_count == total_count:
                message = f"Successfully marked payments as paid for {success_count} staff member(s):\n"
                for result in results:
                    message += f"• {result['staff_name']}: {result['message']}\n"
            else:
                message = f"Marked payments as paid for {success_count} out of {total_count} staff members:\n"
                for result in results:
                    status = "✓" if result['success'] else "✗"
                    message += f"{status} {result['staff_name']}: {result['message']}\n"
            
            return AgentResponse(
                content=message.strip(),
                data={'results': results}
            )
            
        except Exception as e:
            logger.error(f"Error handling mark paid: {e}")
            return AgentResponse(
                content=f"I encountered an error marking payments as paid: {str(e)}"
            )
    
    async def _handle_invoice_status(self, parsed_query, session_id: str) -> AgentResponse:
        """Handle invoice status queries"""
        try:
            # Get invoice status information
            status_result = await self.payroll_tool.execute({
                'action': 'get_invoice_status',
                'staff_names': parsed_query.staff_names,
                'filters': parsed_query.parameters
            })
            
            if 'error' in status_result:
                return AgentResponse(
                    content=f"I couldn't get invoice status: {status_result['error']}"
                )
            
            message = self._format_invoice_status_response(status_result)
            
            return AgentResponse(
                content=message,
                data=status_result
            )
            
        except Exception as e:
            logger.error(f"Error handling invoice status: {e}")
            return AgentResponse(
                content=f"I encountered an error getting invoice status: {str(e)}"
            )
    
    async def _handle_pay_rate_update(self, parsed_query, session_id: str) -> AgentResponse:
        """Handle pay rate update queries"""
        try:
            # This would handle queries like "update John's pay rate to $15/hour"
            # Implementation would depend on the specific query format
            return AgentResponse(
                content="Pay rate updates are not yet implemented. Please contact your administrator."
            )
            
        except Exception as e:
            logger.error(f"Error handling pay rate update: {e}")
            return AgentResponse(
                content=f"I encountered an error updating pay rates: {str(e)}"
            )
    
    async def _handle_general_payroll_query(self, parsed_query, session_id: str) -> AgentResponse:
        """Handle general payroll queries that don't fit specific intents"""
        try:
            # Analyze the query for general payroll information
            message = "I can help you with payroll-related queries. Here are some things I can do:\n"
            message += "• Calculate pay summaries for staff members\n"
            message += "• Mark invoices or salaries as paid\n"
            message += "• Check payment status\n"
            message += "• Generate payroll reports\n\n"
            message += "Please specify what you'd like to know about payroll or payments."
            
            return AgentResponse(
                content=message,
                data={'capabilities': [cap.name for cap in self.capabilities]}
            )
            
        except Exception as e:
            logger.error(f"Error handling general payroll query: {e}")
            return AgentResponse(
                content=f"I encountered an error processing your payroll query: {str(e)}"
            )
    
    def _format_pay_summary_response(self, staff_name: str, pay_summary: Dict[str, Any]) -> str:
        """Format pay summary response"""
        try:
            period = pay_summary.get('period', {})
            period_str = f"from {period.get('start', 'N/A')} to {period.get('end', 'N/A')}"
            
            message = f"Pay Summary for {staff_name} {period_str}:\n\n"
            message += f"💰 Total Pay: ${pay_summary.get('total_pay', 0):.2f}\n"
            message += f"⏰ Total Hours: {pay_summary.get('total_hours', 0)} hours\n"
            message += f"📊 Regular Hours: {pay_summary.get('regular_hours', 0)} hours\n"
            message += f"⚡ Overtime Hours: {pay_summary.get('overtime_hours', 0)} hours\n"
            message += f"🏢 Shifts Worked: {pay_summary.get('shifts_worked', 0)}\n"
            message += f"💵 Average Rate: ${pay_summary.get('average_hourly_rate', 0):.2f}/hour\n"
            
            venues = pay_summary.get('venues', [])
            if venues:
                message += f"🏪 Venues: {', '.join(venues)}\n"
            
            return message
            
        except Exception as e:
            logger.error(f"Error formatting pay summary response: {e}")
            return f"Pay summary for {staff_name}: ${pay_summary.get('total_pay', 0):.2f}"
    
    def _format_invoice_status_response(self, status_result: Dict[str, Any]) -> str:
        """Format invoice status response"""
        try:
            message = "Invoice Status Summary:\n\n"
            
            total_invoices = status_result.get('total_invoices', 0)
            paid_invoices = status_result.get('paid_invoices', 0)
            pending_invoices = status_result.get('pending_invoices', 0)
            overdue_invoices = status_result.get('overdue_invoices', 0)
            
            message += f"📋 Total Invoices: {total_invoices}\n"
            message += f"✅ Paid: {paid_invoices}\n"
            message += f"⏳ Pending: {pending_invoices}\n"
            message += f"🔴 Overdue: {overdue_invoices}\n"
            
            if status_result.get('total_amount_due'):
                message += f"💰 Total Amount Due: ${status_result['total_amount_due']:.2f}\n"
            
            return message
            
        except Exception as e:
            logger.error(f"Error formatting invoice status response: {e}")
            return "Invoice status information is available."