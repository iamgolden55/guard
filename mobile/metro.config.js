// Learn more https://docs.expo.io/guides/customizing-metro
// Load environment variables first
require('dotenv').config();

const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Disable code splitting and lazy loading
config.transformer = {
  ...config.transformer,
  // Disable lazy imports
  enableBabelRCLookup: false,
};

// Disable experimental features that might enable code splitting
config.serializer = {
  ...config.serializer,
  // Disable lazy bundling
  customSerializer: undefined,
};

module.exports = config;
