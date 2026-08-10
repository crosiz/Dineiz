# Dineiz POS — Design System & UI/UX Guidelines

> Inspired by Blink POS's clean, high-contrast, touch-optimized interface — evolved for 2026 with modern ergonomics, RTL support, and multi-tenant branding flexibility.

---

## 1. Design Philosophy

Dineiz follows four core design principles:

**Speed over decoration.** Every tap should achieve something. No animations longer than 200ms on the POS screen. No carousels, no banners, no distractions during order punching.

**Touch-first, mouse-optional.** The POS tablet UI is designed for 10-inch Android screens with gloved or greasy hands. Minimum tap target is 48×48px everywhere on the POS app; 44×44px on the admin dashboard.

**Clarity under pressure.** Kitchen staff, cashiers, and riders operate in noisy, time-pressured environments. Typography is large, status colors are unambiguous, and critical actions are never buried.

**Brand-flexible but system-consistent.** White-label tenants can inject their logo and primary color. The layout, spacing, and component behavior stay consistent across all tenants so staff who move between restaurants feel at home immediately.

---

## 2. Color System

### 2.1 Base Palette (Default / Dineiz Brand)

| Token | Hex | Usage |
|---|---|---|
| `--color-brand-primary` | `#FF5722` | Primary actions, active state, brand accent |
| `--color-brand-secondary` | `#FF8A65` | Hover states, secondary highlights |
| `--color-surface-base` | `#0F0F0F` | Main app background (dark mode default) |
| `--color-surface-raised` | `#1A1A1A` | Cards, panels, modals |
| `--color-surface-overlay` | `#242424` | Input fields, dropdown backgrounds |
| `--color-border` | `#2E2E2E` | Subtle dividers, card borders |
| `--color-text-primary` | `#F5F5F5` | Headings, primary text |
| `--color-text-secondary` | `#9E9E9E` | Labels, captions, placeholders |
| `--color-text-disabled` | `#555555` | Inactive buttons, disabled fields |

### 2.2 Semantic / Status Colors

| Token | Hex | Usage |
|---|---|---|
| `--color-status-new` | `#2196F3` | New order badge on KDS |
| `--color-status-prep` | `#FF9800` | In Preparation — amber urgency |
| `--color-status-ready` | `#4CAF50` | Ready for pickup/service |
| `--color-status-dispatched` | `#9C27B0` | Out for delivery |
| `--color-status-cancelled` | `#F44336` | Cancelled / error |
| `--color-status-rush` | `#FF1744` | Rush order highlight on KDS |
| `--color-cash` | `#66BB6A` | Cash payment indicator |
| `--color-card` | `#42A5F5` | Card payment indicator |

### 2.3 White-Label Overrides

Tenants can override only `--color-brand-primary` and `--color-brand-secondary`. All other tokens remain system-controlled to preserve usability and accessibility contrast ratios.

### 2.4 Light Mode (Admin Dashboard)

The admin dashboard and analytics portal offer a light mode variant:

| Token | Light Value |
|---|---|
| `--color-surface-base` | `#F8F9FA` |
| `--color-surface-raised` | `#FFFFFF` |
| `--color-text-primary` | `#1A1A1A` |
| `--color-text-secondary` | `#6B7280` |
| `--color-border` | `#E5E7EB` |

---

## 3. Typography

### 3.1 Font Stack

- **Primary:** `Inter` — used for all English UI text. Clean, tabular numerals, excellent screen legibility at small sizes.
- **Arabic / RTL:** `Cairo` — WOFF2, covers Arabic and Urdu script. Activated automatically when `dir="rtl"` is set on the root element.
- **Monospace (receipts, IDs, tokens):** `JetBrains Mono` — order tokens, API keys, terminal output.

### 3.2 Type Scale

| Level | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| `display` | 32px | 700 | 1.2 | Dashboard hero numbers (total revenue, order count) |
| `heading-1` | 24px | 600 | 1.3 | Page titles, module headers |
| `heading-2` | 18px | 600 | 1.4 | Section headings, card titles |
| `body-large` | 16px | 400 | 1.5 | Primary body text, menu item names |
| `body` | 14px | 400 | 1.5 | Standard UI text, labels |
| `caption` | 12px | 400 | 1.4 | Timestamps, helper text, tooltips |
| `overline` | 11px | 600 | 1.3 | Category labels (uppercase, tracked) |

