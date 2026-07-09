# Implementation Plan: Analytics, Caching, Faculty Preview, & ECDH-AES Redesign

This document outlines the step-by-step steps to implement the approved technical design.

---

## Phase 1: Dependency Installation & DB Schema Sync

### 1.1 Install Recharts
Execute the npm installation command to add `recharts` for visualization components:
```bash
npm install recharts
```

### 1.2 Update Prisma Schema
Edit [schema.prisma](file:///C:/Users/admin/Desktop/evalUAtion/prisma/schema.prisma) to add:
- `ScoreCache` model for caching mathematical scale scores, qualitative AI scores, and final composite scores.
- `AuditLog` model for storing AES-encrypted administrative action details.
- Update the `Professor` model to define the relation `scoreCaches ScoreCache[]`.

```prisma
model ScoreCache {
  id              String    @id @default(cuid())
  professorId     String
  academicYear    String
  semester        String
  scaleScore      Float?    // 0-100
  aiQualityScore  Float?    // 0-100
  compositeScore  Float?    // 0-100
  isStale         Boolean   @default(true)
  lastComputedAt  DateTime?
  professor       Professor @relation(fields: [professorId], references: [id], onDelete: Cascade)

  @@unique([professorId, academicYear, semester])
}

model AuditLog {
  id             String   @id @default(cuid())
  encryptedEvent Bytes    // AES-256-GCM ciphertext
  iv             Bytes
  authTag        Bytes
  eventType      String   // plaintext index
  actorEmail     String   // plaintext index
  createdAt      DateTime @default(now())

  @@index([eventType, createdAt])
}
```

### 1.3 Sync Database Schema
Run the Prisma migration generator to apply changes to PostgreSQL:
```bash
npx prisma db push
```

---

## Phase 2: Cryptographic Engine & Audit Log Implementation

### 2.1 Cryptographic Utilities
Create a new file `lib/crypto.ts` implementing:
- Ephemeral server keypair generation (`generateServerSessionKeys()`).
- Ephemeral session registration using database or Redis.
- Client-side compatibility helpers for deriving shared keys using the Web Crypto API.
- AES-256-GCM encryption and decryption functions for DB payload storage.

### 2.2 API Session Endpoint
Create `/app/api/crypto/session/route.ts`:
- **GET:** Initiates session, generates server keypair, stores private key in cache/DB, returns public key and `sessionId`.

### 2.3 Server Actions for Audit Logging
Create `app/actions/audit.ts` containing:
- `writeAuditLog(eventType, actorEmail, payload)`: Encrypts administrative payload using `process.env.AUDIT_LOG_KEY` via AES-256-GCM and inserts into the database.
- `getAuditLogs()`: Fetches logs, decrypts payloads on-the-fly, and returns plaintext arrays to the admin panel.

---

## Phase 3: Scoring Refactor & Caching Logic

### 3.1 Refactor Student Submission Action
Update `submitProfessorEvaluation` in [student.ts](file:///C:/Users/admin/Desktop/evalUAtion/app/actions/student.ts):
- Decrypt the encrypted payload if security parameters are present.
- Save the encrypted payload to `SecureEvaluation`.
- Save standard values to `Evaluation` and `Answer` for active query resolution.
- Mark the professor's `ScoreCache.isStale` as `true` for the current term inside the transaction.

### 3.2 Update Gemini AI Evaluation Prompt
Refactor `processFacultyEvaluationSummary` in [ai.ts](file:///C:/Users/admin/Desktop/evalUAtion/app/actions/ai.ts) to:
- Prompt Gemini to extract structural metrics and compute a qualitative sentiment rating (0-100).
- Save results and update `ScoreCache.aiQualityScore`.
- Recompute `ScoreCache.compositeScore` and toggle `isStale` to `false`.

---

## Phase 4: Admin Faculty Preview Dashboard & Links

### 4.1 Faculty Preview Page Route
Create a new server component: `/app/(admin)/admin/faculty/[professorId]/page.tsx`
- Fetches profile statistics (`getFacultyProfileData`).
- Integrates a visual layout combining all Recharts charts.
- Provides admin controls to trigger manual cache rebuilds.

### 4.2 Link Management Table to Preview
Update [page.tsx](file:///C:/Users/admin/Desktop/evalUAtion/app/(admin)/admin/management/page.tsx):
- Convert row names to clickable `Link` tags directing to `/admin/faculty/[professorId]`.

---

## Phase 5: Recharts Integration & Visual Polish

### 5.1 Recharts Chart Components
Develop charting components under `components/charts/`:
- `RadarClusterChart.tsx`
- `SectionBarChart.tsx`
- `FacultyRankingChart.tsx`
- `DepartmentDonutChart.tsx`
- `HistoricalTrendChart.tsx`

### 5.2 Populate Live Pages
- Replace placeholders on `/app/(faculty)/faculty/page.tsx` with live data charts.
- Embed `FacultyRankingChart` and `DepartmentDonutChart` inside the main Admin Dashboard page (`/app/(admin)/admin/page.tsx`).
- Replace Mock Logs with live decrypted streams from the `AuditLog` model in the administrative Activity Log tab.
