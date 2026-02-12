# Stream Platform Design System
**"Liquid Order"** - Institutional Trading Interface

## Direction & Feel

This is a **mission-critical trading terminal** for institutional options flow analysis. The interface must convey:
- **Precision**: Every number matters, data must be instantly readable
- **Depth**: Layered information without overwhelming
- **Speed**: Visual hierarchy guides the eye to critical data
- **Authority**: Professional, not playful

The design draws from the world of **institutional trading floors** and **high-frequency data terminals** (Bloomberg, Refinitiv), but with modern glassmorphism and subtle animations.

---

## Domain Exploration

### Product World
- **Gamma Magnetism**: Price attraction to high gamma strikes
- **Liquidity Walls**: Call/Put walls that act as support/resistance
- **Dealer Hedging**: Market maker positioning and flow
- **0DTE Tension**: Same-day expiration urgency
- **Order Flow Depth**: Institutional vs retail pressure

### Color World
Colors are derived from the trading environment:
- **Deep Obsidian**: The darkness of pre-market hours (`#080a0f`)
- **Neon Cyan**: Live data streams, active positions (`#00f2ff`)
- **Electric Crimson**: Sell pressure, bearish flow (`#ff0055`)
- **Liquid Gold**: Equilibrium levels (Max Pain, Pinning) (`#ffcc00`)
- **Spectral Indigo**: Structural elements, barely visible borders

### Signature Element
**"Pulse Walls"** - Critical price levels (Call Wall, Put Wall) have subtle pulsating glows that indicate live liquidity strength. This is unique to Stream and cannot exist in generic dashboards.

### Rejected Defaults
1. ❌ **Generic Gray Palette** → ✅ Deep obsidian with indigo undertones
2. ❌ **Heavy Card Borders** → ✅ Glassmorphism with spectral borders
3. ❌ **Standard Dashboard Grid** → ✅ High-density "Instrument Belt" layout

---

## Design Tokens

### Surface Elevation (Obsidian Scale)
```css
--base: #080a0f;        /* Page background */
--surface: #0d111a;     /* Cards, containers */
--elevated: #161b26;    /* Dropdowns, modals */
--overlay: #1c2331;     /* Tooltips, popovers */
```

### Borders (Spectral)
```css
--border-soft: rgba(255, 255, 255, 0.04);
--border-muted: rgba(255, 255, 255, 0.08);
--border-strong: rgba(255, 255, 255, 0.15);
```

### Brand & Semantic Colors
```css
--accent: #00f2ff;              /* Neon Cyan - GEX, active states */
--accent-glow: rgba(0, 242, 255, 0.15);

--positive: #00ffa3;            /* Deep Green-Cyan - Bullish */
--positive-glow: rgba(0, 255, 163, 0.1);

--negative: #ff0055;            /* Electric Crimson - Bearish */
--negative-glow: rgba(255, 0, 85, 0.1);

--warning: #ffcc00;             /* Liquid Gold - Neutral/Warning */
```

### Typography Hierarchy
```css
--ink-primary: #f8fafc;         /* Main text */
--ink-secondary: #94a3b8;       /* Supporting text */
--ink-tertiary: #64748b;        /* Metadata, labels */
--ink-muted: #475569;           /* Disabled, placeholders */
```

### Spacing Base
```css
--space-unit: 8px;
```

---

## Typography

### Font Families
- **UI Text**: `Inter` - Modern, highly legible at small sizes
- **Data/Numbers**: `Roboto Mono` - Tabular numerals, monospaced for alignment

### Type Scale
- **Micro Labels**: `text-[8px]` - uppercase, tracking-widest
- **Small Labels**: `text-[9px]` - uppercase, tracking-[0.2em]
- **Body**: `text-xs` to `text-sm`
- **Data Numbers**: `text-sm` to `text-4xl` - always with `.data-font` class
- **Headlines**: `text-2xl` to `text-3xl` - font-black, tracking-tight

### Usage Rules
- All **labels** are UPPERCASE with wide tracking (`tracking-widest`)
- All **numerical data** uses `data-font` class (Roboto Mono)
- **Headlines** use `font-black` (900 weight) for authority
- **Metadata** uses `text-ink-tertiary` or `text-ink-muted`

---

## Depth Strategy

**Glassmorphism + Subtle Borders**

