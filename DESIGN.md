---
name: Poultry Prophet
description: A practical batch-monitoring and review system for gamefowl farms.
colors:
  field-canopy-green: "#28633f"
  field-canopy-green-dark: "#b44a45"
  soft-farm-paper: "#f7f9f6"
  night-earth: "#1f1a17"
  surface-white: "#ffffff"
  night-card: "#2a2320"
  deep-green-ink: "#17211a"
  warm-paper-ink: "#f5efe4"
  muted-sage: "#eef3ee"
  muted-earth: "#3a302b"
  border-sage: "#d5ded4"
  border-night: "rgb(255 247 238 / 12%)"
  input-sage: "#b9c8ba"
  harvest-ochre: "#a66a08"
  harvest-gold: "#c6923b"
  barn-red: "#b42318"
  warning-clay: "#d26a32"
  accent-mist: "#e8f2ea"
  accent-earth: "#3f3029"
  accent-deep-green: "#1f5133"
typography:
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.375
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.025em"
rounded:
  sm: "7.2px"
  md: "9.6px"
  lg: "12px"
  xl: "16.8px"
  2xl: "21.6px"
  3xl: "26.4px"
  pill: "31.2px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.field-canopy-green}"
    textColor: "{colors.surface-white}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "44px"
  button-outline:
    backgroundColor: "{colors.soft-farm-paper}"
    textColor: "{colors.deep-green-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.deep-green-ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.deep-green-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "44px"
  nav-item-active:
    backgroundColor: "{colors.accent-mist}"
    textColor: "{colors.accent-deep-green}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
---

# Design System: Poultry Prophet

## Overview

**Creative North Star: "The Field Ledger"**

Poultry Prophet is a practical field ledger with the warmth of a working coop and the clarity of a farm watchtower. The incumbent interface keeps the record itself in the foreground: a light, paper-like canvas; clear green actions; compact cards; and enough hierarchy to help a manager review what happened without turning the farm into a control-room spectacle.

The system is practical, calm, clear, and trustworthy. It is designed for daily use by handlers with limited technical experience and for focused review by owners and managers. The visual language should stay plainspoken and low-friction: useful grouping, familiar controls, readable status, and restrained decoration. Avoid glossy ag-tech marketing, dense enterprise dashboards, futuristic “AI” styling, decorative farm illustrations, and an excess of scores, badges, or explanatory copy competing with the records.

**Key Characteristics:**

- Light, white-based surfaces with grounded farm greens and a small set of semantic status colors.
- Inter used consistently for a direct, highly legible voice.
- Thin borders and tonal layering establish grouping; shadows are reserved for meaningful elevation.
- Rounded controls and cards support touch use without making the interface playful or ornamental.
- Responsive desktop sidebar and mobile bottom navigation keep daily logging close at hand.

## Colors

The palette is a white-based farm register: Field Canopy Green carries action and positive emphasis, Soft Farm Paper keeps the canvas quiet, Harvest Ochre calls for attention, Barn Red marks risk or loss, and Deep Green Ink keeps text grounded. Dark mode shifts to warm earth surfaces while preserving the same semantic roles.

### Primary

- **Field Canopy Green** (`#28633f`): Primary actions, active navigation, positive emphasis, and the main chart series in the light theme.
- **Field Canopy Green — dark theme** (`#b44a45`): The dark-theme primary role, tuned against warm dark surfaces.

### Secondary

- **Harvest Ochre** (`#a66a08`): Ring and attention emphasis in the light theme, including review and warning-adjacent states.
- **Harvest Gold — dark theme** (`#c6923b`): The dark-theme attention and sidebar-primary role.

### Tertiary

- **Barn Red** (`#b42318`): Destructive actions, loss-oriented status, and high-risk emphasis in the light theme.
- **Warning Clay — dark theme** (`#d26a32`): The dark-theme destructive and warning role.

### Neutral