### 3.3 Numeric Display

Order totals, inventory quantities, and revenue figures use tabular numeral rendering (`font-variant-numeric: tabular-nums`) so columns align cleanly in tables and live dashboards.

---

## 4. Spacing & Grid

### 4.1 Spacing Scale (4px base)

```
4px   — xs   — Tight icon gaps
8px   — sm   — Inline padding, chip spacing
12px  — md   — Input field padding
16px  — lg   — Card padding (default)
24px  — xl   — Section gaps
32px  — 2xl  — Page-level margins
48px  — 3xl  — Modal padding, hero spacing
```

### 4.2 POS Tablet Grid (10-inch, 1280×800)

The POS order punching screen uses a fixed 2-panel layout:

- **Left panel (60%):** Menu grid — 4-column item grid with category tabs pinned at top.
- **Right panel (40%):** Order cart — scrollable line items, totals, payment actions pinned at bottom.

On smaller tablets (1024×600), the grid collapses to 3 columns in the menu panel.

### 4.3 Admin Dashboard Grid

12-column CSS Grid with 24px gutters. Cards snap to 3, 4, or 6 column spans depending on content density. The layout is responsive down to 1024px wide (minimum supported browser width for admin).

### 4.4 KDS Screen Grid (16:9 landscape, typically 22–32 inch monitor)

Order cards displayed in a 4-column masonry-style grid. Cards grow vertically as items are added. Rush orders float to the top-left position regardless of chronological order.

---

## 5. Component Library

### 5.1 Order Card (POS Screen)

```
┌─────────────────────────────────┐
│ #0042          DINE-IN · T-07   │  ← Token · Order type · Table
│─────────────────────────────────│
│ ✦ Zinger Burger       ×2  1,200 │
│   + Extra Sauce               50│
│ ✦ Fries (Large)       ×1    350 │
│─────────────────────────────────│
│ Subtotal                  1,600 │
│ Tax (13%)                   208 │
│ ─────────────────────────────── │
│ TOTAL                PKR 1,808  │  ← Large, high contrast
│─────────────────────────────────│
│  [ SPLIT ]  [ DISCOUNT ]  [PAY] │  ← 48px tall action strip
└─────────────────────────────────┘
```

- Background: `--color-surface-raised`
- Token: monospace, `--color-brand-primary`
- Total row: `display` type, `--color-text-primary`
- PAY button: full-width on mobile, `--color-brand-primary` fill, white text

### 5.2 KDS Order Card

```
┌────────────────────────────────┐
│ #0042  RUSH  │ ⏱ 00:03:42      │  ← Rush badge, countdown
│────────────────────────────────│
│ ○ Zinger Burger ×2             │  ← Tap to mark In Progress
│ ✓ Fries (Large) ×1             │  ← Ticked = Ready
│────────────────────────────────│
│ [  MARK ALL READY  ]           │
└────────────────────────────────┘
```

- Rush orders: left border `4px solid --color-status-rush`, card header background `rgba(255,23,68,0.12)`
- Timer turns amber at 80% of target time, red at 100%
- Tapped items strike through with `--color-status-ready` icon

### 5.3 Buttons

| Variant | Background | Text | Border | Use Case |
|---|---|---|---|---|
| Primary | `--color-brand-primary` | White | None | PAY, CONFIRM, SAVE |
| Secondary | Transparent | `--color-brand-primary` | `1px brand` | CANCEL, BACK |
| Danger | `--color-status-cancelled` | White | None | DELETE, REVERSE ORDER |
| Ghost | Transparent | `--color-text-secondary` | None | Tertiary actions |
| Disabled | `#2E2E2E` | `--color-text-disabled` | None | Unavailable action |

All buttons: `border-radius: 8px`, minimum height `48px` on POS, `40px` on dashboard.

### 5.4 Status Badges

Pill-shaped badges with colored fill at 15% opacity and matching text color:

