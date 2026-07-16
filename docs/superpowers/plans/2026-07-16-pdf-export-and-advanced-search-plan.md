# Implementation Plan: PDF Export & Advanced Search

This plan details the implementation of UA branded, non-cutting PDF exports and the Ratings Ledger Advanced Search filter panel.

---

## Task 1: Create PDF Branding Utilities (`lib/pdfUtils.ts`)
We will create a helper utility to centralize canvas watermark pre-processing and native header/footer vector drawing.

### Steps:
1. **Create Utility File**: Create [pdfUtils.ts](file:///C:/Users/admin/Desktop/evalUAtion/lib/pdfUtils.ts).
2. **Implement `loadAndFadeImage`**: Load an image path (like `/bg.jpg` or `/ua-logo.png`) into an HTML Image object, render it with standard canvas contexts using `globalAlpha` for fading, and export as a Base64 URL.
3. **Implement `drawBrandedLayout`**: Native vector-drawing helper using `jsPDF` commands:
   - Faded watermark in the center of the page.
   - Navy Blue (`#0B2F64`) title banner and Gold (`#D4AF37`) lines.
   - University logo and title text in the header.
   - Page numbers ("Page X") and date/time footer.

### Verification:
- Import `loadAndFadeImage` in a console test to verify that the generated base64 image matches the opacity specification.

---

## Task 2: Rebuild Vector Table PDF Export
Rebuild `exportToPDF` in [page.tsx](file:///C:/Users/admin/Desktop/evalUAtion/app/(admin)/admin/page.tsx) to draw rows natively with automatic text wrapping.

### Steps:
1. **Dynamic Text Wrap Helper**: Write a helper to measure string widths using `doc.getTextWidth` and split long text arrays into multi-line rows.
2. **Re-implement `exportToPDF`**:
   - Compute column width constraints dynamically based on document boundaries.
   - Pre-calculate total page count by doing a dry-run layout pass (needed for "Page X of Y" footer).
   - Draw table rows with alternating white and light-blue zebra backgrounds.
   - Detect page-boundary crossings (`y > pageHeight - margin`) to automatically print footers, call `doc.addPage()`, and draw the next page header.
3. **Update Call Sites**: Verify all caller functions (Ratings, Attendance, Audit logs) await `exportToPDF`.

### Verification:
- Trigger PDF downloads for Ratings, Attendance, and Audit Logs.
- Check that long text wrap cleanly onto new lines and do not truncate with ellipses (`...`).

---

## Task 3: Rebuild Faculty Profile PDF Exporter (Sectional DOM Capture)
Update `exportFacultyPDF` in [exports.ts](file:///C:/Users/admin/Desktop/evalUAtion/lib/exports.ts) to screenshot widgets individually and place them page-by-page.

### Steps:
1. **Identify Widget Cards**: Target individual CSS selectors (`#report-header`, `#report-charts`, `#report-sentiment`, `#report-comments`).
2. **Card Rendering Engine**:
   - Capture each card separately via `html2canvas`.
   - Iterate through cards, tracking remaining space on the current PDF page.
   - If a card does not fit in the remaining space, call `doc.addPage()` to place it on the next page, drawing headers, watermark, and footers.
3. **Styling Integration**: Apply the UA logo header, watermark background, and border accents.

### Verification:
- Download the Faculty Profile PDF from both the Admin Preview and Faculty Console.
- Ensure no charts or comment lines are cut horizontally in half at the page breaks.

---

## Task 4: Ratings Ledger Advanced Search
Implement name/email search and a collapsible multi-filter panel for the Ratings Ledger.

### Steps:
1. **Introduce React States**:
   - `ratingsSearch` (string): text input search.
   - `selectedRatingsDepts` (string[]): array of active department filter ids.
   - `selectedRatingsLevels` (string[]): array of active level filters (`COLLEGE`, `BASIC_ED`).
   - `isRatingsAdvancedSearchOpen` (boolean): toggles visibility of the advanced panel.
2. **Update Filter Computation**: Replace `filteredRankings` mapping with a concurrent filter covering search query, educational level, and individual department names.
3. **Insert Search Bar UI**:
   - Add a search input and Sliders icon button for "Advanced Search" right above the Ratings table.
   - Implement the collapsible filtering card showing checkboxes for Levels and Departments.

### Verification:
- Search for a specific professor by name or email.
- Check and uncheck specific departments (e.g. College of Computer Studies) and confirm only matching professors show up.
