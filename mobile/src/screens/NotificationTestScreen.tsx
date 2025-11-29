import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import notificationService from '../services/notificationService';
import { colors } from '../theme/colors';

export const NotificationTestScreen = () => {
  const [permissionStatus, setPermissionStatus] = useState<string>('Unknown');
  const [pushToken, setPushToken] = useState<string | null>(null);

  const checkPermissions = async () => {
    const hasPermission = await notificationService.hasPermissions();
    setPermissionStatus(hasPermission ? 'Granted ✅' : 'Denied ❌');
  };

  const requestPermissions = async () => {
    const granted = await notificationService.requestPermissions();
    setPermissionStatus(granted ? 'Granted ✅' : 'Denied ❌');
    if (granted) {
      Alert.alert('Success', 'Notification permissions granted!');
    } else {
      Alert.alert('Error', 'Notification permissions denied');
    }
  };

  const registerToken = async () => {
    const token = await notificationService.registerPushToken();
    setPushToken(token);
    if (token) {
      Alert.alert('Success', `Token registered: ${token.substring(0, 20)}...`);
    }
  };

  const sendImmediateTest = async () => {
    await notificationService.sendTestNotification();
    Alert.alert('Sent', 'Test notification sent immediately!');
  };

  const sendShiftReminder = async () => {
    await notificationService.sendTestShiftReminder(999, 'Security Venue');
    Alert.alert('Sent', 'Test shift reminder sent!');
  };

  const scheduleDelayedTest = async () => {
    await notificationService.scheduleTestNotification(10);
    Alert.alert('Scheduled', 'Test notification will appear in 10 seconds');
  };

  const getScheduledNotifications = async () => {
    const scheduled = await notificationService.getScheduledNotifications();
    Alert.alert(
      'Scheduled Notifications',
      `You have ${scheduled.length} scheduled notifications`,
      [
        {
          text: 'OK',
          onPress: () => console.log('Scheduled notifications:', scheduled),
        },
      ]
    );
  };

  const clearAllNotifications = async () => {
    await notificationService.cancelAllNotifications();
    Alert.alert('Cleared', 'All scheduled notifications cleared');
  };

  const getBadgeCount = async () => {
    const count = await notificationService.getBadgeCount();
    Alert.alert('Badge Count', `Current badge count: ${count}`);
  };

  const clearBadge = async () => {
    await notificationService.clearBadge();
    Alert.alert('Cleared', 'Badge count cleared');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔔 Notification Testing</Text>
        <Text style={styles.subtitle}>
          Test local notifications and push token registration
        </Text>
      </View>

      {/* Status Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status</Text>
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Permissions:</Text>
          <Text style={styles.statusValue}>{permissionStatus}</Text>
        </View>
        {pushToken && (
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Push Token:</Text>
            <Text style={styles.statusValue} numberOfLines={1}>
              {pushToken.substring(0, 30)}...
            </Text>
          </View>
        )}
      </View>

      {/* Permission Tests */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Permissions</Text>
        <TouchableOpacity style={styles.button} onPress={checkPermissions}>
          <Text style={styles.buttonText}>Check Permissions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={requestPermissions}
        >
          <Text style={[styles.buttonText, styles.buttonTextWhite]}>
            Request Permissions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={registerToken}>
          <Text style={styles.buttonText}>Register Push Token</Text>
        </TouchableOpacity>
      </View>

      {/* Immediate Notification Tests */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Immediate Notifications</Text>
        <TouchableOpacity
          style={[styles.button, styles.buttonSuccess]}
          onPress={sendImmediateTest}
        >
          <Text style={[styles.buttonText, styles.buttonTextWhite]}>
            Send Test Notification Now
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonSuccess]}
          onPress={sendShiftReminder}
        >
          <Text style={[styles.buttonText, styles.buttonTextWhite]}>
            Send Shift Reminder Now
          </Text>
        </TouchableOpacity>
      </View>

      {/* Scheduled Notification Tests */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scheduled Notifications</Text>
        <TouchableOpacity
          style={[styles.button, styles.buttonWarning]}
          onPress={scheduleDelayedTest}
        >
          <Text style={[styles.buttonText, styles.buttonTextWhite]}>
            Schedule Test (10 seconds)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={getScheduledNotifications}>
          <Text style={styles.buttonText}>View Scheduled Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonDanger]}
          onPress={clearAllNotifications}
        >
          <Text style={[styles.buttonText, styles.buttonTextWhite]}>
            Clear All Scheduled
          </Text>
        </TouchableOpacity>
      </View>

      {/* Badge Tests */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Badge Management</Text>
        <TouchableOpacity style={styles.button} onPress={getBadgeCount}>
          <Text style={styles.buttonText}>Get Badge Count</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={clearBadge}>
          <Text style={styles.buttonText}>Clear Badge</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          💡 Tip: Tap a notification to test deep linking
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    padding: 20,
    backgroundColor: colors.primary,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: colors.text.primary,
  },
  statusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  button: {
    backgroundColor: colors.background.secondary,
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  buttonSuccess: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  buttonWarning: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  buttonDanger: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.text.primary,
  },
  buttonTextWhite: {
    color: 'white',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
