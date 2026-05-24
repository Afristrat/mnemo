---
name: Mnémo Brand Identity
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3d4947'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6d7a77'
  outline-variant: '#bcc9c6'
  surface-tint: '#006a61'
  primary: '#00685f'
  on-primary: '#ffffff'
  primary-container: '#008378'
  on-primary-container: '#f4fffc'
  inverse-primary: '#6bd8cb'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#7d5400'
  on-tertiary: '#ffffff'
  tertiary-container: '#9d6a00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#89f5e7'
  primary-fixed-dim: '#6bd8cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#005049'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#ffddb0'
  tertiary-fixed-dim: '#ffba46'
  on-tertiary-fixed: '#281800'
  on-tertiary-fixed-variant: '#614000'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.03em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-margin: 24px
  element-gap: 20px
  section-padding: 40px
  grid-gutter: 24px
---

## Brand & Style

The design system is engineered for a B2B Sovereign AI Data Infrastructure audience, prioritizing **engineering credibility, transparency, and premium stability**. The brand personality is authoritative yet accessible, positioned as the "memory layer" of an organization. 

The visual style is **Corporate Modern with Technical Precision**. It avoids decorative flourishes in favor of structured data visualization, clear hierarchies, and high-performance layouts. The emotional response should be one of "sovereign control"—users must feel that their data is secure, localized, and architecturally sound. 

Visual metaphors focus exclusively on **cloud infrastructure, data persistence layers, and AI logic flows**. All French typography must maintain proper grammatical accents on uppercase characters (e.g., É, À) to uphold professional standards.

## Colors

The palette is rooted in a "Clean Technical" spectrum. The background utilizes a cool-toned slate white (`#F8FAFC`) to reduce eye strain during long engineering sessions, while surfaces use pure white (`#FFFFFF`) to delineate data containers.

- **Primary Accent (Teal):** Used for core actions and "Sovereign" status indicators.
- **Secondary Accent (Blue):** Dedicated to technical networking, cloud infrastructure, and AI processing states.
- **Premium (Gold):** Reserved for advanced intelligence features and tier-based insights.
- **Alerts:** Success and Error colors are saturated to ensure immediate recognition against the neutral UI.

## Typography

This design system employs a three-tiered font strategy to balance impact with utility:

1.  **Space Grotesk (Headings):** Used for all structural titles. Tracking is tightened to create a dense, modern "tech" aesthetic.
2.  **Inter (Body/UI):** The workhorse for all interface elements, ensuring maximum readability and accessibility across density levels.
3.  **JetBrains Mono (Technical Data):** Mandatory for all numerical data, API keys, logs, and infrastructure paths.

Ensure that the tagline—*"La base mémorielle souveraine qui grandit avec votre organisation — sans migration, sans verrouillage, sans coûts cachés."*—always utilizes `body-lg` for maximum clarity.

## Layout & Spacing

The layout follows a **Fixed-Fluid Hybrid** model. Content is contained within a maximum width of 1440px for desktop to maintain readability, while utilizing a 12-column grid.

- **Rhythm:** A base-4 unit system is used, but primary spacing is anchored on **20px** and **24px** to create an "airy" feel that prevents information density from becoming overwhelming.
- **Breakpoints:**
  - *Mobile:* 4-column grid, 16px margins.
  - *Tablet:* 8-column grid, 20px margins.
  - *Desktop:* 12-column grid, 24px margins.

## Elevation & Depth

Hierarchy is established through **Tonal Layering and Soft Shadows** rather than heavy depth effects.

- **Base Layer:** `#F8FAFC` background.
- **Surface Layer:** White cards with a `1px` solid border in `#E2E8F0`. This "Flat-plus" approach emphasizes the structural integrity of the data infrastructure.
- **Shadows:** A single, consistent elevation style is used for floating elements (menus, tooltips, active cards): `0 1px 3px rgba(15, 23, 42, 0.06)`. This subtle shadow provides enough lift without breaking the clean, sovereign aesthetic.

## Shapes

The shape language reflects a balance between modern SaaS approachability and industrial precision:

- **Cards:** Defined at `14px` radius to provide a distinct, premium framing for data.
- **Input Fields:** Defined at `10px` to differentiate interactive areas from layout containers.
- **Buttons:** Use "Full Pill" (9999px) shapes. This high degree of rounding for primary actions makes them instantly recognizable as interactive against the more geometric, rectangular layout of the data infrastructure components.

## Components

- **Buttons:** High-contrast pills. Primary uses `#0D9488` with white text. Secondary uses a ghost style with `#E2E8F0` borders and `#0F172A` text.
- **Input Fields:** `10px` radius, `1px` border in `#E2E8F0`. On focus, the border transitions to Primary Teal with a subtle 2px outer glow.
- **Data Cards:** `14px` radius, white background, `1px` border. Headers within cards should use `headline-md` in Space Grotesk.
- **Status Chips:** Small, semi-rounded chips using low-opacity versions of the Status/Primary colors with high-contrast text.
- **Monospace Tickers:** Used for live-streaming AI data processing. Housed in `#0F172A` (dark) containers with JetBrains Mono text in teal or gold for high visibility.
- **Navigation:** Vertical sidebar for infrastructure-heavy views; horizontal top bar for high-level organization switching.