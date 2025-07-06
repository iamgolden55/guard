"""
Test script for the AI agents system.
"""
import asyncio
import logging
from typing import List

from agents.analytics_agent import AnalyticsAgent
from agents.payroll_agent import PayrollAgent
from agents.shift_management_agent import ShiftManagementAgent

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AgentTester:
    """Test class for AI agents"""
    
    def __init__(self):
        self.agents = {
            "analytics": AnalyticsAgent(),
            "payroll": PayrollAgent(),
            "shift_management": ShiftManagementAgent(),
        }
    
    async def test_agent_capabilities(self):
        """Test that all agents can be initialized and have capabilities"""
        print("🧪 Testing Agent Capabilities")
        print("=" * 40)
        
        for agent_name, agent in self.agents.items():
            print(f"\n{agent_name.upper()} AGENT:")
            print(f"  Name: {agent.name}")
            print(f"  Description: {agent.description}")
            print(f"  Capabilities: {len(agent.capabilities)}")
            for capability in agent.capabilities:
                print(f"    • {capability}")
    
    async def test_query_classification(self):
        """Test query classification across agents"""
        print("\n🔍 Testing Query Classification")
        print("=" * 40)
        
        test_queries = [
            # Analytics queries
            "How many times did MR A start his shift late?",
            "What is the attendance rate for this week?",
            "Show me performance trends for punctuality",
            
            # Payroll queries
            "What is the total pay for MR C for last week?",
            "Mark MR A and MR B salary as paid",
            "Show me the invoice status",
            
            # Shift management queries
            "Give MR A shifts at BIMM from monday to saturday everyday at 5:00 pm to 10:00pm",
            "Create shifts for MR B at LOCATION1 from 9 AM to 5 PM",
            "Schedule daily shifts for MR C next week",
            
            # General queries
            "Hello, what can you do?",
            "Help me with something",
        ]
        
        for query in test_queries:
            print(f"\nQuery: '{query}'")
            
            best_agent = None
            best_score = 0.0
            
            for agent_name, agent in self.agents.items():
                try:
                    can_handle, score = await agent.can_handle(query)
                    print(f"  {agent_name}: {can_handle} (score: {score:.2f})")
                    
                    if can_handle and score > best_score:
                        best_agent = agent_name
                        best_score = score
                
                except Exception as e:
                    print(f"  {agent_name}: ERROR - {e}")
            
            if best_agent:
                print(f"  → Best match: {best_agent} (score: {best_score:.2f})")
            else:
                print(f"  → No agent can handle this query")
    
    async def test_sample_queries(self):
        """Test processing of sample queries"""
        print("\n💬 Testing Sample Query Processing")
        print("=" * 40)
        
        sample_queries = [
            ("analytics", "How many times did MR A start his shift late?"),
            ("payroll", "What is the total pay for MR C for last week?"),
            ("shift_management", "Give MR A shifts at BIMM from monday to saturday everyday at 5:00 pm to 10:00pm"),
        ]
        
        for agent_name, query in sample_queries:
            print(f"\nTesting {agent_name} agent with: '{query}'")
            
            try:
                agent = self.agents[agent_name]
                response = await agent.process_query(query, "test_session", "test_user")
                
                print(f"  Success: {response.success}")
                print(f"  Message: {response.message[:200]}...")
                if response.data:
                    print(f"  Data keys: {list(response.data.keys())}")
                
            except Exception as e:
                print(f"  ERROR: {e}")
    
    async def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting AI Agents Test Suite")
        print("=" * 50)
        
        try:
            await self.test_agent_capabilities()
            await self.test_query_classification()
            await self.test_sample_queries()
            
            print("\n✅ All tests completed!")
            
        except Exception as e:
            print(f"\n❌ Test suite failed: {e}")
            logger.error(f"Test suite error: {e}")


async def main():
    """Main test function"""
    tester = AgentTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())