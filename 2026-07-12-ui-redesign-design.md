# CIT Evaluation System — UI Redesign Spec

Status: Approved
Date: 2026-07-12

## Goal

Full visual and interaction redesign of the CIT Evaluation System, covering admin pages,
faculty pages (restyle only), the template builder, and the student evaluate flow.
Must be fully responsive with mobile as the primary target (students mainly use phones),
free of "AI slop" visual clichés, and animated in a deliberate, restrained way.

## Brand Identity

Source: University of the Assumption (San Fernando, Pampanga) seal — navy/gold/red/white,
torch/flame motif, motto "Scientia · Virtus · Communitas" (Knowledge · Virtue · Community).

## Design Tokens

**Color**
- Primary Navy: `#0B2265`
- Accent Gold: `#F4B400`
- Alert/Destructive Crimson: `#C8102E`
- Light background: `#FAFAF8` (warm white)
- Dark background: `#0A0E1A` (deep navy-black)
- Flame gradient (orange → gold): reserved as a signature accent only, not for general UI

**Typography**
- Display/headings: serif with institutional gravitas (e.g. Fraunces or Source Serif 4)
- Body/data: clean grotesk (e.g. Inter or Geist)
- Eyebrow labels: small caps / letterspaced, referencing the seal's motto styling

**Motion**
- Framer Motion (`motion/react`) for orchestrated transitions: page loads, route changes,
  drag-reorder in template builder
- CSS transitions (150–200ms) for micro-interactions: hover, focus, toggle states
- `prefers-reduced-motion` must be respected everywhere (required, not optional)

**Shape/Elevation**
- Moderate border radius (not full-pill "AI slop" shapes)
- Single-layer soft shadows, hairline borders
- Reads institutional, not generic consumer-app

**Dark mode**: supported, using the token pairs above.

## Shared Primitives (build once, reuse across all pages)

- `AppShell` — sidebar (admin/faculty), collapses to drawer/bottom-nav on mobile; minimal
  top bar for student-facing pages
- `Card` — consistent padding/shadow/radius across professor cards, template cards, summaries
- `Button` — primary (gold-on-navy or navy-on-white), ghost, destructive (crimson), consistent
  hover/press micro-interaction
- `Input` / `Select` / `RadioGroup` / `CheckboxGroup` / `ScaleInput` (0–4) — bound to
  react-hook-form + zod
- `ProgressBar` — reused by template-builder save state and evaluate flow's cluster stepper
- `ClusterStepper` — new, evaluate-flow-specific: mobile-first, sticky bottom Back/Next nav,
  top progress indicator, one `CriterionCluster` per screen
- `DragHandle` / `SortableItem` — Framer Motion `Reorder`-based, for template builder
- `Modal` / `Toast` — confirmations and feedback

## Page Plan (priority order)

1. **Evaluate page** — `app/(student)/evaluate/StudentEvaluateClient.tsx` +
   `DynamicQuestionRenderer`. Highest priority: highest traffic, mobile-critical.
   Cluster-per-screen flow via `ClusterStepper`, sticky progress bar, 44px+ tap targets,
   tactile 0–4 scale selector (not a cramped radio row).
2. **Admin dashboard shell + main page** — `app/(admin)/admin/layout.tsx`,
   `app/(admin)/admin/page.tsx`. Sidebar → collapsible drawer on mobile. Stat cards with
   subtle count-up animation on load.
3. **Template builder** — `app/(admin)/admin/templates/[templateId]/page.tsx`. Drag-and-drop
   cluster/criteria reordering, inline add/edit, autosave feedback via `Toast`.
4. **Templates list + Department management** — `app/(admin)/admin/templates/page.tsx`,
   `app/(admin)/admin/management/page.tsx`. Tables collapse into stacked cards under `md`
   breakpoint — no horizontal-scroll tables on mobile.
5. **Faculty pages** — restyle pass only, reusing primitives from steps 1–4. No new logic.

## Responsiveness Strategy

- Mobile-first Tailwind (`base → sm → md → lg`), tested at 375px as the primary breakpoint
- Sidebars → bottom sheets/drawers under `md`
- Tables → stacked cards under `md`
- Minimum 44px touch targets (WCAG/Apple HIG)

## "No AI Slop" Checklist

- No emojis anywhere — use `lucide-react` icons
- No generic gradient hero banners, no purple-to-pink gradients
- No overused fully-rounded pill buttons
- No filler/marketing copy ("Unlock your potential") — plain, functional copy per
  frontend-design skill writing guidance
- No numbered-marker decoration (01/02/03) unless content is a genuine sequence

## Out of Scope

- New backend logic, schema changes, or new faculty-facing features (faculty pages are
  restyle-only per existing functionality)
- Auth/permissions changes

## Testing / Quality Bar

- Responsive down to 375px width on every redesigned page
- Visible keyboard focus states on all interactive elements
- `prefers-reduced-motion` respected
- Dark mode parity for all redesigned pages
