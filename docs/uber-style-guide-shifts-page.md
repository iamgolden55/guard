# Uber Style Guide - Shifts Page

A comprehensive style guide for implementing the Shifts/Calendar page with Uber-inspired minimalist design and smooth animations.

---

## Design Principles

1. **Minimal & Clean**: Remove visual clutter, use whitespace
2. **Black & White First**: Color only for status/emphasis
3. **Subtle Depth**: Soft shadows, no harsh borders
4. **Smooth Motion**: Purposeful animations that feel natural
5. **Clear Hierarchy**: Bold numbers, subtle labels

---

## Color Palette

```typescript
// Primary
const colors = {
  primary: '#000000',        // Actions, active states
  primaryLight: '#1F1F1F',   // Dark mode surfaces

  // Backgrounds
  background: '#F8F8F8',     // Page bg
  surface: '#FFFFFF',        // Cards
  surfaceHover: '#FAFAFA',   // Card hover state

  // Text
  textPrimary: '#111827',    // Headings, important
  textSecondary: '#6B7280',  // Body text
  textMuted: '#9CA3AF',      // Placeholders, hints
  textInverse: '#FFFFFF',    // On dark backgrounds

  // Borders
  borderLight: '#E5E7EB',    // Default borders
  borderMedium: '#D1D5DB',   // Emphasis borders

  // Status
  success: '#22C55E',        // Completed, confirmed
  successLight: '#DCFCE7',   // Success bg
  warning: '#F59E0B',        // Late, attention
  warningLight: '#FEF3C7',   // Warning bg
  error: '#EF4444',          // Cancelled, error
  errorLight: '#FEE2E2',     // Error bg
  info: '#3B82F6',           // Informational
  infoLight: '#DBEAFE',      // Info bg

  // Shift Status Colors
  pending: '#6B7280',        // Gray - awaiting
  confirmed: '#22C55E',      // Green - confirmed
  inProgress: '#3B82F6',     // Blue - active
  completed: '#111827',      // Black - done
  cancelled: '#EF4444',      // Red - cancelled
};
```

---

## Typography

```typescript
const typography = {
  // Page Header
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },

  // Section Headers
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  // Card Title (Venue Name)
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // Card Subtitle (Date/Time)
  cardSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },

  // Time Display
  timeDisplay: {
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },

  // Small Time
  timeSmall: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'monospace',
    color: colors.textSecondary,
  },

  // Status Badge
  statusBadge: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Labels
  label: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.textMuted,
  },

  // Body
  body: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: colors.textSecondary,
  },
};
```

---

## Spacing System

```typescript
const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
};
```

---

## Border Radius

```typescript
const radius = {
  sm: 4,
  default: 8,
  md: 10,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
};
```

---

## Shadows

```typescript
const shadows = {
  // Subtle card shadow
  soft: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },

  // Card shadow
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },

  // Elevated/floating elements
  elevated: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },

  // Pressed state (inset feel)
  pressed: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
};
```

---

## Component Specifications

### 1. Page Header

```
┌─────────────────────────────────────┐
│  My Shifts                     [+]  │
│  3 upcoming shifts                  │
└─────────────────────────────────────┘
```

**Styles:**
```typescript
const PageHeader = {
  container: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: {
    ...typography.pageTitle,
  },
  subtitle: {
    ...typography.body,
    marginTop: spacing.xs,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
};
```

---

### 2. Calendar Strip (Horizontal Date Picker)

```
┌─────────────────────────────────────┐
│  ← January 2026 →                   │
├─────────────────────────────────────┤
│  Mon  Tue  Wed  Thu  Fri  Sat  Sun  │
│   19   20  [21]  22   23   24   25  │
│             ●                       │
└─────────────────────────────────────┘
```

**Styles:**
```typescript
const CalendarStrip = {
  container: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  monthText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  arrow: {
    padding: spacing.sm,
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.sm,
  },
  dayItem: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },
  dayItemActive: {
    backgroundColor: colors.primary,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dayNumberActive: {
    color: colors.textInverse,
  },
  // Dot indicator for shifts
  shiftDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: spacing.xs,
  },
};
```

**Animation - Day Selection:**
```typescript
// Scale bounce on selection
const daySelectAnim = {
  transform: [
    {
      scale: useSharedValue(1).withTiming(0.95, { duration: 100 })
                              .withTiming(1.05, { duration: 100 })
                              .withTiming(1, { duration: 100 }),
    },
  ],
};
```

---

### 3. Shift Card

```
┌─────────────────────────────────────┐
│  ┌────┐                             │
│  │ 09 │  Club XYZ               →   │
│  │ AM │  Security Door Staff        │
│  └────┘  09:00 - 17:00 • 8h         │
│          ┌──────────┐               │
│          │CONFIRMED │               │
│          └──────────┘               │
└─────────────────────────────────────┘
```

