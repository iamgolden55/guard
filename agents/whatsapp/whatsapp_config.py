"""
WhatsApp Integration Configuration
Secure setup for business customers
"""
import os
from typing import Dict, List
from dataclasses import dataclass


@dataclass
class WhatsAppConfig:
    """WhatsApp integration configuration"""
    
    # Twilio Configuration (Option 1 - Recommended for small businesses)
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_number: str = "whatsapp:+14155238886"  # Twilio Sandbox
    
    # Meta WhatsApp Business API Configuration (Option 2 - For enterprises)
    meta_app_id: str = ""
    meta_app_secret: str = ""
    meta_verify_token: str = ""
    meta_access_token: str = ""
    meta_phone_number_id: str = ""
    
    # Security Configuration
    webhook_secret: str = ""
    allowed_phone_numbers: List[str] = None
    enable_signature_verification: bool = True
    session_timeout_hours: int = 8
    max_messages_per_minute: int = 20
    
    # AI Integration
    ai_endpoint: str = "http://localhost:8001/query"
    ai_timeout_seconds: int = 30
    
    # Server Configuration
    webhook_port: int = 5000
    webhook_host: str = "0.0.0.0"
    debug_mode: bool = False
    
    def __post_init__(self):
        """Load configuration from environment variables"""
        if not self.webhook_secret:
            self.webhook_secret = os.getenv('WHATSAPP_WEBHOOK_SECRET', 'change_me_in_production')
            
        if not self.twilio_account_sid:
            self.twilio_account_sid = os.getenv('TWILIO_ACCOUNT_SID', '')
            
        if not self.twilio_auth_token:
            self.twilio_auth_token = os.getenv('TWILIO_AUTH_TOKEN', '')
            
        self.ai_endpoint = os.getenv('AI_ENDPOINT', self.ai_endpoint)
        self.webhook_port = int(os.getenv('WHATSAPP_PORT', self.webhook_port))
        self.debug_mode = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
        
        # Parse allowed phone numbers from environment
        if not self.allowed_phone_numbers:
            allowed_numbers = os.getenv('WHATSAPP_ALLOWED_NUMBERS', '')
            if allowed_numbers:
                self.allowed_phone_numbers = [num.strip() for num in allowed_numbers.split(',')]
            else:
                self.allowed_phone_numbers = []
    
    def is_valid_twilio_config(self) -> bool:
        """Check if Twilio configuration is valid"""
        return bool(self.twilio_account_sid and self.twilio_auth_token)
    
    def is_valid_meta_config(self) -> bool:
        """Check if Meta WhatsApp Business API configuration is valid"""
        return bool(self.meta_access_token and self.meta_phone_number_id)
    
    def get_provider(self) -> str:
        """Get the configured WhatsApp provider"""
        if self.is_valid_meta_config():
            return "meta"
        elif self.is_valid_twilio_config():
            return "twilio"
        else:
            return "none"


class WhatsAppSecurityConfig:
    """Security configuration for WhatsApp integration"""
    
    # Rate limiting
    RATE_LIMIT_MESSAGES_PER_MINUTE = 20
    RATE_LIMIT_MESSAGES_PER_HOUR = 200
    
    # Session management
    SESSION_TIMEOUT_HOURS = 8
    MAX_CONCURRENT_SESSIONS = 100
    
    # Authentication
    REQUIRE_PHONE_VERIFICATION = True
    ADMIN_PHONE_NUMBERS = [
        # Add admin phone numbers here
        # "+1234567890",
    ]
    
    # Content filtering
    BLOCKED_KEYWORDS = [
        # Add any keywords you want to block
    ]
    
    # Webhook security
    VERIFY_WEBHOOK_SIGNATURE = True
    WEBHOOK_SECRET_MIN_LENGTH = 32
    
    @staticmethod
    def generate_webhook_secret() -> str:
        """Generate a secure webhook secret"""
        import secrets
        return secrets.token_urlsafe(32)


