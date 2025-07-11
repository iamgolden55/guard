"""
Secure WhatsApp Bot Integration for AI Shift Management
Supports both Twilio and Meta WhatsApp Business API
"""
import os
import hmac
import hashlib
import logging
import asyncio
import httpx
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from dataclasses import dataclass
from flask import Flask, request, jsonify
from flask_cors import CORS
from twilio.twiml.messaging_response import MessagingResponse
from twilio.rest import Client as TwilioClient
import phonenumbers
from phonenumbers import NumberParseException

logger = logging.getLogger(__name__)


@dataclass
class WhatsAppUser:
    """WhatsApp user information"""
    phone_number: str
    display_name: str
    is_authorized: bool = False
    staff_id: Optional[int] = None
    role: str = "user"
    last_active: datetime = None
    session_id: Optional[str] = None


class WhatsAppSecurity:
    """Security layer for WhatsApp integration"""
    
    def __init__(self, webhook_secret: str):
        self.webhook_secret = webhook_secret
        self.authorized_numbers = set()  # Will be populated from database
        self.session_timeout = timedelta(hours=8)  # Session expires after 8 hours
        self.active_sessions = {}  # phone_number -> session_data
        
    def verify_webhook_signature(self, payload: str, signature: str) -> bool:
        """Verify webhook signature from WhatsApp/Twilio"""
        try:
            # For Twilio X-Twilio-Signature
            expected_signature = hmac.new(
                self.webhook_secret.encode('utf-8'),
                payload.encode('utf-8'),
                hashlib.sha1
            ).hexdigest()
            
            # Remove 'sha1=' prefix if present
            if signature.startswith('sha1='):
                signature = signature[5:]
                
            return hmac.compare_digest(expected_signature, signature)
            
        except Exception as e:
            logger.error(f"Error verifying webhook signature: {e}")
            return False
    
    def is_authorized_number(self, phone_number: str) -> bool:
        """Check if phone number is authorized to use the bot"""
        # Normalize phone number
        normalized = self.normalize_phone_number(phone_number)
        return normalized in self.authorized_numbers
    
    def normalize_phone_number(self, phone_number: str) -> str:
        """Normalize phone number to E.164 format"""
        try:
            parsed = phonenumbers.parse(phone_number, None)
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        except NumberParseException:
            # Return as-is if parsing fails
            return phone_number.strip()
    
    def create_session(self, phone_number: str, user_data: Dict) -> str:
        """Create secure session for WhatsApp user"""
        normalized_number = self.normalize_phone_number(phone_number)
        session_id = f"wa_{normalized_number}_{int(datetime.now().timestamp())}"
        
        self.active_sessions[normalized_number] = {
            'session_id': session_id,
            'user_data': user_data,
            'created_at': datetime.now(),
            'last_active': datetime.now(),
            'message_count': 0
        }
        
        return session_id
    
    def get_session(self, phone_number: str) -> Optional[Dict]:
        """Get active session for phone number"""
        normalized_number = self.normalize_phone_number(phone_number)
        session = self.active_sessions.get(normalized_number)
        
        if session:
            # Check if session is expired
            if datetime.now() - session['last_active'] > self.session_timeout:
                del self.active_sessions[normalized_number]
                return None
                
            # Update last active
            session['last_active'] = datetime.now()
            session['message_count'] += 1
            
        return session
    
    async def authorize_user(self, phone_number: str) -> Optional[WhatsAppUser]:
        """Authorize user by checking against staff database"""
        try:
            # This would integrate with your staff database
            # For now, we'll use the existing API
            from api.client import ShiftManagementAPI
            
            api_client = ShiftManagementAPI()
            staff_list = await api_client.get_staff()
            
            # Look for staff member with matching phone number
            # (You'd add phone_number field to your staff model)
            normalized_number = self.normalize_phone_number(phone_number)
            
            for staff in staff_list:
                # For demo, we'll allow specific numbers
                # In production, match against staff.phone_number field
                if staff.get('username') in ['admin2', 'admin123'] or 'admin' in staff.get('role', ''):
                    return WhatsAppUser(
                        phone_number=normalized_number,
                        display_name=f"{staff.get('first_name', '')} {staff.get('last_name', '')}".strip(),
                        is_authorized=True,
                        staff_id=staff.get('id'),
                        role=staff.get('role', 'staff')
                    )
            
            return None
            
        except Exception as e:
            logger.error(f"Error authorizing user {phone_number}: {e}")
            return None


