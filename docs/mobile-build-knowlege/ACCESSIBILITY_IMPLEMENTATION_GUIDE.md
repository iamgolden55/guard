# Mobile App Accessibility Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Accessibility Standards](#accessibility-standards)
3. [Screen Reader Support](#screen-reader-support)
4. [Touch Target Sizing](#touch-target-sizing)
5. [Color & Contrast](#color--contrast)
6. [Typography & Readability](#typography--readability)
7. [Navigation Accessibility](#navigation-accessibility)
8. [Form Accessibility](#form-accessibility)
9. [Media Accessibility](#media-accessibility)
10. [Testing & Validation](#testing--validation)
11. [Accessibility Checklist](#accessibility-checklist)

---

## Overview

### Accessibility Commitment
This mobile app targets **WCAG 2.1 Level AA** compliance across all platforms (iOS and Android). Accessibility is not an afterthought but a core design principle ensuring all staff members, regardless of ability, can use the app effectively.

### Key Principles
- **Perceivable**: Information and UI components must be perceivable
- **Operable**: UI components and navigation must be operable
- **Understandable**: Text and operations must be understandable
- **Robust**: Content must be robust enough for assistive technologies

### Tools Required
```bash
npm install @react-native-community/hooks
npm install react-native-accessibility-helper
npm install react-native-gesture-handler  # Already installed
```

---

## Accessibility Standards

### WCAG 2.1 Guidelines

| Criterion | Level | Requirement |
|-----------|-------|-------------|
| **1.3.1 Info and Relationships** | A | Semantic structure |
| **1.4.3 Contrast (Minimum)** | AA | 4.5:1 for text, 3:1 for graphics |
| **1.4.4 Resize Text** | AA | Support 200% zoom |
| **2.1.1 Keyboard** | A | All functionality keyboard accessible |
| **2.1.2 No Keyboard Trap** | A | Focus not trapped |
| **2.4.3 Focus Order** | A | Logical focus order |
| **2.4.7 Focus Visible** | AA | Visible focus indicator |
| **3.2.4 Consistent Identification** | AA | Consistent UI patterns |
| **4.1.2 Name, Role, Value** | A | Proper accessibility labels |
| **4.1.3 Status Messages** | AA | Announce dynamic updates |

### React Native Accessibility API

```typescript
import { View, Text, AccessibilityInfo } from 'react-native';

// Basic accessibility properties
<View
  accessible={true}
  accessibilityRole="button"
  accessibilityLabel="Check In"
  accessibilityHint="Double tap to start shift check-in process"
  accessibilityState={{ disabled: false, checked: false }}
>
  <Text>Check In</Text>
</View>
```

---

## Screen Reader Support

### VoiceOver (iOS) & TalkBack (Android)

#### Setting Accessibility Labels
```typescript
export const AccessibleButton: React.FC<ButtonProps> = ({
  label,
  hint,
  onPress,
  disabled,
}) => {
  return (
    <Pressable
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
    >
      <Text>{label}</Text>
    </Pressable>
  );
};

// Usage
<AccessibleButton
  label="Check In"
  hint="Starts the shift check-in process. Requires location verification and photo confirmation."
  onPress={handleCheckIn}
/>
```

#### Dynamic Content Announcements
```typescript
import { AccessibilityInfo } from 'react-native';

export const useLiveRegion = () => {
  const announceForAccessibility = (message: string) => {
    AccessibilityInfo.announceForAccessibility(message);
  };

  return { announceForAccessibility };
};

// Usage in component
export const ShiftStatus: React.FC<{ status: string }> = ({ status }) => {
  const { announceForAccessibility } = useLiveRegion();
  const [displayStatus, setDisplayStatus] = useState(status);

  useEffect(() => {
    const statusMessage = getStatusMessage(status);
    setDisplayStatus(statusMessage);
    announceForAccessibility(statusMessage);
  }, [status]);

  return (
    <View
      accessible={true}
      accessibilityRole="status"
      accessibilityLiveRegion="polite"
    >
      <Text>{displayStatus}</Text>
    </View>
  );
};
```

#### Semantic Structure
```typescript
// Good: Clear semantic hierarchy
<View
  accessible={true}
  accessibilityRole="header"
  accessibilityLabel="Shift Details"
>
  <Text style={styles.heading}>Today's Shift</Text>
</View>

<View
  accessible={true}
  accessibilityRole="list"
  accessibilityLabel="Shift information"
>
  <View
    accessible={true}
    accessibilityRole="listitem"
    accessibilityLabel="Venue: The Grand Hotel"
  >
    <Text>Venue: The Grand Hotel</Text>
  </View>
  <View
    accessible={true}
    accessibilityRole="listitem"
    accessibilityLabel="Time: 9:00 AM to 5:00 PM"
  >
    <Text>Time: 9:00 AM to 5:00 PM</Text>
  </View>
</View>
```

#### Form Fields with Labels
```typescript
export const AccessibleInput: React.FC<InputProps> = ({
  label,
  error,
  required,
  value,
  onChangeText,
  secureTextEntry,
}) => {
  const accessibilityLabel = `${label}${required ? ', required' : ''}`;
  const accessibilityHint = error ? `Error: ${error}` : undefined;

  return (
    <View>
      <Text
        accessible={false}
        style={styles.label}
      >
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityRole="text"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        style={[styles.input, error && styles.inputError]}
      />
    </View>
  );
};
```

---

## Touch Target Sizing

### Minimum Touch Target Sizes

**Guideline**: 44pt × 44pt minimum (Apple) / 48dp × 48dp (Android)

```typescript
export const AccessiblePressable: React.FC<PressableProps> = ({
  children,
  onPress,
  minSize = 44, // points
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        {
          minWidth: minSize,
          minHeight: minSize,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {children}
    </Pressable>
  );
};

// Good: Adequate touch target
<AccessiblePressable
  onPress={handleCheckIn}
  minSize={48}
>
  <Text>Check In</Text>
</AccessiblePressable>

// Bad: Too small
<Pressable style={{ width: 24, height: 24 }}>
  <Icon />
</Pressable>

// Good: Use hitSlop to expand touch area without changing visual size
<Pressable
  onPress={handleClose}
  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
>
  <Icon size={24} />
</Pressable>
```

### Spacing Between Interactive Elements

```typescript
export const styles = StyleSheet.create({
  buttonContainer: {
    marginBottom: 16, // At least 16pt spacing between buttons
    marginHorizontal: 8,
  },
  button: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});
```

---

## Color & Contrast

### Contrast Ratios

```typescript
import { Colors } from '@/app/theme';

// Verify contrast ratios (using WCAG AA standards: 4.5:1 for text, 3:1 for graphics)
export const ColorSystem = {
  // Text colors
  text: {
    primary: '#000000',      // 21:1 contrast on white
    secondary: '#333333',    // 18:1 contrast on white
    tertiary: '#666666',     // 7:1 contrast on white
    disabled: '#CCCCCC',     // 3:1 contrast on white (limited use)
  },
  
  // Background colors
  background: {
    primary: '#FFFFFF',
    secondary: '#F5F5F5',
    tertiary: '#E8E8E8',
  },
  
  // Semantic colors
  status: {
    success: '#34C759',      // 3.5:1 contrast on white (needs dark text)
    warning: '#FF9500',      // 3:1 contrast on white (needs dark text)
    error: '#FF3B30',        // 2.5:1 contrast on white (use dark text)
    info: '#007AFF',         // 3:1 contrast on white (needs dark text)
  },
};

// Bad: Insufficient contrast
<Text style={{ color: '#CCCCCC', backgroundColor: '#FFFFFF' }}>
  Low contrast text
</Text>

// Good: Sufficient contrast
<Text style={{ color: Colors.text.primary, backgroundColor: Colors.background.primary }}>
  Good contrast text
</Text>
```

### Don't Rely on Color Alone

```typescript
// Bad: Only color distinguishes status
<View style={{ backgroundColor: status === 'active' ? '#34C759' : '#FF3B30' }} />

// Good: Color + text + icon
<View style={{
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: status === 'active' ? '#34C759' : '#FF3B30',
}}>
  <Icon
    name={status === 'active' ? 'checkmark-circle' : 'alert-circle'}
    color="#FFFFFF"
  />
  <Text style={{ color: '#FFFFFF', marginLeft: 8 }}>
    {status === 'active' ? 'Active' : 'Inactive'}
  </Text>
</View>
```

### Supporting Dark Mode

```typescript
import { useColorScheme } from 'react-native';

export const useAccessibleColors = () => {
  const colorScheme = useColorScheme();

  return {
    text: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
    background: colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF',
    secondary: colorScheme === 'dark' ? '#8E8E93' : '#CCCCCC',
  };
};
```

---

## Typography & Readability

### Font Sizing Standards

```typescript
export const Typography = StyleSheet.create({
  h1: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: 0.5,
  },
  h2: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    letterSpacing: 0.5,
  },
  h3: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    letterSpacing: 0.5,
  },
  h4: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
    letterSpacing: 0.5,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    letterSpacing: 0.5,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    letterSpacing: 0.25,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    letterSpacing: 0.4,
  },
});

// Minimum font size: 14pt for body text
// Never go below 12pt without special justification
// Line height minimum: 1.5x font size (for body text)
```

### Text Scaling Support

```typescript
import { AccessibilityInfo } from 'react-native';

export const ScalableText: React.FC<{ size: 'small' | 'medium' | 'large' } & TextProps> = ({
  size = 'medium',
  ...props
}) => {
  const [fontScale, setFontScale] = useState(1);

  useEffect(() => {
    AccessibilityInfo.screenReaderEnabled().then((enabled) => {
      // Use larger fonts for screen reader users
      setFontScale(enabled ? 1.2 : 1);
    });
  }, []);

  const baseSizes = {
    small: 12,
    medium: 16,
    large: 20,
  };

  return (
    <Text
      {...props}
      style={[
        props.style,
        {
          fontSize: baseSizes[size] * fontScale,
          lineHeight: (baseSizes[size] * fontScale) * 1.5,
        },
      ]}
    />
  );
};
```

---

## Navigation Accessibility

### Keyboard Navigation

```typescript
import { useFocusEffect } from '@react-navigation/native';
import { AccessibilityInfo, View } from 'react-native';

export const AccessibleScreen: React.FC = () => {
  const [focusableElements, setFocusableElements] = useState<string[]>([]);

  useFocusEffect(() => {
    // Announce screen title to screen reader users
    AccessibilityInfo.announceForAccessibility('Shift Details Screen');
  });

  return (
    <View
      accessible={true}
      accessibilityRole="main"
      accessibilityLabel="Shift Details"
    >
      {/* Content */}
    </View>
  );
};

// Focus management
export const useFocusNavigation = () => {
  const nextFocusRef = useRef<any>(null);

  const moveFocusToNext = () => {
    if (nextFocusRef.current) {
      AccessibilityInfo.setAccessibilityFocus(
        findNodeHandle(nextFocusRef.current)
      );
    }
  };

  return { nextFocusRef, moveFocusToNext };
};
```

### Tab Navigation Hints

```typescript
// Provide hints about tabbing behavior
<View
  accessible={true}
  accessibilityRole="tablist"
  accessibilityLabel="Navigation tabs"
>
  <Pressable
    accessible={true}
    accessibilityRole="tab"
    accessibilityLabel="Home tab"
    accessibilityHint="Swipe right to navigate to next tab"
    accessibilityState={{ selected: activeTab === 'home' }}
  >
    <Text>Home</Text>
  </Pressable>
</View>
```

---

## Form Accessibility

### Input Fields

```typescript
export const AccessibleTextInput: React.FC<FormFieldProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  required,
  hint,
  inputType = 'email',
}) => {
  const inputRef = useRef<TextInput>(null);

  return (
    <View>
      {/* Label should always be associated with input */}
      <Text
        nativeID={`label-${inputType}`}
        style={styles.label}
      >
        {label}
        {required && <Text style={styles.required}> * (required)</Text>}
      </Text>

      <TextInput
        ref={inputRef}
        accessible={true}
        accessibilityLabel={label}
        accessibilityHint={hint || error}
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        nativeID={`input-${inputType}`}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999999"
        style={[
          styles.input,
          error && styles.inputError,
        ]}
        // Declare input type for keyboard optimization
        keyboardType={inputType === 'email' ? 'email-address' : 'default'}
        textContentType={inputType}
      />

      {/* Error message with ARIA live region */}
      {error && (
        <Text
          style={styles.errorMessage}
          accessible={true}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          Error: {error}
        </Text>
      )}
    </View>
  );
};
```

### Select / Picker Fields

```typescript
// Good: Use native picker with accessibility support
<View
  accessible={true}
  accessibilityRole="dropdown"
  accessibilityLabel="Incident Type"
  accessibilityHint="Choose the type of incident that occurred"
>
  <Picker
    selectedValue={selectedIncident}
    onValueChange={(value) => setSelectedIncident(value)}
    accessibilityLabel="Incident Type"
  >
    <Picker.Item label="Select incident type" value="" />
    <Picker.Item label="Assault" value="assault" />
    <Picker.Item label="Theft" value="theft" />
    <Picker.Item label="Property Damage" value="damage" />
  </Picker>
</View>
```

### Checkboxes & Radio Buttons

```typescript
export const AccessibleCheckbox: React.FC<CheckboxProps> = ({
  label,
  checked,
  onToggle,
  disabled,
  hint,
}) => {
  return (
    <Pressable
      accessible={true}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked, disabled }}
      onPress={() => !disabled && onToggle(!checked)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={[styles.checkbox, checked && styles.checked]}>
        {checked && (
          <Text
            style={styles.checkmark}
            allowFontScaling={false}
          >
            ✓
          </Text>
        )}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
};
```

---

## Media Accessibility

### Image Descriptions

```typescript
// Bad: No description
<Image
  source={require('../../assets/venue-photo.jpg')}
  style={styles.image}
/>

// Good: Descriptive accessibility label
<Image
  source={require('../../assets/venue-photo.jpg')}
  accessible={true}
  accessibilityRole="image"
  accessibilityLabel="The Grand Hotel venue - exterior building with glass entrance"
  style={styles.image}
/>
```

### Audio & Video Content

```typescript
// Audio transcription for incidents
export const VoiceRecording: React.FC<{ uri: string; transcript?: string }> = ({
  uri,
  transcript,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <View>
      <Pressable
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Stop playback' : 'Play voice recording'}
        accessibilityHint="Incident voice memo from check-in"
        onPress={() => setIsPlaying(!isPlaying)}
      >
        <Icon name={isPlaying ? 'pause' : 'play'} />
        <Text>{isPlaying ? 'Pause' : 'Play'} Recording</Text>
      </Pressable>

      {/* Transcript for accessibility */}
      {transcript && (
        <View
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel="Voice recording transcript"
        >
          <Text>{transcript}</Text>
        </View>
      )}
    </View>
  );
};
```

### Captions for Videos

```typescript
// Always provide captions for video content
<Video
  source={{ uri: videoUri }}
  poster={posterUri}
  accessibilityLabel="Security incident video"
  textTracks={[
    {
      title: 'English',
      language: 'en',
      type: 'text/vtt',
      uri: captionUri,
    },
  ]}
/>
```

---

## Testing & Validation

### Automated Testing

```typescript
import { render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

describe('Accessibility Tests', () => {
  it('should have proper accessibility labels', async () => {
    const { getByA11yLabel } = render(<CheckInButton />);
    const button = getByA11yLabel('Check In');
    expect(button).toBeDefined();
  });

  it('should announce status changes to screen readers', async () => {
    const { getByA11yRole } = render(<ShiftStatus status="active" />);
    const status = getByA11yRole('status');
    expect(status).toBeDefined();
  });

  it('should have sufficient contrast ratio', async () => {
    // Use a tool like axe-core to verify contrast
    const { getByText } = render(
      <Text style={{ color: '#000000', backgroundColor: '#FFFFFF' }}>
        Good contrast
      </Text>
    );
    expect(getByText('Good contrast')).toBeDefined();
  });

  it('should support keyboard navigation', async () => {
    const { getByA11yRole } = render(<FormScreen />);
    const inputs = getByA11yRole('text');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('should have minimum touch target size', async () => {
    const { getByA11yLabel } = render(<Button label="Check In" />);
    const button = getByA11yLabel('Check In');
    const { width, height } = await button.measure();
    expect(width).toBeGreaterThanOrEqual(44);
    expect(height).toBeGreaterThanOrEqual(44);
  });
});
```

### Manual Testing Checklist

#### VoiceOver (iOS)
```bash
# Enable VoiceOver
Settings → Accessibility → VoiceOver → On

# Testing
1. Navigate using VoiceOver rotor (two-finger Z gesture)
2. Swipe right to move forward, left to move back
3. Double-tap to activate
4. Two-finger swipe up to read from top
5. Verify all interactive elements are accessible
6. Check that focus order is logical
7. Verify status updates are announced
```

#### TalkBack (Android)
```bash
# Enable TalkBack
Settings → Accessibility → TalkBack → On

# Testing
1. Swipe right to move forward, left to move back
2. Double-tap to activate
3. Swipe down then right for context menu
4. Verify all interactive elements are accessible
5. Check that focus order is logical
6. Verify status updates are announced
```

---

## Accessibility Checklist

### Before Release

- [ ] All text has minimum 14pt font size (body text)
- [ ] Color contrast ratios meet WCAG AA standards (4.5:1 for text)
- [ ] All interactive elements have touch targets ≥44pt × 44pt
- [ ] Screen reader labels are descriptive and contextual
- [ ] Form fields have associated labels
- [ ] Error messages are announced immediately
- [ ] Focus order is logical and predictable
- [ ] Focus indicators are visible throughout
- [ ] No keyboard traps exist
- [ ] Images have descriptive alt text
- [ ] Videos have captions and transcripts
- [ ] Audio content has transcriptions
- [ ] Status changes are announced to screen readers
- [ ] No reliance on color alone to convey information
- [ ] Dark mode is fully supported
- [ ] Text can scale up to 200% without breaking layout
- [ ] All interactive elements work with both single tap and hold
- [ ] Vibration/haptic feedback doesn't convey critical information
- [ ] Loading states are clearly communicated
- [ ] Modals trap focus appropriately
- [ ] VoiceOver and TalkBack tested on real devices

### Ongoing Monitoring

```typescript
// Add accessibility telemetry
export const trackAccessibilityUsage = async () => {
  const screenReaderEnabled = await AccessibilityInfo.screenReaderEnabled();
  const boldTextEnabled = await AccessibilityInfo.boldTextEnabled();
  const screenReaderEnabled = await AccessibilityInfo.screenReaderEnabled();
  
  logAnalytics('accessibility_usage', {
    screenReaderEnabled,
    boldTextEnabled,
    timestamp: new Date(),
  });
};
```

---

## Resources

- [React Native Accessibility Guide](https://reactnative.dev/docs/accessibility)
- [WCAG 2.1 Complete Guide](https://www.w3.org/WAI/WCAG21/quickref/)
- [Apple Accessibility Guidelines](https://developer.apple.com/design/accessibility/)
- [Android Accessibility Guidelines](https://developer.android.com/guide/topics/ui/accessibility)
- [Inclusive Components](https://inclusive-components.design/)

---

**Status**: ✅ Complete | **Last Updated**: February 2026
