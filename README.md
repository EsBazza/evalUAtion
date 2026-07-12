# CIT Evaluation System (University-Wide Scale)

A university-wide, multi-tenant platform designed to collect, process, and analyze student evaluations of faculty members. Rebuilt from the ground up to replace the legacy Spring Boot/React separate client architecture with a modern, high-performance Next.js consolidated monorepo.

---

## 🚀 Tech Stack (2026 Standards)

- **Framework:** Next.js 16.2 (App Router, React 19, Turbopack enabled)
- **Language:** TypeScript (Strict Mode)
- **Database:** PostgreSQL
- **ORM:** Prisma 7.8.0 (Rust-free client, preview driver adapters)
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Form Handling & Validation:** `react-hook-form` + `zod`
- **Authentication:** NextAuth.js (Auth.js) via Google OAuth
- **State Management:** React Context + React 19 Server Actions / React Query

---

## 🏛️ Architecture & Core Shifts

1. **Consolidated Full-Stack:** Replacing the legacy separated Spring Boot/React setup with a Next.js 16 monorepo. The application uses Next.js Server Actions for mutations and Server Components for secure data fetching.
2. **Multi-Tenancy (University Scale):** The system isolates data across multiple departments/colleges using a `Department` model.
3. **Dynamic Evaluation Templates:** Administrators can create customized `EvaluationTemplates` with nested `CriterionClusters` to group questions logically (e.g. for Online Distance Learning or Senior High School Homeroom).
4. **Performance & Security:** Legacy browser-side Elliptic Curve End-to-End (E2E) encryption has been dropped. Security now relies on TLS in transit, database encryption at rest, and strict application-level authorization rules.

---

## 📊 Database Schema (Prisma 7.8.0)

The application uses PostgreSQL with a schema optimized for tenant isolation and relational analytics.

```prisma
model Department {
  id          String      @id @default(cuid())
  name        String      @unique
  users       User[]
  professors  Professor[]
  templates   EvaluationTemplate[]
  evaluations Evaluation[]
}

model User {
  id            String      @id @default(cuid())
  email         String      @unique
  name          String?
  role          Role        @default(STUDENT)
  departmentId  String?
  department    Department? @relation(fields: [departmentId], references: [id])
}

model Professor {
  id            String      @id @default(cuid())
  email         String      @unique
  name          String
  departmentId  String
  department    Department  @relation(fields: [departmentId], references: [id])
  sections      String[]    // e.g., ["1-A", "2-B"]
  evaluations   Evaluation[]
}

model EvaluationTemplate {
  id            String      @id @default(cuid())
  name          String      
  departmentId  String
  department    Department  @relation(fields: [departmentId], references: [id])
  clusters      CriterionCluster[]
  evaluations   Evaluation[]
}

model CriterionCluster {
  id            String      @id @default(cuid())
  templateId    String
  title         String      
  order         Int
  template      EvaluationTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  criteria      Criterion[]
}

model Criterion {
  id            String      @id @default(cuid())
  clusterId     String
  title         String
  type          QuestionType 
  options       Json?       // Array of choices, or configuration objects
  isMandatory   Boolean     @default(true)
  order         Int
  cluster       CriterionCluster @relation(fields: [clusterId], references: [id], onDelete: Cascade)
  answers       EvaluationAnswer[]
}

model Evaluation {
  id              String      @id @default(cuid())
  studentEmail    String      // Used to prevent duplicates, NEVER exposed to faculty
  section         String
  professorId     String
  departmentId    String
  templateId      String
  professor       Professor   @relation(fields: [professorId], references: [id])
  department      Department  @relation(fields: [departmentId], references: [id])
  template        EvaluationTemplate @relation(fields: [templateId], references: [id])
  answers         EvaluationAnswer[]
  createdAt       DateTime    @default(now())
  
  @@unique([studentEmail, professorId, section])
}

model EvaluationAnswer {
  id              String      @id @default(cuid())
  evaluationId    String
  criterionId     String
  score           Int?        // For SCALE (0-4)
  textResponse    String?     // For TEXT
  choiceResponse  Json?       // For RADIO/CHECKBOX arrays
  evaluation      Evaluation  @relation(fields: [evaluationId], references: [id], onDelete: Cascade)
  criterion       Criterion   @relation(fields: [criterionId], references: [id])
}
```

---

## 🛠️ Getting Started & Scripts

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env` or `.env.local` file in the root with:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/evaluation_db"
NEXTAUTH_SECRET="your-nextauth-secret"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### 3. Database Migration & Seeding
```bash
npx prisma db push
node prisma/seed.js
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🧑‍💻 Installed Developer Agent Skills

This repository is equipped with custom instruction sets to guide developer agents when modifying specific areas of the application:

*   **[frontend-design](file:///C:/Users/admin/Desktop/evalUAtion/.agents/skills/frontend-design)**: Visual guidelines, typography pairings, and custom token patterns to ensure high-fidelity, visually premium components without relying on generic web defaults.

---

## ✅ UI Redesign Tasks & Status

Progress tracking for the university-wide UI modernization:
*   [x] **Task 1:** Update `globals.css` with brand theme configuration.
*   [x] **Task 2:** Create shared sidebar layout under `app/(admin)/admin/layout.tsx`.
*   [x] **Task 3:** Refactor admin main page (`app/(admin)/admin/page.tsx`).
*   [x] **Task 4:** Refactor department management page (`app/(admin)/admin/management/page.tsx`).
*   [x] **Task 5:** Refactor templates list (`app/(admin)/admin/templates/page.tsx`).
*   [x] **Task 6:** Refactor template dynamic builder (`app/(admin)/admin/templates/[templateId]/page.tsx`).
*   [x] **Task 7:** Refactor student evaluate client (`app/(student)/evaluate/StudentEvaluateClient.tsx`).
*   [x] **Task 8:** Refactor `DynamicQuestionRenderer` component.
*   [x] **Task 9:** Verify compilation and build state.
