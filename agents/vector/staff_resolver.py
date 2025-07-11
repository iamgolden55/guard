"""
Vector database staff resolution system using LangChain and ChromaDB.
Provides instant, intelligent staff member resolution with fuzzy matching.
"""
import os
import logging
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

import chromadb
from sentence_transformers import SentenceTransformer
from chromadb.config import Settings

from api.client import ShiftManagementAPI

logger = logging.getLogger(__name__)


class VectorStaffResolver:
    """Ultra-fast staff resolution using vector similarity search"""
    
    def __init__(self, persist_directory: str = None):
        """Initialize vector staff resolver"""
        
        if persist_directory is None:
            persist_directory = str(Path(__file__).parent / "staff_vectors")
            
        # Initialize ChromaDB with persistence
        self.client = chromadb.PersistentClient(
            path=persist_directory,
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
        # Use sentence transformers for embeddings (faster than OpenAI)
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name="staff_members",
            metadata={"description": "Staff member names and variations for fast lookup"}
        )
        
        self.api_client = ShiftManagementAPI()
        self._staff_cache = {}
        self._last_update = None
        
    async def setup_staff_vectors(self, force_refresh: bool = False) -> bool:
        """Index all staff members with their name variations and nicknames"""
        try:
            # Check if we need to update
            if not force_refresh and self.collection.count() > 0:
                logger.info(f"✅ Vector database already contains {self.collection.count()} staff entries")
                return True
                
            logger.info("🔄 Setting up staff vector database...")
            
            # Get all staff from API
            staff_data = await self.api_client.get_staff()
            
            if not staff_data:
                logger.warning("No staff data available for vectorization")
                return False
                
            # Clear existing collection if force refresh
            if force_refresh and self.collection.count() > 0:
                self.client.delete_collection("staff_members")
                self.collection = self.client.get_or_create_collection(
                    name="staff_members",
                    metadata={"description": "Staff member names and variations for fast lookup"}
                )
            
            # Prepare documents for vectorization
            documents = []
            metadatas = []
            ids = []
            
            for staff in staff_data:
                # Create comprehensive text with all name variations
                variations = self._generate_name_variations(staff)
                text = " | ".join(variations)
                
                documents.append(text)
                metadatas.append({
                    "staff_id": int(staff['id']),
                    "username": str(staff.get('username', '')),
                    "first_name": str(staff.get('first_name', '')),
                    "last_name": str(staff.get('last_name', '')),
                    "full_name": f"{staff.get('first_name', '')} {staff.get('last_name', '')}".strip(),
                    "role": str(staff.get('role', '')),
                    "is_active": bool(staff.get('is_active', True)),
                    "email": str(staff.get('email', ''))
                })
                ids.append(f"staff_{staff['id']}")
                
                # Cache staff data
                self._staff_cache[staff['id']] = staff
            
            # Add to vector database
            self.collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            
            logger.info(f"✅ Vectorized {len(documents)} staff members")
            return True
            
        except Exception as e:
            logger.error(f"Error setting up staff vectors: {e}")
            return False
    
    def _generate_name_variations(self, staff: Dict[str, Any]) -> List[str]:
        """Generate all possible name variations for a staff member"""
        variations = []
        
        username = staff.get('username', '').strip()
        first_name = staff.get('first_name', '').strip()
        last_name = staff.get('last_name', '').strip()
        
        # Basic variations
        if username:
            variations.append(username)
            
        if first_name:
            variations.append(first_name)
            
        if last_name:
            variations.append(last_name)
            
        if first_name and last_name:
            variations.append(f"{first_name} {last_name}")
            variations.append(f"{last_name} {first_name}")
            variations.append(f"{first_name}{last_name}")  # No space
            
        # First name variations
        if first_name:
            # Common nicknames and shortenings
            if len(first_name) > 3:
                variations.append(first_name[:3])  # First 3 chars
                variations.append(first_name[:4])  # First 4 chars
                
            # Known nickname mappings (expandable)
            nickname_map = {
                'Ninioritse': ['Nini', 'Nina', 'Nin'],
                'Azemi': ['Aze', 'Az', 'Zemi'],
                'Alexander': ['Alex', 'Al', 'Xander'],
                'Elizabeth': ['Liz', 'Beth', 'Lizzy'],
                'Michael': ['Mike', 'Mick', 'Mickey'],
                'Christopher': ['Chris', 'Christie'],
                'William': ['Will', 'Bill', 'Willie'],
                'Jennifer': ['Jen', 'Jenny', 'Jenn'],
                'Matthew': ['Matt', 'Matty'],
                'Jessica': ['Jess', 'Jessie']
            }
            
            if first_name in nickname_map:
                variations.extend(nickname_map[first_name])
                
        # Last name variations
        if last_name:
            if len(last_name) > 4:
                variations.append(last_name[:4])  # First 4 chars of last name
                
        # Remove duplicates and empty strings
        variations = list(set(filter(None, variations)))
        
        return variations
    
    async def resolve_staff_fast(self, name: str, limit: int = 1) -> List[Dict[str, Any]]:
        """Ultra-fast staff resolution using vector similarity"""
        try:
            if not name or not name.strip():
                return []
                
            name = name.strip()
            
            # Ensure vectors are set up
            if self.collection.count() == 0:
                await self.setup_staff_vectors()
                
            # Query vector database
            results = self.collection.query(
                query_texts=[name],
                n_results=min(limit, 5),  # Get top 5 matches max
                include=['metadatas', 'distances']
            )
            
            if not results['metadatas'] or not results['metadatas'][0]:
                return []
                
            resolved_staff = []
            for i, metadata in enumerate(results['metadatas'][0]):
                distance = results['distances'][0][i]
                confidence = max(0.0, 1.0 - distance)  # Convert distance to confidence
                
                # Filter by confidence threshold
                if confidence > 0.3:  # Adjust threshold as needed
                    # Reconstruct staff data from metadata
                    staff_data = {
                        'id': metadata['staff_id'],
                        'username': metadata['username'],
                        'first_name': metadata['first_name'],
                        'last_name': metadata['last_name'],
                        'role': metadata['role'],
                        'is_active': metadata['is_active'],
                        'email': metadata['email'],
                        'match_confidence': confidence,
                        'match_type': 'vector_similarity'
                    }
                    resolved_staff.append(staff_data)
                    
            return resolved_staff[:limit]
            
        except Exception as e:
            logger.error(f"Error in vector staff resolution: {e}")
            return []
    
    async def resolve_staff_with_fallback(self, name: str) -> Tuple[bool, Dict[str, Any], str]:
        """
        Resolve staff with vector search first, fallback to traditional search
        Returns: (found, staff_data, match_type)
        """
        try:
            # Try vector search first (ultra-fast)
            vector_results = await self.resolve_staff_fast(name, limit=1)
            
            if vector_results:
                staff = vector_results[0]
                return True, staff, f"vector_match_{staff.get('match_confidence', 0):.2f}"
                
            # Fallback to traditional API search (slower)
            from tools.staff_tool import StaffTool
            staff_tool = StaffTool()
            
            traditional_result = await staff_tool.find_staff_by_name(name)
            
            if traditional_result.get('found'):
                staff = traditional_result['staff']
                staff['match_confidence'] = 0.8  # Assume high confidence for exact matches
                return True, staff, f"traditional_{traditional_result.get('match_type', 'unknown')}"
                
            return False, {}, "not_found"
            
        except Exception as e:
            logger.error(f"Error in staff resolution with fallback: {e}")
            return False, {}, f"error_{str(e)}"
    
    async def bulk_resolve_staff(self, names: List[str]) -> Dict[str, Dict[str, Any]]:
        """Resolve multiple staff names in a single operation"""
        try:
            results = {}
            
            if not names:
                return results
                
            # Query vector database with multiple names
            vector_results = self.collection.query(
                query_texts=names,
                n_results=1,  # Best match for each name
                include=['metadatas', 'distances']
            )
            
            for i, name in enumerate(names):
                if (i < len(vector_results['metadatas']) and 
                    vector_results['metadatas'][i] and 
                    vector_results['distances'][i]):
                    
                    metadata = vector_results['metadatas'][i][0]
                    distance = vector_results['distances'][i][0]
                    confidence = max(0.0, 1.0 - distance)
                    
                    if confidence > 0.3:
                        # Reconstruct staff data from metadata
                        staff_data = {
                            'id': metadata['staff_id'],
                            'username': metadata['username'],
                            'first_name': metadata['first_name'],
                            'last_name': metadata['last_name'],
                            'role': metadata['role'],
                            'is_active': metadata['is_active'],
                            'email': metadata['email'],
                            'match_confidence': confidence
                        }
                        results[name] = staff_data
                    else:
                        results[name] = None
                else:
                    results[name] = None
                    
            return results
            
        except Exception as e:
            logger.error(f"Error in bulk staff resolution: {e}")
            return {name: None for name in names}
    
    async def refresh_staff_cache(self) -> bool:
        """Refresh the staff vector database with latest data"""
        logger.info("🔄 Refreshing staff vector database...")
        return await self.setup_staff_vectors(force_refresh=True)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the vector database"""
        try:
            count = self.collection.count()
            return {
                "total_staff_vectors": count,
                "collection_name": self.collection.name,
                "cache_size": len(self._staff_cache),
                "status": "ready" if count > 0 else "needs_setup"
            }
        except Exception as e:
            return {
                "error": str(e),
                "status": "error"
            }


# Performance testing
class VectorPerformanceTester:
    """Test performance comparison between vector and traditional search"""
    
    def __init__(self):
        self.vector_resolver = VectorStaffResolver()
        
    async def run_performance_test(self, test_names: List[str], iterations: int = 100):
        """Compare vector vs traditional search performance"""
        import time
        
        print("🚀 Running Vector vs Traditional Search Performance Test")
        print("=" * 60)
        
        # Setup vector database
        await self.vector_resolver.setup_staff_vectors()
        
        # Test names
        if not test_names:
            test_names = ["Nini", "Azemi", "admin123", "eruwagolden", "Ninioritse"]
            
        # Vector search performance
        print("🔍 Testing Vector Search Performance...")
        vector_start = time.time()
        
        for _ in range(iterations):
            for name in test_names:
                await self.vector_resolver.resolve_staff_fast(name)
                
        vector_end = time.time()
        vector_time = vector_end - vector_start
        
        # Traditional search performance
        print("🐌 Testing Traditional Search Performance...")
        from tools.staff_tool import StaffTool
        staff_tool = StaffTool()
        
        traditional_start = time.time()
        
        for _ in range(iterations):
            for name in test_names:
                await staff_tool.find_staff_by_name(name)
                
        traditional_end = time.time()
        traditional_time = traditional_end - traditional_start
        
        # Results
        total_operations = iterations * len(test_names)
        
        print("\n📊 Performance Results:")
        print(f"Total operations: {total_operations}")
        print(f"Vector search time: {vector_time:.3f}s ({total_operations/vector_time:.0f} ops/sec)")
        print(f"Traditional search time: {traditional_time:.3f}s ({total_operations/traditional_time:.0f} ops/sec)")
        print(f"Speed improvement: {traditional_time/vector_time:.1f}x faster")
        print("=" * 60)
        
        return {
            "vector_time": vector_time,
            "traditional_time": traditional_time,
            "speed_improvement": traditional_time / vector_time,
            "total_operations": total_operations,
            "vector_ops_per_sec": total_operations / vector_time,
            "traditional_ops_per_sec": total_operations / traditional_time
        }


# Utility functions
async def init_vector_staff_resolver() -> VectorStaffResolver:
    """Initialize and setup vector staff resolver"""
    resolver = VectorStaffResolver()
    await resolver.setup_staff_vectors()
    return resolver


async def test_vector_system():
    """Test the vector staff resolution system"""
    print("🧪 Testing Vector Staff Resolution System")
    
    resolver = await init_vector_staff_resolver()
    
    test_cases = [
        "Nini",
        "Ninioritse", 
        "Azemi",
        "eruwagolden",
        "admin123",
        "John"  # Non-existent
    ]
    
    for name in test_cases:
        found, staff, match_type = await resolver.resolve_staff_with_fallback(name)
        if found:
            confidence = staff.get('match_confidence', 0)
            print(f"✅ '{name}' → {staff.get('first_name')} {staff.get('last_name')} ({match_type}, {confidence:.2f})")
        else:
            print(f"❌ '{name}' → Not found ({match_type})")


if __name__ == "__main__":
    asyncio.run(test_vector_system())