- **Soft Farm Paper** (`#f7f9f6`): Main light background.
- **Surface White** (`#ffffff`): Cards, popovers, and the light sidebar.
- **Deep Green Ink** (`#17211a`): Headings and primary light-theme text.
- **Muted Sage** (`#eef3ee`): Quiet grouping surfaces and secondary controls.
- **Border Sage** (`#d5ded4`): Thin grouping borders and dividers.
- **Input Sage** (`#b9c8ba`): Field borders before focus.
- **Accent Mist** (`#e8f2ea`): Active navigation and soft positive backgrounds.
- **Accent Deep Green** (`#1f5133`): Text on accent backgrounds.
- **Night Earth** (`#1f1a17`): Main dark-theme background.
- **Night Card** (`#2a2320`): Dark cards and popovers.

### Named Rules

**The Ledger Contrast Rule.** Use strong contrast for the primary action and important status, but keep most of the screen quiet so the recorded facts remain the visual priority.

## Typography

**Display Font:** Inter (with `ui-sans-serif`, `system-ui`, and `sans-serif` fallbacks)
**Body Font:** Inter (with `ui-sans-serif`, `system-ui`, and `sans-serif` fallbacks)
**Label/Mono Font:** No distinct mono face; labels and tabular values remain in Inter.

**Character:** Inter gives the system a direct, neutral voice that holds up on small mobile controls and compact review summaries. Weight and spacing do the hierarchy work rather than a decorative type pairing.

### Hierarchy

- **Headline** (700, `1.875rem`, `1.25` line-height): Page titles and primary route headings; typically reduced to `1.5rem` on smaller screens.
- **Title** (500, `1rem`, `1.375` line-height): Card titles, dialog titles, and section headings.
- **Body** (400, `0.875rem`, `1.5` line-height): Descriptions, records, helper text, and everyday controls.
- **Label** (600, `0.75rem`, `1` line-height, slight tracking): Compact metadata, chart labels, and occasional uppercase navigation or role labels.

### Named Rules

**The Plainspoken Type Rule.** Prefer short, readable labels and a clear weight step over display treatments, all-caps blocks, or ornamental typography.

## Layout

The desktop shell uses a fixed left sidebar of approximately `16rem` with a flexible content inset. The content area is centered where a focused page benefits from it (the dashboard uses a `max-w-5xl` container) and expands for analytics or data-entry surfaces. The main inset uses `p-4` on small screens, `sm:p-6`, `lg:p-8`, and `xl:p-10`; content receives safe bottom padding when the mobile action/navigation bar is present.

Spacing follows the Tailwind rhythm: `8px`, `12px`, `16px`, `24px`, and `32px` are the most common steps. Cards and form sections use stacked `gap-4` or `gap-6`; compact records use `gap-2` or `gap-3`. Desktop navigation collapses into a mobile sheet plus a fixed bottom navigation bar at the `md` breakpoint. Touch targets commonly use `44px` or `48px` minimum heights.

The layout favors one clear task per view, progressive disclosure for optional details, and responsive grids that move from one column to two or three only when the content remains scannable.

## Elevation & Depth

The system is layered and restrained. Most surfaces are flat light or dark tones separated by a thin border or a low-contrast ring. Cards use a subtle `ring-1 ring-foreground/10` treatment and frequently opt out of shadows. Shadows are meaningful state: dialogs and dropdowns use a modest shadow, settings cards may lift slightly on hover, and the mobile bottom navigation uses a stronger upward shadow because it overlays content.

### Shadow Vocabulary

- **Quiet card:** `ring 1px foreground/10`, with no shadow at rest; the default container treatment.
- **Interactive lift:** `shadow-sm` or `shadow-md` on settings and hoverable surfaces; use sparingly.
- **Overlay:** `shadow-md` for popovers and dropdowns; keep the surface opaque and legible.
- **Mobile dock:** `0 -8px 24px rgba(42, 36, 32, 0.12)` for the fixed bottom navigation.

### Named Rules

**The Selective Lift Rule.** Do not make every card float. Use borders and tonal surfaces for ordinary grouping; reserve visible shadows for overlays, active states, and the mobile dock.

## Shapes