**Styles:**
```typescript
const ShiftCard = {
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.base,
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.soft,
  },
  // Time badge on left
  timeBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  timeNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  timePeriod: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  // Content area
  content: {
    flex: 1,
  },
  venueName: {
    ...typography.cardTitle,
    marginBottom: 2,
  },
  role: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  timeRange: {
    ...typography.timeSmall,
    marginBottom: spacing.sm,
  },
  // Status badge
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  statusText: {
    ...typography.statusBadge,
  },
  // Chevron
  chevron: {
    alignSelf: 'center',
    marginLeft: spacing.sm,
  },
};

// Status badge colors
const statusColors = {
  pending: { bg: colors.background, text: colors.textMuted },
  confirmed: { bg: colors.successLight, text: colors.success },
  inProgress: { bg: colors.infoLight, text: colors.info },
  completed: { bg: colors.background, text: colors.textPrimary },
  cancelled: { bg: colors.errorLight, text: colors.error },
};
```

**Animation - Card Press:**
```typescript
const cardPressAnim = useAnimatedStyle(() => ({
  transform: [{ scale: withTiming(pressed ? 0.98 : 1, { duration: 150 }) }],
  backgroundColor: withTiming(
    pressed ? colors.surfaceHover : colors.surface,
    { duration: 150 }
  ),
}));
```

---

### 4. Shift Detail Header

```
┌─────────────────────────────────────┐
│  ←  Shift Details           [Edit]  │
├─────────────────────────────────────┤
│                                     │
│           Club XYZ                  │
│      Security Door Staff            │
│                                     │
│     ┌───────────────────┐           │
│     │    09:00          │           │
│     │    ─────          │           │
│     │    17:00          │           │
│     │                   │           │
│     │    8h total       │           │
│     └───────────────────┘           │
│                                     │
│        [CONFIRMED]                  │
│                                     │
└─────────────────────────────────────┘
```

**Styles:**
```typescript
const ShiftDetailHeader = {
  container: {
    backgroundColor: colors.surface,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius['3xl'],
    borderBottomRightRadius: radius['3xl'],
    ...shadows.card,
  },
  venueName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  role: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  // Time display box
  timeBox: {
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginHorizontal: spacing['2xl'],
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  startTime: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  timeDivider: {
    width: 40,
    height: 2,
    backgroundColor: colors.borderMedium,
    marginVertical: spacing.md,
  },
  endTime: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  duration: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
    marginTop: spacing.md,
  },
};
```

---

### 5. Action Buttons

```
┌─────────────────────────────────────┐
│  [━━━━━ Check In ━━━━━]            │
│                                     │
│  [─── View on Map ───] [── Call ──] │
└─────────────────────────────────────┘
```

**Styles:**
```typescript
const ActionButtons = {
  // Primary action (full width)
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textInverse,
  },
  // Secondary actions (half width)
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  // Destructive action
  destructiveButton: {
    backgroundColor: colors.errorLight,
    borderColor: colors.error,
  },
  destructiveButtonText: {
    color: colors.error,
  },
};
```

**Animation - Button Press:**
```typescript
const buttonPressAnim = useAnimatedStyle(() => ({
  transform: [{ scale: withSpring(pressed ? 0.96 : 1) }],
  opacity: withTiming(pressed ? 0.9 : 1, { duration: 100 }),
}));
```

---

### 6. Info Rows

```
┌─────────────────────────────────────┐
│  📍 Location                        │
│     123 Main Street, Bristol        │
├─────────────────────────────────────┤
│  👤 Manager                         │
│     John Smith • +44 7123 456789    │
├─────────────────────────────────────┤
│  📋 Notes                           │
│     Wear black uniform. Arrive 15   │
│     minutes early for briefing.     │
└─────────────────────────────────────┘
```

**Styles:**
```typescript
const InfoRow = {
  container: {
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  value: {
    ...typography.body,
    color: colors.textPrimary,
  },
  valueSecondary: {
    ...typography.body,
    color: colors.textSecondary,
  },
};
```

---

## Animations Catalog

### 1. Page Transitions

```typescript
// Slide up from bottom
const slideUpEnter = {
  from: { translateY: 50, opacity: 0 },
  to: { translateY: 0, opacity: 1 },
  duration: 300,
  easing: Easing.out(Easing.cubic),
};

// Fade in
const fadeIn = {
  from: { opacity: 0 },
  to: { opacity: 1 },
  duration: 250,
};
```

### 2. List Item Stagger

```typescript
// Cards appear one by one
const staggeredList = (index: number) => ({
  entering: FadeInDown.delay(index * 50).springify(),
});
```

### 3. Status Badge Pulse

```typescript
// For "In Progress" status
const pulseAnim = useAnimatedStyle(() => ({
  opacity: withRepeat(
    withSequence(
      withTiming(1, { duration: 1000 }),
      withTiming(0.6, { duration: 1000 })
    ),
    -1,
    true
  ),
}));
```

### 4. Pull to Refresh

