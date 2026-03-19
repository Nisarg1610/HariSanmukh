# HariSanmukh — Design System

> A premium household management PWA inspired by Apple's iOS design language.
> Built with Next.js, Tailwind CSS v4, and shadcn/ui.

---

## 1. Brand Identity

**App Name:** HariSanmukh
**Tagline:** Manage household duties together
**Personality:** Calm, premium, trustworthy, minimal
**Inspiration:** iOS Settings, Apple Health, Linear, Vercel

---

## 2. Color Palette

The palette is derived from a deep navy blue series — sophisticated, calm, and premium.

### Named Colors (Source Palette)

| Name          | Hex       | Usage                          |
|---------------|-----------|--------------------------------|
| Black Russian | `#121524` | Dark bg, light mode text       |
| Cello         | `#384c65` | Light mode accent, text-2      |
| Wedgewood     | `#485f88` | Borders, accent-2              |
| Echo Blue     | `#9daccc` | Dark mode accent, muted text   |
| Link Water    | `#c0c9db` | Dark mode text-2, subtle tones |

---

## 3. CSS Variables — Design Tokens

All colors are defined as CSS variables on `:root` (light) and `html.dark` (dark).

### Light Mode (`:root`)

```css
--bg: #f0f2f7;              /* Page background */
--bg-card: #ffffff;          /* Card surface */
--bg-card-2: #f5f6fa;        /* Inset / secondary surface */
--bg-elevated: #ffffff;      /* Modals, panels */
--text-1: #121524;           /* Primary text */
--text-2: #384c65;           /* Secondary text */
--text-3: #7a8ba0;           /* Tertiary / muted text */
--text-4: #b0bec9;           /* Placeholder / disabled */
--border: rgba(72,95,136,0.12);
--border-strong: rgba(72,95,136,0.25);
--accent: #384c65;           /* Primary action color */
--accent-2: #485f88;         /* Hover / secondary accent */
--accent-bg: #edf0f7;        /* Accent background tint */
--accent-text: #384c65;      /* Text on accent-bg */
--green: #2d9e6b;
--green-bg: #e8f7f1;
--red: #e05252;
--red-bg: #fdf0f0;
--yellow: #d4920a;
--yellow-bg: #fdf5e6;
--separator: rgba(72,95,136,0.1);
```

### Dark Mode (`html.dark`)

```css
--bg: #121524;               /* Black Russian */
--bg-card: #1a1f30;          /* Slightly elevated */
--bg-card-2: #222840;        /* Inset surface */
--bg-elevated: #222840;
--text-1: #e8edf5;           /* Near white */
--text-2: #c0c9db;           /* Link Water */
--text-3: #9daccc;           /* Echo Blue */
--text-4: #485f88;           /* Wedgewood */
--border: rgba(153,172,204,0.10);
--border-strong: rgba(153,172,204,0.20);
--accent: #9daccc;           /* Echo Blue as accent */
--accent-2: #c0c9db;
--accent-bg: #1e2640;
--accent-text: #9daccc;
--green: #30c97a;
--green-bg: #0d2a1c;
--red: #ff6b6b;
--red-bg: #2a1010;
--yellow: #ffd166;
--yellow-bg: #2a2010;
--separator: rgba(153,172,204,0.08);
```

---

## 4. Typography

**Font Stack:**
```css
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
  'Segoe UI', system-ui, sans-serif;
```

Uses the system font — feels native on every device.

### Type Scale

| Role             | Size  | Weight | Color        |
|------------------|-------|--------|--------------|
| Page title       | 28px  | 700    | `--text-1`   |
| Section title    | 20px  | 700    | `--text-1`   |
| Card title       | 17px  | 600    | `--text-1`   |
| Body             | 15px  | 400    | `--text-1`   |
| Secondary body   | 14px  | 400    | `--text-2`   |
| Caption          | 13px  | 400    | `--text-3`   |
| Section header   | 12px  | 600    | `--text-3` UPPERCASE |
| Micro            | 11px  | 500    | `--text-4`   |

---

## 5. Spacing & Layout

```
Base unit: 4px
Page padding: 16px (mobile), 24px (desktop)
Card padding: 16px
Section gap: 24px
Row gap: 12px
Icon size: 20-24px
```

**Max content width:** `640px` (centered on desktop)

---

## 6. Border Radius

```css
--radius-sm: 10px;   /* Small elements, tags */
--radius-md: 14px;   /* Inputs, buttons */
--radius-lg: 18px;   /* Cards */
--radius-xl: 24px;   /* Large cards, modals */
--radius-full: 9999px; /* Pills, avatars, toggles */
```