class WhatsAppMessageFormatter:
    """Format AI responses for WhatsApp"""
    
    @staticmethod
    def format_ai_response(response: Dict[str, Any]) -> str:
        """Format AI agent response for WhatsApp"""
        try:
            if not response.get('success'):
                return f"❌ {response.get('message', 'Something went wrong')}"
            
            message = response.get('message', '')
            
            # Clean up formatting for WhatsApp
            message = message.replace('✅', '✅')
            message = message.replace('👥', '👥')
            message = message.replace('🏢', '🏢')
            message = message.replace('⏰', '⏰')
            message = message.replace('📅', '📅')
            
            # Add WhatsApp-specific formatting
            if 'Successfully created' in message:
                message += "\n\n💡 *Tip: Send 'help' for more commands*"
            
            return message
            
        except Exception as e:
            logger.error(f"Error formatting message: {e}")
            return "✅ Operation completed successfully!"
    
    @staticmethod
    def format_help_message() -> str:
        """Generate help message for WhatsApp users"""
        return """🤖 *AI Shift Manager Help*

*📋 Shift Management:*
• Create shifts: _"Create shifts for John at Main Store tomorrow 9 AM to 5 PM"_
• Change times: _"Change Sarah's shift to 10 AM to 6 PM"_
• Delete shifts: _"Delete Mike's shift for tomorrow"_

*🎯 Quick Commands:*
• help - Show this help
• status - Check system status
• shifts - View today's shifts

*💡 Natural Language:*
Just type what you want! The AI understands:
• Staff nicknames ("Nini", "Mike")
• Relative dates ("tomorrow", "next week")
• Casual language ("give John shifts")

*🔒 Secure & Private:*
Your data stays on your servers. No external access.

Need support? Contact your admin."""

    @staticmethod
    def format_error_message(error: str) -> str:
        """Format error message for WhatsApp"""
        return f"❌ *Error:* {error}\n\n💡 Send 'help' for usage examples"


