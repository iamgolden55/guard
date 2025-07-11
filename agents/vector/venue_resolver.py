"""
Vector-based venue resolution for ultra-fast venue name lookup and matching.
"""
import logging
from typing import List, Dict, Any, Optional, Tuple
import asyncio
from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.config import Settings

from api.client import ShiftManagementAPI

logger = logging.getLogger(__name__)


class VectorVenueResolver:
    """Ultra-fast venue resolution using vector embeddings"""
    
    def __init__(self, api_client: ShiftManagementAPI = None):
        self.api_client = api_client or ShiftManagementAPI()
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Initialize ChromaDB client
        self.client = chromadb.Client(Settings(
            anonymized_telemetry=False,
            allow_reset=True
        ))
        
        # Create or get collection for venues
        self.collection = self.client.get_or_create_collection(
            name="venues",
            metadata={"description": "Venue names and variations for fast lookup"}
        )
        
        # In-memory cache for venue data
        self._venue_cache = {}
        
        logger.info("🏢 Vector venue resolver initialized")
    
    def _generate_venue_variations(self, venue: Dict[str, Any]) -> List[str]:
        """Generate various name formats for a venue"""
        variations = []
        
        # Main venue name
        name = venue.get('name', '').strip()
        if name:
            variations.append(name)
            variations.append(name.lower())
            variations.append(name.upper())
            
            # Common variations
            variations.append(name.replace(' ', ''))  # No spaces
            variations.append(name.replace('\'', ''))  # No apostrophes
            variations.append(name.replace('-', ' '))  # Hyphens to spaces
            variations.append(name.replace('&', 'and'))  # & to and
            
            # Short forms
            words = name.split()
            if len(words) > 1:
                variations.append(''.join([w[0].upper() for w in words]))  # Initials
                variations.append(words[0])  # First word only
                variations.append(words[-1])  # Last word only
                
            # Common typos and variations for Left Handed Giant
            if 'left handed giant' in name.lower():
                variations.extend([
                    'left handed gaint',  # Common typo
                    'left hand giant',
                    'left hand gaint', 
                    'lefthanded giant',
                    'lefthanded gaint',
                    'LHG',
                    'left giant',
                    'giant'
                ])
            
            # Common typos for other venues
            if 'renatos' in name.lower():
                variations.extend(['renato', 'renato pizza', 'pizza'])
            
            if 'bimm' in name.lower():
                variations.extend(['bim', 'institute', 'university'])
                
            if 'rough trade' in name.lower():
                variations.extend(['rough', 'trade', 'RT'])
        
        # Address components
        address = venue.get('address', '').strip()
        if address:
            variations.append(address)
            # Extract useful parts from address
            address_parts = address.split()
            for part in address_parts:
                if len(part) > 3:  # Skip very short words
                    variations.append(part)
        
        # Remove duplicates and empty strings
        variations = list(set([v for v in variations if v.strip()]))
        
        return variations
    
    def _find_exact_text_matches(self, name: str) -> List[Dict[str, Any]]:
        """Find venues with exact text matches in their document variations"""
        try:
            # Get all documents
            results = self.collection.query(
                query_texts=[""],  # Empty query to get all
                n_results=self.collection.count(),
                include=['metadatas', 'documents']
            )
            
            name_lower = name.lower().strip()
            matches = []
            
            for metadata, document in zip(results['metadatas'][0], results['documents'][0]):
                # Check if the search term appears as a complete variation in the document
                document_variations = [var.strip().lower() for var in document.split(' | ')]
                
                if name_lower in document_variations:
                    venue_data = {
                        'id': metadata['venue_id'],
                        'name': metadata['name'],
                        'address': metadata['address'],
                        'latitude': metadata['latitude'],
                        'longitude': metadata['longitude'],
                        'match_confidence': 1.0  # Perfect match
                    }
                    matches.append(venue_data)
            
            return matches
            
        except Exception as e:
            logger.error(f"Error in exact text matching: {e}")
            return []
    
    async def setup_venue_vectors(self, force_refresh: bool = False) -> bool:
        """Set up venue vector database from API data"""
        try:
            logger.info("🔄 Setting up venue vector database...")
            
            # Get all venues from API
            venue_data = await self.api_client.get_venues()
            
            if not venue_data:
                logger.warning("No venue data available for vectorization")
                return False
                
            # Clear existing collection if force refresh
            if force_refresh and self.collection.count() > 0:
                self.client.delete_collection("venues")
                self.collection = self.client.get_or_create_collection(
                    name="venues",
                    metadata={"description": "Venue names and variations for fast lookup"}
                )
            
            # Prepare documents for vectorization
            documents = []
            metadatas = []
            ids = []
            
            for venue in venue_data:
                # Create comprehensive text with all name variations
                variations = self._generate_venue_variations(venue)
                text = " | ".join(variations)
                
                documents.append(text)
                metadatas.append({
                    "venue_id": int(venue['id']),
                    "name": str(venue.get('name', '')),
                    "address": str(venue.get('address', '')),
                    "latitude": float(venue.get('latitude', 0.0)) if venue.get('latitude') else 0.0,
                    "longitude": float(venue.get('longitude', 0.0)) if venue.get('longitude') else 0.0
                })
                ids.append(f"venue_{venue['id']}")
                
                # Cache venue data
                self._venue_cache[venue['id']] = venue
            
            # Add to vector database
            self.collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            
            logger.info(f"✅ Vectorized {len(documents)} venues")
            return True
            
        except Exception as e:
            logger.error(f"Error setting up venue vectors: {e}")
            return False
    
    async def resolve_venue_fast(self, name: str, limit: int = 1) -> List[Dict[str, Any]]:
        """Ultra-fast venue resolution using vector similarity and exact text matching"""
        try:
            if self.collection.count() == 0:
                logger.warning("Venue vector database is empty, setting up...")
                await self.setup_venue_vectors()
            
            # First try exact text matching in documents
            exact_matches = self._find_exact_text_matches(name)
            if exact_matches:
                logger.info(f"🎯 Found exact text match for '{name}': {exact_matches[0]['name']}")
                return exact_matches[:limit]
            
            # Fallback to vector similarity
            results = self.collection.query(
                query_texts=[name],
                n_results=min(limit, 5),
                include=['metadatas', 'distances']
            )
            
            resolved_venues = []
            
            # Process results
            for i, metadata in enumerate(results['metadatas'][0]):
                distance = results['distances'][0][i]
                confidence = max(0.0, 1.0 - distance)
                
                if confidence > 0.0:  # Return all matches for debugging
                    venue_data = {
                        'id': metadata['venue_id'],
                        'name': metadata['name'],
                        'address': metadata['address'],
                        'latitude': metadata['latitude'],
                        'longitude': metadata['longitude'],
                        'match_confidence': confidence
                    }
                    resolved_venues.append(venue_data)
            
            if resolved_venues:
                logger.info(f"🎯 Resolved '{name}' to {len(resolved_venues)} venue(s)")
                return resolved_venues
            else:
                logger.warning(f"❌ No venue matches found for '{name}'")
                return []
                
        except Exception as e:
            logger.error(f"Error in venue resolution: {e}")
            return []
    
    async def resolve_venue_with_fallback(self, name: str) -> Tuple[bool, Dict[str, Any], str]:
        """
        Resolve venue with fallback to API search
        Returns: (success, venue_data, message)
        """
        try:
            # Try vector resolution first
            venues = await self.resolve_venue_fast(name)
            
            if venues:
                best_match = venues[0]
                return True, best_match, f"Found venue: {best_match['name']}"
            
            # Fallback to API search
            logger.info(f"Vector resolution failed for '{name}', trying API search...")
            api_venues = await self.api_client.get_venues(search_query=name)
            
            if api_venues:
                venue = api_venues[0]
                # Add to cache for future use
                self._venue_cache[venue['id']] = venue
                return True, venue, f"Found venue via API: {venue['name']}"
            
            return False, {}, f"No venue found matching '{name}'"
            
        except Exception as e:
            logger.error(f"Error resolving venue '{name}': {e}")
            return False, {}, f"Error resolving venue: {str(e)}"
    
    async def refresh_venue_data(self) -> bool:
        """Refresh venue vector database with latest data"""
        logger.info("🔄 Refreshing venue vector database...")
        return await self.setup_venue_vectors(force_refresh=True)
    
    def get_venue_count(self) -> int:
        """Get number of venues in vector database"""
        return self.collection.count()


async def init_vector_venue_resolver() -> Optional[VectorVenueResolver]:
    """Initialize and setup vector venue resolver"""
    try:
        resolver = VectorVenueResolver()
        success = await resolver.setup_venue_vectors()
        
        if success:
            logger.info(f"✅ Venue vector database ready: {resolver.get_venue_count()} venues indexed")
            return resolver
        else:
            logger.warning("⚠️ Venue vector database setup failed")
            return None
            
    except Exception as e:
        logger.error(f"Failed to initialize venue resolver: {e}")
        return None


if __name__ == "__main__":
    # Test venue resolution
    async def test_venue_resolution():
        resolver = await init_vector_venue_resolver()
        if resolver:
            # Test various venue searches
            test_venues = ["renatos", "rough trade", "horse field", "bistro"]
            
            for venue_name in test_venues:
                print(f"\n🔍 Testing: '{venue_name}'")
                success, venue_data, message = await resolver.resolve_venue_with_fallback(venue_name)
                
                if success:
                    print(f"✅ {message}")
                    print(f"   ID: {venue_data.get('id')}")
                    print(f"   Address: {venue_data.get('address', 'N/A')}")
                else:
                    print(f"❌ {message}")
    
    # Run test
    asyncio.run(test_venue_resolution())