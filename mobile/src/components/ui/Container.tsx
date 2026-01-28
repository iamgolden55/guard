/**
 * Container Component
 * Standard screen container with consistent padding
 */

import React from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getColors, spacing } from '../../theme';
import { useTheme } from '../../hooks/useTheme';

interface ContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  keyboardAware?: boolean;
  safeArea?: boolean;
  padding?: keyof typeof spacing;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
}

export const Container: React.FC<ContainerProps> = ({
  children,
  scrollable = false,
  keyboardAware = true,
  safeArea = true,
  padding,
  style,
  contentContainerStyle,
}) => {
  const { isDark } = useTheme();
  const colors = getColors(isDark);

  // Base style with just flex and background - let screens control padding via style prop
  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: colors.background.primary,
    ...(padding && { padding: spacing[padding] }),
    ...style,
  };

  const scrollContentStyle: ViewStyle = {
    flexGrow: 1,
    ...contentContainerStyle,
  };

  const content = scrollable ? (
    <ScrollView
      contentContainerStyle={scrollContentStyle}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={containerStyle}>{children}</View>
  );

  if (keyboardAware && scrollable) {
    return (
      <KeyboardAvoidingView
        style={[styles.keyboardView, { backgroundColor: colors.background.primary }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {safeArea ? (
          <SafeAreaView style={containerStyle}>{content}</SafeAreaView>
        ) : (
          <View style={containerStyle}>{content}</View>
        )}
      </KeyboardAvoidingView>
    );
  }

  if (safeArea) {
    return <SafeAreaView style={containerStyle}>{content}</SafeAreaView>;
  }

  return <View style={containerStyle}>{content}</View>;
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    // backgroundColor applied via inline style for dark mode
  },
});
