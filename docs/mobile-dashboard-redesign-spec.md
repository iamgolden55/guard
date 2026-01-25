# Mobile Dashboard Redesign Specification

**Project:** Security Staff Management App
**Platform:** Mobile (iOS/Android via React Native)
**Date:** January 21, 2026
**Version:** 2.0

---

## Table of Contents

1. [Overview](#overview)
2. [Design System](#design-system)
3. [Screens & States](#screens--states)
4. [Component Specifications](#component-specifications)
5. [Illustrations & Assets](#illustrations--assets)
6. [Animations & Interactions](#animations--interactions)
7. [Reference Images](#reference-images)

---

## Overview

### Project Context

We're redesigning the mobile dashboard for a **security staff management app**. Staff members use this app to:
- Check in/out of shifts at venues
- View their work hours and completed checks
- Access their schedule
- Snap venue photos for verification

### Design Direction

Moving from a generic card-based UI to a more **illustrated, friendly attendance app style** inspired by modern HR/attendance applications. The new design features:

- **Rich header illustrations** with office/workplace scenes
- **Large illustrated cards** for check-in/check-out actions
- **Floating pill-style tab bar**
- **Soft, rounded UI elements** throughout
- **Security-themed** adaptations (guards, venues, badges)

### Key Screens

| Screen | Purpose |
|--------|---------|
| Dashboard (Home) | Main screen with check-in/out cards and stats |
| QR Scanner / Snap Venue | Camera interface for venue verification |
| Success Modal | Confirmation after check-in/out |

---

## Design System

### Color Palette

#### Primary Colors
| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Primary | `#3F51B5` | 63, 81, 181 | Buttons, active states, accents |
| Primary Light | `#5C6BC0` | 92, 107, 192 | Gradients, hover states |
| Primary Dark | `#303F9F` | 48, 63, 159 | Pressed states |
| Primary 50 | `#E8EAF6` | 232, 234, 246 | Light backgrounds, borders |
| Primary 100 | `#C5CAE9` | 197, 202, 233 | Secondary backgrounds |

#### Neutral Colors
| Name | Hex | Usage |
|------|-----|-------|
| Background | `#F0F4F8` | Page background |
| Surface | `#FFFFFF` | Cards, modals |
| Text Primary | `#1A1A1A` | Headings, important text |
| Text Secondary | `#4A4A4A` | Body text |
| Text Muted | `#757575` | Labels, captions |
| Text Disabled | `#9E9E9E` | Disabled states |
| Border | `#E0E0E0` | Dividers, inactive borders |

#### Status Colors
| Name | Hex | Light Variant | Usage |
|------|-----|---------------|-------|
| Success | `#4CAF50` | `#E8F5E9` | Completed states, checkmarks |
| Warning | `#FF9800` | `#FFF3E0` | Alerts, calendar icon |
| Error | `#F44336` | `#FFEBEE` | Errors, destructive actions |

#### Illustration Colors
| Name | Hex | Usage |
|------|-----|-------|
| Skin Tone 1 | `#FFCCBC` | Light skin |
| Skin Tone 2 | `#FFE0B2` | Medium skin |
| Skin Tone 3 | `#D7CCC8` | Dark skin |
| Hair Dark | `#3E2723` | Dark hair |
| Hair Medium | `#5D4037` | Brown hair |
| Badge Gold | `#FFD54F` | ID badges, accents |

### Typography

**Font Family:** Plus Jakarta Sans (Google Fonts)

| Style | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| Greeting | 26px | 700 (Bold) | 1.2 | "Good Morning, John!" |
| Date | 14px | 400 (Regular) | 1.4 | "Tuesday, 21 January 2026" |
| Section Title | 18px | 700 (Bold) | 1.3 | "Today's Overview" |
| Card Label | 15px | 600 (SemiBold) | 1.3 | "Check In", "Check Out" |
| Card Time | 18px | 700 (Bold) | 1.2 | "08:45 AM" |
| Button Text | 13px | 600 (SemiBold) | 1 | "CHECK IN", "DONE" |
| Stat Number | 28px | 700 (Bold) | 1.2 | "2.5", "1", "3" |
| Stat Label | 12px | 400 (Regular) | 1.3 | "Hours Today" |
| Tab Label | 13px | 600 (SemiBold) | 1 | "Home" |

### Spacing Scale

```
4px   - xs (tight spacing, icon gaps)
8px   - sm (small gaps)
12px  - md (card gaps, internal padding)
16px  - base (standard padding)
20px  - lg (section spacing)
24px  - xl (major sections)
32px  - 2xl (header curves)
```

### Border Radius

| Element | Radius |
|---------|--------|
| Header bottom curve | 32px |
| Cards | 16px |
| Stat cards | 16px |
| Buttons (pill) | 25px (full pill) |
| Tab bar | 20px |
| Tab item active | 14px |
| Stat icon background | 12px |
| Modal | 28px |
| Avatar | 50% (circle) |
| Viewfinder corners | 16px |

### Shadows

```css
/* Card shadow */
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);

/* Tab bar shadow */
box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);

/* Avatar shadow */
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
```

---

## Screens & States

### Screen 1: Dashboard (Home)

#### Layout Structure

```
┌─────────────────────────────────────────┐
│                                         │
│         HEADER ILLUSTRATION             │
│         (Office scene with              │
│          people at desks)               │
│         Height: 220px                   │
│         Bottom radius: 32px             │
│                                         │
├─────────────────────────────────────────┤
│ Padding: 20px horizontal                │
│                                         │
│ Good Morning, John!              [Avatar]│
│ Tuesday, 21 January 2026          52px  │
│                                         │
│ ┌─────────────────┐ ┌─────────────────┐ │
│ │                 │ │                 │ │
│ │  [Desk Illust]  │ │  [Desk Illust]  │ │
│ │                 │ │                 │ │
│ │    Check In     │ │    Check Out    │ │
│ │    08:45 AM     │ │      --:--      │ │
│ │                 │ │                 │ │
│ │   [✓ DONE]      │ │  [CHECK OUT]    │ │
│ │                 │ │                 │ │
│ └─────────────────┘ └─────────────────┘ │
│      Gap: 12px between cards            │
│                                         │
│ Today's Overview                        │
│                                         │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│ │  (🕐)   │ │  (✓)    │ │  (📅)   │     │
│ │   2.5   │ │    1    │ │    3    │     │
│ │  Hours  │ │ Checks  │ │ Shifts  │     │
│ │  Today  │ │  Done   │ │ This Wk │     │
│ └─────────┘ └─────────┘ └─────────┘     │
│                                         │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│        [🏠 Home] [📄] [📊] [👤]         │
│              FLOATING TAB BAR           │
│              Bottom: 24px               │
└─────────────────────────────────────────┘
```

#### State 1: Initial (Before Check-In)

| Element | State |
|---------|-------|
| Check In Card | Blue border (`#3F51B5`), white background |
| Check In Button | Primary blue, text: "Check In" with arrow icon |
| Check In Time | "--:-- AM" in gray (`#9E9E9E`) |
| Check Out Card | No border, white background, slightly dimmed |
| Check Out Button | Gray outline, disabled |
| Check Out Time | "--:--" in gray |
| Hours Today | "0" |
| Checks Done | "0" |

#### State 2: Checked In

| Element | State |
|---------|-------|
| Check In Card | Green border (`#4CAF50`), light green background (`#E8F5E9`) |
| Check In Button | Green success, text: "✓ DONE" |
| Check In Time | "08:45 AM" in black |
| Check Out Card | No border, white background, active |
| Check Out Button | Primary blue, text: "CHECK OUT" |
| Check Out Time | "--:--" in gray |
| Hours Today | "2.5" |
| Checks Done | "1" |

#### State 3: Completed (Both Done)

| Element | State |
|---------|-------|
| Check In Card | Green border, light green background |
| Check In Button | Green, text: "✓ Done Check In" |
| Check In Time | "10:05 AM" in black |
| Check Out Card | Green border, light green background |
| Check Out Button | Green, text: "✓ Done Check Out" |
| Check Out Time | "05:05 PM" in black |
| Hours Today | "7" |
| Checks Done | "2" |

---

### Screen 2: QR Scanner / Snap Venue

#### Layout Structure

```
┌─────────────────────────────────────────┐
│ [X]        Scan QR code                 │
│ Close                                   │
│ button                                  │
│                                         │
│                                         │
│            S E C U R I T Y              │
│              scan here                  │
│                                         │
│         ┌─────────────────┐             │
│       ┌─┘                 └─┐           │
│       │                     │           │
│       │                     │           │
│       │    [QR VIEWFINDER]  │           │
│       │                     │           │
│       │    ═══════════      │ ← Scan    │
│       │    (scan line)      │   line    │
│       │                     │           │
│       └─┐                 ┌─┘           │
│         └─────────────────┘             │
│          Corner brackets                │
│                                         │
│     [QR] Point camera at QR to Check In │
│                                         │
│                              [⚡]        │
│                              Flash      │
│                              button     │
└─────────────────────────────────────────┘
```

#### Specifications

| Element | Specification |
|---------|---------------|
| Background | Dark gradient: `#1A1A1A` to `#16213E` |
| Close button | 40px circle, `rgba(255,255,255,0.2)` background |
| Title | White, 18px, SemiBold, centered |
| "SECURITY" text | Gray (`#9E9E9E`), 24px, light weight, letter-spacing: 8px |
| "scan here" text | Primary light (`#5C6BC0`), 14px |
| Viewfinder | 260x260px, border: 2px `rgba(255,255,255,0.2)`, radius: 24px |
| Corner brackets | 40x40px, 4px white borders, radius: 16px on corner |
| Scan line | Animated gradient line, moves top to bottom |
| Hint pill | `rgba(255,255,255,0.1)` background, radius: 25px |
| Flash button | 50px circle, `rgba(255,255,255,0.15)` background |

---

### Screen 3: Success Modal

#### Layout Structure

```
┌─────────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░ BLURRED ░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░ BACKDROP ░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│  ┌───────────────────────────────────┐  │
│  │                              [X]  │  │
│  │          [✓ Checkmark]            │  │
│  │           64px green              │  │
│  │                                   │  │
│  │     ┌─────────────────────┐       │  │
│  │     │                     │       │  │
│  │     │   [ILLUSTRATION]    │       │  │
│  │     │   Person leaving    │       │  │
│  │     │   through door      │       │  │
│  │     │   with phone        │       │  │
│  │     │                     │       │  │
│  │     └─────────────────────┘       │  │
│  │                                   │  │
│  │     Successfully Check Out!       │  │
│  │                                   │  │
│  │     You have successfully check   │  │
│  │     out of your present! Good     │  │
│  │     bye and have a good rest!     │  │
│  │                                   │  │
│  │        [Back to home]             │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└─────────────────────────────────────────┘
```

#### Specifications

| Element | Specification |
|---------|---------------|
| Backdrop | `rgba(0,0,0,0.5)`, blur: 4px |
| Modal | White, max-width: 360px, padding: 24px, radius: 28px |
| Close button | Top-right, 20px X icon, gray stroke |
| Checkmark circle | 64px, `#E8F5E9` background, `#4CAF50` checkmark |
| Illustration | 200x160px, shows person leaving door |
| Title | 22px, Bold, `#1A1A1A` |
| Description | 14px, Regular, `#757575`, line-height: 1.5 |
| Button | Full width, primary blue, pill shape, 14px padding |

#### Variations

| Type | Title | Message |
|------|-------|---------|
| Check In | "Successfully Check In!" | "You have successfully checked in! Have a productive day!" |
| Check Out | "Successfully Check Out!" | "You have successfully check out of your present! Good bye and have a good rest!" |

---

## Component Specifications

### Component: Header Illustration

**Dimensions:** Full width × 220px height
**Background:** Gradient `135deg, #3949AB → #5C6BC0 → #7986CB`
**Bottom radius:** 32px

**Scene Elements:**
1. **Window frame** (top-right area)
   - Rectangle with cross dividers
   - Plant silhouette inside

2. **Three desks** with monitors
   - Desks: Light semi-transparent rectangles
   - Monitors: Dark blue (`#1A237E`) with indigo screens (`#3F51B5`)
   - Screen content: Horizontal lines representing code/text

3. **Three people**
   - Person 1 (left): Waving, arm raised
   - Person 2 (center): Seated, female with long hair
   - Person 3 (right): Working, arms on desk
   - All wearing indigo/blue clothing
   - ID badges on some (gold `#FFD54F`)

4. **Geometric shapes** (background)
   - Semi-transparent white rectangles
   - Rotated at various angles
   - Adds depth and visual interest

### Component: Check Card

**Dimensions:** Flex 1 (50% - gap)
**Padding:** 16px
**Border radius:** 16px
**Background:** White
**Border:** 2px (color varies by state)

**Internal Layout:**
```
┌──────────────────────┐
│                      │
│   [Illustration]     │  ← 100px height
│    Desk + Monitor    │
│    + Person          │
│                      │
│      Check In        │  ← 15px SemiBold
│      08:45 AM        │  ← 18px Bold
│                      │
│   [  ✓ DONE     ]    │  ← Full width button
│                      │
└──────────────────────┘
```

**Card Illustration Elements:**
- Check In: Person at active desk (colored monitor)
- Check Out: Person at inactive desk (gray monitor with X)

### Component: Stat Card

**Dimensions:** 1/3 of container width
**Padding:** 16px vertical, 12px horizontal
**Border radius:** 16px
**Background:** White
**Alignment:** Center

**Internal Layout:**
```
┌────────────┐
│    [Icon]  │  ← 48x48px, 12px radius
│            │
│     2.5    │  ← 28px Bold
│   Hours    │  ← 12px Regular, gray
│   Today    │
└────────────┘
```

**Icon Backgrounds:**
| Stat | Background | Icon Color |
|------|------------|------------|
| Hours Today | `#E8EAF6` | `#3F51B5` |
| Checks Done | `#E8F5E9` | `#4CAF50` |
| Shifts This Wk | `#FFF3E0` | `#FF9800` |

**Icons (outlined stroke style):**
- Hours: Clock (circle + hands)
- Checks: Checkmark in circle
- Shifts: Calendar

### Component: Floating Tab Bar

**Position:** Fixed, bottom: 24px, centered
**Background:** White
**Padding:** 8px 12px
**Border radius:** 20px
**Shadow:** `0 4px 20px rgba(0,0,0,0.12)`

**Tab Items:**
- Size: 44px height (approx)
- Padding: 10px 14px
- Border radius: 14px
- Gap between tabs: 8px

**Tab States:**
| State | Background | Icon | Label |
|-------|------------|------|-------|
| Inactive | Transparent | Gray (`#9E9E9E`) | Hidden |
| Active | Primary (`#3F51B5`) | White | Visible, white |

**Tab Icons:**
1. Home (filled house)
2. Documents (outlined file)
3. Analytics (outlined bar chart)
4. Profile (outlined person)

### Component: Pill Button

**Height:** 44-48px
**Padding:** 12px 16px
**Border radius:** 25px (full pill)
**Font:** 13px SemiBold

**Variants:**
| Variant | Background | Text | Border |
|---------|------------|------|--------|
| Primary | `#3F51B5` | White | None |
| Success | `#4CAF50` | White | None |
| Outline | `#F5F5F5` | `#9E9E9E` | 1px `#E0E0E0` |
| Outline Active | `#E8EAF6` | `#3F51B5` | 1px `#C5CAE9` |

---

## Illustrations & Assets

### Required Illustrations

#### 1. Header Scene
**Style:** Flat illustration, simple shapes, no outlines
**Colors:** Use brand palette (indigo, skin tones, gold accents)
**Elements:**
- Office environment with window
- 3 people at desks with monitors
- One person waving (welcoming gesture)
- Plant/greenery accent
- Geometric background shapes

#### 2. Check-In Card Illustration
**Size:** 120 × 90px
**Scene:** Person at active workstation
- Desk with monitor showing content (blue screen)
- Person figure with ID badge
- Warm, inviting colors

#### 3. Check-Out Card Illustration
**Size:** 120 × 90px
**Scene:** Person leaving workstation
- Desk with inactive monitor (gray, X on screen)
- Person figure in muted colors
- Suggests end of shift

#### 4. Success Modal Illustration
**Size:** 200 × 160px
**Scene:** Person successfully checking out
- Door frame (blue, with window)
- Person walking through/waving
- Phone in hand
- Confetti/celebration elements
- Green arrow indicating "exit"

### Icon Requirements

All icons should be **outlined stroke style**, 2px stroke weight:

| Icon | Usage | Source |
|------|-------|--------|
| Clock | Hours Today stat | Lucide: `clock` |
| Check Circle | Checks Done stat | Lucide: `check-circle` |
| Calendar | Shifts stat | Lucide: `calendar` |
| Home (filled) | Active tab | Custom or Lucide: `home` |
| File Text | Documents tab | Lucide: `file-text` |
| Bar Chart | Analytics tab | Lucide: `bar-chart-2` |
| User | Profile tab | Lucide: `user` |
| X | Close button | Lucide: `x` |
| Zap | Flash toggle | Lucide: `zap` |
| QR Code | Scanner hint | Lucide: `qr-code` |
| Arrow Right | Check In button | Lucide: `log-in` |
| Checkmark | Done state | Lucide: `check` |

---

## Animations & Interactions

### Page Load Sequence

```
Timeline: 0ms ──────────────────────────────────► 700ms

Header:     ████████░░░░░░░░░░░░░░░░░  0-400ms  (fade + slide down)
Greeting:   ░░░░████████░░░░░░░░░░░░░  150-450ms (fade + slide up)
Card 1:     ░░░░░░░░████████░░░░░░░░░  250-650ms (scale in)
Card 2:     ░░░░░░░░░░░░████████░░░░░  350-750ms (scale in)
Stats:      ░░░░░░░░░░░░░░░░████████░  480-780ms (fade + slide up, stagger)
Tab Bar:    ░░░░░░░░░░░░░░░░░░████████ 500-800ms (fade + slide up)
```

### Button Interactions

| Interaction | Animation |
|-------------|-----------|
| Hover | Scale to 1.02, slight shadow increase |
| Press | Scale to 0.98 |
| Release | Bounce back to 1.0 (spring easing) |

### Card State Transitions

**Check In Complete:**
```
Duration: 500ms
1. Border color: transparent → #4CAF50
2. Background: white → #E8F5E9
3. Button: morphs blue → green
4. Checkmark: bounces in with scale overshoot
5. Time: fades in from below
```

### Modal Animations

**Open:**
```
Backdrop: 300ms fade in + blur
Modal: 400ms slide up + scale (0.85 → 1.0) with bounce easing
Checkmark: 500ms bounce in (delayed 200ms)
```

**Close:**
```
Modal: 250ms fade out + slide down
Backdrop: 200ms fade out
```

### Scanner Animations

**Scan Line:**
```
Duration: 2500ms (infinite loop)
Movement: Top 15% → Bottom 85%
Opacity: 0.4 → 1.0 → 0.4
Easing: ease-in-out
```

### Tab Bar Interactions

| Interaction | Animation |
|-------------|-----------|
| Tab press | Scale to 0.9 |
| Tab activate | 300ms color transition, label fades in |
| Tab deactivate | Label fades out, color to gray |

---

## Reference Images

### Target Design Reference

The design should closely match this attendance app UI style:

**Key characteristics to match:**
1. Rich, detailed header illustrations with multiple people
2. Large illustrations within cards (not just icons)
3. Colored borders on cards to indicate state
4. Full-width pill buttons inside cards
5. Floating tab bar with pill-shaped active state
6. Success modals with scene illustrations
7. Soft shadows and generous border radius throughout

### File Locations

| Asset | Path |
|-------|------|
| HTML Prototype v2 | `.superdesign/design_iterations/attendance_dashboard_2.html` |
| Theme CSS | `.superdesign/design_iterations/attendance_theme_1.css` |

### Viewing the Prototype

Open `attendance_dashboard_2.html` in a browser. Use the state control buttons (top-right) to preview:
- **Initial** - Before any check-in
- **Checked In** - After check-in, ready to check out
- **Completed** - Both actions complete
- **Camera** - QR/Snap Venue screen
- **Modal** - Success confirmation

---

## Implementation Notes

### For Figma Designer

1. **Create a component library** with all variants for:
   - Check cards (3 states each)
   - Buttons (4 variants)
   - Stat cards (3 types)
   - Tab items (active/inactive)

2. **Set up Auto Layout** for:
   - Card internal layouts
   - Stats grid (3 columns)
   - Tab bar

3. **Create illustration components** that can be swapped:
   - Header scene (reusable)
   - Card illustrations (2 versions)
   - Modal illustration

4. **Use Figma Variables** for:
   - All colors in the palette
   - Typography styles
   - Spacing values
   - Border radius values

5. **Create Interactive Prototype** showing:
   - Initial → Checked In transition
   - Checked In → Modal → Completed flow
   - Tab navigation
   - Camera screen access

### Questions for Designer

1. Should we create security-themed variations of the illustrations (guards instead of office workers)?
2. Do you have preferred illustration style/artist to match?
3. Should the modal slide up from bottom or fade in centered?
4. Any preference on the specific shade of indigo for the primary color?

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 21, 2026 | Initial design with basic cards |
| 2.0 | Jan 21, 2026 | Major redesign matching attendance app reference |

---

**Document prepared by:** Development Team
**For:** UI/UX Design Team (Figma Implementation)
