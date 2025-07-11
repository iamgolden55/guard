"""
Automatic authentication and token management for production deployment.
"""
import os
import logging
import httpx
import asyncio
from typing import Optional, Dict, Any
from pathlib import Path

logger = logging.getLogger(__name__)


class AutoAuthManager:
    """Automatically manages API tokens for AI agents in production"""
    
    def __init__(self, backend_url: str = "http://localhost:8000"):
        self.backend_url = backend_url.rstrip('/')
        self.env_file_path = Path(__file__).parent.parent / ".env"
        
    async def ensure_ai_access(self) -> str:
        """
        Ensure AI has valid API access. Try multiple methods:
        1. Use existing valid token
        2. Auto-login with admin credentials  
        3. Create AI service account
        """
        
        # Method 1: Check if current token is valid
        current_token = self._get_current_token()
        if current_token and await self._test_token(current_token):
            logger.info("✅ Current token is valid")
            return current_token
            
        # Method 2: Try auto-login with admin credentials
        admin_token = await self._try_admin_login()
        if admin_token:
            logger.info("✅ Auto-login successful")
            self._update_env_token(admin_token)
            return admin_token
            
        # Method 3: Create AI service account (requires admin access)
        service_token = await self._create_ai_service_account()
        if service_token:
            logger.info("✅ AI service account created")
            self._update_env_token(service_token)
            return service_token
            
        # Method 4: Use environment fallback
        env_token = os.getenv('BACKEND_SERVICE_TOKEN')
        if env_token:
            logger.info("✅ Using environment fallback token")
            return env_token
            
        raise Exception("❌ Could not establish AI API access. Please configure authentication.")
    
    def _get_current_token(self) -> Optional[str]:
        """Get current token from .env file"""
        try:
            if self.env_file_path.exists():
                with open(self.env_file_path, 'r') as f:
                    for line in f:
                        if line.startswith('BACKEND_API_TOKEN='):
                            token = line.split('=', 1)[1].strip()
                            if token and token != "your_api_token_here":
                                return token
        except Exception as e:
            logger.warning(f"Could not read current token: {e}")
        return None
    
    async def _test_token(self, token: str) -> bool:
        """Test if a token is valid"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.backend_url}/api/v1/users/",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=5.0
                )
                return response.status_code == 200
        except Exception as e:
            logger.debug(f"Token test failed: {e}")
            return False
    
    async def _try_admin_login(self) -> Optional[str]:
        """Try to login with admin credentials from environment"""
        username = os.getenv('AI_ADMIN_USERNAME', 'admin2')
        password = os.getenv('AI_ADMIN_PASSWORD', 'test12345')
        
        if not username or not password:
            logger.debug("No admin credentials found in environment")
            return None
            
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.backend_url}/api/v1/login/",
                    json={"username": username, "password": password},
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data.get('access')
                    
        except Exception as e:
            logger.warning(f"Admin login failed: {e}")
            
        return None
    
    async def _create_ai_service_account(self) -> Optional[str]:
        """Create dedicated AI service account via Django management command"""
        try:
            # This would require admin access to Django
            # For now, we'll return None and rely on manual setup
            logger.info("AI service account creation requires manual Django setup")
            return None
            
        except Exception as e:
            logger.warning(f"Could not create AI service account: {e}")
            return None
    
    def _update_env_token(self, token: str) -> bool:
        """Update the .env file with new token"""
        try:
            lines = []
            token_updated = False
            
            if self.env_file_path.exists():
                with open(self.env_file_path, 'r') as f:
                    lines = f.readlines()
                    
            # Update existing token line or add new one
            for i, line in enumerate(lines):
                if line.startswith('BACKEND_API_TOKEN='):
                    lines[i] = f"BACKEND_API_TOKEN={token}\n"
                    token_updated = True
                    break
                    
            if not token_updated:
                lines.append(f"BACKEND_API_TOKEN={token}\n")
                
            # Write back to file
            with open(self.env_file_path, 'w') as f:
                f.writelines(lines)
                
            logger.info(f"✅ Updated .env file with new token")
            return True
            
        except Exception as e:
            logger.error(f"Could not update .env file: {e}")
            return False
    
    async def get_token_info(self, token: str) -> Dict[str, Any]:
        """Get information about the current token"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.backend_url}/api/v1/users/me/",  # Assuming this endpoint exists
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=5.0
                )
                
                if response.status_code == 200:
                    return response.json()
                    
        except Exception as e:
            logger.debug(f"Could not get token info: {e}")
            
        return {}


class ProductionAuthSetup:
    """Setup authentication for production deployment"""
    
    @staticmethod
    async def setup_for_customer(
        customer_admin_username: str,
        customer_admin_password: str,
        backend_url: str = "http://localhost:8000"
    ) -> str:
        """
        Setup AI authentication for a new customer deployment.
        This would be called during installation/setup.
        """
        
        auth_manager = AutoAuthManager(backend_url)
        
        # Set customer credentials in environment temporarily
        os.environ['AI_ADMIN_USERNAME'] = customer_admin_username
        os.environ['AI_ADMIN_PASSWORD'] = customer_admin_password
        
        try:
            token = await auth_manager.ensure_ai_access()
            
            # Create permanent environment file for customer
            env_content = f"""# AI Agent Configuration
BACKEND_API_URL={backend_url}
BACKEND_API_TOKEN={token}

# LLM Configuration (customer provides their own keys)
OPENAI_API_KEY=customer_openai_key_here
ANTHROPIC_API_KEY=customer_anthropic_key_here
LLM_PROVIDER=openai
LLM_MODEL=gpt-4

# Customer can override these
AI_ADMIN_USERNAME={customer_admin_username}
AI_ADMIN_PASSWORD={customer_admin_password}

# Other configuration...
AGENT_DEBUG=false
AGENT_LOG_LEVEL=INFO
"""
            
            # Write customer-specific .env file
            env_path = Path(__file__).parent.parent / ".env"
            with open(env_path, 'w') as f:
                f.write(env_content)
                
            logger.info(f"✅ Customer authentication configured successfully")
            return token
            
        except Exception as e:
            logger.error(f"❌ Customer setup failed: {e}")
            raise


# Convenience function for startup
async def ensure_ai_authentication() -> str:
    """Ensure AI has authentication - call this on startup"""
    auth_manager = AutoAuthManager()
    return await auth_manager.ensure_ai_access()


if __name__ == "__main__":
    # Test the authentication system
    async def test_auth():
        token = await ensure_ai_authentication()
        print(f"✅ AI Token: {token[:20]}...")
        
    asyncio.run(test_auth())