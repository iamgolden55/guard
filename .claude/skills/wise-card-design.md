# Wise-Inspired Card Design Pattern

A clean, minimal, product-focused card design pattern inspired by Wise (formerly TransferWise) with 3D flip animation.

## Design Principles

1. **Hero Card Display** - Large gradient card as focal point, slightly tilted (-3deg)
2. **Bold Typography** - Extra bold headings (42px, 900 weight, -1px letter spacing)
3. **Product Focus** - Card is the product, minimal chrome around it
4. **Feature Icons** - Circular blue icons (48px) with descriptive text
5. **Clean White Background** - Maximum contrast with colored card
6. **Generous Spacing** - Plenty of breathing room between sections

## Visual Components

### Card Front
- **Gradient Background**: Green to blue diagonal (`['#84FAB0', '#8FD3F4']`)
- **Watermark Text**: Large diagonal "SECURE" text (120px, 15% opacity)
- **Chip Icon**: Credit card chip (48x38px) in top left
- **User Info**: Name in uppercase (18px bold) + detail text (13px)
- **Logo**: Shield icon in bottom right corner
- **Card Tilt**: -3deg rotation for visual interest
- **Deep Shadow**: 12px offset, 12% opacity, 20px radius

### Card Back (QR Code)
- **White Background**: Clean white card
- **Centered QR Code**: 70% of card width
- **Same Tilt**: -3deg rotation for consistency
- **Hint Text**: Small caption below QR

## 3D Flip Animation

### Setup
```typescript
import { Animated } from 'react-native';

const [isFlipped, setIsFlipped] = useState(false);
const flipAnim = useRef(new Animated.Value(0)).current;

// Flip animation
useEffect(() => {
  Animated.spring(flipAnim, {
    toValue: isFlipped ? 180 : 0,
    friction: 8,
    tension: 10,
    useNativeDriver: true,
  }).start();
}, [isFlipped]);
```

### Interpolation
```typescript
const frontRotate = flipAnim.interpolate({
  inputRange: [0, 180],
  outputRange: ['0deg', '180deg'],
});

const backRotate = flipAnim.interpolate({
  inputRange: [0, 180],
  outputRange: ['180deg', '360deg'],
});

const frontOpacity = flipAnim.interpolate({
  inputRange: [0, 90, 90.1, 180],
  outputRange: [1, 1, 0, 0],
});

const backOpacity = flipAnim.interpolate({
  inputRange: [0, 90, 90.1, 180],
  outputRange: [0, 0, 1, 1],
});
```

### Structure
```tsx
<View style={styles.cardContainer}>
  {/* Front Card */}
  <Animated.View
    style={[
      styles.cardFace,
      {
        transform: [{ rotateY: frontRotate }],
        opacity: frontOpacity,
      },
    ]}
  >
    <TouchableOpacity onPress={() => setIsFlipped(!isFlipped)}>
      {/* Card content */}
    </TouchableOpacity>
  </Animated.View>

  {/* Back Card */}
  <Animated.View
    style={[
      styles.cardFace,
      styles.cardBack,
      {
        transform: [{ rotateY: backRotate }],
        opacity: backOpacity,
      },
    ]}
  >
    <TouchableOpacity onPress={() => setIsFlipped(!isFlipped)}>
      {/* QR code content */}
    </TouchableOpacity>
  </Animated.View>
</View>
```

### Key Styles
```typescript
cardContainer: {
  width: CARD_WIDTH,
  height: CARD_HEIGHT,
},
cardFace: {
  position: 'absolute',
  width: '100%',
  height: '100%',
  backfaceVisibility: 'hidden',
},
cardBack: {
  position: 'absolute',
  top: 0,
  left: 0,
},
```

## Layout Pattern

### 1. Close Button (Top Left)
```typescript
closeButton: {
  position: 'absolute',
  top: 50,
  left: 20,
  zIndex: 10,
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: '#F5F5F5',
  // Subtle shadow
}
```

### 2. Hero Card (Center)
```typescript
content: {
  paddingTop: 100,
  paddingHorizontal: spacing.lg,
  paddingBottom: spacing.xl * 2,
  alignItems: 'center',
}
```

### 3. Bold Heading
```typescript
mainHeading: {
  fontSize: 42,
  fontWeight: '900',
  color: colors.text.primary,
  textAlign: 'center',
  marginBottom: spacing.base,
  lineHeight: 48,
  letterSpacing: -1,
}
```

### 4. Subtitle
```typescript
subtitle: {
  fontSize: 16,
  color: colors.text.secondary,
  textAlign: 'center',
  marginBottom: spacing.xl,
  lineHeight: 24,
  paddingHorizontal: spacing.base,
}
```

### 5. Feature List
```tsx
<View style={styles.featuresContainer}>
  <View style={styles.featureItem}>
    <View style={styles.featureIconCircle}>
      <Ionicons name="flash" size={22} color="#0066FF" />
    </View>
    <View style={styles.featureContent}>
      <Text style={styles.featureTitle}>Feature Title</Text>
      <Text style={styles.featureDescription}>
        Feature description text here
      </Text>
    </View>
  </View>
  {/* More features... */}
</View>
```

### Feature Styles
```typescript
featuresContainer: {
  width: '100%',
  gap: spacing.lg,
  marginBottom: spacing.xl,
},
featureItem: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  gap: spacing.base,
},
featureIconCircle: {
  width: 48,
  height: 48,
  borderRadius: 24,
  backgroundColor: '#F0F4FF',
  alignItems: 'center',
  justifyContent: 'center',
},
featureContent: {
  flex: 1,
  paddingTop: 4,
},
featureTitle: {
  fontSize: 17,
  fontWeight: '600',
  color: colors.text.primary,
  marginBottom: 4,
},
featureDescription: {
  fontSize: 15,
  color: colors.text.secondary,
  lineHeight: 22,
},
```

