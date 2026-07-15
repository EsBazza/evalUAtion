# University of the Assumption (UA) Evaluation System

A secure, university-wide, multi-tenant evaluation platform designed to collect, process, and analyze student evaluations of faculty members in real-time. Built as a high-performance Next.js consolidate monorepo.

---

## 🚀 Tech Stack

- **Framework:** Next.js 16.2 (App Router, React 19, Turbopack enabled)
- **Language:** TypeScript (Strict Mode)
- **Database:** PostgreSQL
- **ORM:** Prisma 7.8.0 (Rust-free client, preview driver adapters)
- **Styling:** Tailwind CSS v4 + shadcn/ui custom components (UA Primitives)
- **Form Handling:** `react-hook-form` + `zod`
- **Authentication:** NextAuth.js (Auth.js) supporting Google OAuth & Admin Credentials
- **State Management:** React Context & Server Actions

---

## 🏛️ Core Features & Architecture

1. **Multi-Tenancy & Scoped Administration**:
   - Supports multiple educational levels (Junior High School, Senior High School, College, Graduate School) and departments.
   - **System Administrator (ADMIN)**: Complete access to manage global parameters, templates, departments, user elevating, and audit trails.
   - **Sub Administrator (SUB_ADMIN)**: Department-assigned administrators restricted to viewing and managing data within their assigned department only.

2. **Advanced Security & Data Privacy**:
   - **E2E Cryptography Exchange**: Dynamic ECDH exchange key sessions for client-server key exchanges.
   - **Secure Evaluations Storage**: Raw student evaluations are stored as encrypted bytes (`SecureEvaluation`) in PostgreSQL using AES-GCM (Authenticated Encryption).
   - **Submission Anonymity & Deduplication**: Employs HMAC signature hashes of student identities to prevent duplicate submissions without storing student credentials linked to answers.
   - **Encrypted Audit Logs**: Critical system mutations are logged as AES-256-GCM ciphertexts to prevent logs tampering.

3. **Faculty Analytics Dashboard**:
   - Performance indicators including composite scores, cluster averages, and section-wise breakdowns.
   - Interactive data visualizations featuring Radar charts, Section Bar charts, and Historical Trend charts.
   - **AI-Powered Narrative Summaries**: Generates qualitative feedback evaluations and sentiment metrics leveraging Google Gemini.

4. **Ledger Data Exporting (CSV & PDF)**:
   - Client-side data exporters for all core tables (Ratings Ledger, Attendance Logs, and Audit Logs).
   - Exports high-fidelity, multi-page PDF documents of the Faculty Analytics Dashboards (including charts and AI narratives) and raw score tables (CSV).

---

## 📊 Database Schema (Prisma 7.8.0)

The PostgreSQL schema is structured for secure tenant isolation, relational evaluations, and dynamic query filtering:

```prisma
model Department {
  id          String         @id @default(cuid())
  name        String         @unique
  level       EducationLevel
  sections    Section[]
  professors  Professor[]
  templates   Template[]
  users       User[]
  evaluations Evaluation[]
}

model User {
  id           String      @id @default(cuid())
  email        String      @unique
  name         String?
  role         Role        @default(STUDENT)
  departmentId String?
  department   Department? @relation(fields: [departmentId], references: [id])
  username     String?     @unique
  password     String?
  createdAt    DateTime    @default(now())
}

model Professor {
  id           String       @id @default(cuid())
  email        String       @unique
  name         String
  departmentId String
  department   Department   @relation(fields: [departmentId], references: [id], onDelete: Cascade)
  sections     Section[]    @relation("SectionToProfessor")
  evaluations  Evaluation[]
  aiSummaries  AiSummary[]
  scoreCaches  ScoreCache[]
}

model Section {
  id           String      @id @default(cuid())
  name         String
  code         String?
  departmentId String
  department   Department  @relation(fields: [departmentId], references: [id], onDelete: Cascade)
  professors   Professor[] @relation("SectionToProfessor")
  evaluations  Evaluation[]
}

model Template {
  id           String       @id @default(cuid())
  title        String
  instructions String?
  scaleType    String       @default("0_TO_4")
  level        EducationLevel
  departmentId String?
  department   Department?  @relation(fields: [departmentId], references: [id])
  clusters     Cluster[]
  evaluations  Evaluation[]
  isActive     Boolean      @default(false)
}

model Cluster {
  id         String      @id @default(cuid())
  templateId String
  title      String
  order      Int
  template   Template    @relation(fields: [templateId], references: [id], onDelete: Cascade)
  criteria   Criterion[]
}

model Criterion {
  id          String       @id @default(cuid())
  clusterId   String
  question    String
  type        QuestionType
  options     Json?
  order       Int
  cluster     Cluster      @relation(fields: [clusterId], references: [id], onDelete: Cascade)
  answers     Answer[]
}

model Evaluation {
  id           String      @id @default(cuid())
  sectionId    String
  professorId  String
  departmentId String
  templateId   String
  academicYear String
  semester     String
  section      Section     @relation(fields: [sectionId], references: [id])
  professor    Professor   @relation(fields: [professorId], references: [id])
  department   Department  @relation(fields: [departmentId], references: [id])
  template     Template    @relation(fields: [templateId], references: [id])
  answers      Answer[]
  createdAt    DateTime    @default(now())
}

model Answer {
  id           String     @id @default(cuid())
  evaluationId String
  criterionId  String
  score        Int?
  textVal      String?
  jsonVal      Json?
  evaluation   Evaluation @relation(fields: [evaluationId], references: [id], onDelete: Cascade)
  criterion    Criterion  @relation(fields: [criterionId], references: [id])
}

model SecureEvaluation {
  id             String   @id @default(uuid())
  facultyId      String
  periodId       String
  encryptedData  Bytes
  iv             Bytes
  authTag        Bytes
  submissionHash String   @unique
  createdAt      DateTime @default(now())
}

model AuditLog {
  id             String   @id @default(cuid())
  encryptedEvent Bytes
  iv             Bytes
  authTag        Bytes
  eventType      String
  actorEmail     String
  createdAt      DateTime @default(now())
}

enum Role {
  STUDENT
  FACULTY
  ADMIN
  SUB_ADMIN
}
```

---

## 🛠️ Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/evaluation_db"
NEXTAUTH_SECRET="your-nextauth-secret-key"
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"
GEMINI_API_KEY="your-gemini-pro-api-key"
```

### 3. Database Migration & Setup
```bash
npx prisma generate
npx prisma db push
node prisma/seed.js
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the portal.