class WhatsAppMessageTemplates:
    """Pre-defined message templates for common scenarios"""
    
    WELCOME_MESSAGE = """👋 Welcome to AI Shift Manager!

🤖 I'm your AI assistant for shift management.

*Quick Start:*
• "Create shifts for John tomorrow 9 AM to 5 PM"
• "Delete Mike's shift for Friday"  
• "Change Sarah's shift to start at 10 AM"

Send *help* for more commands!"""

    HELP_MESSAGE = """🤖 *AI Shift Manager Commands*

*📋 Shift Management:*
• Create: _"Create shifts for [name] at [location] [date] [time]"_
• Modify: _"Change [name]'s shift to [new time]"_
• Delete: _"Delete [name]'s shift for [date]"_

*🎯 Quick Commands:*
• *help* - Show this help
• *status* - Check system status
• *today* - Show today's shifts
• *week* - Show this week's schedule

*💡 Smart Features:*
• Use nicknames: "Nini", "Mike", "Sarah"
• Natural dates: "tomorrow", "next Monday"
• Casual language: "give John shifts"

*Examples:*
• _"Create shifts for the whole team next week"_
• _"Give Nini shifts at downtown store"_
• _"Delete all Friday shifts"_

Need help? Contact your admin."""

    UNAUTHORIZED_MESSAGE = """🔒 *Access Denied*

Your WhatsApp number is not authorized to use this service.

Please contact your administrator to:
1. Add your number to the system
2. Link it to your staff account

*Need help?* Contact support."""

    ERROR_MESSAGE = """❌ *Oops! Something went wrong*

I couldn't process your request right now.

*What you can try:*
• Check your message format
• Send *help* for examples
• Try again in a moment

*Still having issues?* Contact support."""

    RATE_LIMIT_MESSAGE = """⏰ *Slow down!*

You're sending messages too quickly.

Please wait a moment before sending another message.

*Tip:* Combine multiple requests in one message."""

    MAINTENANCE_MESSAGE = """🔧 *Maintenance Mode*

The AI system is temporarily under maintenance.

We'll be back shortly. Thank you for your patience!

*Estimated time:* 15 minutes"""


# Environment configuration template
WHATSAPP_ENV_TEMPLATE = """
# WhatsApp Integration Configuration

# Option 1: Twilio (Recommended for small businesses)
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Option 2: Meta WhatsApp Business API (For enterprises)
META_APP_ID=your_meta_app_id_here
META_APP_SECRET=your_meta_app_secret_here
META_ACCESS_TOKEN=your_meta_access_token_here
META_PHONE_NUMBER_ID=your_phone_number_id_here

# Security (IMPORTANT: Change in production!)
WHATSAPP_WEBHOOK_SECRET=your_very_secure_secret_key_here_min_32_chars
WHATSAPP_ALLOWED_NUMBERS=+1234567890,+0987654321

# Server Configuration
WHATSAPP_PORT=5000
AI_ENDPOINT=http://localhost:8001/query
FLASK_DEBUG=false

# Rate Limiting
WHATSAPP_RATE_LIMIT_PER_MINUTE=20
WHATSAPP_RATE_LIMIT_PER_HOUR=200
"""


def create_whatsapp_env_file(file_path: str = ".env.whatsapp"):
    """Create WhatsApp environment configuration file"""
    with open(file_path, 'w') as f:
        f.write(WHATSAPP_ENV_TEMPLATE)
    print(f"✅ Created WhatsApp configuration file: {file_path}")
    print("🔧 Please edit the file and add your credentials")


if __name__ == "__main__":
    # Test configuration
    config = WhatsAppConfig()
    print("WhatsApp Configuration:")
    print(f"Provider: {config.get_provider()}")
    print(f"Webhook Port: {config.webhook_port}")
    print(f"AI Endpoint: {config.ai_endpoint}")
    
    # Generate secure webhook secret
    secret = WhatsAppSecurityConfig.generate_webhook_secret()
    print(f"Generated webhook secret: {secret}")
    
    # Create env file template
    create_whatsapp_env_file()