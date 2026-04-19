# DBT Leakage Detection System - Design System

This document outlines the visual identity, typography, color tokens, and UI principles for the DBT Leakage Detection System.

## 1. Design Philosophy
The system is designed for **Government Efficiency and High Trust**. It balances data-heavy administrative dashboards with intuitive, mobile-responsive field tools.
- **Modern & Premium**: Uses subtle gradients, smooth transitions, and professional color schemes.
- **Explainable**: Visual highlights are used to point to "evidence" behind risk scores.
- **Action-Oriented**: Focuses on "Prioritized Queues" rather than raw data tables.

## 2. Visual Tokens

### Color Palette
Managed via CSS variables in `globals.css`.

#### Primary Brand Colors (Emerald)
| Token | Hex | Usage |
| :--- | :--- | :--- |
| `--emerald-900` | `#064e3b` | Darkest accent, footer, dark gradients |
| `--emerald-800` | `#065f46` | Button hover states |
| `--emerald-700` | `#047857` | Primary brand, nav icons |
| `--emerald-600` | `#059669` | Secondary elements |
| `--emerald-500` | `#10b981` | Success states, positive metrics |
| `--emerald-400` | `#34d399` | Highlights, animations |
| `--emerald-300` | `#6ee7b7` | Light accents |
| `--emerald-200` | `#a7f3d0` | Background tints |
| `--emerald-100` | `#d1fae5` | Subtle highlights |
| `--emerald-50` | `#ecfdf5` | Lightest backgrounds |

#### Secondary Colors (Teal)
| Token | Hex | Usage |
| :--- | :--- | :--- |
| `--teal-500` | `#14b8a6` | Secondary actions |
| `--teal-400` | `#2dd4bf` | Accent highlights |

#### Neutral Colors (Slate)
| Token | Hex | Usage |
| :--- | :--- | :--- |
| `--slate-900` | `#0f172a` | Primary text, headings |
| `--slate-800` | `#1e293b` | Secondary headings |
| `--slate-700` | `#334155` | Body text emphasis |
| `--slate-600` | `#475569` | Body text |
| `--slate-500` | `#64748b` | Secondary text |
| `--slate-400` | `#94a3b8` | Placeholder text |
| `--slate-300` | `#cbd5e1` | Borders |
| `--slate-200` | `#e2e8f0` | Light borders |
| `--slate-100` | `#f1f5f9` | Background tints |
| `--slate-50` | `#f8fafc` | Lightest backgrounds |

#### Alert Colors
| Token | Hex | Usage |
| :--- | :--- | :--- |
| `--orange-500` | `#f97316` | Warning states |
| `--red-500` | `#ef4444` | Error, critical alerts |

#### Base Colors
| Token | Light Mode | Dark Mode | Usage |
| :--- | :--- | :--- | :--- |
| `--background` | `#ffffff` / `#F3F5F7` | - | Main page background |
| `--foreground` | `#171717` | `#ededed` | Primary text |
| `--card` | `#ffffff` | `#171717` | Surfaces & containers |
| `--primary` | `#3b82f6` | `#3b82f6` | Action buttons, active states |
| `--border` | `#e5e5e5` | `#262626` | Separators and input borders |

### Typography
- **Primary Font**: `Plus Jakarta Sans` (Google Fonts)
- **Weights**: 400 (Regular), 500 (Medium), 600 (Semibold), 700 (Bold)
- **Fallback**: `ui-sans-serif`, `system-ui`, `-apple-system`, `Segoe UI`, `Roboto`, `Helvetica Neue`
- **Usage**:
  - Headings: 600-700 weight, tight tracking
  - Body: 400-500 weight
  - Labels: 500 weight, small size

### Spacing System
- **Max Content Width**: `1180px`
- **Grid**: 2-column layout (md:grid-cols-2)
- **Gap**: `gap-6` between cards
- **Padding**: `px-4` mobile, `md:px-0` desktop

## 3. Components

### Navigation Bar
- Max width container with `mx-auto`
- Logo (40x40 rounded-lg icon) + brand name
- Center nav links (hidden on mobile)
- Right action buttons (Login, Sign Up)

### Hero Section
- 2-column grid layout
- Left: Headline + description + CTA + stats
- Right: Animated feature cards

### Feature Cards
Four card types with unique gradients:
1. **Security Card**: `from-emerald-900 to-emerald-800` - fraud detection features
2. **Multi-Scheme Card**: `from-teal-400 to-emerald-500` - cross-scheme features
3. **Metrics Card**: White background with bar chart - revenue/leakage stats
4. **Alert Card**: `from-orange-500 to-red-500` - warning states

### Buttons
- **Primary (SoftButton)**: `rounded-full`, emerald-900 background, white text
- **Secondary**: Transparent with hover state
- **Border**: Rounded-full or rounded-xl

### Animations
- **Motion.div**: Fade-in with upward slide (`opacity: 0 → 1`, `y: 20 → 0`)
- **Staggered delays**: 0.1s, 0.2s, 0.3s, 0.4s for card sequencing
- **MiniBars**: Spring animation for chart bars
- **Pulse animation**: Box-shadow pulse for emphasis

## 4. Page Routes
| Route | Description |
| :--- | :--- |
| `/` | Landing page with brand hero and feature cards |
| `/login` | Sign-in page with testimonials |
| `/signup` | Registration page |
| `/dashboard` | (Future) DFO investigation queue |
| `/heatmap` | (Future) State risk heatmap |

## 5. Implementation Notes
- **Tailwind CSS v4**: Uses `@theme` directive in CSS
- **Framer Motion**: For complex animations
- **Lucide Icons**: Consistent iconography
- **Client Components**: Auth and interactive pages marked with `"use client"`
- **Server Components**: Landing/static pages for performance