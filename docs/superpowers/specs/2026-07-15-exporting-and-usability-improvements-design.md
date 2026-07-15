# Design Spec: Exporting Features & Usability Improvements

## 1. Goals & Requirements
The goal of this project is to implement comprehensive CSV/PDF export features for the UA Evaluation system, make the ratings ledger navigable, and resolve a reload flashing bug on the faculty console dashboard.

### Core Deliverables:
1. **Exporting Ledger Reports (CSV & PDF)**:
   - **Faculty Ratings Ledger** (Admin Ratings tab): Export current/filtered ledger records.
   - **Evaluation Attendance Logs** (Admin Logs tab): Add PDF export and maintain/enhance CSV export.
   - **Audit Logs** (Admin Logs tab): Export current logs.
2. **Exporting Individual Faculty Profiles (CSV & PDF)**:
   - Export overall scores, radar/bar chart datasets, and qualitative AI narrative summaries.
3. **Ratings Ledger Interactive Navigation**:
   - Wrap names in the ratings ledger table with links leading directly to `/admin/faculty/[professorId]`.
4. **Faculty Dashboard Load-Flash Fix**:
   - Correct loading states to prevent momentary "Access Denied" or "Portal Suspended" flashes on reload.

---

## 2. Architecture & Technologies
- **PDF Generation**: Client-side conversion via `jspdf` and `html2canvas`. This compiles a capture of target DOM element references (e.g. dashboards, charts, tables) into formatted multi-page PDFs.
- **CSV Generation**: Standard client-side base64/UTF-8 URI generation and download trigger.
- **Routing & Rendering**: Next.js App Router dynamic page links and standard hooks.

---

## 3. Implementation Details

### A. Dependency Setup
```bash
npm install jspdf html2canvas
```

### B. Usability Enhancements
1. **Faculty Console Flashing Fix**:
   - In `app/(faculty)/faculty/page.tsx`, initialize `isLoading` to `true` (instead of `false`). This shows the syncing workspace indicator on reload until auth/sync finishes.
2. **Interactive Ratings Ledger**:
   - In `app/(admin)/admin/page.tsx`, wrap the name cell of the ledger table with a Next.js `<Link href={`/admin/faculty/${rank.id}`}>` component.

### C. CSV and PDF Export Implementations
1. **ratings ledger / attendance logs / audit logs**:
   - Create client-side export functions using standard table structures.
   - For PDF, capture the table containers or render optimized layouts.
2. **faculty profiles (Admin Faculty Preview & Faculty dashboard)**:
   - Render download buttons at the top of the analytics screens.
   - Export CSV containing performance numbers and raw comment text.
   - Export PDF by running `html2canvas` over the charts and narrative blocks, rendering high-resolution images inline in a `jsPDF` document.

---

## 4. Verification and Testing
- **TypeScript & Linting**: Run `npm run build` to verify no typing or compilation failures occur.
- **Functional Testing**:
   - Reload the faculty page to verify the "Access Denied" flash is gone.
   - Verify names in the ratings ledger link to the correct detail views.
   - Trigger CSV and PDF downloads for all ledgers and dashboards, confirming correct data and styling.
