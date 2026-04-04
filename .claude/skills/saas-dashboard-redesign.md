# Premium SaaS Dashboard Design System

A comprehensive design system for redesigning dashboard pages with a premium, modern SaaS aesthetic inspired by soft enterprise admin products.

## When to Use This Skill

Use this skill when redesigning any dashboard page in the security staff portal. Apply consistently across ALL pages for a unified look.

## Design Principles

1. **Clean B2B Dashboard Aesthetic** - Professional, trustworthy, operational
2. **Information Dense but Elegant** - Pack data without visual clutter
3. **Calm Professional Tone** - Muted colors, soft accents, generous whitespace
4. **Readability First** - Clear hierarchy, strong typography, structured layouts
5. **Premium Feel** - Polished, border-based separation, minimal shadows
6. **Engaging Layouts Based on Importance** - Use visual weight, card sizing, and placement to reflect data priority. High-importance items get larger cards, prominent positions (top-left), and richer visual treatments. Lower-priority items get compact cards or secondary positions. Don't make every card the same size — vary the grid to create visual hierarchy and engagement.

## Color Tokens

```typescript
// Color System
const colors = {
  // Backgrounds
  pageBg: '#F7F7FA',           // Muted light-gray page background
  cardBg: '#FFFFFF',           // White card background
  sidebarBg: '#FFFFFF',        // Sidebar background
  sidebarActiveBg: '#FEF2F2', // Soft red active state

  // Primary - Warm Red
  primary: '#DC2626',          // Primary accent
  primaryLight: '#FEF2F2',     // Primary tinted background
  primaryHover: '#B91C1C',     // Primary hover state
  primaryMuted: '#FECACA',     // Subtle primary tint for chips/pills

  // Text
  textPrimary: '#1A1A2E',     // Dark heading text
  textSecondary: '#6B7280',   // Muted gray body text
  textMuted: '#9CA3AF',       // Helper/metadata text
  textOnPrimary: '#FFFFFF',   // Text on primary backgrounds

  // Borders
  borderDefault: '#EAEAF0',   // Very light neutral/lilac gray
  borderLight: '#F0F0F5',     // Lighter variant
  borderFocus: '#DC2626',     // Focus ring color

  // Status Colors (Soft Accent Palette)
  success: '#34D399',
  successBg: '#ECFDF5',
  warning: '#FBBF24',
  warningBg: '#FFFBEB',
  error: '#F87171',
  errorBg: '#FEF2F2',
  info: '#60A5FA',
  infoBg: '#EFF6FF',

  // Chart/Data Visualization (Soft Accent Colors)
  chart1: '#DC2626',          // Red
  chart2: '#34D399',          // Green
  chart3: '#60A5FA',          // Blue
  chart4: '#FBBF24',          // Yellow
  chart5: '#F472B6',          // Pink
  chart6: '#A78BFA',          // Light purple
};
```

## Typography Tokens

```typescript
// Typography System (Inter font family)
const typography = {
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",

  // Page Title
  pageTitle: {
    fontSize: '28px',
    fontWeight: 700,
    lineHeight: '36px',
    letterSpacing: '-0.02em',
    color: colors.textPrimary,
  },

  // Card Title
  cardTitle: {
    fontSize: '16px',
    fontWeight: 600,
    lineHeight: '24px',
    color: colors.textPrimary,
  },

  // Stat Numbers (KPIs)
  statNumber: {
    fontSize: '32px',
    fontWeight: 700,
    lineHeight: '40px',
    letterSpacing: '-0.02em',
    color: colors.textPrimary,
  },

  // Stat Label
  statLabel: {
    fontSize: '13px',
    fontWeight: 500,
    lineHeight: '20px',
    color: colors.textSecondary,
  },

  // Body Text
  body: {
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: '22px',
    color: colors.textSecondary,
  },

  // Small/Helper Text
  helper: {
    fontSize: '12px',
    fontWeight: 400,
    lineHeight: '16px',
    color: colors.textMuted,
  },

  // Table Header
  tableHeader: {
    fontSize: '12px',
    fontWeight: 600,
    lineHeight: '16px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
};
```

## Spacing System

```typescript
const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '32px',
  '4xl': '40px',
  '5xl': '48px',

  // Specific use cases
  cardPadding: '24px',
  cardGap: '24px',         // Gap between cards (generous and premium)
  sectionGap: '20px',      // Gap between sections within cards
  internalGap: '12px',     // Gap between elements within sections
  pageMargin: '32px',      // Page-level horizontal margin
  gridGap: '24px',         // 12-column grid gap
};
```

## Card Variants

### Base Card
```css
.card {
  background: #FFFFFF;
  border: 1px solid #EAEAF0;
  border-radius: 16px;
  padding: 24px;
}
```

### Stat/KPI Card
```css
.stat-card {
  /* Base card + */
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.stat-card .stat-value {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.stat-card .stat-label {
  font-size: 13px;
  font-weight: 500;
  color: #6B7280;
}
.stat-card .stat-change {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 9999px;
  /* Green for positive, red for negative */
}
```

### Chart Card (Large)
```css
.chart-card {
  /* Base card + */
  grid-column: span 6; /* Half width on 12-col grid */
}
```

