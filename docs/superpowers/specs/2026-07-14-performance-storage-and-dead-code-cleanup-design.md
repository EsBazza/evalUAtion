# Performance, Storage & Dead-Code Cleanup — Spec

Status: Approved
Date: 2026-07-14

## Goal
Improve page-load and page-transition speed, reduce database query latency, and shrink the repository/deployment footprint by removing unused code, packages, and components. Optimized for both self-hosted Docker/VPS and Vercel serverless platforms.

---

## 1. Database Seeding & Clean Start

To ensure a clean database state and align all section access codes with the new prefix mappings:

### Clean Order
Database cleanup must run sequentially to satisfy foreign key constraints:
1. `SecureEvaluation` & `EvaluationReceipt`
2. `Answer` & `Evaluation`
3. `Criterion` & `Cluster` & `Template`
4. `User` & `Professor` & `Section` & `Department`

### Correct Code Generation during Seed
When sections are created, their access codes will be calculated and generated dynamically inside `prisma/seed.js` using:
- **JHS Department**: prefix `"JHS"`
- **SHS Department**: prefix `"SHS"`
- **College Departments**: corresponding uppercase abbreviations (e.g. `COA`, `CEA`, `CIT`, `SBPA`)
- **Format**: `UA-[DEPT]-[RAND4]-[SEM][YY]` (e.g. `UA-COA-P5RJ-1S2627`)

---

## 2. Serverless & VPS Optimization

### Vercel Cold Start Mitigation
- **Bundle Trimming**: Keep the bundle size of student-facing routes under 100kb by segregating admin components.
- **Dynamic Imports**: Use `next/dynamic` to load heavy UI elements (e.g., charts, ledger tables, template builders) on demand rather than at initial page load.

### VPS Standalone Packing
- **Minimal Docker Output**: Configure `output: 'standalone'` in `next.config.js` to automatically package only runtime-critical files.

### Request-Level Caching
- **React Server Cache**: Wrap configuration fetches (system settings, active templates) in React's `cache()` to deduplicate DB queries within the same request lifecycle without needing an external Redis instance.

---

## 3. Dead-Code, Packages, and Icon Import Cleanup

### Automated Auditing
- **Unused Packages**: Audit `dependencies` and `devDependencies` using `depcheck` and prune unimported packages from `package.json`.
- **Dead Source Files**: Locate and remove unimported source files, assets, or shadcn components using `knip`.

### Import Optimization
- **Lucide Icon Treeshaking**: Verify all `lucide-react` imports are imported via direct destructuring (e.g., `import { LogOut } from "lucide-react"`) to ensure proper compiler tree-shaking.

---

## Success Criteria
- **Lighthouse Performance Score**: Mobile score on the `/evaluate` page improved.
- **Docker Image Size**: Reduced by up to 80% using standalone compilation tracing.
- **Zero Regressions**: Compile and run checks pass cleanly.
