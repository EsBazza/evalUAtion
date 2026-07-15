# Project Context: UA Faculty Evaluation System

## 1. Project Overview
The University of the Assumption (UA) Faculty Evaluation System is a modern, high-performance, multi-tenant portal engineered to collect, store, and analyze student evaluations. The system operates on a consolidated Next.js architecture supporting different administrative access tiers, dynamic form evaluation configurations, AI-driven sentiment logs, and high-fidelity CSV/PDF exporting interfaces.

### Key Technology Stack:
- **Framework:** Next.js 16.2 (App Router, React 19, Turbopack)
- **Database:** PostgreSQL + Prisma ORM (Client v7.8.0)
- **Authentication:** Auth.js (NextAuth v5) supporting domain-locked Google OAuth (`@ua.edu.ph`) & secure credential accounts
- **AI Analytics:** Google Gemini API integration for qualitative comment narratives
- **Cryptography:** Node.js Crypto API (ECDH, AES-256-GCM, AES-GCM, HMAC-SHA256)

---

## 2. Core Architectural Design

### A. Role Hierarchy & Multi-Tenancy Isolation
1. **Student**: Authenticates via Google OAuth. Displays dynamic evaluation forms matching their registered educational level. Submissions are anonymous.
2. **Faculty**: Scoped dashboard access displaying radar metric charts, section averages, and qualitative AI narratives.
3. **Sub-Administrator (SUB_ADMIN)**: Scoped to their assigned `Department` ID. They can view, analyze, and export records only for classes, professors, and logs belonging to their department.
4. **System Administrator (ADMIN)**: Global access configuration. Can manage templates, departments, user roles, system states (enabling/disabling the portal), and inspect security audit logs.

### B. Security & Cryptographic Subsystems
- **ECDH Key Exchange**: Exchange key routes allow clients to verify server parameters dynamically.
- **Secure Encrypted Evaluation Store**: Student evaluations are encrypted via AES-GCM with distinct initialization vectors (IVs) and auth tags.
- **HMAC Signature Anonymity**: Prevents duplicate student submissions by comparing HMAC hashes of client metadata without saving the student's email linked directly to their answers.
- **Encrypted Audit Logs**: Critical administrator activities (role elevations, configuration adjustments) write logs encrypted with AES-256-GCM to prevent database modifications from concealing administrative actions.

---

## 3. Data Processing & Export Workflows
- **Real-Time Scoring Caches**: Score caches are computed and cached on demand (combining evaluation scales and qualitative metrics). Cache status values (`isStale`) allow scheduled live re-sync polling to run seamlessly.
- **Structured CSV Exporting**: Enabled for Ratings Ledger, Attendance Logs, Audit Logs, and Faculty Profile scores/comments using dynamic client Blob URI triggers.
- **Client-Side PDF Compilation**: Dynamically imports `html2canvas` and `jspdf` to convert HTML layout modules (charts, cards, and AI narrative blocks) into structured multi-page PDF documents.