---

## 7. Elevation & Surfaces

Three surface levels:

| Level     | CSS Var        | Use Case                    |
|-----------|----------------|-----------------------------|
| Base      | `--bg`         | Page background             |
| Card      | `--bg-card`    | Content cards               |
| Elevated  | `--bg-card-2`  | Inputs, inset sections      |

**No box-shadows.** Depth is achieved through background color contrast only — cleaner on both light and dark.

---

## 8. Component Patterns

### Card (iOS Grouped List Style)
```css
.card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 0.5px solid var(--border);
  overflow: hidden;
}
```

### List Row
```css
.list-row {
  padding: 12px 16px;
  border-bottom: 0.5px solid var(--separator);
  display: flex;
  align-items: center;
  gap: 12px;
}
.list-row:last-child { border-bottom: none; }
```

### Section Header
```css
.section-header {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 8px;
}
```

### Buttons
```css
/* Primary */
.btn-primary {
  background: var(--accent);
  color: white;
  border-radius: var(--radius-md);
  padding: 13px 20px;
  font-weight: 600;
  font-size: 15px;
}

/* Secondary */
.btn-secondary {
  background: var(--bg-card-2);
  color: var(--text-2);
  border: 0.5px solid var(--border);
  border-radius: var(--radius-md);
  padding: 13px 20px;
  font-weight: 600;
  font-size: 15px;
}
```

### Input
```css
.input {
  background: var(--bg-card-2);
  border: 0.5px solid var(--border);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  color: var(--text-1);
  font-size: 15px;
}
.input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(153,172,204,0.15);
}
```

### Toggle Switch (iOS Style)
```css
.toggle {
  width: 51px; height: 31px;
  border-radius: 9999px;
  background: var(--bg-card-2);
  border: 0.5px solid var(--border);
  transition: background 0.2s ease;
  position: relative;
}
.toggle.on { background: var(--green); }
.toggle-thumb {
  position: absolute;
  top: 2px; left: 2px;
  width: 27px; height: 27px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  transition: transform 0.2s ease;
}
.toggle.on .toggle-thumb { transform: translateX(20px); }
```

### Badge / Pill
```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
}
.badge-blue  { background: var(--accent-bg);  color: var(--accent-text); }
.badge-green { background: var(--green-bg);   color: var(--green); }
.badge-red   { background: var(--red-bg);     color: var(--red); }
.badge-yellow{ background: var(--yellow-bg);  color: var(--yellow); }
```

### Glass Header / Navbar
```css
.glass-nav {
  background: rgba(240, 242, 247, 0.85);
  backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 0.5px solid var(--separator);
}
html.dark .glass-nav {
  background: rgba(18, 21, 36, 0.88);
}

.glass-bottom {
  background: rgba(240, 242, 247, 0.92);
  backdrop-filter: saturate(180%) blur(20px);
  border-top: 0.5px solid var(--separator);
}
html.dark .glass-bottom {
  background: rgba(18, 21, 36, 0.92);
}
```

---

## 9. Dark Mode

### Setup
Dark mode is class-based using `html.dark`.

**Tailwind v4:**
```css
@variant dark (&:where(.dark, .dark *));
```

**Auto-detect & persist in `layout.tsx`:**
```html
<script>
  try {
    const theme = localStorage.getItem('hs_theme');
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else if (theme === 'light') document.documentElement.classList.remove('dark');
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.add('dark');
  } catch(e) {}
</script>
```

**Toggle:**
```tsx
const isDark = document.documentElement.classList.contains('dark');
document.documentElement.classList.toggle('dark', !isDark);
localStorage.setItem('hs_theme', isDark ? 'light' : 'dark');
```

### Design Principles for Dark Mode
- Background goes to **Black Russian `#121524`** — not pure black
- Cards use `#1a1f30` — subtly lighter than bg for depth
- Text uses **Link Water `#c0c9db`** not pure white — easier on eyes
- Accent shifts to **Echo Blue `#9daccc`** — softer glow
- Borders are very subtle — `rgba(153,172,204,0.10)`
- No harsh whites — everything has a slight blue tint

---

## 10. Animation

```css
/* Page entry */
@keyframes pageIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
main { animation: pageIn 0.2s ease-out; }

/* Transitions */
html, body { transition: background-color 0.3s ease; }
buttons    { transition: opacity 0.15s ease, transform 0.1s ease; }
inputs     { transition: border-color 0.15s ease, box-shadow 0.15s ease; }
```

---

## 11. Icon System