```css
.badge-new        { background: rgba(33,150,243,0.15); color: #2196F3; }
.badge-prep       { background: rgba(255,152,0,0.15);  color: #FF9800; }
.badge-ready      { background: rgba(76,175,80,0.15);  color: #4CAF50; }
.badge-cancelled  { background: rgba(244,67,54,0.15);  color: #F44336; }
```

### 5.5 Input Fields

- Background: `--color-surface-overlay`
- Border: `1px solid --color-border`, `border-radius: 8px`
- Focus: border color `--color-brand-primary`, `box-shadow: 0 0 0 3px rgba(255,87,34,0.2)`
- Height: `48px` on POS, `40px` on admin dashboard
- Placeholder: `--color-text-disabled`

### 5.6 Data Tables (Admin Dashboard)

- Row height: `52px`
- Alternating row: even rows get `background: rgba(255,255,255,0.02)` (dark) or `rgba(0,0,0,0.02)` (light)
- Hover: `background: rgba(255,87,34,0.06)`
- Sticky header with `border-bottom: 1px solid --color-border`
- All numeric columns right-aligned with tabular numerals

### 5.7 Modals & Dialogs

- Backdrop: `rgba(0,0,0,0.7)` with `backdrop-filter: blur(4px)`
- Modal surface: `--color-surface-raised`, `border-radius: 16px`
- Max width: `560px` (standard), `800px` (wide / split billing)
- Entry animation: scale from `0.95` to `1.0` over `150ms ease-out`

---

## 6. Screen Layouts

### 6.1 POS Order Punching Screen

```
┌──────────────────────────────────────────────────────────────┐
│ [≡ Menu]  Dineiz        Branch: Clifton   Shift: #S-041  │  ← Top bar 56px
├────────────────────────────────┬─────────────────────────────┤
│ [Burgers] [Pizza] [Drinks] [+] │  Order #0042 · Dine-In T-7  │  ← Category tabs
│────────────────────────────────│─────────────────────────────│
│  [Zinger]  [Classic] [Spicy]   │  Zinger Burger ×2    1,200  │
│  [Loaded]  [Tower]   [Kids ]   │  + Extra Sauce          50  │  ← Cart items
│            (4-col item grid)   │  Fries Large   ×1      350  │
│  [item] [item] [item] [item]   │  ─────────────────────────  │
│  [item] [item] [item] [item]   │  Subtotal              1,600 │
│  [item] [item] [item] [item]   │  Tax (13%)               208 │
│                                │  ─────────────────────────  │
│                                │  TOTAL           PKR 1,808  │
│                                │  [SPLIT] [DISC]  [  PAY  ] │
└────────────────────────────────┴─────────────────────────────┘
  60% width                          40% width
```

### 6.2 Admin Dashboard (Desktop)

```
┌──────┬─────────────────────────────────────────────────────┐
│      │  ☀ Good morning, Ahsan   |   Clifton Branch  ▾     │
│  S   │─────────────────────────────────────────────────────│
│  I   │  Today's Revenue   Orders Today   Avg Basket   Riders│
│  D   │   PKR 248,500         342            726         4/6 │
│  E   │─────────────────────────────────────────────────────│
│  B   │  [Revenue Trend — 30 day line chart]                │
│  A   │─────────────────────────────────────────────────────│
│  R   │  Top Items Today          │  Live Orders Feed       │
│      │  1. Zinger Burger  89     │  #0044 PREP  T-12  3min │
│      │  2. Fries Large    76     │  #0043 READY T-09  ---  │
│      │  3. Pepsi Regular  71     │  #0042 NEW   D-05  ---  │
└──────┴─────────────────────────────────────────────────────┘
 72px     Remaining width
```

Sidebar: `72px` collapsed (icons only), `240px` expanded. Expand on hover (desktop) or tap (tablet admin).

