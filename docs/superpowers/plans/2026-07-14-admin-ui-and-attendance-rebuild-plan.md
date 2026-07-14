# Implementation Plan: Admin Sidebar Refactor & Evaluation Attendance Rebuild

**Date:** 2026-07-14  
**Author:** Antigravity  

---

## Step 1: Database Index Migration (Attendance Query Optimization)
- [ ] Add `@@index([studentEmail, createdAt])` on `EvaluationReceipt` inside `prisma/schema.prisma`.
- [ ] Run `npx prisma migrate dev --name add_attendance_receipt_index` to sync the database schema.

## Step 2: High Performance SQL Server Actions
- [ ] Create `getEvaluationAttendanceLogs` in `app/actions/admin.ts` using `prisma.$queryRaw` with parameterized templates and `Prisma.sql` to avoid injection.
- [ ] Add dynamic filters: Search pattern (`ILIKE`), Departments (`IN`), Sections (`IN`), Academic Years (`IN`), and Semesters (`IN`).
- [ ] Ensure name is joined from the `User` table, and sections/departments are resolved via section mapping.

## Step 3: Sidebar UI Refactoring (Task 1)
- [ ] Update `components/ui-ua/app-shell.tsx` navigation items to match the new ordered workflow.
- [ ] Add `isCollapsed` state to `AppShell`, toggled by a bottom collapse arrow button.
- [ ] Persist collapsed state to `localStorage` safely under a `useEffect` hydration guard.
- [ ] Refactor CSS transitions for width (`w-72` to `w-20`) using `motion-reduce:transition-none` for accessibility.
- [ ] Adjust heights to a minimum of 48px and add the gold border active indicator (`border-ua-gold`).

## Step 4: Attendance Log & Cascade Filters Rebuild (Task 2)
- [ ] Update the Attendance log view in `app/(admin)/admin/page.tsx` to display grouped unique student entries.
- [ ] Render cascading Advanced Search options: choosing a department dynamically filters the section options in real-time.
- [ ] Implement query inputs for multi-select arrays and run refreshes when clicking "Search".

## Step 5: Decoupled CSV Export Modal
- [ ] Build the Export modal containing separate radio buttons for scope choice (`Current View` vs `Whole Department`) and a checkbox for `Include all fields`.
- [ ] Construct the CSV payload format client-side and trigger the document download.