**Library:** `lucide-react`
**Default size:** `20px`
**Stroke width:** `1.8` (inactive), `2.5` (active)
**Color:** Always use CSS variables, never hardcoded hex

**Icon badge (iOS Settings style):**
```tsx
<div style={{
  width: 32, height: 32,
  borderRadius: 8,
  background: 'var(--accent-bg)',
  display: 'flex', alignItems: 'center', justifyContent: 'center'
}}>
  <Icon size={16} color="var(--accent)" />
</div>
```

---

## 12. Navigation

### Bottom Nav (glass pill)
- Fixed bottom with `env(safe-area-inset-bottom)` padding
- Glass blur effect via `.glass-bottom`
- Active item uses `--accent` color
- Inactive uses `--text-3`
- Icon + label below

### Top Header (glass sticky)
- Sticky top with `env(safe-area-inset-top)` padding
- Glass blur via `.glass-nav`
- App logo left + profile avatar right
- No hard border — only subtle separator

---

## 13. shadcn/ui Integration

### Install
```bash
npx shadcn@latest init
```

### `components.json` config
```json
{
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

### Override shadcn CSS variables to match our palette

Add to `globals.css` after the existing variables:

```css
/* shadcn/ui overrides — light */
:root {
  --background: 240 243 247;        /* --bg */
  --foreground: 18 21 36;           /* --text-1 */
  --card: 255 255 255;              /* --bg-card */
  --card-foreground: 18 21 36;
  --popover: 255 255 255;
  --popover-foreground: 18 21 36;
  --primary: 56 76 101;             /* Cello --accent */
  --primary-foreground: 255 255 255;
  --secondary: 245 246 250;         /* --bg-card-2 */
  --secondary-foreground: 56 76 101;
  --muted: 245 246 250;
  --muted-foreground: 122 139 160;  /* --text-3 */
  --accent: 237 240 247;            /* --accent-bg */
  --accent-foreground: 56 76 101;
  --destructive: 224 82 82;         /* --red */
  --destructive-foreground: 255 255 255;
  --border: 72 95 136 / 0.12;
  --input: 72 95 136 / 0.12;
  --ring: 56 76 101;
  --radius: 0.875rem;               /* --radius-lg */
}

/* shadcn/ui overrides — dark */
html.dark {
  --background: 18 21 36;           /* Black Russian */
  --foreground: 232 237 245;
  --card: 26 31 48;                 /* --bg-card */
  --card-foreground: 232 237 245;
  --popover: 34 40 64;
  --popover-foreground: 232 237 245;
  --primary: 157 172 204;           /* Echo Blue */
  --primary-foreground: 18 21 36;
  --secondary: 34 40 64;
  --secondary-foreground: 192 201 219;
  --muted: 34 40 64;
  --muted-foreground: 157 172 204;
  --accent: 30 38 64;
  --accent-foreground: 157 172 204;
  --destructive: 255 107 107;
  --destructive-foreground: 18 21 36;
  --border: 153 172 204 / 0.10;
  --input: 153 172 204 / 0.10;
  --ring: 157 172 204;
}
```

---

## 14. Do's and Don'ts

### ✅ Do
- Use CSS variables for ALL colors — never hardcode hex in components
- Use `0.5px` borders — not `1px`
- Use `var(--radius-lg)` for cards, `var(--radius-md)` for buttons/inputs
- Add `env(safe-area-inset-*)` padding to fixed elements
- Use system font — don't import Google Fonts
- Keep animations under 300ms
- Use `--separator` for dividers between list items
- Match icon color to context using CSS variables

### ❌ Don't
- Don't use pure black (`#000`) or pure white (`#fff`) for backgrounds in dark mode
- Don't use box-shadows for elevation — use background contrast
- Don't use colored backgrounds on page level — only on cards
- Don't use font sizes below 11px
- Don't use `border-radius > 24px` except for pills
- Don't add gradients except on the dashboard greeting card
- Don't use more than 2 accent colors per screen

---

## 15. Page-Specific Notes

### Login Page
- Full dark background `#121524` in dark mode
- Centered card with logo, biometric button, Google button
- No distracting gradients

### Dashboard
- Greeting card uses gradient: `from Cello #384c65 to Wedgewood #485f88`
- Cards for Seva, Laundry, Garbage below
- Glass header with profile avatar

### Seva / Grocery / Laundry / Members
- Gray page background (`--bg`)
- White cards (`--bg-card`) with subtle borders
- Section headers in uppercase `--text-3`
- Status badges using semantic colors

### Profile Panel
- Slides in from right
- iOS Settings style list groups
- Colored icon badges for each setting
- Toggle switches for dark mode and notifications