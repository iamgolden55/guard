/**
 * Checkbox Component
 * Design system checkbox with label support
 */

import React from 'react';
import { TouchableOpacity, View, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body } from './Typography';
import { colors, getColors, spacing } from '../../theme';
import { useTheme } from '../../hooks/useTheme';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  style,
}) => {
  const { isDark } = useTheme();
  const themeColors = getColors(isDark);

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={() => !disabled && onChange(!checked)}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.checkbox,
          { backgroundColor: themeColors.background.primary, borderColor: themeColors.border.dark },
          checked && styles.checkboxChecked,
          disabled && styles.checkboxDisabled,
        ]}
      >
        {checked && (
          <Ionicons
            name="checkmark"
            size={18}
            color={disabled ? colors.gray[400] : colors.white}
          />
        )}
      </View>
      {label && (
        <Body
          style={[
            styles.label,
            { color: themeColors.text.primary },
            disabled && { color: colors.gray[400] },
          ]}
        >
          {label}
        </Body>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    // backgroundColor and borderColor applied via inline style for dark mode
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxDisabled: {
    backgroundColor: colors.gray[200],
    borderColor: colors.gray[300],
  },
  label: {
    flex: 1,
    lineHeight: 22,
    // color applied via inline style for dark mode
  },
});