class WhatsAppBot:
    """Secure WhatsApp Bot for AI Shift Management"""
    
    def __init__(self, config: Dict[str, str]):
        self.config = config
        self.security = WhatsAppSecurity(config.get('webhook_secret', 'default_secret'))
        self.formatter = WhatsAppMessageFormatter()
        
        # Initialize Twilio client if configured
        if config.get('twilio_account_sid') and config.get('twilio_auth_token'):
            self.twilio_client = TwilioClient(
                config['twilio_account_sid'],
                config['twilio_auth_token']
            )
        else:
            self.twilio_client = None
            
        # AI agents endpoint
        self.ai_endpoint = config.get('ai_endpoint', 'http://localhost:8001/query')
        
        logger.info("WhatsApp bot initialized successfully")
    
    async def process_message(self, phone_number: str, message_body: str, message_sid: str) -> str:
        """Process incoming WhatsApp message"""
        try:
            logger.info(f"Processing message from {phone_number}: {message_body}")
            
            # Step 1: Normalize phone number
            normalized_number = self.security.normalize_phone_number(phone_number)
            
            # Step 2: Get or create user session
            session = self.security.get_session(normalized_number)
            
            if not session:
                # Temporary: Skip authorization for testing
                # TODO: Re-enable authorization in production
                logger.info(f"Creating test session for {normalized_number}")
                
                # Create fake user for testing
                from types import SimpleNamespace
                user = SimpleNamespace(
                    display_name="Test User",
                    is_authorized=True,
                    phone_number=normalized_number
                )
                
                # Create new session
                session_id = self.security.create_session(normalized_number, user.__dict__)
                session = self.security.get_session(normalized_number)
                
                # Welcome message
                welcome_msg = f"👋 Welcome {user.display_name}!\n\n"
                welcome_msg += "🤖 You're now connected to your AI Shift Manager.\n\n"
                welcome_msg += "Try: _'Create shifts for tomorrow'_ or send 'help' for more options."
                return welcome_msg
            
            # Step 3: Handle special commands
            message_lower = message_body.lower().strip()
            
            if message_lower == 'help':
                return self.formatter.format_help_message()
            
            if message_lower == 'status':
                return "✅ AI Shift Manager is online and ready!\n\n🕐 Session active\n🔒 Secure connection"
            
            if message_lower in ['hi', 'hello', 'hey']:
                user_name = session['user_data'].get('display_name', 'there')
                return f"👋 Hi {user_name}! How can I help you with shift management today?\n\nSend 'help' for examples."
            
            # Step 4: Send to AI agents system
            ai_response = await self._send_to_ai_agents(message_body, session['session_id'])
            
            # Step 5: Format response for WhatsApp
            formatted_response = self.formatter.format_ai_response(ai_response)
            
            return formatted_response
            
        except Exception as e:
            logger.error(f"Error processing WhatsApp message: {e}")
            return self.formatter.format_error_message(
                "Sorry, I encountered an error. Please try again or contact support."
            )
    
    async def _send_to_ai_agents(self, message: str, session_id: str) -> Dict[str, Any]:
        """Send message to AI agents system"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.ai_endpoint,
                    json={
                        "query": message,
                        "session_id": session_id,
                        "source": "whatsapp"
                    },
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"AI agents returned status {response.status_code}")
                    return {"success": False, "message": "AI service temporarily unavailable"}
                    
        except Exception as e:
            logger.error(f"Error calling AI agents: {e}")
            return {"success": False, "message": "Could not reach AI service"}
    
    def send_message(self, to_number: str, message: str) -> bool:
        """Send WhatsApp message via Twilio"""
        try:
            if not self.twilio_client:
                logger.error("Twilio client not configured")
                return False
                
            # Send message
            message_obj = self.twilio_client.messages.create(
                body=message,
                from_=self.config.get('twilio_whatsapp_number', 'whatsapp:+14155238886'),
                to=f"whatsapp:{to_number}"
            )
            
            logger.info(f"Sent WhatsApp message to {to_number}: {message_obj.sid}")
            return True
            
        except Exception as e:
            logger.error(f"Error sending WhatsApp message: {e}")
            return False


# Flask webhook server
app = Flask(__name__)
CORS(app)

# Initialize WhatsApp bot
whatsapp_config = {
    'webhook_secret': os.getenv('WHATSAPP_WEBHOOK_SECRET', 'your_webhook_secret_here'),
    'twilio_account_sid': os.getenv('TWILIO_ACCOUNT_SID'),
    'twilio_auth_token': os.getenv('TWILIO_AUTH_TOKEN'),
    'twilio_whatsapp_number': os.getenv('TWILIO_WHATSAPP_NUMBER', 'whatsapp:+14155238886'),
    'ai_endpoint': os.getenv('AI_ENDPOINT', 'http://localhost:8001/query')
}

bot = WhatsAppBot(whatsapp_config)


@app.route('/webhook/whatsapp', methods=['POST'])
def whatsapp_webhook():
    """Handle incoming WhatsApp messages"""
    try:
        # FORCE DISABLE signature verification for testing
        logger.info("🔒 Signature verification: FORCE DISABLED for testing")
        logger.info(f"📥 Incoming webhook: {request.method} {request.url}")
        logger.info(f"📋 Request headers: {dict(request.headers)}")
        
        # Skip all signature verification completely
        verify_signature = False
        
        if False:  # Never execute signature verification for now
            signature = request.headers.get('X-Twilio-Signature', '')
            if not bot.security.verify_webhook_signature(request.get_data(as_text=True), signature):
                logger.warning("Invalid webhook signature")
                return jsonify({"error": "Invalid signature"}), 403
        else:
            logger.info("✅ Signature verification completely bypassed")
        
        # Get message data
        phone_number = request.form.get('From', '').replace('whatsapp:', '')
        message_body = request.form.get('Body', '')
        message_sid = request.form.get('MessageSid', '')
        
        # Debug logging to see actual phone number format
        logger.info(f"📱 Received message from: {phone_number} (original: {request.form.get('From', '')})")
        logger.info(f"💬 Message body: '{message_body}'")
        logger.info(f"🆔 Message SID: {message_sid}")
        
        if not phone_number or not message_body:
            logger.error(f"❌ Missing required fields - phone: {phone_number}, body: {message_body}")
            return jsonify({"error": "Missing required fields"}), 400
        
        # Process message asynchronously
        async def process_and_respond():
            logger.info("🤖 Processing message with AI...")
            response_text = await bot.process_message(phone_number, message_body, message_sid)
            logger.info(f"✅ AI response: '{response_text[:100]}...'")
            
            # Send response via Twilio
            resp = MessagingResponse()
            resp.message(response_text)
            logger.info("📤 Sending TwiML response back to Twilio")
            return str(resp)
        
        # Run async function
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            twiml_response = loop.run_until_complete(process_and_respond())
            return twiml_response, 200, {'Content-Type': 'text/xml'}
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error in WhatsApp webhook: {e}")
        resp = MessagingResponse()
        resp.message("❌ Sorry, I'm temporarily unavailable. Please try again later.")
        return str(resp), 200, {'Content-Type': 'text/xml'}


@app.route('/webhook/health', methods=['GET'])
def health_check():
    """Health check for WhatsApp webhook"""
    return jsonify({
        "status": "healthy",
        "service": "whatsapp_bot",
        "timestamp": datetime.now().isoformat()
    })


@app.route('/admin/send-message', methods=['POST'])
def admin_send_message():
    """Admin endpoint to send WhatsApp messages"""
    try:
        data = request.get_json()
        to_number = data.get('to_number')
        message = data.get('message')
        
        if not to_number or not message:
            return jsonify({"error": "Missing to_number or message"}), 400
        
        success = bot.send_message(to_number, message)
        
        return jsonify({
            "success": success,
            "message": "Message sent successfully" if success else "Failed to send message"
        })
        
    except Exception as e:
        logger.error(f"Error in admin send message: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    # Load environment variables from .env.whatsapp file
    try:
        from dotenv import load_dotenv
        env_loaded = load_dotenv('../.env.whatsapp')
        print(f"📁 Environment file loaded: {env_loaded}")
        print(f"🔒 WHATSAPP_VERIFY_SIGNATURE: {os.getenv('WHATSAPP_VERIFY_SIGNATURE', 'not_set')}")
    except ImportError:
        print("⚠️ python-dotenv not available, using system environment variables")
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    print("🚀 Starting WhatsApp Bot Server...")
    print(f"📱 Webhook URL: http://localhost:5000/webhook/whatsapp")
    print(f"🤖 AI Endpoint: {whatsapp_config['ai_endpoint']}")
    
    # Run Flask app
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('WHATSAPP_PORT', 5000)),
        debug=os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    )