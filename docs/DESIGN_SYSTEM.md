# Valtrix Capital — Design System

> Brand expression for a premium, trustworthy Web3 trading platform.

---

## 1. Brand Voice

- **Premium but accessible**: looks like a hedge-fund terminal, behaves like a consumer app.
- **Confident, not flashy**: gold accents used sparingly; never neon-overloaded.
- **Data-first**: every screen leads with a number, then explains it.

---

## 2. Color Tokens

All colors are defined as CSS variables (HSL-friendly) so themes can be swapped later.

### 2.1 Surfaces (dark, default)

| Token | Hex | Usage |
|---|---|---|
| `bg-base` | `#0A0A0F` | App background |
| `bg-elevated` | `#11131A` | Cards, sidebar, modals |
| `bg-hover` | `#1A1D27` | Hover state, secondary surface |
| `bg-pressed` | `#23262F` | Active / pressed surface |
| `border-subtle` | `#23262F` | 1 px dividers |
| `border-strong` | `#3A3E4A` | Form borders, focused state |

### 2.2 Text

| Token | Hex | Usage |
|---|---|---|
| `text-primary` | `#F5F5F7` | Headings, key numbers |
| `text-secondary` | `#9CA0AB` | Body, labels |
| `text-muted` | `#5C606B` | Captions, helper text |
| `text-inverse` | `#0A0A0F` | Text on light surfaces |

### 2.3 Brand

| Token | Hex | Usage |
|---|---|---|
| `gold` | `#D4AF37` | Primary brand accent, primary CTA |
| `gold-bright` | `#F0C75E` | Hover on gold |
| `gold-muted` | `#8A7427` | Disabled gold |
| `silver` | `#C0C5CE` | Secondary accent |
| `silver-bright` | `#E2E5EC` | Hover on silver |

**Gold gradient (for logos / hero accents)**: `linear-gradient(135deg, #F0C75E 0%, #D4AF37 50%, #8A7427 100%)`
**Silver gradient (for text on hero)**: `linear-gradient(180deg, #FFFFFF 0%, #C0C5CE 100%)`

### 2.4 Semantic

| Token | Hex | Usage |
|---|---|---|
| `success` | `#22C55E` | Buy, profit, positive delta |
| `success-bg` | `rgba(34,197,94,0.10)` | Success chip background |
| `danger` | `#EF4444` | Sell, loss, negative delta |
| `danger-bg` | `rgba(239,68,68,0.10)` | Danger chip background |
| `info` | `#3B82F6` | Info chips, links |
| `warning` | `#F59E0B` | Warnings, low-balance |

---

## 3. Typography

### 3.1 Fonts
- **Display / Brand**: `Sora` — 400, 600, 700 — used for big hero headlines & logo wordmark hints.
- **UI**: `Inter` — 400, 500, 600, 700 — body text, buttons, all UI chrome.
- **Mono**: `JetBrains Mono` — 400, 500 — numbers, hashes, addresses.

### 3.2 Scale

| Token | Size / Line | Weight | Usage |
|---|---|---|---|
| `display-xl` | 64 / 72 | 700 Sora | Hero headlines |
| `display-lg` | 48 / 56 | 700 Sora | Section heroes |
| `display-md` | 36 / 44 | 600 Sora | Page titles |
| `h1` | 28 / 36 | 600 Inter | Card titles |
| `h2` | 22 / 30 | 600 Inter | Sub-section titles |
| `h3` | 18 / 26 | 600 Inter | Inline titles |
| `body-lg` | 16 / 24 | 400 Inter | Default body |
| `body` | 14 / 22 | 400 Inter | Compact body, UI |
| `caption` | 12 / 18 | 500 Inter | Labels, captions |
| `mono-lg` | 24 / 32 | 500 JBM | Large stats / prices |
| `mono` | 14 / 20 | 500 JBM | Tx hashes, addresses |

---

## 4. Spacing & Radius

- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96 (rem-based via Tailwind defaults).
- Radius scale:
  - `radius-sm` 6 px — chips, badges
  - `radius-md` 10 px — buttons, inputs
  - `radius-lg` 14 px — cards
  - `radius-xl` 20 px — large surfaces
  - `radius-full` — pills, avatars

---

## 5. Shadows

| Token | Value |
|---|---|
| `shadow-card` | `0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)` |
| `shadow-elevated` | `0 20px 50px rgba(0,0,0,0.55)` |
| `shadow-gold-glow` | `0 0 24px rgba(212,175,55,0.35)` |
| `shadow-success-glow` | `0 0 24px rgba(34,197,94,0.30)` |
| `shadow-danger-glow` | `0 0 24px rgba(239,68,68,0.30)` |

---

## 6. Component Patterns

### Button variants
- **Primary (gold)** — main CTA. Gold gradient bg, dark text.
- **Secondary (silver outline)** — secondary actions.
- **Ghost** — tertiary, hover lifts background.
- **Success (buy)** — solid green gradient.
- **Danger (sell)** — solid red gradient.
- **Icon** — square, 36–40 px.

Sizes: `sm` (32px), `md` (40px), `lg` (48px), `xl` (56px).

### Cards
- Base: `bg-elevated`, `border 1px border-subtle`, `radius-lg`, `shadow-card`, padding `p-6`.
- Highlighted (stat hero): adds subtle gold border-glow on top edge.

### Stat tile
- Label `caption text-muted uppercase tracking-wider`
- Value `mono-lg text-primary`
- Delta chip (success/danger) with arrow icon.

### Inputs
- `bg-base`, `border border-subtle`, focus → `border-gold`.
- Number inputs use mono.

### Sidebar
- `bg-elevated`, width 240 px, collapses to 72 px on small screens.
- Active item: subtle gold left bar (3 px) + gold text + soft gold-tinted bg.

### Header
- 72 px height, sticky, blurred bg (`backdrop-blur`), shows wallet pill, balance, network switcher.

### Trade buttons (Buy / Sell)
- Full-width within trade panel; 56 px height; arrow icons; soft glow on hover.

---

## 7. Motion

- Default transition: `200ms ease-out`.
- Page transitions: `framer-motion` fade + slight Y translate (`y: 8px → 0`).
- Number animations: count-up on stat tiles (150ms).
- Trade pulse: subtle scale on the active candle when trade is open.

---

## 8. Iconography

- Library: `lucide-react`.
- Stroke: 1.75 px default.
- Size: 18 / 20 / 24 px.
- Brand-only assets (logo, arrow mark) live in `/public/brand/`.

---

## 9. Imagery / Charts

- Charts use TradingView `lightweight-charts`:
  - Up candle: `#22C55E` solid, border same.
  - Down candle: `#EF4444` solid, border same.
  - Grid: `#1A1D27` very faint.
  - Crosshair: dashed `#9CA0AB`.
- Sparkline mini-charts in stat tiles use single-line stroke (success or danger).

---

## 10. Accessibility

- All interactive elements ≥ 40 px hit target on mobile.
- Color contrast AA minimum (AAA for body text on dark bg — verified).
- Focus rings: 2 px gold ring with 2 px offset.
- Reduced-motion: disables non-essential animations when `prefers-reduced-motion: reduce`.
- ARIA labels on every icon-only button.

---

End of design system — v1.0
