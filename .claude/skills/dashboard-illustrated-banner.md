# Dashboard Illustrated Banner & Card Illustrations

A skill for creating premium illustrated banners, animated document card decks, and decorative illustrations across dashboard pages in the Mead Security portal.

## When to Use This Skill

Use when:
- Adding a welcome/hero banner to any page with animated decorative cards
- Adding illustrated empty states to any component
- Adding decorative background illustrations (radar, watermarks, patterns) to dashboard panels
- Adding feature promotion banners (dark gradient CTAs) to any page
- Redesigning any page header to feel more premium and engaging

## Core Pattern: Animated Document Card Deck

The signature illustration is a fanned deck of 3 miniature document cards that slide in from the right with staggered spring animation. Each card represents a platform pillar — **People, Operations, Finance**.

### Card Types Available

#### Staff ID Badge Card (People)
- White card with colored gradient header strip (cyan: `#0891B2` to `#06B6D4`)
- "MS" logo mark + "MEAD SECURITY" header text
- Avatar circle with initials, name, role
- SIA Licence status row with green active dot
- Employee ID in monospace font
- Mini QR code grid (5x5 grid of filled/empty squares)

#### Shift Schedule Card (Operations)
- White card with colored gradient header strip (indigo: `#4F46E5` to `#6366F1`)
- "This Week" title + date range
- Schedule rows: colored dot + day/time + venue name, separated by subtle borders
- Footer: "+N more shifts" link + total hours

#### Invoice Card (Finance)
- White card with colored gradient header strip (red: `#DC2626` to `#EF4444`)
- "Invoice" title + invoice number in monospace
- Company name + issue date
- Line items with description, hours, amount
- Bold total with large font
- Green "PAID" pill badge with dot

### Animation System

```
Cards slide in from off-screen right with:
- Easing: cubic-bezier(0.34, 1.56, 0.64, 1) — spring with slight overshoot
- Duration: 900ms per card
- Stagger: 150ms between cards (back card first, front card last)
- Cards scale from 0.88 to 1 during entrance
- Cards rotate into fanned positions (-20deg, -11deg, -3deg)
- Accent dots fade in after cards settle (1000ms–1200ms delay)
- Trigger: useEffect with 100ms initial delay, useState boolean toggle
```

### Card Styling Rules

```typescript
// Shared card container styles
const cardBase = {
  background: '#FFFFFF',
  borderRadius: '16px',
  overflow: 'hidden',
  border: '1.5px solid <color-tint>',  // Tinted border matching header color
  boxShadow: '0 Npx Npx rgba(<color>,0.1), 0 Npx Npx rgba(0,0,0,0.05)',
};

// Header strip: 
// padding: '10px 14px'
// background: 'linear-gradient(135deg, <darker>, <lighter>)'
// White text, 9px font-weight-700, Plus Jakarta Sans

// Body:
// padding: '14px'
// Compact typography: 7-9px for labels/values
// Font families: Plus Jakarta Sans (display), JetBrains Mono (codes/numbers)
// Status dots: 5-6px circles with semantic colors
// Dividers: 1px solid #F3F4F6
```

### Positioning (within parent banner)

```
Parent container: relative, overflow-hidden, p-8 md:p-10, rounded-[20px]
Card area: absolute right-0 top-0 bottom-0 w-[50%] md:w-[45%], hidden sm:block

Card 1 (back):   right 115px, top 5px,    rotate -20deg, width 175px
Card 2 (middle):  right 58px,  top -15px,  rotate -11deg, width 185px
Card 3 (front):   right -2px,  top -32px,  rotate -3deg,  width 195px

Accent dots: 3 colored circles (red, indigo, cyan) with box-shadow glow
```

## Secondary Pattern: Decorative Panel Illustrations

### Radar/Map Background (for live status panels)
- 3 concentric circle borders at 40-60% opacity over `#F7F7FA` background
- Gradient sweep line from center
- 2-3 pulsing green dots at varying delays simulating active tracking
- Content sits on `z-10` above the illustration

### Watermark Icons (for alert/risk cards)
- Large icon (48px) from LineIcons at 6% opacity
- Positioned: absolute right-2 bottom-1
- Color matches the card's severity tone
- Uses `pointer-events-none` to stay non-interactive

### KPI Card Background Icons
- Same icon used in the card's tile, repeated at 64px / 4% opacity
- Positioned: absolute right -8px bottom -8px
- Wraps card content in a relative div to layer correctly

### Empty State Illustrations
- Tilted card (rotate -3deg) with gradient background matching the section's color
- Icon centered inside (32px from LineIcons)
- 5-6 confetti dots around it in brand colors at 25-35% opacity
- Pulsing glow ring behind (10px blur, animate-pulse)
- Warm copy: "All caught up!" not just "No data"

## Tertiary Pattern: Feature Promotion Banner

- Dark gradient background: `from-[#1A1A2E] to-[#2D2B55]`
- `rounded-[20px]`, custom shadow: `0 4px 24px rgba(26,26,46,0.15)`
- "New feature" pill badge with bolt icon in yellow
- Heading in white (20-22px, Plus Jakarta Sans bold)
- Description in white/60 opacity
- White primary CTA button + ghost text link with arrow
- Right side: layered translucent card outlines + floating icon tiles + glow dots
- All decorative elements at 5-20% white opacity

## Implementation Notes

- All illustrations are pure CSS/JSX — no external images or SVGs needed
- Use `pointer-events-none` and `aria-hidden="true"` on all decorative elements
- Hide decorative panels on mobile with `hidden sm:block`
- Animation state managed via `useState(false)` + `useEffect(() => setTimeout(..., 100))`
- Use LineIcons (`lni lni-<name>`) for all icons, never inline SVGs
- Font stack: Plus Jakarta Sans for display, Inter for body, JetBrains Mono for codes
- All cards use the same `var(--ds-shadow-card)` token for base shadows
- Card radius: 16-22px (`var(--ds-radius-card)` or explicit)
