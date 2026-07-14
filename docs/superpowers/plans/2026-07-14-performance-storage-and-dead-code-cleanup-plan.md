# Performance, Storage & Dead-Code Cleanup — Implementation Plan

Status: Approved
Date: 2026-07-14

## Step 1: Database Clean & Reseed

### 1.1 Update `prisma/seed.js` Cleanup
- Add `prisma.secureEvaluation.deleteMany()` and `prisma.evaluationReceipt.deleteMany()` at the very beginning of the seed script to ensure no foreign key leaks exist.

### 1.2 Implement Dynamic Section Access Codes in `prisma/seed.js`
- Inline the `buildSectionCode`, `getDeptAbbreviation`, `formatAcademicYear`, and `formatSemester` helper functions matching our `lib/codegen.ts` specs.
- Update the section creation loop to generate access codes using:
  - `JHS` for Junior High School level
  - `SHS` for Senior High School level
  - `COA`, `CEA`, `CIT`, `SBPA`, `CONP`, `CHTM`, `SAS`, `SED` for the respective College departments
  - A random 4-character segment, semester, and academic year.

### 1.3 Reset Database & Run Seed
- Execute database wipe and seed to populate the tables with clean, structured, and prefix-compliant section access codes:
  ```bash
  npx prisma db push --force-reset
  npx prisma db seed
  ```

---

## Step 2: Package & Dead Code Cleanup

### 2.1 Audit with `depcheck`
- Execute `npx depcheck` to find any unused npm packages in `package.json`.
- Safely uninstall unimported packages.

### 2.2 Clean Unused UI Components
- Identify unimported shadcn UI primitives in `components/ui/` or other unwired assets.
- Delete unused scratch/temporary files.

---

## Step 3: Bundle & Performance Optimization

### 3.1 Install and Configure Bundle Analyzer
- Install `@next/bundle-analyzer` as a devDependency.
- Update `next.config.js` to load the bundle analyzer plugin.

### 3.2 Configure Standalone Output
- Add `output: 'standalone'` inside `next.config.js` to enable automatic minimal production tracing for Docker/VPS deployments.

### 3.3 Dynamic Import Segmentation
- Modify `app/(admin)/admin/page.tsx` to dynamically load heavy ledger components and charts:
  - `FacultyRankingChart`
  - `DepartmentDonutChart`
  - `Modal`
  These will load on-demand, reducing the initial JS weight of the dashboard.

---

## Step 4: Verification

### 4.1 Build Check
- Run `npm run build` to verify the bundle analyzer outputs the visual graphs and that the standalone tracing compiles cleanly without missing modules.

### 4.2 Database Access Verification
- Log in to the application and verify that the evaluation pages and sections load instantly.
