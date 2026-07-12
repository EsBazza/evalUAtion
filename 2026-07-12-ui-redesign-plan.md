# CIT Evaluation System — UI Redesign Implementation Plan

**Goal:** Redesign the entire UI (admin, faculty, template builder, student evaluate flow)
around the University of the Assumption brand, mobile-first and responsive, with a
deliberate motion system and no generic "AI slop" patterns.

**Architecture:** Token-and-primitives-first approach. Establish design tokens and ~8 shared
components once (built on the existing Tailwind v4 + shadcn/ui stack), then move through
pages in priority order, each page consuming the shared primitives rather than reinventing
styles.

**Tech Stack:** Next.js 16.2 (App Router), TypeScript strict, Tailwind CSS v4, shadcn/ui,
Framer Motion (`motion/react`), react-hook-form + zod, lucide-react.

**Reference spec:** `docs/superpowers/specs/2026-07-12-ui-redesign-design.md`

## Global Constraints

- Colors: Navy `#0B2265`, Gold `#F4B400`, Crimson `#C8102E`, light bg `#FAFAF8`, dark bg `#0A0E1A`
- No emojis — `lucide-react` icons only
- Minimum 44px touch targets on all interactive elements
- `prefers-reduced-motion` must be respected on every animation
- Mobile-first Tailwind breakpoints, tested at 375px width minimum
- Dark mode parity required on every redesigned page
- No new backend logic, schema changes, or faculty-facing features — faculty pages are
  restyle-only

---

## Phase 0 — Foundation

### Task 1: Design tokens in `globals.css`

**Files:**
- Modify: `app/globals.css`

**Steps:**
- [ ] Define CSS custom properties for the full light/dark token pairs (color, radius,
  shadow) under `:root` and `.dark`
- [ ] Import display font (e.g. Fraunces) and body font (e.g. Inter or Geist) via
  `next/font`, expose as `--font-display` / `--font-body`
- [ ] Add a `prefers-reduced-motion` global rule disabling/shortening transitions
- [ ] Verify build: `npm run dev`, confirm no CSS errors, toggle dark mode manually to
  confirm variables switch
- [ ] Commit: `git commit -m "style: establish UA brand design tokens"`

### Task 2: Install and configure Framer Motion

**Files:**
- Modify: `package.json`

**Steps:**
- [ ] `npm install motion`
- [ ] Create `lib/motion.ts` exporting shared variants (`fadeInUp`, `staggerChildren`,
  `pageTransition`) so every page imports the same easing/duration values instead of
  redefining them
- [ ] Commit: `git commit -m "chore: add framer motion and shared motion variants"`

### Task 3: Core primitives

**Files:**
- Create: `components/ui-ua/button.tsx`
- Create: `components/ui-ua/card.tsx`
- Create: `components/ui-ua/progress-bar.tsx`
- Create: `components/ui-ua/modal.tsx`
- Create: `components/ui-ua/toast.tsx`

