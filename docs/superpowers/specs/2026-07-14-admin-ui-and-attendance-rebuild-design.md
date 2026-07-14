# Design Spec: Admin Sidebar Refactor & Evaluation Attendance Rebuild

**Date:** 2026-07-14  
**Status:** Approved  
**Author:** Antigravity  

---

## 1. Sidebar Refactor (Task 1)

### 1.1 Requirements & Workflow Order
The current navigation links inside `app/(admin)/admin/layout.tsx` will be restructured to represent a sequential administrative workflow instead of a flat list:
1. **Faculty & Department Management** (`/admin/management`)
2. **Manage Templates** (`/admin/templates`)
3. **Rankings Ledger** (`/admin`)

Administrative utilities will be grouped under a separated sub-header or bottom section:
- **Activity Logs** (`/admin?tab=logs`)
- **System Settings** (`/admin?tab=settings`)

### 1.2 Minimize/Collapse & Persistence
- A toggle button (using a dynamic `ChevronLeft` / `ChevronRight` Lucide icon) will sit at the bottom of the sidebar.
- State will be tracked via `isCollapsed` boolean inside the `AppShell` component.
- The collapsed state will be persisted in `localStorage` under `ua_sidebar_collapsed` to avoid state resetting during page transitions.
- **Hydration Guard**: To prevent hydration mismatch in Next.js, the sidebar will default to expanded (`false`) on SSR and load the persisted value in a `useEffect` on mount.
- **Motion Handling**: Sidebar width will transition from `w-72` to `w-20` using standard Tailwind transitions (`transition-all duration-300`). We will apply the `motion-reduce:transition-none` class to respect the `prefers-reduced-motion` media query.

### 1.3 Mobile Responsiveness & Tap Targets
- Link items will have increased vertical padding (`py-3`) to guarantee a minimum click/tap target of **48px**.
- Active tabs will be highlighted with a gold left border (`border-l-4 border-ua-gold`).
- On mobile screen widths (<768px), the sidebar will continue to render as a slide-out drawer inside `AppShell`, using the identical workflow ordering and enlarged touch targets.

---

## 2. Evaluation Attendance Tab Rebuild (Task 2)

### 2.1 Database Grouping & Aggregation
To prevent duplicate rows for students who evaluate multiple professors, we will group by `studentEmail` at the database layer.

- **Query logic**: Use `DISTINCT ON ("studentEmail")` inside a PostgreSQL Common Table Expression (CTE) combined with window functions or subqueries to extract the first and most recent submission dates.
- **Name resolution**: Display name is resolved by joining the `User` table on the student's email, representing their authenticated GSuite OAuth identity.
- **Tiebreaking**: In case of duplicate submission timestamps (common in seed or test datasets), the SQL will use `r.id DESC` as a deterministic tiebreaker.

### 2.2 Advanced Search & Cascading Filtering
A collapsible filter panel will be rendered above the attendance log table:
- **Department**: Multi-select dropdown checkbox list.
- **Section**: Cascades dynamically. Selecting one or more departments updates the section dropdown list to display only sections belonging to those departments. If no department is selected, all sections are displayed.
- **Academic Year**: Multi-select checkbox populated dynamically via `SELECT DISTINCT "academicYear" FROM "EvaluationReceipt"`.
- **Semester**: Multi-select checkbox populated dynamically via `SELECT DISTINCT "semester" FROM "EvaluationReceipt"`.

### 2.3 SQL Query Implementation
The SQL query will be executed via `prisma.$queryRaw` using safe parameterized SQL templates to prevent injection vulnerabilities:

```typescript
// app/actions/admin.ts
export async function getEvaluationAttendanceLogs(filters: {
  search?: string;
  departments?: string[];
  sections?: string[];
  academicYears?: string[];
  semesters?: string[];
  page: number;
  pageSize: number;
}) {
  const offset = (filters.page - 1) * filters.pageSize;
  const conditions = [];

  if (filters.search?.trim()) {
    const searchPattern = `%${filters.search.trim()}%`;
    conditions.push(Prisma.sql`(r."studentEmail" ILIKE ${searchPattern} OR u."name" ILIKE ${searchPattern})`);
  }
  if (filters.departments && filters.departments.length > 0) {
    conditions.push(Prisma.sql`s."departmentId" IN (${Prisma.join(filters.departments)})`);
  }
  if (filters.sections && filters.sections.length > 0) {
    conditions.push(Prisma.sql`r."sectionId" IN (${Prisma.join(filters.sections)})`);
  }
  if (filters.academicYears && filters.academicYears.length > 0) {
    conditions.push(Prisma.sql`r."academicYear" IN (${Prisma.join(filters.academicYears)})`);
  }
  if (filters.semesters && filters.semesters.length > 0) {
    conditions.push(Prisma.sql`r."semester" IN (${Prisma.join(filters.semesters)})`);
  }

  const whereClause = conditions.length > 0 
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` 
    : Prisma.empty;

  return prisma.$queryRaw`
    WITH first_submissions AS (
      SELECT "studentEmail", MIN("createdAt") AS "firstSubmitted"
      FROM "EvaluationReceipt"
      GROUP BY "studentEmail"
    ),
    latest_receipts AS (
      SELECT DISTINCT ON ("studentEmail")
        id,
        "studentEmail",
        "sectionId",
        "academicYear",
        "semester",
        "createdAt" AS "mostRecentSubmitted"
      FROM "EvaluationReceipt"
      ORDER BY "studentEmail", "createdAt" DESC, id DESC
    )
    SELECT 
      lr.*,
      fs."firstSubmitted",
      u.name AS "studentName",
      s.name AS "sectionName",
      d.name AS "departmentName",
      d.level AS "level"
    FROM latest_receipts lr
    JOIN first_submissions fs ON lr."studentEmail" = fs."studentEmail"
    LEFT JOIN "User" u ON lr."studentEmail" = u.email
    LEFT JOIN "Section" s ON lr."sectionId" = s.id
    LEFT JOIN "Department" d ON s."departmentId" = d.id
    ${whereClause}
    ORDER BY lr."mostRecentSubmitted" DESC, lr.id DESC
    LIMIT ${filters.pageSize} OFFSET ${offset};
  `;
}
```

---

## 3. Database Indexes

To maintain sub-second queries as logs grow:
- Add index `@@index([studentEmail, createdAt])` to the `EvaluationReceipt` model in `schema.prisma`.
- Run migrations to update the database schema.

---

## 4. Export CSV Options

An Export button will trigger a modal with:
1. **Export Scope (Radio buttons)**:
   - `Current View`: Exports exactly the current filtered and sorted results.
   - `Whole Department`: Bypasses search filters to export all unique students in a chosen department (reveals a department dropdown if none is active).
2. **Column Schema (Checkbox)**:
   - `Include all fields`: (Name, Email, First Submitted, Most Recent Submitted, Department, Section) vs a compact view (Name, Email, Section).
