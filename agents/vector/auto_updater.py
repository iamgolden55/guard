"""
Auto-Update System for Vector Databases
Automatically updates staff and venue vectors when new data is added
"""
import logging
import asyncio
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import aiohttp
import json

from vector.staff_resolver import VectorStaffResolver
from vector.venue_resolver import VectorVenueResolver
from api.client import ShiftManagementAPI

logger = logging.getLogger(__name__)


class VectorAutoUpdater:
    """Automatically updates vector databases when new staff/venues are added"""
    
    def __init__(self, 
                 staff_resolver: Optional[VectorStaffResolver] = None,
                 venue_resolver: Optional[VectorVenueResolver] = None):
        self.staff_resolver = staff_resolver
        self.venue_resolver = venue_resolver
        self.api_client = ShiftManagementAPI()
        
        # Track last update times
        self.last_staff_update = datetime.now()
        self.last_venue_update = datetime.now()
        
        # Update intervals (in minutes)
        self.staff_update_interval = 15  # Check every 15 minutes
        self.venue_update_interval = 30  # Check every 30 minutes
        
        # Cache counts to detect changes
        self.last_staff_count = 0
        self.last_venue_count = 0
        
        logger.info("🔄 Vector auto-updater initialized")
    
    async def check_staff_updates(self) -> bool:
        """Check if staff data has been updated and refresh if needed"""
        try:
            if not self.staff_resolver:
                return False
                
            # Check if enough time has passed
            now = datetime.now()
            if (now - self.last_staff_update).total_seconds() < (self.staff_update_interval * 60):
                return False
            
            logger.info("🔍 Checking for staff updates...")
            
            # Get current staff count from API
            staff_data = await self.api_client.get_staff()
            current_count = len(staff_data) if staff_data else 0
            
            # Compare with cached count
            if current_count != self.last_staff_count:
                logger.info(f"📊 Staff count changed: {self.last_staff_count} → {current_count}")
                
                # Refresh staff vectors
                success = await self.staff_resolver.refresh_staff_data()
                if success:
                    self.last_staff_count = current_count
                    self.last_staff_update = now
                    logger.info("✅ Staff vector database updated successfully")
                    return True
                else:
                    logger.error("❌ Failed to update staff vector database")
                    return False
            else:
                # No changes, just update timestamp
                self.last_staff_update = now
                logger.debug(f"✅ Staff data unchanged ({current_count} staff members)")
                return False
                
        except Exception as e:
            logger.error(f"Error checking staff updates: {e}")
            return False
    
    async def check_venue_updates(self) -> bool:
        """Check if venue data has been updated and refresh if needed"""
        try:
            if not self.venue_resolver:
                return False
                
            # Check if enough time has passed
            now = datetime.now()
            if (now - self.last_venue_update).total_seconds() < (self.venue_update_interval * 60):
                return False
            
            logger.info("🔍 Checking for venue updates...")
            
            # Get current venue count from API
            venue_data = await self.api_client.get_venues()
            current_count = len(venue_data) if venue_data else 0
            
            # Compare with cached count
            if current_count != self.last_venue_count:
                logger.info(f"🏢 Venue count changed: {self.last_venue_count} → {current_count}")
                
                # Refresh venue vectors
                success = await self.venue_resolver.refresh_venue_data()
                if success:
                    self.last_venue_count = current_count
                    self.last_venue_update = now
                    logger.info("✅ Venue vector database updated successfully")
                    return True
                else:
                    logger.error("❌ Failed to update venue vector database")
                    return False
            else:
                # No changes, just update timestamp
                self.last_venue_update = now
                logger.debug(f"✅ Venue data unchanged ({current_count} venues)")
                return False
                
        except Exception as e:
            logger.error(f"Error checking venue updates: {e}")
            return False
    
    async def force_update_all(self) -> Dict[str, bool]:
        """Force update both staff and venue vector databases"""
        logger.info("🔄 Force updating all vector databases...")
        
        results = {
            "staff_updated": False,
            "venue_updated": False
        }
        
        # Update staff
        if self.staff_resolver:
            try:
                success = await self.staff_resolver.refresh_staff_data()
                if success:
                    staff_data = await self.api_client.get_staff()
                    self.last_staff_count = len(staff_data) if staff_data else 0
                    self.last_staff_update = datetime.now()
                    results["staff_updated"] = True
                    logger.info("✅ Staff vectors force updated")
                else:
                    logger.error("❌ Staff vectors force update failed")
            except Exception as e:
                logger.error(f"Error force updating staff: {e}")
        
        # Update venues
        if self.venue_resolver:
            try:
                success = await self.venue_resolver.refresh_venue_data()
                if success:
                    venue_data = await self.api_client.get_venues()
                    self.last_venue_count = len(venue_data) if venue_data else 0
                    self.last_venue_update = datetime.now()
                    results["venue_updated"] = True
                    logger.info("✅ Venue vectors force updated")
                else:
                    logger.error("❌ Venue vectors force update failed")
            except Exception as e:
                logger.error(f"Error force updating venues: {e}")
        
        return results
    
    async def start_auto_update_loop(self):
        """Start the auto-update background loop"""
        logger.info("🚀 Starting vector auto-update loop...")
        
        while True:
            try:
                # Check for updates
                staff_updated = await self.check_staff_updates()
                venue_updated = await self.check_venue_updates()
                
                if staff_updated or venue_updated:
                    updates = []
                    if staff_updated:
                        updates.append("staff")
                    if venue_updated:
                        updates.append("venues")
                    logger.info(f"🎉 Vector databases updated: {', '.join(updates)}")
                
                # Sleep for 5 minutes before next check
                await asyncio.sleep(300)  # 5 minutes
                
            except Exception as e:
                logger.error(f"Error in auto-update loop: {e}")
                await asyncio.sleep(60)  # Wait 1 minute before retrying
    
    def get_status(self) -> Dict[str, Any]:
        """Get current status of the auto-updater"""
        return {
            "staff_resolver_active": self.staff_resolver is not None,
            "venue_resolver_active": self.venue_resolver is not None,
            "last_staff_update": self.last_staff_update.isoformat(),
            "last_venue_update": self.last_venue_update.isoformat(),
            "staff_count": self.last_staff_count,
            "venue_count": self.last_venue_count,
            "staff_update_interval_minutes": self.staff_update_interval,
            "venue_update_interval_minutes": self.venue_update_interval
        }


# Global auto-updater instance
auto_updater: Optional[VectorAutoUpdater] = None


async def init_auto_updater(staff_resolver: Optional[VectorStaffResolver] = None,
                           venue_resolver: Optional[VectorVenueResolver] = None) -> VectorAutoUpdater:
    """Initialize the auto-updater system"""
    global auto_updater
    
    auto_updater = VectorAutoUpdater(staff_resolver, venue_resolver)
    
    # Initialize counts
    if staff_resolver:
        try:
            staff_data = await auto_updater.api_client.get_staff()
            auto_updater.last_staff_count = len(staff_data) if staff_data else 0
        except:
            auto_updater.last_staff_count = 0
    
    if venue_resolver:
        try:
            venue_data = await auto_updater.api_client.get_venues()
            auto_updater.last_venue_count = len(venue_data) if venue_data else 0
        except:
            auto_updater.last_venue_count = 0
    
    # Start background update loop
    asyncio.create_task(auto_updater.start_auto_update_loop())
    
    logger.info("✅ Vector auto-updater initialized and started")
    return auto_updater


def get_auto_updater() -> Optional[VectorAutoUpdater]:
    """Get the global auto-updater instance"""
    return auto_updater