- Primary containers: `.glass-surface` class
  - `background: rgba(13, 17, 26, 0.7)`
  - `backdrop-filter: blur(12px)`
  - `border: 1px solid var(--border-muted)`

- Elevated containers: `.glass-elevated` class
  - `background: rgba(22, 27, 38, 0.8)`
  - `backdrop-filter: blur(16px)`
  - `border: 1px solid var(--border-strong)`

- **No heavy shadows** - depth comes from layering and blur
- Borders are always `rgba()` with low opacity (4-15%)
- Surface color shifts are whisper-quiet (2-4% lightness difference)

---

## Component Patterns

### Cards
```tsx
<div className="glass-surface rounded-2xl p-5 border border-white/[0.08] hover:border-white/[0.15] transition-all">
  {/* Content */}
</div>
```

### Section Headers
```tsx
<div className="bg-white/[0.02] border-b border-white/[0.05] px-6 py-3">
  <h2 className="text-[10px] font-black text-ink-tertiary uppercase tracking-widest">
    Section Title
  </h2>
</div>
```

### Data Tables
- Header: `sticky top-0 bg-base/95 backdrop-blur-md`
- Header cells: `text-[9px] font-black uppercase tracking-widest text-ink-tertiary`
- Row hover: `hover:bg-white/[0.03]`
- Borders: `border-white/[0.03]` (very subtle)

### Buttons (Primary Action)
```tsx
<button className="px-4 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">
  Action
</button>
```

### Input Controls
```tsx
<input className="bg-white/5 text-white px-2 py-1 rounded text-xs data-font font-bold border border-white/10 focus:border-accent/50 focus:outline-none transition-colors" />
```

### Pulse Walls (Signature)
```tsx
<span className="glow-cyan">Call Wall Value</span>
<span className="glow-crimson">Put Wall Value</span>
```

---

## Animation

### Keyframes
```css
@keyframes pulse-cyan {
  0% { box-shadow: 0 0 0 0 rgba(0, 242, 255, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(0, 242, 255, 0); }
  100% { box-shadow: 0 0 0 0 rgba(0, 242, 255, 0); }
}

@keyframes pulse-crimson {
  0% { box-shadow: 0 0 0 0 rgba(255, 0, 85, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(255, 0, 85, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 0, 85, 0); }
}
```

### Timing
- **Micro-interactions**: `150-200ms`
- **Hover states**: `transition-all` (200ms default)
- **Pulse animations**: `2s infinite`
- **Easing**: Default browser easing (ease) for most, `linear` for scrolling

---

## Layout

### Max Width
- Dashboard: `max-w-[1600px]` - optimized for modern displays
- Centered: `mx-auto`

### Spacing
- Section gaps: `space-y-6`
- Card padding: `p-5` to `p-6`
- Component spacing: `gap-3` to `gap-6`

### Responsive
- Mobile: Single column, full width
- Tablet: `md:grid-cols-2`
- Desktop: `lg:grid-cols-4` or `lg:grid-cols-12`

---

## Consistency Checks

When adding new components, verify:
- [ ] Uses tokens from `index.css` (no hardcoded colors)
- [ ] Numerical data uses `.data-font` class
- [ ] Labels are UPPERCASE with wide tracking
- [ ] Borders are `rgba()` with 3-15% opacity
- [ ] Hover states have subtle transitions
- [ ] Glassmorphism applied to containers
- [ ] Spacing follows 8px grid (`--space-unit`)

---

## Files Modified

- `src/index.css` - Core design tokens and utilities
- `src/components/layout/Header.tsx` - Navigation and branding
- `src/pages/Dashboard.tsx` - Main layout structure
- `src/components/dashboard/ZeroDTEScanner.tsx` - Primary scanner interface
- `src/components/dashboard/QuickStatsCards.tsx` - Market overview cards
- `src/components/dashboard/VolumeScanner.tsx` - Volume heatmap table
- `src/components/dashboard/LiveFlowTicker.tsx` - Institutional flow ticker

---

## Future Enhancements

- [ ] Dark mode toggle (currently dark-only)
- [ ] Custom scrollbar styling for all scrollable areas
- [ ] Loading skeleton states with glassmorphism
- [ ] Toast notifications with accent colors
- [ ] Modal/dialog patterns
- [ ] Chart theming (Recharts/D3 integration)