### 6.3 KDS Screen

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ #0039  NEW      │ #0041  PREP      │ #0042  RUSH      │ #0040  READY    │
│ Dine-In T-04   │ Takeaway        │ Delivery  !RED!  │ Dine-In T-02   │
│─────────────────│─────────────────│──────────────────│─────────────────│
│ ○ Zinger ×2    │ ✓ Loaded ×1     │ ● Spicy   ×3     │ ✓ Classic ×1   │
│ ○ Fries  ×2    │ ○ Pepsi  ×2     │ ○ Fries   ×3     │ ✓ Fries  ×1   │
│                 │                 │ ○ Coleslaw×3     │ ✓ Pepsi  ×2   │
│─────────────────│─────────────────│──────────────────│─────────────────│
│ [ACCEPT]        │ [MARK READY]    │ [MARK READY]     │ [DISPATCHED]    │
│                 │ ⏱ 00:04:12      │ ⏱ 00:07:55 🔴    │ ✓ Done         │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

---

## 7. Iconography

Use **Lucide Icons** (MIT license, consistent stroke width, tree-shakeable). Icon size: `20px` in navigation, `16px` inline, `24px` in empty states and feature banners.

Key icons mapped to features:

| Feature | Icon |
|---|---|
| Orders | `clipboard-list` |
| Menu | `utensils` |
| Inventory | `package` |
| KDS | `monitor` |
| Riders | `bike` |
| Analytics | `bar-chart-2` |
| Loyalty | `star` |
| Settings | `settings` |
| Shift | `clock` |
| WhatsApp | `message-circle` |

---

## 8. Motion & Animation

All transitions follow a strict performance budget — no janky reflows on low-end Android tablets.

| Element | Duration | Easing |
|---|---|---|
| Button press feedback | 80ms | `ease-out` |
| Modal open/close | 150ms | `ease-out` / `ease-in` |
| Page transitions | 200ms | `ease-in-out` |
| KDS card arrival | 250ms | `spring(1, 80, 12)` |
| Order status badge change | 300ms | `ease` (color cross-fade) |
| Sidebar expand | 200ms | `ease-out` |

**Disable all animations** when `prefers-reduced-motion: reduce` is detected.

---

## 9. RTL & Localization

- All layouts use CSS logical properties (`margin-inline-start`, `padding-inline-end`) rather than `left`/`right` to automatically flip in RTL.
- Font switching is automatic: when locale is `ar` or `ur`, `Cairo` replaces `Inter` system-wide.
- The order punching grid, sidebar, and cart panel all flip correctly in RTL mode.
- Numbers (order totals, quantities) are always rendered LTR even inside RTL layouts (`unicode-bidi: isolate` on numeric spans).

---

## 10. White-Label Theming Implementation

Tenant branding is applied at runtime via CSS custom property injection:

```css
/* Injected per-tenant from the theming API */
:root {
  --color-brand-primary: /* tenant hex */;
  --color-brand-secondary: /* tenant hex */;
  --tenant-logo-url: url("https://cdn.dineiz.io/tenants/{id}/logo.svg");
}
```

The system validates that the injected primary color achieves at least 4.5:1 contrast ratio against `--color-text-primary` (WCAG AA). If it fails, the system falls back to the default `#FF5722` brand color and surfaces a warning in the tenant admin panel.

---

## 11. Accessibility Standards

- WCAG 2.1 AA compliance on the admin dashboard and QR ordering web interface.
- All interactive elements are keyboard-navigable with visible focus rings (`outline: 2px solid --color-brand-primary`).
- Screen reader landmarks: `<header>`, `<nav>`, `<main>`, `<aside>` used semantically.
- Error messages are associated with their inputs via `aria-describedby`.
- Status changes on the KDS and live order feed are announced via `aria-live="polite"` regions.
- Color is never the only means of conveying status — every status badge includes a text label alongside its color.

---

## 12. Responsive Breakpoints

| Breakpoint | Width | Target Device |
|---|---|---|
| `xs` | < 480px | Rider mobile app |
| `sm` | 480–768px | QR ordering (customer phone) |
| `md` | 768–1024px | 8-inch POS tablet (secondary support) |
| `lg` | 1024–1280px | 10-inch POS tablet (primary) |
| `xl` | 1280–1440px | Admin dashboard laptop |
| `2xl` | > 1440px | KDS monitor, large admin screen |

The POS punching screen does not collapse below `lg` — it is a fixed-layout tablet application. The admin dashboard is fully responsive down to `md`.

---

*Dineiz POS — Design System v1.0 — April 2026 — Confidential*
