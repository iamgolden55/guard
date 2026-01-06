/**
 * Clear Sync Queue Script
 * Run this to clear all pending sync items during development
 */
const AsyncStorage = require('@react-native-async-storage/async-storage').default;

async function clearSyncQueue() {
  try {
    console.log('🧹 Clearing sync queue...');
    
    // Clear sync queue
    await AsyncStorage.removeItem('syncQueue');
    
    // Clear last sync timestamp
    await AsyncStorage.removeItem('lastSync');
    
    console.log('✅ Sync queue cleared successfully!');
    console.log('📱 Restart the app to see changes');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing sync queue:', error);
    process.exit(1);
  }
}

clearSyncQueue();
