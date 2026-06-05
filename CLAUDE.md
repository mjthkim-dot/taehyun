# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Salesforce Automation AI** application — a Next.js app that records sales calls and meetings, transcribes audio via Google Speech-to-Text, analyzes content with Google Gemini (MEDDIC sales framework), and automatically creates tasks/logs in Salesforce.

**Note**: The source code was developed locally and the `SFDC` file at repo root documents the original setup transcript. If source files are missing, they need to be pushed from the developer's machine.

## Tech Stack

- **Framework**: Next.js (App Router, no `src/` directory, `@/*` import alias)
- **Language**: TypeScript with Tailwind CSS
- **AI**: Google Gemini via `@google/generative-ai`
- **Speech**: `@google-cloud/speech` (Speech-to-Text)
- **Salesforce**: `jsforce`
- **Google APIs**: `googleapis` (Calendar integration)
- **Scheduling**: `node-cron`
- **Deploy**: Vercel (`vercel.json` present)

## Commands

```bash
npm run dev       # Start development server (localhost:3000)
npm run build     # Production build
npm run lint      # ESLint
npm run start     # Run production build
```

## Architecture

### Request Flow

```
Browser/Client
  → app/api/**  (Next.js Route Handlers)
  → lib/workflows/**  (orchestration layer)
  → lib/salesforce/** + lib/ai/** + lib/stt/** + lib/google/**  (domain services)
```

### `lib/` Domain Organization

Each subdirectory is a self-contained domain module:

| Directory | Responsibility |
|---|---|
| `lib/salesforce/` | Salesforce auth (`auth.ts`), call logs, meeting logs, task CRUD |
| `lib/ai/` | Gemini client (`gemini.ts`), call/meeting analyzer, task suggestions |
| `lib/analysis/` | MEDDIC framework scoring (`meddicAnalyzer.ts`) |
| `lib/stt/` | Audio conversion and file handling for Speech-to-Text |
| `lib/google/` | Google Calendar client, meeting detection |
| `lib/workflows/` | High-level orchestrators that compose domain modules |
| `lib/priority/` | Task priority scoring (`calculator.ts`) |
| `lib/monitoring/` | Logger, error tracker, metrics (internal observability) |
| `lib/demo/` | Demo data fixtures for the `/test` and `/demo/*` routes |

### API Routes

| Route | Purpose |
|---|---|
| `POST /api/call/record` | Start/stop call recording workflow |
| `POST /api/meeting/record` | Start/stop meeting recording workflow |
| `POST /api/analyze/audio` | Transcribe and analyze a single audio file |
| `POST /api/task/create` | Manually create a Salesforce task |
| `GET/POST /api/demo/call` | Demo call flow without real audio |
| `GET/POST /api/demo/meeting` | Demo meeting flow |
| `GET/POST /api/demo/task` | Demo task creation |

### Pages

- `/` — Landing / home
- `/dashboard` — Activity summary (`ActivitySummary.tsx`) and task list (`TaskList.tsx`)
- `/record` — Live call/meeting recording UI
- `/test` — Development test harness using demo data

### Workflow Pattern

The `lib/workflows/` layer is the key architectural seam. Each workflow (`callRecording.ts`, `meetingRecording.ts`, `taskCreation.ts`) coordinates the full pipeline: audio capture → STT → AI analysis → MEDDIC scoring → priority calculation → Salesforce write. API routes call workflows, not domain services directly.

## Environment Variables

Required at runtime (not committed — set in Vercel or `.env.local`):

- `SALESFORCE_*` — Salesforce OAuth credentials (from `lib/salesforce/auth.ts`)
- `GOOGLE_GEMINI_API_KEY` — Gemini API key
- `GOOGLE_CLOUD_*` — Google Cloud credentials for Speech-to-Text and Calendar
