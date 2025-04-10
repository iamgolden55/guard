import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneIcon, EnvelopeIcon, ChatBubbleLeftRightIcon, XMarkIcon } from '@heroicons/react/24/outline';

const FloatingActionButton = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  // Function to handle all menu item clicks
  const handleMenuItemClick = (action: () => void) => {
    // First execute the provided action
    action();
    // Then close the menu
    setIsOpen(false);
  };

  // Handle chat toggle with custom event
  const handleChatToggle = () => {
    window.dispatchEvent(new CustomEvent('toggleChat'));
  };

  // Microsoft Fluent Design animation variants
  const containerVariants = {
    hidden: {
      opacity: 0,
      scale: 0.8,
      y: 20
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        delay: 1.5,
        duration: 0.5,
        ease: [0.25, 0.1, 0.25, 1],
      }
    },
  };

  const fabVariants = {
    closed: {
      rotate: 0,
      transition: {
        duration: 0.3,
        ease: [0.25, 0.1, 0.25, 1],
      }
    },
    open: {
      rotate: 45,
      transition: {
        duration: 0.3,
        ease: [0.25, 0.1, 0.25, 1],
      }
    }
  };

  const menuVariants = {
    closed: {
      opacity: 0,
      y: 20,
      transition: {
        duration: 0.3,
        ease: [0.25, 0.1, 0.25, 1],
        staggerDirection: -1,
        staggerChildren: 0.1,
      }
    },
    open: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: [0.25, 0.1, 0.25, 1],
        staggerChildren: 0.1,
        delayChildren: 0.1,
      }
    }
  };

  const itemVariants = {
    closed: { opacity: 0, y: 10 },
    open: { opacity: 1, y: 0 }
  };

  return (
    <motion.div
      className="fixed bottom-5 right-5 z-50"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="flex flex-col gap-3 mb-4 items-end"
            variants={menuVariants}
            initial="closed"
            animate="open"
            exit="closed"
          >
            <motion.div variants={itemVariants} className="flex items-center">
              <span className="bg-white text-ms-gray-700 py-2 px-3 rounded-l-md shadow-ms mr-2 font-medium">
                Call Us
              </span>
              <a
                href="tel:07452830021"
                className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-ms hover:shadow-ms-md transition-shadow"
                aria-label="Call us"
                onClick={() => setIsOpen(false)}
              >
                <PhoneIcon className="w-5 h-5" />
              </a>
            </motion.div>

            <motion.div variants={itemVariants} className="flex items-center">
              <span className="bg-white text-ms-gray-700 py-2 px-3 rounded-l-md shadow-ms mr-2 font-medium">
                Email Us
              </span>
              <a
                href="mailto:contactus@meadsecurity.co.uk"
                className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-ms hover:shadow-ms-md transition-shadow"
                aria-label="Email us"
                onClick={() => setIsOpen(false)}
              >
                <EnvelopeIcon className="w-5 h-5" />
              </a>
            </motion.div>

            <motion.div variants={itemVariants} className="flex items-center">
              <span className="bg-white text-ms-gray-700 py-2 px-3 rounded-l-md shadow-ms mr-2 font-medium">
                Chat Now
              </span>
              <button
                onClick={() => handleMenuItemClick(handleChatToggle)}
                className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-ms hover:shadow-ms-md transition-shadow"
                aria-label="Open chat"
              >
                <ChatBubbleLeftRightIcon className="w-5 h-5" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main FAB button */}
      <motion.button
        className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center shadow-ms-lg hover:shadow-ms-xl focus:outline-none transition-all"
        onClick={toggleOpen}
        variants={fabVariants}
        animate={isOpen ? "open" : "closed"}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label={isOpen ? "Close menu" : "Open contact menu"}
      >
        {isOpen ? (
          <XMarkIcon className="w-7 h-7" />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        )}
      </motion.button>
    </motion.div>
  );
};

export default FloatingActionButton;