The base radius is `0.75rem` (`12px`), with derived `rounded-lg` controls, `rounded-xl` cards and banners, and `rounded-2xl` touch-oriented panels and mobile actions. Badges and compact status chips use a pill-like `rounded-4xl` silhouette. Borders are thin and quiet in the light theme and translucent warm-white in dark mode. Inputs and buttons keep a sturdy rectangular silhouette with softened corners rather than circles or decorative cutouts.

## Components

### Buttons

- **Shape:** Rounded-lg (`12px`) by default; larger touch actions may use rounded-xl or rounded-2xl.
- **Primary:** Field Canopy Green with white text, `44px` default height, compact horizontal padding, and medium Inter weight.
- **Hover / Focus:** The primary shifts to a lower-opacity green on hover. All variants receive a visible ring/border focus treatment; active buttons translate down by one pixel.
- **Secondary / Ghost / Tertiary:** Outline uses the paper/background surface and Border Sage; secondary uses Muted Sage; ghost stays transparent until hover; destructive uses a soft Barn Red wash rather than a solid alarm block.

### Chips

- **Style:** Compact `20px`-high pill badges with `12px` text, minimal padding, and semantic background/text pairing.
- **State:** Default and secondary chips carry role or count information; outline chips preserve the quiet record-first tone; destructive chips are reserved for explicit risk.

### Cards / Containers

- **Corner Style:** Rounded-xl (`16.8px`) for the main card primitive; rounded-2xl for larger touch sections.
- **Background:** Surface White or Night Card, with Soft Farm Paper/Night Earth behind it.
- **Shadow Strategy:** Prefer the quiet card ring; use a small lift only when interaction or overlay depth requires it.
- **Border:** Thin Border Sage or the shared foreground ring; dashed borders signal empty or optional areas.
- **Internal Padding:** `16px` by default, `12px` for compact cards, and `20–24px` for mobile or review sections.

### Inputs / Fields

- **Style:** Transparent or theme-surface fill, `44px` minimum height, `12px` radius, Input Sage border, and `16px` readable text on mobile.
- **Focus:** Border shifts to Harvest Ochre/Ring and receives a `3px` low-opacity ring.
- **Error / Disabled:** Barn Red border/ring for invalid fields; disabled fields reduce opacity, block interaction, and use the input token for a quiet disabled fill.

### Navigation

- **Desktop:** White or Night Earth sidebar with a centered Poultry Prophet mark, farm name, role label, and a vertical list of large menu buttons. Active navigation uses Accent Mist/Accent Earth and a visible text/icon shift; alert counts use a Barn Red pill.
- **Mobile:** Compact top header with a sidebar trigger, farm/role context, and sync status; a fixed bottom navigation bar keeps the most common actions within thumb reach. The central logging action uses the primary green and a stronger shadow.
- **Behavior:** Manager-only routes are omitted for handlers, and the active route is always visible through tone and state, not color alone.

### Status & Sync Indicators

Offline, validation, error, and synchronization banners use semantic color plus text and icons. Pending, failed, and auth-required states expose the next action instead of relying on a dot or color-only signal.

## Do's and Don'ts

### Do:

- **Do** let batch records, history, and source facts command the hierarchy.
- **Do** use Field Canopy Green for primary actions and active states, keeping it purposeful rather than omnipresent.
- **Do** use thin borders and tonal backgrounds before adding a shadow.
- **Do** keep touch targets around `44px` or taller and preserve readable `16px` mobile field text.
- **Do** pair status color with a label, icon, or clear text explanation.
- **Do** preserve the calm Field Ledger voice across manager review and handler logging.

### Don't:

- **Don't** turn every card into a floating panel or add decorative elevation without hierarchy.
- **Don't** use glossy ag-tech gradients, futuristic AI motifs, or ornamental farm illustrations as primary interface language.
- **Don't** make badges, scores, indicators, or helper copy compete with the recorded facts.
- **Don't** rely on color alone to communicate offline, warning, error, inventory, or review state.
- **Don't** introduce a new font pairing or unrelated hue family without an explicit redesign decision.
