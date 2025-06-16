require('@testing-library/jest-dom');

// Add TextEncoder and TextDecoder polyfills for Node.js environment
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder;
}

if (typeof TextDecoder === 'undefined') {
  global.TextDecoder = require('util').TextDecoder;
} 