```typescript
const refreshAnim = {
  // Rotation for loading spinner
  rotation: withRepeat(
    withTiming(360, { duration: 1000, easing: Easing.linear }),
    -1
  ),
};
```

### 5. Swipe Actions

```typescript
// Swipe to reveal actions
const swipeAnim = useAnimatedStyle(() => ({
  transform: [{ translateX: withSpring(swipeX.value) }],
}));

// Action buttons fade in
const actionsAnim = useAnimatedStyle(() => ({
  opacity: interpolate(swipeX.value, [-80, -40], [1, 0]),
}));
```

### 6. Empty State

```typescript
// Gentle float animation
const floatAnim = useAnimatedStyle(() => ({
  transform: [
    {
      translateY: withRepeat(
        withSequence(
          withTiming(-10, { duration: 2000 }),
          withTiming(0, { duration: 2000 })
        ),
        -1,
        true
      ),
    },
  ],
}));
```

---

## Empty State

```
┌─────────────────────────────────────┐
│                                     │
│           ┌─────────┐               │
│           │   📅    │               │
│           └─────────┘               │
│                                     │
│        No shifts scheduled          │
│     Your upcoming shifts will       │
│         appear here                 │
│                                     │
│       [Browse Open Shifts]          │
│                                     │
└─────────────────────────────────────┘
```

**Styles:**
```typescript
const EmptyState = {
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: radius['2xl'],
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
};
```

---

## Implementation Checklist

### Components to Build
- [ ] `UberShiftsScreen.tsx` - Main shifts list page
- [ ] `UberCalendarStrip.tsx` - Horizontal date picker
- [ ] `UberShiftCard.tsx` - Individual shift card
- [ ] `UberShiftDetailScreen.tsx` - Shift detail page
- [ ] `UberEmptyState.tsx` - Reusable empty state
- [ ] `UberInfoRow.tsx` - Reusable info display row
- [ ] `UberActionButton.tsx` - Reusable action button

### Animations to Implement
- [ ] Card press feedback
- [ ] List stagger entrance
- [ ] Date selection bounce
- [ ] Status badge pulse
- [ ] Pull to refresh
- [ ] Page transitions
- [ ] Empty state float

### Integration Points
- [ ] Connect to existing shift Redux slice
- [ ] Use existing navigation patterns
- [ ] Maintain check-in/out flow
- [ ] Preserve filter/sort functionality

---

## Code Example: Shift Card with Animation

```tsx
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { uberColors, uberRadius, uberShadows, spacing } from '../theme';

interface ShiftCardProps {
  shift: Shift;
  index: number;
  onPress: () => void;
}

export const UberShiftCard: React.FC<ShiftCardProps> = ({
  shift,
  index,
  onPress,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.98, { duration: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const startTime = new Date(shift.start_time);
  const endTime = new Date(shift.end_time);
  const hours = formatHours(startTime);
  const period = formatPeriod(startTime);
  const timeRange = `${formatTime(startTime)} - ${formatTime(endTime)}`;
  const duration = calculateDuration(startTime, endTime);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
      >
        <Animated.View style={[styles.card, animatedStyle]}>
          {/* Time Badge */}
          <View style={styles.timeBadge}>
            <Text style={styles.timeNumber}>{hours}</Text>
            <Text style={styles.timePeriod}>{period}</Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.venueName}>{shift.venue.name}</Text>
            <Text style={styles.role}>{shift.role || 'Security Staff'}</Text>
            <Text style={styles.timeRange}>{timeRange} • {duration}</Text>

            {/* Status Badge */}
            <View style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(shift.status).bg }
            ]}>
              <Text style={[
                styles.statusText,
                { color: getStatusColor(shift.status).text }
              ]}>
                {shift.status.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Chevron */}
          <Ionicons
            name="chevron-forward"
            size={20}
            color={uberColors.text.muted}
            style={styles.chevron}
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: uberColors.background.surface,
    borderRadius: uberRadius.xl,
    padding: spacing.base,
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: uberColors.border.light,
    ...uberShadows.soft,
  },
  timeBadge: {
    width: 56,
    height: 56,
    borderRadius: uberRadius.lg,
    backgroundColor: uberColors.background.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  timeNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: uberColors.text.primary,
  },
  timePeriod: {
    fontSize: 11,
    fontWeight: '600',
    color: uberColors.text.muted,
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
  },
  venueName: {
    fontSize: 16,
    fontWeight: '600',
    color: uberColors.text.primary,
    marginBottom: 2,
  },
  role: {
    fontSize: 14,
    color: uberColors.text.secondary,
    marginBottom: spacing.xs,
  },
  timeRange: {
    fontSize: 13,
    fontWeight: '600',
    color: uberColors.text.secondary,
    marginBottom: spacing.sm,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: uberRadius.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  chevron: {
    alignSelf: 'center',
    marginLeft: spacing.sm,
  },
});
```

---

This style guide provides everything needed to implement the Shifts page with consistent Uber-style design and smooth, purposeful animations.
