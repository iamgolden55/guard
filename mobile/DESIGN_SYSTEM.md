# Mobile App Design System

**Dropbox-Inspired Clean & Professional Design**

This design system ensures consistency across the entire mobile application with reusable components, standardized colors, typography, and spacing.

---

## Table of Contents
1. [Design Principles](#design-principles)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing](#spacing)
5. [Layout & Components](#layout--components)
6. [Component Usage](#component-usage)
7. [Code Examples](#code-examples)

---

## Design Principles

### 1. Clean & Minimal
- White backgrounds with subtle borders
- No heavy shadows or gradients
- Focus on content, not decoration

### 2. Professional
- System fonts (iOS System, Android Roboto)
- Consistent spacing and alignment
- Clear visual hierarchy

### 3. User-Friendly
- Large touch targets (minimum 44pt)
- Clear labels and placeholders
- Immediate visual feedback

### 4. Consistent
- Use design system components everywhere
- Follow established patterns
- Maintain uniform spacing

---

## Color System

### Primary Colors
```typescript
import { colors } from '@theme';

colors.primary        // '#0061FF' - Dropbox blue
colors.primaryDark    // '#0052E0' - Pressed state
colors.primaryLight   // '#3385FF' - Hover state
```

### Neutral Colors
```typescript
colors.white          // '#FFFFFF'
colors.black          // '#000000'
colors.gray[50]       // '#F9F9F9' - Lightest
colors.gray[100]      // '#F5F5F5'
colors.gray[200]      // '#E5E5E5' - Borders
colors.gray[400]      // '#A3A3A3'
colors.gray[600]      // '#525252' - Secondary text
colors.gray[900]      // '#171717' - Darkest
```

### Semantic Colors
```typescript
colors.success        // '#22C55E' - Green
colors.error          // '#EF4444' - Red
colors.warning        // '#F59E0B' - Orange
colors.info           // '#3B82F6' - Blue
```

### Text Colors
```typescript
colors.text.primary       // '#000000' - Headings, labels
colors.text.secondary     // '#525252' - Body text
colors.text.tertiary      // '#737373' - Helper text
colors.text.placeholder   // '#999999' - Input placeholders
colors.text.inverse       // '#FFFFFF' - White text
```

---

## Typography

### Import Typography
```typescript
import { textStyles, fonts } from '@theme';
import { Heading1, Body, Caption } from '@components/ui';
```

### Heading Styles
```typescript
// Heading 1 - 28pt, Bold
<Heading1>Security Staff Portal</Heading1>

// Heading 2 - 24pt, Bold
<Heading2>Welcome Back</Heading2>

// Heading 3 - 20pt, Semibold
<Heading3>Your Shifts</Heading3>

// Heading 4 - 18pt, Semibold
<Heading4>Today's Schedule</Heading4>
```

### Body Text
```typescript
// Body Large - 18pt, Regular
<BodyLarge>Important information</BodyLarge>

// Body - 16pt, Regular (default)
<Body>Standard body text for most content</Body>

// Body Small - 14pt, Regular
<BodySmall>Secondary information</BodySmall>

// Caption - 12pt, Regular
<Caption>Helper text and timestamps</Caption>
```

### Label Text
```typescript
// Label - 16pt, Semibold
<Label>Email</Label>
```

### Font Weights
```typescript
fonts.weight.regular    // '400'
fonts.weight.medium     // '500'
fonts.weight.semibold   // '600'
fonts.weight.bold       // '700'
```

---

## Spacing

### Spacing Scale
```typescript
import { spacing } from '@theme';

spacing.xs      // 4pt
spacing.sm      // 8pt
spacing.md      // 12pt
spacing.base    // 16pt (default)
spacing.lg      // 20pt
spacing.xl      // 24pt
spacing['2xl']  // 32pt
spacing['3xl']  // 40pt
spacing['4xl']  // 48pt
spacing['5xl']  // 64pt
spacing['6xl']  // 80pt
```

### Common Usage
- **Component padding**: `spacing.xl` (24pt)
- **Section gaps**: `spacing['2xl']` (32pt)
- **Input padding**: `spacing.base` (16pt)
- **Button padding**: `spacing.lg` vertical, `spacing.xl` horizontal
- **Card padding**: `spacing.base` to `spacing.lg`

---

## Layout & Components

### Border Radius
```typescript
import { layout } from '@theme';

layout.borderRadius.sm      // 4pt
layout.borderRadius.base    // 8pt (buttons, inputs)
layout.borderRadius.md      // 12pt (cards)
layout.borderRadius.lg      // 16pt
layout.borderRadius.full    // 9999pt (circles)
```

### Shadows
```typescript
layout.shadow.none    // No shadow
layout.shadow.sm      // Subtle shadow
layout.shadow.base    // Default shadow
layout.shadow.md      // Medium shadow
layout.shadow.lg      // Large shadow
```

### Icon Sizes
```typescript
layout.iconSize.sm      // 20pt
layout.iconSize.base    // 24pt
layout.iconSize.md      // 28pt
layout.iconSize.lg      // 32pt
```

---

## Component Usage

### 1. Container
**Purpose**: Main screen wrapper with consistent padding and safe area handling

```typescript
import { Container } from '@components/ui';

<Container
  scrollable={true}
  keyboardAware={true}
  safeArea={true}
  padding="xl"
>
  {/* Screen content */}
</Container>
```

**Props**:
- `scrollable`: Enable ScrollView (default: false)
- `keyboardAware`: Enable keyboard avoidance (default: true)
- `safeArea`: Use SafeAreaView (default: true)
- `padding`: Spacing key from theme (default: 'xl')

---

### 2. Button
**Purpose**: Primary action buttons with multiple variants

```typescript
import { Button } from '@components/ui';

// Primary button (blue)
<Button
  title="Sign in"
  onPress={handleSignIn}
  variant="primary"
  size="large"
  loading={isLoading}
/>

// Secondary button (gray)
<Button
  title="Cancel"
  onPress={handleCancel}
  variant="secondary"
/>

// Outline button (white with border)
<Button
  title="Learn More"
  onPress={handleLearnMore}
  variant="outline"
/>

// Social login buttons
<Button
  title="Sign in with Apple"
  onPress={handleAppleLogin}
  variant="social-apple"
  icon={<FontAwesome name="apple" size={20} color="#FFF" />}
/>

<Button
  title="Continue with Google"
  onPress={handleGoogleLogin}
  variant="social-google"
  icon={<AntDesign name="google" size={20} color="#4285F4" />}
/>
```

**Variants**:
- `primary`: Blue background, white text
- `secondary`: Gray background, black text
- `outline`: White background, border, black text
- `ghost`: Transparent background, blue text
- `social-apple`: Black background, white text
- `social-google`: White background, border, black text

**Sizes**:
- `small`: Compact button
- `medium`: Medium button
- `large`: Full-width button (default)

---

### 3. Input
**Purpose**: Text input with horizontal label layout (Dropbox style)

```typescript
import { Input } from '@components/ui';

<Input
  label="Email"
  placeholder="Email address"
  value={email}
  onChangeText={setEmail}
  keyboardType="email-address"
  autoCapitalize="none"
  error={emailError}
/>

<Input
  label="Password"
  placeholder="Password"
  value={password}
  onChangeText={setPassword}
  secureTextEntry
  error={passwordError}
/>
```

**Features**:
- Horizontal layout (label on left, input on right)
- Tap anywhere on row to focus
- Bottom border (changes to red on error)
- Error message below input
- Platform-specific fonts

---

### 4. Card
**Purpose**: Content containers with optional elevation

```typescript
import { Card } from '@components/ui';

// Elevated card (with shadow)
<Card variant="elevated" padding="base">
  <Heading3>Your Next Shift</Heading3>
  <Body>Tomorrow at 9:00 AM</Body>
</Card>

// Outlined card (with border)
<Card variant="outlined" padding="lg">
  <Body>Outlined card content</Body>
</Card>

// Flat card (no shadow/border)
<Card variant="flat">
  <Body>Flat card content</Body>
</Card>
```

**Variants**:
- `elevated`: White background with shadow (default)
- `outlined`: White background with border
- `flat`: Gray background, no shadow/border

---

### 5. Typography Components
**Purpose**: Pre-styled text components

```typescript
import {
  Heading1,
  Heading2,
  Body,
  Caption
} from '@components/ui';

<Heading1>Main Title</Heading1>
<Heading2>Section Title</Heading2>
<Body>Body text content</Body>
<Caption>Helper text or timestamp</Caption>

// With custom color
<Body color={colors.error}>Error message</Body>

// With alignment
<Heading2 align="center">Centered Title</Heading2>
```

---

## Code Examples

### Example 1: Login Screen (Dropbox Style)

```typescript
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { FontAwesome, AntDesign } from '@expo/vector-icons';
import {
  Container,
  Button,
  Input,
  Heading1,
  Body
} from '@components/ui';
import { colors, spacing, layout } from '@theme';

export const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <Container scrollable keyboardAware>
      <View style={styles.logoContainer}>
        <Logo />
      </View>

      {/* Social login */}
      <Button
        title="Sign in with Apple"
        variant="social-apple"
        icon={<FontAwesome name="apple" size={20} color="#FFF" />}
        onPress={handleAppleLogin}
      />

      <Button
        title="Continue with Google"
        variant="social-google"
        icon={<AntDesign name="google" size={20} color="#4285F4" />}
        onPress={handleGoogleLogin}
      />

      {/* Heading */}
      <Heading1 style={styles.heading}>Sign in</Heading1>

      {/* Form inputs */}
      <Input
        label="Email"
        placeholder="Email address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />

      <Input
        label="Password"
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {/* Submit button */}
      <Button
        title="Sign in"
        variant="primary"
        onPress={handleLogin}
      />
    </Container>
  );
};

const styles = StyleSheet.create({
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  heading: {
    marginTop: spacing['2xl'],
    marginBottom: spacing.xl,
  },
});
```

---

### Example 2: Dashboard Card

```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Heading3, Body, Button } from '@components/ui';
import { spacing } from '@theme';

export const ShiftCard = ({ shift }) => {
  return (
    <Card variant="elevated" padding="lg">
      <Heading3>Your Next Shift</Heading3>
      <Body style={styles.time}>
        {shift.date} at {shift.time}
      </Body>
      <Body style={styles.venue}>
        {shift.venue}
      </Body>

      <Button
        title="Check In"
        variant="primary"
        onPress={handleCheckIn}
        style={styles.button}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  time: {
    marginTop: spacing.sm,
  },
  venue: {
    marginTop: spacing.xs,
  },
  button: {
    marginTop: spacing.lg,
  },
});
```

---

### Example 3: Settings Screen

```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Container,
  Card,
  Heading2,
  Body,
  Button
} from '@components/ui';
import { spacing } from '@theme';

export const SettingsScreen = () => {
  return (
    <Container scrollable>
      <Heading2 style={styles.title}>Settings</Heading2>

      <Card variant="outlined" style={styles.section}>
        <Body style={styles.sectionTitle}>Account</Body>
        <Button
          title="Edit Profile"
          variant="outline"
          onPress={handleEditProfile}
        />
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Body style={styles.sectionTitle}>Security</Body>
        <Button
          title="Change Password"
          variant="outline"
          onPress={handleChangePassword}
        />
      </Card>

      <Button
        title="Sign Out"
        variant="secondary"
        onPress={handleSignOut}
      />
    </Container>
  );
};

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.base,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
});
```

---

## Best Practices

### ✅ Do's

1. **Use design system components**
   ```typescript
   // Good
   <Button title="Sign In" variant="primary" />

   // Bad
   <TouchableOpacity style={customBlueButton}>
     <Text>Sign In</Text>
   </TouchableOpacity>
   ```

2. **Use theme tokens for colors and spacing**
   ```typescript
   // Good
   style={{ padding: spacing.xl, color: colors.text.primary }}

   // Bad
   style={{ padding: 24, color: '#000000' }}
   ```

3. **Use typography components**
   ```typescript
   // Good
   <Heading2>Welcome</Heading2>

   // Bad
   <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Welcome</Text>
   ```

4. **Maintain consistent spacing**
   ```typescript
   // Good - uses spacing scale
   marginBottom: spacing.xl,
   gap: spacing.base,

   // Bad - random values
   marginBottom: 25,
   gap: 13,
   ```

### ❌ Don'ts

1. **Don't hardcode colors**
   - Use `colors` from theme instead

2. **Don't create custom buttons**
   - Use `<Button>` component with variants

3. **Don't use random spacing values**
   - Use `spacing` scale

4. **Don't mix design styles**
   - Stick to Dropbox-inspired clean design

---

## Migration Guide

### Migrating Existing Screens

1. **Replace custom containers**
   ```typescript
   // Before
   <KeyboardAvoidingView>
     <ScrollView>
       {/* content */}
     </ScrollView>
   </KeyboardAvoidingView>

   // After
   <Container scrollable keyboardAware>
     {/* content */}
   </Container>
   ```

2. **Replace custom buttons**
   ```typescript
   // Before
   <TouchableOpacity style={styles.blueButton}>
     <Text style={styles.buttonText}>Sign In</Text>
   </TouchableOpacity>

   // After
   <Button title="Sign In" variant="primary" />
   ```

3. **Replace custom inputs**
   ```typescript
   // Before
   <View style={styles.inputGroup}>
     <Text style={styles.label}>Email</Text>
     <TextInput style={styles.input} />
   </View>

   // After
   <Input label="Email" placeholder="Email address" />
   ```

4. **Replace text components**
   ```typescript
   // Before
   <Text style={{ fontSize: 28, fontWeight: 'bold' }}>Title</Text>

   // After
   <Heading1>Title</Heading1>
   ```

---

## Quick Reference

### Import Shortcuts
```typescript
// Theme tokens
import { colors, spacing, layout, textStyles } from '@theme';

// Components
import {
  Container,
  Button,
  Input,
  Card,
  Heading1,
  Body
} from '@components/ui';
```

### Common Patterns

**Screen Layout**
```typescript
<Container scrollable keyboardAware>
  <Heading1>Screen Title</Heading1>
  {/* Content */}
</Container>
```

**Form Layout**
```typescript
<Input label="Email" ... />
<Input label="Password" ... />
<Button title="Submit" variant="primary" />
```

**Card Grid**
```typescript
<Card variant="elevated">
  <Heading3>Card Title</Heading3>
  <Body>Card content</Body>
</Card>
```

---

## Questions or Issues?

If you have questions about the design system or need to add new components, refer to:
- `/mobile/src/theme/*` - Theme tokens
- `/mobile/src/components/ui/*` - Component implementations
- This document for usage patterns

**Remember**: Consistency is key! Always use design system components and theme tokens.
