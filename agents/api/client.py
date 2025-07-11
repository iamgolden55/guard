"""
API client for communicating with the backend shift management system.
"""
import logging
from typing import Any, Dict, List, Optional

import httpx
from config.settings import settings

logger = logging.getLogger(__name__)


class ShiftManagementAPI:
    """Client for the shift management backend API"""
    
    def __init__(self, base_url: str = None, auth_token: str = None):
        self.base_url = base_url or settings.backend_api_url
        self.auth_token = auth_token or settings.backend_api_token
        
        # Create HTTP client
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            headers=self._get_headers(),
            timeout=30.0
        )
    
    def _get_headers(self) -> Dict[str, str]:
        """Get request headers with authentication"""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        
        return headers
    
    async def get_staff(self, search_query: str = None, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Get staff members with optional search and filters"""
        try:
            params = {}
            if search_query:
                params["search"] = search_query
            if filters:
                params.update(filters)
            
            response = await self.client.get("/api/v1/users/", params=params)
            response.raise_for_status()
            
            data = response.json()
            
            # Handle paginated response
            if isinstance(data, dict) and "results" in data:
                return data["results"]
            elif isinstance(data, list):
                return data
            else:
                return []
                
        except Exception as e:
            logger.warning(f"Backend API not available: {e}, using test data")
            # Fallback to test data when backend is not available
            return await self._get_test_staff_data(search_query, filters)
    
    async def get_staff_by_id(self, staff_id: int) -> Optional[Dict[str, Any]]:
        """Get a specific staff member by ID"""
        try:
            response = await self.client.get(f"/api/v1/users/{staff_id}/")
            response.raise_for_status()
            return response.json()
            
        except Exception as e:
            logger.warning(f"Backend API not available for staff ID {staff_id}: {e}, using test data")
            # Fallback to test data
            test_staff = await self._get_test_staff_data()
            return next((s for s in test_staff if s['id'] == staff_id), None)
    
    async def get_venues(self, search_query: str = None) -> List[Dict[str, Any]]:
        """Get venues with optional search"""
        try:
            params = {}
            if search_query:
                params["search"] = search_query
            
            response = await self.client.get("/api/v1/venues/", params=params)
            response.raise_for_status()
            
            data = response.json()
            
            # Handle paginated response
            if isinstance(data, dict) and "results" in data:
                return data["results"]
            elif isinstance(data, list):
                return data
            else:
                return []
                
        except Exception as e:
            logger.warning(f"Backend API not available: {e}, using test data")
            # Fallback to test data when backend is not available
            return await self._get_test_venues_data(search_query)
    
    async def get_venue_by_id(self, venue_id: int) -> Optional[Dict[str, Any]]:
        """Get a specific venue by ID"""
        try:
            response = await self.client.get(f"/api/v1/venues/{venue_id}/")
            response.raise_for_status()
            return response.json()
            
        except Exception as e:
            logger.warning(f"Backend API not available for venue ID {venue_id}: {e}, using test data")
            # Fallback to test data
            test_venues = await self._get_test_venues_data()
            return next((v for v in test_venues if v['id'] == venue_id), None)
    
    async def get_shifts(self, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Get shifts with optional filters"""
        try:
            params = {"page_size": 1000}  # Get large page size for analytics
            if filters:
                params.update(filters)
            
            # Use the shifts API endpoint
            response = await self.client.get("/api/shifts/", params=params)
            response.raise_for_status()
            
            data = response.json()
            
            # Handle paginated response
            if isinstance(data, dict) and "results" in data:
                return data["results"]
            elif isinstance(data, list):
                return data
            else:
                return []
                
        except Exception as e:
            logger.error(f"Error fetching shifts: {e}")
            return []
    
    async def create_shift(self, shift_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a single shift"""
        try:
            response = await self.client.post("/api/shifts/", json=shift_data)
            response.raise_for_status()
            return response.json()
            
        except Exception as e:
            logger.error(f"Error creating shift: {e}")
            raise
    
    async def create_multi_staff_shift(self, shift_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a multi-staff shift"""
        try:
            response = await self.client.post("/api/shifts/create_multi_staff/", json=shift_data)
            response.raise_for_status()
            return response.json()
            
        except Exception as e:
            logger.error(f"Error creating multi-staff shift: {e}")
            raise
    
    async def update_shift(self, shift_id: int, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update a shift"""
        try:
            response = await self.client.put(f"/api/shifts/{shift_id}/", json=update_data)
            response.raise_for_status()
            return response.json()
            
        except Exception as e:
            logger.error(f"Error updating shift: {e}")
            raise
    
    async def delete_shift(self, shift_id: int) -> bool:
        """Delete a shift"""
        try:
            response = await self.client.delete(f"/api/shifts/{shift_id}/")
            response.raise_for_status()
            return True
            
        except Exception as e:
            logger.error(f"Error deleting shift: {e}")
            return False
    
    async def get_invoices(self, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Get invoices with optional filters"""
        try:
            params = {}
            if filters:
                params.update(filters)
            
            response = await self.client.get("/api/v1/invoices/", params=params)
            response.raise_for_status()
            
            data = response.json()
            
            # Handle paginated response
            if isinstance(data, dict) and "results" in data:
                return data["results"]
            elif isinstance(data, list):
                return data
            else:
                return []
                
        except Exception as e:
            logger.error(f"Error fetching invoices: {e}")
            return []
    
    async def get_invoice_items(self, invoice_id: int) -> List[Dict[str, Any]]:
        """Get invoice items for a specific invoice"""
        try:
            response = await self.client.get(f"/api/v1/invoices/{invoice_id}/items/")
            response.raise_for_status()
            
            data = response.json()
            
            if isinstance(data, list):
                return data
            else:
                return []
                
        except Exception as e:
            logger.error(f"Error fetching invoice items: {e}")
            return []
    
    async def update_invoice_status(self, invoice_id: int, status: str) -> Dict[str, Any]:
        """Update invoice status (e.g., mark as paid)"""
        try:
            response = await self.client.patch(
                f"/api/v1/invoices/{invoice_id}/",
                json={"status": status}
            )
            response.raise_for_status()
            return response.json()
            
        except Exception as e:
            logger.error(f"Error updating invoice status: {e}")
            raise
    
    async def get_pay_rates(self, staff_id: int = None) -> List[Dict[str, Any]]:
        """Get pay rates with optional staff filter"""
        try:
            params = {}
            if staff_id:
                params["staff_user"] = staff_id
            
            response = await self.client.get("/api/v1/pay-rates/", params=params)
            response.raise_for_status()
            
            data = response.json()
            
            # Handle paginated response
            if isinstance(data, dict) and "results" in data:
                return data["results"]
            elif isinstance(data, list):
                return data
            else:
                return []
                
        except Exception as e:
            logger.error(f"Error fetching pay rates: {e}")
            return []
    
    async def update_pay_rate(self, staff_id: int, venue_id: int, new_rate: float) -> Dict[str, Any]:
        """Update pay rate for a staff member at a venue"""
        try:
            # First try to find existing pay rate
            pay_rates = await self.get_pay_rates(staff_id)
            existing_rate = next(
                (rate for rate in pay_rates if rate.get("venue") == venue_id),
                None
            )
            
            if existing_rate:
                # Update existing rate
                response = await self.client.patch(
                    f"/api/v1/pay-rates/{existing_rate['id']}/",
                    json={"hourly_rate": new_rate}
                )
            else:
                # Create new rate
                response = await self.client.post(
                    "/api/v1/pay-rates/",
                    json={
                        "staff_user": staff_id,
                        "venue": venue_id,
                        "hourly_rate": new_rate
                    }
                )
            
            response.raise_for_status()
            return response.json()
            
        except Exception as e:
            logger.error(f"Error updating pay rate: {e}")
            raise
    
    async def _get_test_staff_data(self, search_query: str = None, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Get test staff data when backend is not available"""
        try:
            from data.test_staff import TEST_STAFF_DATA
            staff_data = TEST_STAFF_DATA.copy()
            
            # Apply search filter if provided
            if search_query:
                search_lower = search_query.lower()
                filtered_staff = []
                for staff in staff_data:
                    first_name = staff.get('first_name', '').lower()
                    last_name = staff.get('last_name', '').lower()
                    username = staff.get('username', '').lower()
                    email = staff.get('email', '').lower()
                    
                    if (search_lower in first_name or 
                        search_lower in last_name or 
                        search_lower in username or 
                        search_lower in email or
                        search_lower in f"{first_name} {last_name}"):
                        filtered_staff.append(staff)
                
                staff_data = filtered_staff
            
            # Apply other filters if provided
            if filters:
                for key, value in filters.items():
                    if key in ['role', 'is_active']:
                        staff_data = [s for s in staff_data if s.get(key) == value]
            
            return staff_data
            
        except ImportError:
            logger.error("Test staff data not available")
            return []
    
    async def _get_test_venues_data(self, search_query: str = None) -> List[Dict[str, Any]]:
        """Get test venue data when backend is not available"""
        try:
            from data.test_staff import TEST_VENUES_DATA
            venues_data = TEST_VENUES_DATA.copy()
            
            # Apply search filter if provided
            if search_query:
                search_lower = search_query.lower()
                venues_data = [
                    venue for venue in venues_data
                    if search_lower in venue.get('name', '').lower()
                ]
            
            return venues_data
            
        except ImportError:
            logger.error("Test venue data not available")
            return []

    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()