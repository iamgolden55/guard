/**
 * Typography Components
 * Pre-styled text components following design system
 */

import React from 'react';
import { Text, StyleSheet, TextStyle, TextProps } from 'react-native';
import { colors, textStyles } from '../../theme';

interface TypographyProps extends TextProps {
  children: React.ReactNode;
  color?: string;
  align?: 'left' | 'center' | 'right';
  style?: TextStyle;
}

export const Heading1: React.FC<TypographyProps> = ({ children, color, align, style, ...props }) => (
  <Text
    style={[
      textStyles.h1,
      { color: color || colors.text.primary, textAlign: align },
      style,
    ]}
    {...props}
  >
    {children}
  </Text>
);

export const Heading2: React.FC<TypographyProps> = ({ children, color, align, style, ...props }) => (
  <Text
    style={[
      textStyles.h2,
      { color: color || colors.text.primary, textAlign: align },
      style,
    ]}
    {...props}
  >
    {children}
  </Text>
);

export const Heading3: React.FC<TypographyProps> = ({ children, color, align, style, ...props }) => (
  <Text
    style={[
      textStyles.h3,
      { color: color || colors.text.primary, textAlign: align },
      style,
    ]}
    {...props}
  >
    {children}
  </Text>
);

export const Heading4: React.FC<TypographyProps> = ({ children, color, align, style, ...props }) => (
  <Text
    style={[
      textStyles.h4,
      { color: color || colors.text.primary, textAlign: align },
      style,
    ]}
    {...props}
  >
    {children}
  </Text>
);

export const Body: React.FC<TypographyProps> = ({ children, color, align, style, ...props }) => (
  <Text
    style={[
      textStyles.body,
      { color: color || colors.text.primary, textAlign: align },
      style,
    ]}
    {...props}
  >
    {children}
  </Text>
);

export const BodyLarge: React.FC<TypographyProps> = ({ children, color, align, style, ...props }) => (
  <Text
    style={[
      textStyles.bodyLarge,
      { color: color || colors.text.primary, textAlign: align },
      style,
    ]}
    {...props}
  >
    {children}
  </Text>
);

export const BodySmall: React.FC<TypographyProps> = ({ children, color, align, style, ...props }) => (
  <Text
    style={[
      textStyles.bodySmall,
      { color: color || colors.text.secondary, textAlign: align },
      style,
    ]}
    {...props}
  >
    {children}
  </Text>
);

export const Caption: React.FC<TypographyProps> = ({ children, color, align, style, ...props }) => (
  <Text
    style={[
      textStyles.caption,
      { color: color || colors.text.tertiary, textAlign: align },
      style,
    ]}
    {...props}
  >
    {children}
  </Text>
);

export const Label: React.FC<TypographyProps> = ({ children, color, align, style, ...props }) => (
  <Text
    style={[
      textStyles.label,
      { color: color || colors.text.primary, textAlign: align },
      style,
    ]}
    {...props}
  >
    {children}
  </Text>
);
