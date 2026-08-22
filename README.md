# MedUni

An AI-assisted learning platform for medical universities.

Teachers upload source material; the platform turns it into lecture notes, quizzes, clinical cases, illustrated slide decks, narrated video and audio podcasts. Nothing reaches a student until a teacher has reviewed and approved it.

TypeScript monorepo — React front end, Express API, PostgreSQL via Prisma, Google Gemini for generation.

---

## Content safety model

The platform is built around one constraint: **the model must not invent medical content.** Two mechanisms enforce it.

**Grounded generation.** Every generated artefact is derived only from the material the teacher uploaded. Dosages, protocols and figures are carried over from the source rather than synthesised. Where a source has no dosage, the field stays empty.

**Two approval locks.**

1. Generation is blocked until the teacher approves the lecture digest.
2. Students see nothing until the teacher explicitly publishes it.

Editing published content automatically revokes its approval and returns it to draft. Every approval, threshold change and manual override is written to an audit log.

---

## Capabilities

### Teachers

- Topic constructor: upload material (PDF, DOCX, PPTX, TXT) → digest → generate → publish
- One action generates quiz, clinical case, presentation, video and podcast in sequence
- Progress heat map across student × topic, plus a group mistake map down to individual distractors
- Clinical case review queue with advisory AI scoring — the grade stays with the teacher
- Attendance driven by a weekly recurring timetable; lessons are derived from schedule rules rather than created by hand
- Task board of auto-derived work items and assignments received from the department

### Students

- Sequential topic unlocking, either rule-based or driven by the lesson schedule
- Lesson workspace: sectioned digest with inline media, slide deck, video, podcast, mind map and flashcards
- Quizzes with explained review; clinical cases solved step by step
- Virtual patient roleplay — take a history and order investigations, where unnecessary tests cost points
- Spaced repetition, targeted drills on past mistakes, attendance and grades

### Administration

- Faculty → department → course → group structure with five-tier role-based access control
- Learning policy corridor: thresholds are set centrally, and lower tiers may only tighten them, never relax them
- Oversight screen surfacing deviations — manual unlocks, topics without assessment, courses below policy, exam integrity signals
- AI usage tracking with per-department cost quotas

### Derived without model calls

Flashcards, mind maps and mistake drills are computed from the approved digest and existing quiz data. They cost nothing to produce and require no separate approval.

---

## Architecture

```
apps/
  api/      Express + TypeScript REST API
  web/      React + Vite + TypeScript single-page app
packages/
  db/       Prisma schema, client and seed
  ui/       Design system — tokens, components, charts
```

A few decisions worth knowing before reading the code:

- **Modules are isolated.** A page loads only its own module. Course tabs are separate routes, mounted lazily, and the shell itself fetches no business data.
- **The URL carries the state** — tab, page and filters — so links are shareable and browser navigation behaves.
- **The unlocking engine is pure.** `apps/api/src/modules/me/rules.ts` decides whether a topic is open, and every caller shares it — the student view, the teacher progress matrix and task computation all give the same answer and the same reason.
- **Background work is queued, not parallel.** Video rendering, podcast synthesis and image generation run through a single-concurrency queue and checkpoint after each step, so an interrupted job resumes instead of restarting.

---

## Tech stack

| Layer | Choice |
|---|---|
| Front end | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, Framer Motion, React Flow |
| API | Node.js, Express 4, TypeScript, Zod |
| Database | PostgreSQL 16, Prisma ORM |
| Auth | JWT in httpOnly cookies, argon2, WebAuthn, five-tier RBAC |
| AI | Google Gemini for text, images and speech, behind a provider-agnostic layer with an OpenAI-compatible adapter |
| Media | ffmpeg, sharp, pptxgenjs, pdfkit |
| Localisation | Uzbek (Latin) and Russian |

---

## Getting started

**Prerequisites** — Node.js 20+, PostgreSQL 16+ (or use the bundled `docker compose up -d`), and ffmpeg on `PATH` for video and podcast rendering.

```bash
npm install

cp apps/api/.env.example apps/api/.env
# set DATABASE_URL, the JWT secrets and GEMINI_API_KEY

npm run db:migrate
npm run db:seed

npm run dev          # API on :8000, web on :3000
```

Workspaces can also be run individually:

```bash
npm run dev --workspace=@meduni/api
npm run dev --workspace=@meduni/web
```

---

## Deployment

The reference deployment is Vercel for the web app, Render for the API as a Docker service, and Supabase for PostgreSQL. `vercel.json` and `render.yaml` are checked in; see [README.deploy.md](README.deploy.md) for the full guide.

The API is deliberately **not** serverless. Material parsing, image generation and video rendering are long-running background jobs that need a persistent process and ffmpeg available on the host.

File storage has two drivers behind one interface (`apps/api/src/lib/storage.ts`): local disk in development, database blobs in production, because the reference host has an ephemeral filesystem.

---

## Documentation

- [docs/decisions/](docs/decisions/) — architecture decision records
- [README.deploy.md](README.deploy.md) — deployment guide
- [CLAUDE.md](CLAUDE.md) — engineering rules, design system and module-by-module history

---

## Status

Pilot. Feature-complete across all three roles and running on a live deployment, pending a first departmental trial.