### Activity/Summary Card
```css
.activity-card {
  /* Base card + */
  max-height: 400px;
  overflow-y: auto;
}
.activity-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #F0F0F5;
}
```

### Progress/Funding Card (Wide)
```css
.progress-card {
  /* Base card + */
  grid-column: span 8; /* Wide card */
}
```

## Layout Structure

### Dashboard Grid (12-Column)
```css
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 24px;
  padding: 32px;
}

/* Row 1: KPI + Chart + Activity */
.kpi-stack { grid-column: span 3; }
.chart-main { grid-column: span 6; }
.activity-feed { grid-column: span 3; }

/* Row 2: Wide Progress + Side Summary */
.progress-wide { grid-column: span 8; }
.side-summary { grid-column: span 4; }

/* Responsive breakpoints */
@media (max-width: 1200px) {
  .kpi-stack, .chart-main, .activity-feed { grid-column: span 6; }
  .progress-wide, .side-summary { grid-column: span 12; }
}
@media (max-width: 768px) {
  .kpi-stack, .chart-main, .activity-feed,
  .progress-wide, .side-summary { grid-column: span 12; }
}
```

### Fixed Left Sidebar
```css
.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 260px;
  background: #FFFFFF;
  border-right: 1px solid #EAEAF0;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  z-index: 40;
}
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  color: #6B7280;
  transition: all 0.15s ease;
}
.sidebar-item:hover {
  background: #F7F7FA;
  color: #1A1A2E;
}
.sidebar-item.active {
  background: #FEF2F2;
  color: #DC2626;
  font-weight: 600;
}
```

### Top Utility Bar
```css
.top-bar {
  position: fixed;
  top: 0;
  left: 260px;
  right: 0;
  height: 64px;
  background: #FFFFFF;
  border-bottom: 1px solid #EAEAF0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  z-index: 30;
}
```

## Component Patterns

### Buttons
```css
.btn-primary {
  background: #DC2626;
  color: #FFFFFF;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  transition: background 0.15s ease;
}
.btn-primary:hover { background: #B91C1C; }

.btn-secondary {
  background: #FFFFFF;
  color: #1A1A2E;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid #EAEAF0;
}
.btn-secondary:hover { background: #F7F7FA; }
```

### Chips/Pills
```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
}
.chip-red { background: #FEF2F2; color: #DC2626; }
.chip-green { background: #ECFDF5; color: #059669; }
.chip-yellow { background: #FFFBEB; color: #D97706; }
.chip-red { background: #FEF2F2; color: #DC2626; }
```

### Input Fields
```css
.input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #EAEAF0;
  border-radius: 10px;
  font-size: 14px;
  font-family: inherit;
  background: #FFFFFF;
  color: #1A1A2E;
  transition: border-color 0.15s ease;
}
.input:focus {
  outline: none;
  border-color: #DC2626;
  box-shadow: 0 0 0 3px rgba(124, 107, 240, 0.1);
}
.input::placeholder { color: #9CA3AF; }
```

### Tables
```css
.table {
  width: 100%;
  border-collapse: collapse;
}
.table th {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #9CA3AF;
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #EAEAF0;
}
.table td {
  font-size: 14px;
  color: #1A1A2E;
  padding: 14px 16px;
  border-bottom: 1px solid #F0F0F5;
}
.table tr:hover { background: #FAFAFE; }
```

## Tailwind CSS Configuration

When implementing with Tailwind, extend the config:

```typescript
// tailwind.config.ts extension
{
  theme: {
    extend: {
      colors: {
        page: '#F7F7FA',
        primary: {
          DEFAULT: '#DC2626',
          light: '#FEF2F2',
          hover: '#B91C1C',
          muted: '#FECACA',
        },
        border: {
          DEFAULT: '#EAEAF0',
          light: '#F0F0F5',
        },
      },
      borderRadius: {
        card: '16px',
        btn: '10px',
        pill: '9999px',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
}
```

## Implementation Checklist Per Page

When redesigning any dashboard page:

1. [ ] Set page background to `#F7F7FA`
2. [ ] Wrap content in 12-column responsive grid
3. [ ] Replace existing cards with new card styles (white bg, 16px radius, 1px border)
4. [ ] Apply typography hierarchy (page title, card titles, stat numbers, labels)
5. [ ] Update sidebar active state to soft red
6. [ ] Update buttons to rounded style with primary/secondary variants
7. [ ] Update chips/pills to subtle tinted backgrounds
8. [ ] Update tables with new header/row styling
9. [ ] Ensure generous spacing between cards (24px gaps)
10. [ ] Add responsive breakpoints for mobile/tablet
11. [ ] Keep hover states understated and elegant
12. [ ] Verify charts use soft accent color palette
13. [ ] Remove any visual clutter or flashy effects
14. [ ] Test that information density is maintained

## Design Don'ts

- No heavy drop shadows (use borders for separation)
- No bright/neon colors (keep everything muted and professional)
- No flashy animations or effects
- No cramped layouts (whitespace is premium)
- No generic blue (use the warm red palette)
- No inconsistent border-radius values
- No mixed font families
