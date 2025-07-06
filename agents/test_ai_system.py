#!/usr/bin/env python3
"""
Comprehensive test suite for the AI Agents System
Tests all agents and their capabilities with real queries
"""
import asyncio
import os
import sys
import time
import json
from typing import Dict, List, Any
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class AISystemTester:
    """Comprehensive tester for the AI Agents System"""
    
    def __init__(self):
        self.test_results = {
            'setup': {},
            'agents': {},
            'queries': {},
            'performance': {}
        }
        
    async def run_all_tests(self):
        """Run complete test suite"""
        print("🚀 Starting AI Agents System Test Suite")
        print("=" * 60)
        
        # Test 1: System Setup and Dependencies
        await self._test_setup()
        
        # Test 2: Agent Initialization
        await self._test_agent_initialization()
        
        # Test 3: Query Classification
        await self._test_query_classification()
        
        # Test 4: Natural Language Processing
        await self._test_nlp_capabilities()
        
        # Test 5: Real Query Processing
        await self._test_real_queries()
        
        # Test 6: Error Handling
        await self._test_error_handling()
        
        # Test 7: Performance
        await self._test_performance()
        
        # Generate final report
        self._generate_report()
    
    async def _test_setup(self):
        """Test system setup and dependencies"""
        print("\n📋 Testing System Setup...")
        
        setup_results = {}
        
        # Test Python imports
        try:
            import fastapi
            import redis
            setup_results['fastapi'] = '✅ OK'
        except ImportError as e:
            setup_results['fastapi'] = f'❌ FAIL: {e}'
        
        try:
            # Try importing LLM providers
            import openai
            setup_results['openai'] = '✅ OK'
        except ImportError:
            setup_results['openai'] = '⚠️  Not installed (optional)'
        
        try:
            import anthropic
            setup_results['anthropic'] = '✅ OK'
        except ImportError:
            setup_results['anthropic'] = '⚠️  Not installed (optional)'
        
        # Test configuration
        try:
            from config.settings import settings
            setup_results['configuration'] = '✅ OK'
            
            # Check if API keys are set
            if hasattr(settings, 'openai_api_key') and settings.openai_api_key:
                setup_results['openai_key'] = '✅ Configured'
            elif hasattr(settings, 'anthropic_api_key') and settings.anthropic_api_key:
                setup_results['anthropic_key'] = '✅ Configured'
            else:
                setup_results['llm_keys'] = '⚠️  No LLM API keys configured'
                
        except Exception as e:
            setup_results['configuration'] = f'❌ FAIL: {e}'
        
        # Test Redis (optional)
        try:
            import redis
            r = redis.Redis(host='localhost', port=6379, db=0, socket_timeout=2)
            r.ping()
            setup_results['redis'] = '✅ Connected'
        except Exception:
            setup_results['redis'] = '⚠️  Not available (optional)'
        
        self.test_results['setup'] = setup_results
        
        # Print results
        for component, status in setup_results.items():
            print(f"  {component}: {status}")
    
    async def _test_agent_initialization(self):
        """Test that all agents can be initialized"""
        print("\n🤖 Testing Agent Initialization...")
        
        agent_results = {}
        
        try:
            from agents.analytics_agent import AnalyticsAgent
            analytics = AnalyticsAgent()
            agent_results['analytics'] = {
                'status': '✅ OK',
                'name': analytics.name,
                'capabilities': len(analytics.capabilities)
            }
        except Exception as e:
            agent_results['analytics'] = {
                'status': f'❌ FAIL: {e}',
                'error': str(e)
            }
        
        try:
            from agents.payroll_agent import PayrollAgent
            payroll = PayrollAgent()
            agent_results['payroll'] = {
                'status': '✅ OK',
                'name': payroll.name,
                'capabilities': len(payroll.capabilities)
            }
        except Exception as e:
            agent_results['payroll'] = {
                'status': f'❌ FAIL: {e}',
                'error': str(e)
            }
        
        try:
            from agents.shift_management_agent import ShiftManagementAgent
            shift_mgmt = ShiftManagementAgent()
            agent_results['shift_management'] = {
                'status': '✅ OK',
                'name': shift_mgmt.name,
                'capabilities': len(shift_mgmt.capabilities)
            }
        except Exception as e:
            agent_results['shift_management'] = {
                'status': f'❌ FAIL: {e}',
                'error': str(e)
            }
        
        self.test_results['agents'] = agent_results
        
        # Print results
        for agent_name, result in agent_results.items():
            print(f"  {agent_name}: {result['status']}")
            if result['status'].startswith('✅'):
                print(f"    - Capabilities: {result.get('capabilities', 0)}")
    
    async def _test_query_classification(self):
        """Test query classification accuracy"""
        print("\n🔍 Testing Query Classification...")
        
        test_queries = [
            # Analytics queries
            ("How many times did John start late this month?", "analytics", "late_starts"),
            ("What's the attendance rate for Store1?", "analytics", "attendance"),
            ("Show me performance trends", "analytics", "performance"),
            
            # Payroll queries
            ("What is the total pay for Sarah last week?", "payroll", "pay_summary"),
            ("Mark Mike's salary as paid", "payroll", "mark_paid"),
            ("Show invoice status", "payroll", "invoice_status"),
            
            # Shift management queries
            ("Create shifts for John at Store1 from 9 AM to 5 PM", "shift_management", "create_shift"),
            ("Give Sarah shifts at BIMM from monday to friday", "shift_management", "create_shift"),
            ("Schedule the team for weekend coverage", "shift_management", "create_shift"),
            
            # General/ambiguous queries
            ("Hello", "unknown", "unknown"),
            ("Help me", "unknown", "unknown"),
        ]
        
        classification_results = []
        
        try:
            from parsers.query_parser import QueryParser
            parser = QueryParser()
            
            for query, expected_type, expected_intent in test_queries:
                try:
                    result = await parser.parse_query(query)
                    
                    classification_results.append({
                        'query': query,
                        'expected_type': expected_type,
                        'actual_type': result.query_type.value if result.query_type else 'unknown',
                        'confidence': result.confidence,
                        'staff_names': result.staff_names,
                        'venue_names': result.venue_names,
                        'correct': result.query_type.value == expected_type if result.query_type else False
                    })
                    
                except Exception as e:
                    classification_results.append({
                        'query': query,
                        'error': str(e)
                    })
            
        except Exception as e:
            print(f"  ❌ Query parser initialization failed: {e}")
            return
        
        # Calculate accuracy
        correct_classifications = sum(1 for r in classification_results if r.get('correct', False))
        total_tests = len([r for r in classification_results if 'error' not in r])
        accuracy = (correct_classifications / total_tests * 100) if total_tests > 0 else 0
        
        self.test_results['queries']['classification'] = {
            'accuracy': accuracy,
            'correct': correct_classifications,
            'total': total_tests,
            'results': classification_results
        }
        
        print(f"  Classification Accuracy: {accuracy:.1f}% ({correct_classifications}/{total_tests})")
        
        # Show detailed results
        for result in classification_results:
            if 'error' not in result:
                status = "✅" if result['correct'] else "❌"
                print(f"  {status} '{result['query'][:50]}...' → {result['actual_type']} ({result['confidence']:.2f})")
            else:
                print(f"  ❌ '{result['query'][:50]}...' → ERROR: {result['error']}")
    
    async def _test_nlp_capabilities(self):
        """Test natural language processing capabilities"""
        print("\n🧠 Testing NLP Capabilities...")
        
        nlp_tests = [
            # Staff name extraction
            {
                'query': "How many times did MR John Smith start late?",
                'expected_staff': ['John Smith'],
                'test_name': 'staff_extraction'
            },
            {
                'query': "Schedule Sarah and Mike for tomorrow",
                'expected_staff': ['Sarah', 'Mike'],
                'test_name': 'multi_staff_extraction'
            },
            
            # Venue extraction
            {
                'query': "Create shifts at BIMM for the team",
                'expected_venues': ['BIMM'],
                'test_name': 'venue_extraction'
            },
            
            # Time extraction
            {
                'query': "Schedule from 9 AM to 5 PM",
                'expected_times': ['9 AM', '5 PM'],
                'test_name': 'time_extraction'
            },
            
            # Date extraction
            {
                'query': "Show data from monday to friday",
                'expected_dates': ['monday', 'friday'],
                'test_name': 'date_extraction'
            }
        ]
        
        nlp_results = []
        
        try:
            from parsers.query_parser import QueryParser
            parser = QueryParser()
            
            for test in nlp_tests:
                try:
                    result = await parser.parse_query(test['query'])
                    
                    test_result = {
                        'test_name': test['test_name'],
                        'query': test['query'],
                        'success': True
                    }
                    
                    if 'expected_staff' in test:
                        test_result['staff_extracted'] = result.staff_names
                        test_result['staff_correct'] = set(result.staff_names) == set(test['expected_staff'])
                    
                    if 'expected_venues' in test:
                        test_result['venues_extracted'] = result.venue_names
                        test_result['venues_correct'] = set(result.venue_names) == set(test['expected_venues'])
                    
                    if 'expected_times' in test:
                        test_result['times_extracted'] = result.time_references
                        # Check if any expected times are found
                        test_result['times_correct'] = any(
                            expected in str(result.time_references) 
                            for expected in test['expected_times']
                        )
                    
                    if 'expected_dates' in test:
                        test_result['dates_extracted'] = result.date_references
                        test_result['dates_correct'] = any(
                            expected in str(result.date_references)
                            for expected in test['expected_dates']
                        )
                    
                    nlp_results.append(test_result)
                    
                except Exception as e:
                    nlp_results.append({
                        'test_name': test['test_name'],
                        'query': test['query'],
                        'success': False,
                        'error': str(e)
                    })
            
        except Exception as e:
            print(f"  ❌ NLP testing failed: {e}")
            return
        
        self.test_results['queries']['nlp'] = nlp_results
        
        # Print results
        for result in nlp_results:
            if result['success']:
                status_indicators = []
                for key in result.keys():
                    if key.endswith('_correct'):
                        status_indicators.append("✅" if result[key] else "❌")
                
                status = "✅" if all(result.get(k, True) for k in result.keys() if k.endswith('_correct')) else "⚠️"
                print(f"  {status} {result['test_name']}: {result['query'][:40]}...")
                
            else:
                print(f"  ❌ {result['test_name']}: ERROR - {result['error']}")
    
    async def _test_real_queries(self):
        """Test real query processing end-to-end"""
        print("\n💬 Testing Real Query Processing...")
        
        real_queries = [
            {
                'query': "What can you help me with?",
                'expected_success': True,
                'description': 'General capabilities query'
            },
            {
                'query': "How many shifts did we have last week?",
                'expected_success': True,
                'description': 'Analytics query (may need mock data)'
            },
            {
                'query': "Create a shift for John at Store1 tomorrow from 9 AM to 5 PM",
                'expected_success': True,
                'description': 'Shift creation query (may need mock data)'
            },
            {
                'query': "This is completely unrelated to anything",
                'expected_success': False,
                'description': 'Unrelated query should be handled gracefully'
            }
        ]
        
        query_results = []
        
        # Test if we can import and initialize agents
        try:
            from agents.analytics_agent import AnalyticsAgent
            from agents.payroll_agent import PayrollAgent
            from agents.shift_management_agent import ShiftManagementAgent
            
            agents = {
                'analytics': AnalyticsAgent(),
                'payroll': PayrollAgent(),
                'shift_management': ShiftManagementAgent()
            }
            
        except Exception as e:
            print(f"  ❌ Failed to initialize agents: {e}")
            return
        
        for test_query in real_queries:
            query = test_query['query']
            print(f"\n  Testing: '{query}'")
            
            try:
                # Find best agent
                best_agent = None
                best_score = 0.0
                
                for agent_name, agent in agents.items():
                    try:
                        can_handle, score = await agent.can_handle(query)
                        print(f"    {agent_name}: can_handle={can_handle}, score={score:.2f}")
                        
                        if can_handle and score > best_score:
                            best_agent = agent
                            best_score = score
                            
                    except Exception as e:
                        print(f"    {agent_name}: ERROR - {e}")
                
                if best_agent:
                    print(f"    → Selected: {best_agent.name} (score: {best_score:.2f})")
                    
                    # Process query
                    response = await best_agent.process_query(query, "test_session")
                    
                    query_results.append({
                        'query': query,
                        'agent_used': best_agent.name,
                        'success': 'error' not in response.content.lower(),
                        'message_length': len(response.content),
                        'has_data': response.data is not None,
                        'description': test_query['description']
                    })
                    
                    print(f"    ✅ Response: {response.content[:100]}...")
                    
                else:
                    print(f"    ⚠️  No agent could handle this query")
                    query_results.append({
                        'query': query,
                        'agent_used': None,
                        'success': False,
                        'message': 'No agent available',
                        'description': test_query['description']
                    })
                
            except Exception as e:
                print(f"    ❌ Error processing query: {e}")
                query_results.append({
                    'query': query,
                    'success': False,
                    'error': str(e),
                    'description': test_query['description']
                })
        
        self.test_results['queries']['real_queries'] = query_results
    
    async def _test_error_handling(self):
        """Test error handling capabilities"""
        print("\n🚨 Testing Error Handling...")
        
        error_tests = [
            "Query with invalid staff name XYZ123",
            "Create shifts at nonexistent venue FAKE_VENUE",
            "Show me data for invalid date format",
            "",  # Empty query
            "A" * 1000,  # Very long query
        ]
        
        error_results = []
        
        try:
            from agents.analytics_agent import AnalyticsAgent
            agent = AnalyticsAgent()
            
            for test_query in error_tests:
                try:
                    can_handle, score = await agent.can_handle(test_query)
                    response = await agent.process_query(test_query, "test_session")
                    
                    error_results.append({
                        'query': test_query[:50] + "..." if len(test_query) > 50 else test_query,
                        'handled_gracefully': True,
                        'success': 'error' not in response.content.lower(),
                        'has_error_message': 'error' in response.content.lower()
                    })
                    
                except Exception as e:
                    error_results.append({
                        'query': test_query[:50] + "..." if len(test_query) > 50 else test_query,
                        'handled_gracefully': False,
                        'error': str(e)
                    })
            
        except Exception as e:
            print(f"  ❌ Error testing failed: {e}")
            return
        
        self.test_results['queries']['error_handling'] = error_results
        
        # Print results
        for result in error_results:
            if result['handled_gracefully']:
                print(f"  ✅ Handled gracefully: '{result['query']}'")
            else:
                print(f"  ❌ Unhandled error: '{result['query']}' - {result['error']}")
    
    async def _test_performance(self):
        """Test system performance"""
        print("\n⚡ Testing Performance...")
        
        performance_results = {}
        
        try:
            from agents.analytics_agent import AnalyticsAgent
            agent = AnalyticsAgent()
            
            # Test query processing speed
            test_query = "How many staff do we have?"
            
            # Single query timing
            start_time = time.time()
            await agent.can_handle(test_query)
            single_query_time = time.time() - start_time
            
            # Multiple queries timing
            start_time = time.time()
            for _ in range(10):
                await agent.can_handle(test_query)
            multiple_queries_time = (time.time() - start_time) / 10
            
            performance_results = {
                'single_query_time': single_query_time,
                'average_query_time': multiple_queries_time,
                'queries_per_second': 1 / multiple_queries_time if multiple_queries_time > 0 else 0
            }
            
        except Exception as e:
            performance_results = {'error': str(e)}
        
        self.test_results['performance'] = performance_results
        
        if 'error' not in performance_results:
            print(f"  Single query: {performance_results['single_query_time']:.3f}s")
            print(f"  Average query: {performance_results['average_query_time']:.3f}s")
            print(f"  Queries/second: {performance_results['queries_per_second']:.1f}")
        else:
            print(f"  ❌ Performance testing failed: {performance_results['error']}")
    
    def _generate_report(self):
        """Generate final test report"""
        print("\n" + "=" * 60)
        print("📊 AI AGENTS SYSTEM TEST REPORT")
        print("=" * 60)
        
        # Setup summary
        setup_success = sum(1 for status in self.test_results['setup'].values() if '✅' in status)
        setup_total = len(self.test_results['setup'])
        
        print(f"\n🔧 Setup: {setup_success}/{setup_total} components OK")
        
        # Agent summary
        if 'agents' in self.test_results:
            agent_success = sum(1 for result in self.test_results['agents'].values() if '✅' in result['status'])
            agent_total = len(self.test_results['agents'])
            print(f"🤖 Agents: {agent_success}/{agent_total} initialized successfully")
        
        # Query classification summary
        if 'classification' in self.test_results.get('queries', {}):
            accuracy = self.test_results['queries']['classification']['accuracy']
            print(f"🔍 Query Classification: {accuracy:.1f}% accuracy")
        
        # Overall assessment
        print(f"\n📋 OVERALL ASSESSMENT:")
        
        if setup_success >= setup_total - 2:  # Allow some optional components to be missing
            print("✅ System is ready for use!")
            print("✅ Core components are functional")
            
            if 'agents' in self.test_results and agent_success == agent_total:
                print("✅ All agents initialized successfully")
            
            if 'classification' in self.test_results.get('queries', {}) and \
               self.test_results['queries']['classification']['accuracy'] > 70:
                print("✅ Query classification is working well")
            
            print(f"\n🚀 NEXT STEPS:")
            print("1. Set up your environment (.env file) with API keys")
            print("2. Configure your backend API connection")
            print("3. Start the server: python server.py")
            print("4. Test with real queries through the API")
            
        else:
            print("⚠️  System has some issues that need attention")
            print("❌ Check setup results above for missing components")
            
        # Save detailed results
        with open('test_results.json', 'w') as f:
            json.dump(self.test_results, f, indent=2, default=str)
        
        print(f"\n📄 Detailed results saved to: test_results.json")


async def main():
    """Main test function"""
    tester = AISystemTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())