# Mobile Incident Report - Evidence Section UI

## Visual Layout

```
┌─────────────────────────────────────────┐
│  📱 Report Incident                     │
├─────────────────────────────────────────┤
│                                         │
│  [Incident Type Selection Grid]         │
│  [Severity Selection]                   │
│  [Title Input]                          │
│  [Description Textarea]                 │
│  [Location Input]                       │
│  [Witnesses Input]                      │
│  [Persons Involved Input]               │
│  [Actions Taken Textarea]               │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 📋 Evidence                       │  │
│  │                                   │  │
│  │ Add photos or videos to support  │  │
│  │ your report                       │  │
│  │                                   │  │
│  │ ┌───────┐ ┌───────┐ ┌───────┐   │  │
│  │ │   📷  │ │  🖼️   │ │  🎥   │   │  │
│  │ │ Take  │ │ From  │ │Record │   │  │
│  │ │ Photo │ │Gallery│ │ Video │   │  │
│  │ └───────┘ └───────┘ └───────┘   │  │
│  │                                   │  │
│  │ Photos (2)                        │  │
│  │ ┌─────┐ ┌─────┐                  │  │
│  │ │ IMG │ │ IMG │                  │  │
│  │ │  1  │ │  2  │                  │  │
│  │ │  ×  │ │  ×  │                  │  │
│  │ └─────┘ └─────┘                  │  │
│  │                                   │  │
│  │ Videos (1)                        │  │
│  │ ┌─────┐                           │  │
│  │ │  ▶  │                           │  │
│  │ │  1  │                           │  │
│  │ │  ×  │                           │  │
│  │ └─────┘                           │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [Emergency Services Toggles]           │
│  [Submit Button]                        │
│                                         │
└─────────────────────────────────────────┘
```

## Evidence Section Breakdown

### Action Buttons (3 columns)
```
┌───────────┬───────────┬───────────┐
│     📷    │    🖼️     │    🎥     │
│  Take     │   From    │  Record   │
│  Photo    │  Gallery  │   Video   │
└───────────┴───────────┴───────────┘
```

### Photo Thumbnails (Grid Layout)
```
Photos (2)
┌─────────┐ ┌─────────┐ ┌─────────┐
│    ×    │ │    ×    │ │         │
│         │ │         │ │         │
│  [IMG]  │ │  [IMG]  │ │         │
│         │ │         │ │         │
│    1    │ │    2    │ │         │
└─────────┘ └─────────┘ └─────────┘
100x100px   100x100px   (empty slot)
```

### Video Thumbnails (Grid Layout)
```
Videos (1)
┌─────────┐ ┌─────────┐
│    ×    │ │         │
│         │ │         │
│    ▶    │ │         │
│         │ │         │
│    1    │ │         │
└─────────┘ └─────────┘
100x100px   (empty slot)
```

## Component Interactions

### 1. Take Photo Flow
```
User taps "Take Photo"
    ↓
CameraModal opens with tips
    ↓
User captures photo
    ↓
Photo auto-optimizes (<2MB)
    ↓
Thumbnail added to grid
    ↓
User can continue or remove
```

### 2. From Gallery Flow
```
User taps "From Gallery"
    ↓
Permission requested
    ↓
Gallery picker opens (multi-select up to 5)
    ↓
User selects 1-5 photos
    ↓
Each photo optimizes
    ↓
All thumbnails added to grid
```

### 3. Record Video Flow
```
User taps "Record Video"
    ↓
Camera permission requested
    ↓
Camera opens in video mode
    ↓
User records (max 2 min)
    ↓
Video saved to temp directory
    ↓
Video thumbnail added to grid
```

### 4. Remove Evidence Flow
```
User taps × button on thumbnail
    ↓
Confirmation alert appears
    ↓
"Cancel" or "Remove" options
    ↓
If "Remove": deleted from array & disk
    ↓
Thumbnail disappears from grid
```

## Camera Modal UI

