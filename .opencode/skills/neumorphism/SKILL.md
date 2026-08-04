---
name: neumorphism
description: >
  Apply the Kosmos neumorphic \"soft-touch\" design system — soft UI with raised and pressed surfaces, carved wells, and tactile controls. Use whenever building or styling the Kosmos app or any dashboard, control panel, or interface meant to match this aesthetic: neumorphism, soft UI, soft-touch, soft-tactile, extruded or carved surfaces, dual-shadow elements. Trigger even if the user doesn't say \"neumorphism\" — when the product is Kosmos, or when existing code uses surface-colored backgrounds with light/dark dual shadows.
---

# Kosmos Neumorphism Design System

The established visual language for the Kosmos app: **soft-touch UI** — controls that look
extruded from, or carved into, a single soft surface. Every element shares the surface color
with the background; depth comes entirely from paired light/dark shadows.

For overall creative direction, tone, or layout choices, also load the `frontend-design`
skill. This skill defines the _styling system_ — use its tokens and recipes without
improvising alternatives.

## Core physics (why this look works)

Neumorphism only works when these three hold — they are not optional:

1. **Element background == page background.** Use `var(--surface)` everywhere. Any
   contrast between element and background breaks the illusion instantly.
2. **Shadows are pairs.** A raised element casts `box-shadow: <dark> offset, <light> offset`
   where dark is offset toward bottom-right (light source top-left) and light toward
   top-left. Pressed elements swap to `inset`. Never use single shadows.
3. **Depth size scales with element size.** Small controls (buttons, chips, knobs) use
   ~6px offsets; cards and panels use ~9px; wells and troughs use ~5px inset. Keeping the
   ratio proportional is what makes the depth feel physical.

The accent color is reserved for **status and data** (active states, glyphs, fills, deltas)
— never for large surfaces.

## Design tokens

```css
:root {
  --surface: #e4e8f0; /* the one surface everything sits on */
  --shadow-dark: #c7cdd9; /* dark shadow, offset bottom-right */
  --shadow-light: #ffffff; /* light shadow, offset top-left */
  --ink: #2f3548; /* primary text */
  --muted: #6b7285; /* secondary text, labels */
  --accent: #0e9f8e; /* teal — status, data, active */
  --accent-soft: rgba(14, 159, 142, 0.12); /* tinted chip backgrounds */
  --neg: #d9534f; /* negative deltas */
  --radius: 22px; /* panels and cards; controls smaller */
  --font-display: 'Unbounded', 'Bricolage Grotesque', sans-serif;
  --font-body: 'Bricolage Grotesque', sans-serif;
}
```

Fonts load via Google Fonts:

```html
<link
  href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=Unbounded:wght@200..900&display=swap"
  rel="stylesheet"
/>
```

Use the display font (Unbounded) for stat values, route counts, and other numbers with
`font-variant-numeric: tabular-nums`. Use the body font (Bricolage Grotesque) everywhere
else. Uppercase labels use `font-size: 0.74rem; letter-spacing: 0.16em; font-weight: 700`.

## Core recipes

### Raised surface (cards, panels, pills)

```css
.raised {
  background: var(--surface);
  box-shadow:
    9px 9px 18px var(--shadow-dark),
    -9px -9px 18px var(--shadow-light);
}
```

### Pressed surface (wells, troughs, tracks, active states)

```css
.pressed {
  box-shadow:
    inset 6px 6px 12px var(--shadow-dark),
    inset -6px -6px 12px var(--shadow-light);
}
```

### Button

```css
.btn {
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  color: var(--ink);
  background: var(--surface);
  border: none;
  border-radius: 14px;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  box-shadow:
    6px 6px 12px var(--shadow-dark),
    -6px -6px 12px var(--shadow-light);
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease,
    color 0.2s ease;
}
.btn:hover {
  box-shadow:
    8px 8px 16px var(--shadow-dark),
    -8px -8px 16px var(--shadow-light);
}
.btn:active {
  box-shadow:
    inset 5px 5px 10px var(--shadow-dark),
    inset -5px -5px 10px var(--shadow-light);
  transform: translateY(1px);
}
.btn--accent {
  color: var(--accent);
}
```

Hover lifts the element (bigger shadows), active presses it into the surface (inset +
tiny translate). This rest→hover→active arc is the signature micro-interaction — use it
for every pressable thing.

### Toggle switch

Raised shell with a raised knob; when `aria-checked="true"`, the shell becomes pressed
(inset) and the knob slides and fills with an accent gradient:

```css
.switch {
  width: 64px;
  height: 34px;
  border: none;
  border-radius: 999px;
  background: var(--surface);
  cursor: pointer;
  position: relative;
  box-shadow:
    5px 5px 10px var(--shadow-dark),
    -5px -5px 10px var(--shadow-light);
  transition: box-shadow 0.25s ease;
}
.switch .knob {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--surface);
  box-shadow:
    3px 3px 6px var(--shadow-dark),
    -3px -3px 6px var(--shadow-light);
  transition:
    transform 0.25s cubic-bezier(0.2, 0.7, 0.2, 1),
    background 0.25s;
}
.switch[aria-checked='true'] {
  box-shadow:
    inset 4px 4px 8px var(--shadow-dark),
    inset -4px -4px 8px var(--shadow-light);
}
.switch[aria-checked='true'] .knob {
  transform: translateX(30px);
  background: linear-gradient(180deg, #12b3a0, var(--accent));
  box-shadow:
    2px 2px 6px rgba(14, 159, 142, 0.4),
    -1px -1px 3px rgba(255, 255, 255, 0.6);
}
```

