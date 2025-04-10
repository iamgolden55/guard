import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';

// Define chat message types
interface ChatMessage {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
}

// Define pre-defined responses
const botResponses: Record<string, string[]> = {
  greeting: [
    "Hello! I'm your Mead Security virtual assistant. How can I help you today?",
    "Hi there! I'm here to help with any security-related queries. What would you like to know?",
    "Welcome to Mead Security! I'm your virtual assistant. How may I assist you today?"
  ],
  contact: [
    "You can reach our team at 07452 830021 or via email at contactus@meadsecurity.co.uk. Would you like me to arrange a callback for you?",
    "Our team is available at contactus@meadsecurity.co.uk or by phone at 07452 830021. Is there something specific you'd like to discuss?"
  ],
  services: [
    "We offer a range of security services including Door Supervision, Static Guarding, Concierge, Event Security, Gate House Security, and Key Holding. Which service are you interested in learning more about?",
    "Mead Security provides various services such as Door Supervision, Static Guarding, Event Security, and more. Is there a specific service you'd like to know about?"
  ],
  location: [
    "We operate throughout Bristol and the South West, covering areas such as Bath, Devon, Exeter, Gloucester, Plymouth, Salisbury, Somerset, Turo, and Wells. Are you looking for security services in any of these areas?",
    "Mead Security covers Bristol and the South West region. This includes Bath, Devon, Exeter, Gloucester, Plymouth, Salisbury, Somerset, Turo, and Wells. Where are you located?"
  ],
  quote: [
    "I'd be happy to help you get a quote. Could you please provide some details about your requirements? Alternatively, you can fill out our contact form or call us directly at 07452 830021.",
    "For a customized quote, please let me know your security needs or visit our contact page. You can also reach us directly at 07452 830021."
  ],
  default: [
    "I'm not sure I understand. Could you please rephrase or provide more details about what you're looking for?",
    "I don't have information on that specific topic. Would you like to know about our services, locations, or how to contact us instead?",
    "I'm still learning and may not have an answer to that. Would you like to speak with a member of our team directly?"
  ]
};

// Generate a random ID for messages
const generateId = () => Math.random().toString(36).substring(2, 9);

// Get a random response from the provided category
const getRandomResponse = (category: string): string => {
  const responses = botResponses[category] || botResponses.default;
  return responses[Math.floor(Math.random() * responses.length)];
};

// Function to analyze user message and determine response category
const analyzeMessage = (message: string): string => {
  message = message.toLowerCase();

  if (message.match(/hello|hi|hey|greetings/)) {
    return 'greeting';
  } else if (message.match(/contact|phone|email|call|reach/)) {
    return 'contact';
  } else if (message.match(/services|offer|provide|security services|door supervisor|static guard|concierge|event security/)) {
    return 'services';
  } else if (message.match(/where|location|area|cover|bristol|south west|bath|devon/)) {
    return 'location';
  } else if (message.match(/quote|price|cost|pricing|how much|estimate/)) {
    return 'quote';
  } else {
    return 'default';
  }
};

const MicrosoftChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Handle opening/closing the chat with a custom event listener
  useEffect(() => {
    const handleToggleChat = () => setIsOpen(prev => !prev);
    window.addEventListener('toggleChat', handleToggleChat);

    return () => {
      window.removeEventListener('toggleChat', handleToggleChat);
    };
  }, []);

  // Add initial greeting when chat opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const initialMessage: ChatMessage = {
        id: generateId(),
        text: getRandomResponse('greeting'),
        isBot: true,
        timestamp: new Date()
      };
      setMessages([initialMessage]);
    }
  }, [isOpen, messages.length]);

  // Clear messages when chat is closed
  useEffect(() => {
    if (!isOpen) {
      // Wait for the closing animation to complete before clearing messages
      const timer = setTimeout(() => {
        setMessages([]);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Scroll to the bottom of the chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle closing the chat
  const handleClose = () => {
    setIsOpen(false);
  };

  // Handle sending a message
  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      text: inputText,
      isBot: false,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    // Determine response category and send bot response after a delay
    const responseCategory = analyzeMessage(inputText);
    setTimeout(() => {
      const botMessage: ChatMessage = {
        id: generateId(),
        text: getRandomResponse(responseCategory),
        isBot: true,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
      setIsTyping(false);
    }, 1000 + Math.random() * 500); // Random delay between 1-1.5 seconds
  };

  // Microsoft animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }
    },
    exit: {
      opacity: 0,
      y: 20,
      scale: 0.9,
      transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }
    }
  };

  const bubbleVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed bottom-20 right-5 w-full max-w-sm z-[100] rounded-ms-lg overflow-hidden shadow-ms-xl"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* Chat header */}
          <div className="bg-primary text-white p-4 flex justify-between items-center">
            <div className="flex items-center">
              <div className="bg-white rounded-full p-1 mr-3">
                <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold">Mead Security Assistant</h2>
                <div className="text-xs opacity-90">Online | Typically replies in a minute</div>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white p-1 hover:bg-white/10 rounded-full transition-colors"
              aria-label="Close chat"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Chat body */}
          <div className="bg-ms-gray-50 h-80 overflow-y-auto p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
                  variants={bubbleVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                      message.isBot
                        ? 'bg-white text-ms-gray-800 rounded-tl-none shadow-ms'
                        : 'bg-primary text-white rounded-tr-none shadow-ms'
                    }`}
                  >
                    <p>{message.text}</p>
                    <div
                      className={`text-xs mt-1 ${
                        message.isBot ? 'text-ms-gray-500' : 'text-white/75'
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* "Bot is typing" indicator */}
              {isTyping && (
                <motion.div
                  className="flex justify-start"
                  variants={bubbleVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-white text-ms-gray-800 rounded-tl-none shadow-ms">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 rounded-full bg-ms-gray-400 animate-bounce" style={{ animationDelay: '0s' }}></div>
                      <div className="w-2 h-2 rounded-full bg-ms-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 rounded-full bg-ms-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Chat input */}
          <div className="bg-white p-3 border-t border-ms-gray-200">
            <div className="flex items-center">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 border border-ms-gray-200 rounded-ms-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim()}
                className={`ml-2 p-2 rounded-full ${
                  inputText.trim()
                    ? 'bg-primary text-white'
                    : 'bg-ms-gray-200 text-ms-gray-400'
                } focus:outline-none transition-colors`}
                aria-label="Send message"
              >
                <PaperAirplaneIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="text-center mt-2 text-xs text-ms-gray-500">
              This is an AI assistant. For urgent matters, please call 07452 830021
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MicrosoftChatbot;