## Card Design Details

### Gradient Card
```typescript
card: {
  width: '100%',
  height: '100%',
  borderRadius: 16,
  padding: spacing.lg,
  justifyContent: 'space-between',
  transform: [{ rotate: '-3deg' }],
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.12,
  shadowRadius: 20,
  elevation: 12,
  overflow: 'hidden',
}
```

### Watermark Text
```typescript
watermarkText: {
  position: 'absolute',
  top: '35%',
  left: '-10%',
  fontSize: 120,
  fontWeight: '900',
  color: 'rgba(255,255,255,0.15)',
  letterSpacing: 4,
  transform: [{ rotate: '-15deg' }],
}
```

### Chip Icon
```typescript
chipIcon: {
  width: 48,
  height: 38,
  borderRadius: 6,
  backgroundColor: 'rgba(255,255,255,0.3)',
  padding: 6,
},
chipInner: {
  flex: 1,
  borderRadius: 3,
  backgroundColor: 'rgba(255,255,255,0.5)',
  gap: 4,
  padding: 4,
},
chipLine: {
  height: 2,
  backgroundColor: 'rgba(255,255,255,0.8)',
  borderRadius: 1,
}
```

### Card Text
```typescript
cardName: {
  fontSize: 18,
  fontWeight: '700',
  color: 'rgba(255,255,255,0.98)',
  letterSpacing: 1.2,
},
cardDetail: {
  fontSize: 13,
  fontWeight: '500',
  color: 'rgba(255,255,255,0.85)',
  letterSpacing: 0.5,
}
```

## QR Code Card

```typescript
qrCard: {
  width: '100%',
  height: '100%',
  backgroundColor: colors.white,
  borderRadius: 16,
  alignItems: 'center',
  justifyContent: 'center',
  transform: [{ rotate: '-3deg' }],
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.12,
  shadowRadius: 20,
  elevation: 12,
  gap: spacing.base,
}
```

## Usage Example

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { Animated, View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';

const WiseCardScreen = () => {
  const [isFlipped, setIsFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(flipAnim, {
      toValue: isFlipped ? 180 : 0,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
  }, [isFlipped]);

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backRotate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Close Button */}
      <TouchableOpacity style={styles.closeButton}>
        <Icon name="close" />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Card with Flip Animation */}
        <View style={styles.cardContainer}>
          <Animated.View style={{ transform: [{ rotateY: frontRotate }] }}>
            <TouchableOpacity onPress={() => setIsFlipped(!isFlipped)}>
              <LinearGradient colors={['#84FAB0', '#8FD3F4']} style={styles.card}>
                {/* Card content */}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ transform: [{ rotateY: backRotate }] }}>
            <TouchableOpacity onPress={() => setIsFlipped(!isFlipped)}>
              <View style={styles.qrCard}>
                <QRCode value="data" />
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Bold Heading */}
        <Text style={styles.mainHeading}>YOUR DIGITAL{'\n'}CARD</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>Tap the card to reveal QR code</Text>

        {/* Features */}
        <View style={styles.featuresContainer}>
          {/* Feature items */}
        </View>
      </ScrollView>
    </View>
  );
};
```

## Best Practices

1. **Card Dimensions**: Use credit card ratio (1.586:1) for familiarity
2. **Card Width**: 85% of screen width for optimal viewing
3. **Rotation**: -3deg tilt adds visual interest without being distracting
4. **Shadow Depth**: 12px offset creates believable elevation
5. **Spring Animation**: friction=8, tension=10 feels natural and responsive
6. **Opacity Transitions**: Fade at 90deg prevents visual glitches during flip
7. **Backface Visibility**: Always set to 'hidden' for clean flip effect
8. **Native Driver**: Use for 60fps animations on all devices
9. **Absolute Positioning**: Both card faces must be absolutely positioned
10. **Touch Area**: Make entire card tappable for better UX

## Color Schemes

### Option 1: Green-Blue (Used in Virtual ID)
```typescript
colors={['#84FAB0', '#8FD3F4']}
```

### Option 2: Wise Original
```typescript
colors={['#9FE870', '#7DE3CA']}
```

### Option 3: Blue Gradient
```typescript
colors={['#667EEA', '#764BA2']}
```

### Option 4: Sunset
```typescript
colors={['#FA709A', '#FEE140']}
```

## Integration Checklist

- [ ] Install `expo-linear-gradient`
- [ ] Install `react-native-qrcode-svg` (for QR cards)
- [ ] Install `buffer` polyfill (for QR)
- [ ] Set up Animated API
- [ ] Create card dimensions constants
- [ ] Implement flip animation
- [ ] Add interpolation values
- [ ] Style card faces with absolute positioning
- [ ] Add gradient and styling
- [ ] Test flip animation on device
- [ ] Optional: Add brightness boost for QR

## When to Use This Pattern

✅ **Good for:**
- Digital ID cards
- Credit/debit cards
- Membership cards
- Loyalty cards
- Access badges
- Product showcase (single hero item)
- QR code display with context

❌ **Not ideal for:**
- Lists of multiple items
- Complex forms
- Data-heavy dashboards
- Multi-step flows
- Chat interfaces

## References

- Original implementation: `/mobile/src/screens/profile/VirtualIDScreen.tsx`
- Inspiration: Wise iOS app debit card order screen
- Animation docs: React Native Animated API
- Design system: Product-focused minimal UI