**Steps:**
- [ ] Build each on top of the existing shadcn/ui primitives, restyled with the new tokens
  (do not fork shadcn's logic, just its styling props/className)
- [ ] Each component supports light/dark via the CSS variables from Task 1
- [ ] Add Storybook-less manual test page at `app/(dev)/ui-preview/page.tsx` rendering all
  variants for visual QA (delete or gate behind env flag before production)
- [ ] Commit: `git commit -m "feat: add core UA-branded UI primitives"`

---

## Phase 1 — Student Evaluate Flow (highest priority)

### Task 4: `ClusterStepper` primitive

**Files:**
- Create: `components/ui-ua/cluster-stepper.tsx`

**Interfaces:**
- Consumes: `ProgressBar` from Task 3
- Produces: `ClusterStepper` component with props
  `{ clusters: CriterionCluster[]; currentIndex: number; onNext: () => void; onBack: () => void; children: ReactNode }`

**Steps:**
- [ ] Build sticky bottom nav (Back/Next), top `ProgressBar` bound to `currentIndex / clusters.length`
- [ ] Animate cluster transitions with `motion.div` + the `pageTransition` variant from Task 2
- [ ] Disable "Next" until all `isMandatory` criteria in the current cluster are answered
- [ ] Commit: `git commit -m "feat: add ClusterStepper for evaluate flow"`

### Task 5: `ScaleInput` (0–4 tactile selector)

**Files:**
- Create: `components/ui-ua/scale-input.tsx`

**Steps:**
- [ ] Build a 5-option tactile control (large tap targets, 44px min) bound to
  react-hook-form via `Controller`
- [ ] Add press micro-interaction (scale/opacity on select) respecting reduced-motion
- [ ] Commit: `git commit -m "feat: add ScaleInput for 0-4 criterion scoring"`

### Task 6: Redesign `DynamicQuestionRenderer`

**Files:**
- Modify: `app/(student)/evaluate/DynamicQuestionRenderer.tsx`

**Steps:**
- [ ] Swap existing inputs for `ScaleInput` (SCALE type), restyled radio/checkbox groups
  (RADIO/CHECKBOX types), and a redesigned textarea (TEXT type) using Task 3 primitives
- [ ] Verify against all `QuestionType` variants in the schema
- [ ] Manual test: render each question type at 375px width, confirm no horizontal overflow
- [ ] Commit: `git commit -m "style: redesign DynamicQuestionRenderer with UA primitives"`

### Task 7: Redesign `StudentEvaluateClient`

**Files:**
- Modify: `app/(student)/evaluate/StudentEvaluateClient.tsx`

**Steps:**
- [ ] Wrap the cluster list in `ClusterStepper` from Task 4
- [ ] Replace loading/submitting state with the `Toast` primitive for save/submit feedback
- [ ] Add completion screen (post-submit) using the flame/torch motif as the signature
  moment — sparingly, once
- [ ] Manual test at 375px: complete a full evaluation end-to-end, confirm progress bar
  updates and mandatory-field gating works
- [ ] Commit: `git commit -m "style: redesign student evaluate flow"`

---

## Phase 2 — Admin Dashboard Shell

### Task 8: `AppShell` primitive

**Files:**
- Create: `components/ui-ua/app-shell.tsx`

**Steps:**
- [ ] Build sidebar for `md`+ screens, collapsing to a slide-in drawer (triggered by
  hamburger) under `md`
- [ ] Animate drawer open/close with `motion.div` + AnimatePresence
- [ ] Commit: `git commit -m "feat: add responsive AppShell primitive"`

### Task 9: Wire `AppShell` into admin layout

**Files:**
- Modify: `app/(admin)/admin/layout.tsx`

**Steps:**
- [ ] Replace existing sidebar layout with `AppShell`
- [ ] Manual test at 375px and 1280px widths: confirm drawer works on mobile, sidebar fixed
  on desktop
- [ ] Commit: `git commit -m "style: adopt AppShell in admin layout"`

### Task 10: Redesign admin main page

**Files:**
- Modify: `app/(admin)/admin/page.tsx`

**Steps:**
- [ ] Rebuild stat cards with `Card` primitive
- [ ] Add count-up animation on stat numbers using the motion variants from Task 2,
  triggered once on mount (not on every re-render)
- [ ] Commit: `git commit -m "style: redesign admin dashboard main page"`

---

## Phase 3 — Template Builder

### Task 11: `SortableItem` / `DragHandle` primitives

**Files:**
- Create: `components/ui-ua/sortable-item.tsx`

**Steps:**
- [ ] Use Framer Motion's `Reorder.Group` / `Reorder.Item` for drag-and-drop reordering
- [ ] Persist new `order` values via existing server action on drag end
- [ ] Commit: `git commit -m "feat: add drag-and-drop SortableItem primitive"`

### Task 12: Redesign template builder page

**Files:**
- Modify: `app/(admin)/admin/templates/[templateId]/page.tsx`

**Steps:**
- [ ] Wire `SortableItem` into cluster and criterion lists
- [ ] Add inline add/edit using `Modal` primitive
- [ ] Add autosave `Toast` feedback on successful reorder/edit
- [ ] Manual test at 375px: confirm drag works via touch, or provide an up/down button
  fallback for touch devices if drag gestures prove unreliable on mobile
- [ ] Commit: `git commit -m "style: redesign template builder with drag-and-drop"`

---

## Phase 4 — Lists and Tables

### Task 13: Redesign templates list

**Files:**
- Modify: `app/(admin)/admin/templates/page.tsx`

**Steps:**
- [ ] Replace table with `Card`-based list that collapses to stacked cards under `md`
- [ ] Commit: `git commit -m "style: redesign templates list, responsive card layout"`

### Task 14: Redesign department management page

**Files:**
- Modify: `app/(admin)/admin/management/page.tsx`

**Steps:**
- [ ] Same stacked-card pattern as Task 13, applied to department/user management views
- [ ] Commit: `git commit -m "style: redesign department management, responsive card layout"`

---

## Phase 5 — Faculty Pages (restyle only)

### Task 15: Restyle faculty-facing pages

**Files:**
- Modify: faculty page(s) under the faculty route group (confirm exact path in codebase —
  not listed in current README task list)

**Steps:**
- [ ] Apply `AppShell`, `Card`, `Button` primitives from Phases 0–2 — no new logic
- [ ] Manual test at 375px
- [ ] Commit: `git commit -m "style: restyle faculty pages with UA primitives"`

---

## Phase 6 — Quality Pass

### Task 16: Accessibility and motion audit

**Steps:**
- [ ] Tab through every redesigned page, confirm visible focus rings on all interactive
  elements
- [ ] Toggle OS-level "reduce motion" and confirm all animations shorten/disable
- [ ] Toggle dark mode on every redesigned page, confirm no unstyled/low-contrast elements
- [ ] Commit any fixes: `git commit -m "fix: accessibility and reduced-motion audit fixes"`

### Task 17: Remove dev-only preview page

**Files:**
- Delete: `app/(dev)/ui-preview/page.tsx` (from Task 3), or gate behind
  `process.env.NODE_ENV !== 'production'`

**Steps:**
- [ ] Remove or gate the page
- [ ] Commit: `git commit -m "chore: remove dev-only UI preview page"`

---

## Self-Review Notes

- Spec coverage: tokens (Task 1), motion (Task 2), all 8 primitives (Tasks 3–5, 8, 11),
  all 5 pages in priority order (Tasks 6–7, 9–10, 12, 13–14, 15), responsiveness and a11y
  bar (Task 16) — all covered.
- Faculty page exact file path is unconfirmed against the actual repo (README didn't list
  it) — Task 15 explicitly flags this for the implementer to verify first.
