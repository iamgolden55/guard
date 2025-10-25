/**
 * Global polyfills for React Native
 * Required for react-native-svg and other packages that use Node.js core modules
 */

// Buffer polyfill for react-native-svg (used by react-native-qrcode-svg)
import { Buffer } from 'buffer';
global.Buffer = Buffer;