### Segmented control

A pressed (inset) track; the active segment pops back up as a raised chip:

```css
.seg {
  display: flex;
  padding: 5px;
  border-radius: 14px;
  gap: 4px;
  box-shadow:
    inset 4px 4px 8px var(--shadow-dark),
    inset -4px -4px 8px var(--shadow-light);
}
.seg-btn {
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--muted);
  background: transparent;
  border: none;
  border-radius: 10px;
  padding: 0.5rem 1.15rem;
  cursor: pointer;
  transition:
    box-shadow 0.25s ease,
    color 0.25s ease;
}
.seg-btn.is-active {
  color: var(--accent);
  box-shadow:
    3px 3px 7px var(--shadow-dark),
    -3px -3px 7px var(--shadow-light);
}
```

### Status pill with LED

Raised pill; the LED is a tiny inset sphere that glows with the accent:

```css
.status-pill {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 1.35rem;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  white-space: nowrap;
}
.led {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow:
    inset 2px 2px 3px rgba(0, 0, 0, 0.25),
    inset -1px -1px 2px rgba(255, 255, 255, 0.5),
    0 0 0 1px rgba(14, 159, 142, 0.35);
}
```

### Stat card with sparkline

Raised card with uppercase label + glyph, display-font value, and a delta chip. The
sparkline lives in a **carved trough** — raised bars rising from a pressed well is the
strongest neumorphic data viz pattern:

```css
.card {
  padding: 1.45rem 1.45rem 1.25rem;
  border-radius: var(--radius);
}
.card-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}
.stat-value {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: clamp(1.45rem, 2.6vw, 1.9rem);
  margin: 0.75rem 0 0.55rem;
  font-variant-numeric: tabular-nums;
}
.delta {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.22rem 0.55rem;
  border-radius: 999px;
}
.delta--pos {
  color: var(--accent);
  background: var(--accent-soft);
}
.delta--neg {
  color: var(--neg);
  background: rgba(217, 83, 79, 0.1);
}
.spark-trough {
  display: flex;
  align-items: flex-end;
  gap: 5px;
  height: 34px;
  margin-top: 0.95rem;
  padding: 4px 6px;
  border-radius: 12px;
  box-shadow:
    inset 3px 3px 6px var(--shadow-dark),
    inset -3px -3px 6px var(--shadow-light);
}
.spark i {
  flex: 1;
  border-radius: 4px 4px 2px 2px;
  background: linear-gradient(180deg, #12b3a0, var(--accent));
  box-shadow:
    2px 2px 4px rgba(0, 0, 0, 0.12),
    -1px -1px 3px rgba(255, 255, 255, 0.7);
}
```

### Bar chart in a carved well

Panel contains a `chart-well` (pressed), bars rise out of it as accent-gradient columns
with small dual shadows. Bars can carry hover tooltips: a raised `::after` chip with
`data-v` text that fades in on hover.

### Progress track

Pressed track, accent-gradient fill that widens into it. Fill color comes from a
`linear-gradient(90deg, var(--accent), #12b3a0)`.

### Route/status chips

Small raised chips: `font-family: var(--font-display); font-size: 0.62rem; color:
var(--accent); padding: 0.3rem 0.5rem; border-radius: 8px; box-shadow: 3px 3px 6px
var(--shadow-dark), -3px -3px 6px var(--shadow-light);`

## Motion

One orchestrated page load beats scattered micro-interactions: stagger `rise` on cards,
panels, header, and footer with `animation-delay` (8px increments up the grid). Data
elements grow in after: bars `grow` (scaleY), fills `widen` (width via `--w`), sparklines
after their cards.

```css
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(22px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes grow {
  to {
    transform: scaleY(1);
  }
}
@keyframes widen {
  to {
    width: var(--w);
  }
}
```

Easing: `cubic-bezier(0.2, 0.7, 0.2, 1)` everywhere. Respect
`prefers-reduced-motion: reduce` by disabling animations and showing final states
(see kit.css).

## Responsive

Breakpoints: 860px and 480px. Collapse multi-column grids to 2 → 1 columns; stacks panels
and controls at 860px.

## Accessibility

- `:focus-visible` → `outline: 2px solid var(--accent); outline-offset: 2px` on every
  interactive element (buttons, seg buttons, switches). Do not rely on shadow changes alone.
- Toggle switches are `<button role="switch" aria-checked="...">` with an `aria-label`.
- Segmented controls are `<div role="group" aria-label="...">` containing buttons.
- Hover-only affordances (bar tooltips) must not be the only way to read data — labels
  live outside the tooltip.
- Neumorphism has inherently low contrast: text uses `--ink` on `--surface` (never muted
  on surface for body copy), and interactive elements must be identifiable by shape,
  label, or outline — not only by shadows.

## Complete kit

`references/kit.css` contains the full, ready-to-copy stylesheet (tokens, all recipes,
motion, responsive, reduced-motion). For any non-trivial page or component, start from
kit.css rather than reassembling snippets — it is the canonical implementation of this
system.
