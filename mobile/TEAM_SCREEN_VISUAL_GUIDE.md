# Team Screen Visual Design Guide

## 🎨 Complete Visual Breakdown

### 1. Search Header Section
```
┌─────────────────────────────────────┐
│  Team                               │  ← Heading2, bold
│                                     │
│  🔍 Search team members...      ×   │  ← Search input with clear button
└─────────────────────────────────────┘
```
**Colors:**
- Background: White
- Search Bar: Light gray (#F5F5F5)
- Border: Light border bottom

---

### 2. Active Shift Banner (Hero Section)
```
┌─────────────────────────────────────┐
│  🛡️ Mead Security Services          │  ← Company badge (white pill)
│                                     │
│  Active Shift                       │  ← Bold white heading (28px, 800 weight)
│                                     │
│   👥        📍        👥            │
│   5         3         6             │  ← Stats in circles
│  On Duty  Venues   Total Team      │
│                                     │
│  🟢 Live Updates                    │  ← Pulse indicator
└─────────────────────────────────────┘
```
**Colors:**
- Gradient: Blue (#007AFF) → Dark Blue (#0051D5)
- Text: White
- Stats Icons: White circles with 20% opacity
- Background Pattern: Shield and people icons at 5% opacity

**Dimensions:**
- Height: 220px
- Border Radius: 16px
- Margin: 20px horizontal
- Shadow: Large elevation

---

### 3. Quick Actions Grid
```
┌────────────────────────────────────┐
│  [🗨️]   [📢]   [🚨]   [📤]        │
│  Team   Broad  Emer   Share        │
│  Chat   cast   gency              │
│  🔒     🔒                         │  ← Lock icons for premium
└────────────────────────────────────┘
```
**Card Layout:**
- 4 cards in a row
- Equal width (flex: 1)
- Icon circle: 56px
- Icon size: 24px
- Card height: ~100px

**Colors:**
- Team Chat: Blue (#007AFF) background at 15% opacity
- Broadcast: Purple (#8B5CF6) background at 15% opacity
- Emergency: Red (error color) background at 15% opacity
- Share: Green (success color) background at 15% opacity

---

### 4. Team Members Grid (2-Column)
```
┌──────────────┬──────────────┐
│  ┌────────┐  │  ┌────────┐  │
│  │ Photo  │  │  │ Photo  │  │  ← 120x120 circular photos
│  │  120x  │  │  │  120x  │  │
│  │  120   │  │  │  120   │  │
│  └────────┘  │  └────────┘  │
│   🟢 Status  │   🟢 Status  │  ← Status badge on photo
│  📍 Venue    │  📍 Venue    │  ← Venue badge (if active)
│              │              │
│  Sarah       │  Mike        │  ← First name (bold)
│  Johnson     │  Thompson    │  ← Last name
│  Shift Mgr   │  Door Sup    │  ← Role (secondary)
│  🟢 On Duty  │  🟢 On Duty  │  ← Status text
└──────────────┴──────────────┘
│  ┌────────┐  │  ┌────────┐  │
│  │ Photo  │  │  │ Photo  │  │
│  └────────┘  │  └────────┘  │
│   ...        │   ...        │
```

**Card Dimensions:**
- Width: (Screen Width - 60px) / 2
- Padding: 16px
- Photo: 120x120 with 3px colored ring for active status
- Gap between cards: 16px

**Photo Status Rings:**
- Active: Green ring (3px border)
- On Break: Yellow ring (3px border)
- Off Duty: No ring

**Status Badge:**
- Size: 28x28 circular
- Position: Bottom right of photo
- Border: 3px white
- Shadow: Medium elevation
- Colors:
  - Active: Green
  - On Break: Yellow/Orange
  - Off Duty: Gray

**Venue Badge:**
- Pill shape
- Background: Blue at 15% opacity
- Icon: Location pin (10px)
- Text: 10px, truncated
- Only shown for active members

---

## 📐 Spacing & Dimensions

### Screen Layout
```
Padding Top: 16px (lg)
Padding Horizontal: 20px (xl)
Between Sections: 16px (md)

Search Header: ~100px
Active Banner: 220px + 20px margin top/bottom
Quick Actions: ~120px
Grid Cards: Variable (scrollable)
Bottom Spacing: 48px (3xl)
```

### Typography Sizes
- Main Heading: 28px, weight 800
- Screen Title: 24px (Heading2)
- Card Name: 16px, weight 700/600
- Role: 13px, secondary color
- Status: 12px, weight 600
- Captions: 10-12px

---

## 🎨 Color Palette

### Primary Colors
- **Primary Blue**: #007AFF
- **Primary Dark**: #0051D5
- **Success Green**: #4ADE80
- **Warning Orange**: #F59E0B
- **Error Red**: #EF4444
- **Purple Accent**: #8B5CF6

### Grays
- **Gray 50**: #F9FAFB (backgrounds)
- **Gray 100**: #F3F4F6 (placeholders)
- **Gray 400**: #9CA3AF (inactive)
- **Text Primary**: #111827
- **Text Secondary**: #6B7280
- **Text Tertiary**: #9CA3AF

### Backgrounds
- **Main BG**: #F5F5F5 (background.secondary)
- **Card BG**: #FFFFFF (white)
- **Border Light**: #E5E7EB

---

## 🎭 Status Indicators

### Active (Green)
```
Ring: #4ADE80 (3px border on photo)
Badge: #4ADE80 background, white icon
Dot: #4ADE80
Text: #4ADE80
```

### On Break (Yellow)
```
Ring: #F59E0B (3px border on photo)
Badge: #F59E0B background, white icon
Dot: #F59E0B
Text: #F59E0B
```

### Off Duty (Gray)
```
Ring: None
Badge: #9CA3AF background, white icon
Dot: #9CA3AF
Text: #9CA3AF
```

---

## ✨ Interactive Elements

### Card Touch States
- **Default**: White background, subtle shadow
- **Pressed**: Opacity 0.7
- **Long Press**: Additional haptic feedback

### Button Touch States
- **Default**: Colored icon circle background
- **Pressed**: Slightly darker shade
- **Disabled**: 50% opacity

### Search Input
- **Empty**: Gray placeholder
- **Typing**: Blue cursor
- **Has Text**: Shows clear button (×)

---

## 🔒 Premium Feature Indicators

### Locked Features
```
┌────────────┐
│   🔒       │  ← Lock icon in blue circle
│            │
│ Team Chat  │  ← Feature name
│            │
│ Requires   │  ← Requirement text
│ Premium    │
│            │
│ [Upgrade]  │  ← Blue button
│            │
│ Current:   │
│ Basic      │
└────────────┘
```

**Lock Icon:**
- Circle: 48px, blue background at 15% opacity
- Icon: 20px, primary blue color

**Upgrade Button:**
- Background: Primary blue
- Text: White, weight 600
- Icon: Arrow forward
- Border Radius: 8px

---

## 📱 Responsive Behavior

### Portrait (Default)
- 2-column grid
- Full-width banner
- 4 quick action buttons in a row

### Landscape (if needed)
- 3-column grid
- Slightly compressed banner
- Same quick actions

### Small Screens
- Minimum card width: 160px
- Scales photos proportionally
- Text truncates with ellipsis

---

## 🎬 Animations

### Pull-to-Refresh
- Blue spinner
- Smooth bounce animation
- 1 second minimum display

### Card Appear
- Fade in + slight scale up
- Stagger by 50ms per card

### Status Ring
- Smooth color transitions
- 200ms duration

### Banner Pulse
- Green dot pulses at 1.4s interval
- Outer ring expands and fades

---

## 💡 Accessibility

### Touch Targets
- Minimum: 44x44 points
- Quick actions: 56x56 circles
- Cards: Entire card tappable

### Text Contrast
- Primary text: 7:1 ratio minimum
- Secondary text: 4.5:1 ratio
- All status colors meet WCAG AA

### Screen Reader
- All cards have descriptive labels
- Status announced correctly
- Premium features indicate locked state

---

This visual guide ensures pixel-perfect implementation of the redesigned Team screen! 🎨
