/**
 * Clear Sync Queue Utility
 * Run this in the React Native debugger console to clear stuck sync items
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const clearSyncQueue = async () => {
  try {
    await AsyncStorage.removeItem('sync_queue');
    console.log('✅ Sync queue cleared successfully!');
    console.log('Please restart the app for changes to take effect.');
    return true;
  } catch (error) {
    console.error('❌ Error clearing sync queue:', error);
    return false;
  }
};

// Run it
clearSyncQueue();
