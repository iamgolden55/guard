/**
 * Input Component
 * Dropbox-inspired input with horizontal label layout
 */

import React, { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';
import { colors, textStyles, layout, spacing } from '../../theme';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  inputStyle?: TextStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  labelStyle,
  inputStyle,
  ...textInputProps
}) => {
  const inputRef = useRef<TextInput>(null);

  return (
    <View>
      <TouchableWithoutFeedback onPress={() => inputRef.current?.focus()}>
        <View style={[styles.inputRow, error && styles.inputRowError, containerStyle]}>
          <Text style={[styles.label, labelStyle]}>{label}</Text>
          <TextInput
            ref={inputRef}
            style={[styles.input, inputStyle]}
            placeholderTextColor={colors.text.placeholder}
            {...textInputProps}
          />
        </View>
      </TouchableWithoutFeedback>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: layout.borderWidth.thin,
    borderBottomColor: colors.border.light,
    paddingVertical: spacing.base,
    marginBottom: 0,
  },
  inputRowError: {
    borderBottomColor: colors.error,
  },
  label: {
    ...textStyles.label,
    color: colors.text.primary,
    width: 120,
  },
  input: {
    ...textStyles.input,
    flex: 1,
    color: colors.text.primary,
    paddingVertical: 0,
  },
  errorText: {
    ...textStyles.caption,
    color: colors.error,
    marginTop: spacing.xs,
    marginLeft: 120,
  },
});
