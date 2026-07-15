# Exporting Features & Usability Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement CSV/PDF export features on the key reports, make Ratings Ledger names clickable, and fix the faculty console loading-state reload flash.

**Architecture:** Add standard client-side CSV download handlers, integrate `jspdf` and `html2canvas` for browser-based PDF generation of tables/charts, add links to the Ratings Ledger table, and set `isLoading` state default to true on the faculty console dashboard.

**Tech Stack:** React, Next.js, TailwindCSS, jsPDF, html2canvas, Prisma

## Global Constraints
- Do not install any extra packages besides `jspdf` and `html2canvas`.
- Retain all current design semantics (deep navy, gold, and warm white UA Primatives palette).
- Maintain all existing Next.js App Router rules.

---

### Task 1: Scaffolding and Usability Fixes

**Files:**
- Modify: `app/(faculty)/faculty/page.tsx`
- Modify: `app/(admin)/admin/page.tsx`

**Interfaces:**
- Consumes: None
- Produces: Correct default loading state for faculty dashboard, and click-navigation from the admin ratings ledger to faculty profiles.

- [ ] **Step 1: Install Dependencies**
  Run: `npm.cmd install jspdf html2canvas`
  Expected: Installation finishes successfully and writes packages to `package.json`.

- [ ] **Step 2: Correct loading-state default in Faculty console**
  Modify: `app/(faculty)/faculty/page.tsx` to set the default `isLoading` state hook to `true`.
  Code:
  ```typescript
  const [isLoading, setIsLoading] = useState(true);
  ```

- [ ] **Step 3: Wrap Ratings Ledger faculty name in Link**
  Modify: `app/(admin)/admin/page.tsx` to wrap the faculty name cell under the `ratings` view in a `<Link href={\`/admin/faculty/\${rank.id}\`}>` component.
  Code:
  ```tsx
  <td className="p-4 text-sm font-bold text-foreground">
    <Link href={`/admin/faculty/${rank.id}`} className="hover:text-ua-gold hover:underline transition-all">
      {rank.name}
    </Link>
  </td>
  ```

- [ ] **Step 4: Verify and commit**
  Verify the project compiles using `npm run build`.
  Run: `git add package.json app/`
  Run: `git commit -m "feat: install dependencies and apply usability improvements"`

---

### Task 2: CSV/PDF Exporters implementation for Ratings, Attendance, and Audit Ledgers

**Files:**
- Modify: `app/(admin)/admin/page.tsx`

**Interfaces:**
- Consumes: `jspdf` and `html2canvas` packages
- Produces: Live CSV and PDF export options for Ratings, Attendance, and Audit Logs on the admin console dashboard.

- [ ] **Step 1: Add PDF Export Utility**
  Create/implement client-side functions in `app/(admin)/admin/page.tsx` to export logs/tables.
  For CSV, construct string rows and download using a Blob.
  For PDF, use `jsPDF` to construct table logs:
  ```typescript
  import { jsPDF } from 'jspdf';
  // create new document, add content, save file
  ```

- [ ] **Step 2: Connect Export controls in UI**
  Under each relevant tab on the admin console:
  - **Ratings Ledger**: Add export controls to download as CSV/PDF.
  - **Attendance Logs**: Add a PDF download action alongside the CSV export.
  - **Audit Logs**: Add Export CSV & PDF buttons.

- [ ] **Step 3: Verify and commit**
  Verify the project compiles using `npm run build`.
  Commit changes to git.

---

### Task 3: Export features for Faculty Analytics Profile Dashboards

**Files:**
- Modify: `app/(admin)/admin/faculty/[professorId]/FacultyPreviewClient.tsx`
- Modify: `app/(faculty)/faculty/page.tsx`

**Interfaces:**
- Consumes: Task 2 PDF/CSV modules
- Produces: Styled CSV and PDF export operations for the individual faculty profiles.

- [ ] **Step 1: Faculty Preview Dashboard (Admin View)**
  Add Export CSV & PDF buttons in `FacultyPreviewClient.tsx` to export scores/comments (CSV) and capture/export the visual dashboard report using `html2canvas` (PDF).

- [ ] **Step 2: Faculty Dashboard (Faculty View)**
  Add similar Export CSV & PDF buttons in `app/(faculty)/faculty/page.tsx`.

- [ ] **Step 3: Verify build**
  Run: `npm run build` to confirm everything is clean and compiles without issues.

- [ ] **Step 4: Commit**
  Run: `git commit -m "feat: implement profile dashboards export functionality"`
