# Project Context: CIT Evaluation System (University-Wide Scale)

## 1. Project Overview
The CIT Evaluation System is a comprehensive platform designed to collect, process, and analyze student evaluations of faculty members. Originally a single-department tool built with React/Vite and Spring Boot, it is now being rebuilt from the ground up to support a **University-Wide, Multi-Tenant Architecture**. 

### Tech Stack (2026 Standards)
*   **Framework:** Next.js 16.2 (App Router, React 19, Turbopack enabled)
*   **Language:** TypeScript (Strict Mode)
*   **Database:** PostgreSQL
*   **ORM:** Prisma 7.8.0 (Rust-free client)
*   **Styling:** Tailwind CSS + shadcn/ui
*   **Form Handling & Validation:** `react-hook-form` + `zod`
*   **Authentication:** NextAuth.js (Auth.js) via Google OAuth
*   **State Management:** React Context + React 19 Server Actions / React Query

## 2. Core Architectural Shifts from Legacy System
1.  **Consolidated Full-Stack:** We are replacing the separated Spring Boot/React setup with a Next.js 16 monorepo. We will use Next.js Server Actions for mutations and Server Components for data fetching where possible.
2.  **Multi-Tenancy (University Scale):** The system must handle multiple departments/colleges. Data is isolated using a `Department` model.
3.  **Dynamic Evaluation Templates:** Different departments have different evaluation needs (e.g., Senior High School includes "Homeroom Adviser" questions, while College includes "Online Distance Learning"). Administrators must be able to create `EvaluationTemplates` with nested `CriterionClusters` to group questions logically.
4.  **Performance Optimization (Encryption):** We are **dropping** the legacy browser-side Elliptic Curve End-to-End (E2E) encryption. Security will now rely on TLS in transit, database encryption at rest, and strict application-level authorization rules.

## 3. User Roles & Workflows
*   **Student:** Logs in via Google OAuth. Selects their department/section and faculty member. Fills out dynamic criteria forms organized by clusters. Submits anonymously.
*   **Faculty:** Logs in to view personal analytics (radar charts, historical trends, section-wise breakdown). Cannot see individual student identities.
*   **Admin:** Manages departments, faculties, sections, and builds dynamic `EvaluationTemplates`. Has access to aggregate dashboards and raw data exports (CSV/PDF).

## 4. Target Prisma Database Schema (Prisma 7.8.0 Compatible)
The schema is designed for relation-heavy analytics, tenant isolation, and fully dynamic form generation based on clusters.

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

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

// Represents a complete form structure (e.g., "College Evaluation 2026")
model EvaluationTemplate {
  id            String      @id @default(cuid())
  name          String      
  departmentId  String
  department    Department  @relation(fields: [departmentId], references: [id])
  clusters      CriterionCluster[]
  evaluations   Evaluation[]
}

// Groups questions (e.g., "Communication Skills", "Instructional Skills")
model CriterionCluster {
  id            String      @id @default(cuid())
  templateId    String
  title         String      
  order         Int
  template      EvaluationTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  criteria      Criterion[]
}

// The actual questions
model Criterion {
  id            String      @id @default(cuid())
  clusterId     String
  title         String
  type          QuestionType 
  options       Json?       // Array of strings for choices, or configuration objects
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
  
  @@unique([studentEmail, professorId, section]) // Prevents duplicate submissions
}

model EvaluationAnswer {
  id              String      @id @default(cuid())
  evaluationId    String
  criterionId     String
  score           Int?        // Used for SCALE (0-4)
  textResponse    String?     // Used for TEXT
  choiceResponse  Json?       // Used for RADIO/CHECKBOX arrays
  evaluation      Evaluation  @relation(fields: [evaluationId], references: [id], onDelete: Cascade)
  criterion       Criterion   @relation(fields: [criterionId], references: [id])
}

enum Role {
  STUDENT
  FACULTY
  ADMIN
}

enum QuestionType {
  SCALE       // Semantic scale (e.g., 0 to 4)
  RADIO       // Single choice from predefined options
  CHECKBOX    // Multiple choices from predefined options
  TEXT        // Open-ended written feedback
}
5. Development Constraints & Best Practices
Dynamic Forms: Use react-hook-form paired with zod schema validation to manage the dynamic EvaluationTemplate data. Because questions are generated from the database, the form must handle dynamic field registration.

Server Actions: Use Next.js 16 Server Actions for submitting the evaluation payload to avoid writing boilerplate API routes.

UI Components: Implement UI using Tailwind CSS and shadcn/ui. For the SCALE question type, create a custom semantic scale radio group component (values 0-4).

Data Fetching: For dashboards (Faculty/Admin), fetch data securely on the server and pass it down. Ensure studentEmail is explicitly omitted from any queries sent to the Faculty dashboard.