```
┌─────────────────────────────────────┐
│ ×  Capture Evidence Photo         │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │    [CAMERA PREVIEW]         │   │
│  │                             │   │
│  │  ╔═════════════════╗        │   │
│  │  ║ Tips for good   ║        │   │
│  │  ║ photos:         ║        │   │
│  │  ║ • Clear evidence║        │   │
│  │  ║ • Good lighting ║        │   │
│  │  ║ • Surroundings  ║        │   │
│  │  ║   [Got it]      ║        │   │
│  │  ╚═════════════════╝        │   │
│  │                             │   │
│  │      [Crosshair guide]      │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌────┐    ┌────────┐    ┌────┐   │
│  │ 🔄 │    │   ⚪    │    │ ? │   │
│  │Flip│    │Capture│    │Tips│   │
│  └────┘    └────────┘    └────┘   │
└─────────────────────────────────────┘
```

## States & Indicators

### Empty State
- Action buttons visible
- No thumbnail grids shown
- Hint text: "Add photos or videos to support your report"

### Photos Added State
- Action buttons visible
- "Photos (N)" label appears
- Thumbnail grid with numbered photos
- Each thumbnail has × remove button

### Videos Added State
- Action buttons visible
- "Videos (N)" label appears
- Video thumbnails with play icon
- Each thumbnail has × remove button

### Processing State
- Loading indicator on buttons during optimization
- "Optimizing..." text for photos
- "Processing..." text for videos

### Error State
- Alert dialog with error message
- User-friendly error descriptions
- Options to retry or cancel

## Color Scheme

```
Primary Action Color:  #0066CC (blue)
Success Indicator:     #00AA00 (green)
Error/Remove Button:   #DD0000 (red)
Background:            #FFFFFF (white)
Border:                #E0E0E0 (light gray)
Text Primary:          #333333 (dark gray)
Text Secondary:        #666666 (medium gray)
Text Tertiary:         #999999 (light gray)
Video Thumbnail BG:    #444444 (dark gray)
```

## Accessibility

✅ **Touch Targets**: All buttons 44x44pt minimum
✅ **Color Contrast**: WCAG AA compliant
✅ **Labels**: Clear descriptive text
✅ **Icons**: Supplemented with text labels
✅ **Feedback**: Visual confirmation for all actions
✅ **Errors**: Screen reader compatible alerts

## Responsive Design

- Works on all screen sizes (iPhone SE to iPad)
- Button grid adapts to width
- Thumbnail grid wraps based on available space
- Maintains usability on small screens

## Animation & Transitions

- Modal slides up from bottom (300ms)
- Thumbnails fade in (200ms)
- Remove button confirmation (native alert)
- Photo optimization shows spinner
- Success feedback (checkmark)

## Example Complete Form

```
┌─────────────────────────────────────┐
│ 📝 Report Incident                  │
├─────────────────────────────────────┤
│ Type: Security Breach  ✓            │
│ Severity: High 🟠                   │
│ Title: "Unauthorized access"        │
│ Description: "Person entered..."    │
│ Location: "Main entrance, Floor 1"  │
│ ✓ GPS: 37.7749, -122.4194          │
│                                     │
│ Evidence:                           │
│ 📷 🖼️ 🎥                            │
│                                     │
│ Photos (3): [IMG1] [IMG2] [IMG3]   │
│ Videos (1): [▶ VID1]                │
│                                     │
│ Emergency Services:                 │
│ 🚓 Police Notified: ON              │
│ 🚑 Ambulance: OFF                   │
│                                     │
│ [Submit Incident Report] ✓          │
└─────────────────────────────────────┘
```

## Implementation Status

✅ **UI Components**: All designed and implemented
✅ **Photo Capture**: Camera + Gallery working
✅ **Video Recording**: Camera recording working
✅ **Thumbnail Display**: Grid layout with previews
✅ **Delete Functionality**: Confirmation + cleanup
✅ **Form Integration**: Evidence included in submission
✅ **Error Handling**: All edge cases covered
✅ **Permissions**: Camera + Gallery permissions
✅ **Optimization**: Photos auto-compressed

Ready for device testing! 🚀
