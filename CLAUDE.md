# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (Next.js, port 3000)
npm run build    # Production build
npm run lint     # ESLint
```

No test suite is configured yet.

## Architecture

**Next.js 16 App Router** app (React 19, TypeScript, Tailwind CSS v4, no React Compiler).

### Data flow

1. `src/middleware.ts` — runs on every non-static request to refresh the Supabase session cookie.
2. `src/app/page.tsx` — server component, renders `<TimetableView />`.
3. `src/components/timetable/timetable-view.tsx` — single large client component that owns all timetable state. It fetches entries from the API on week change and writes back via optimistic updates.
4. `src/app/api/timetable/route.ts` — Next.js Route Handler (GET / POST / DELETE) that talks to Supabase.

### Supabase

- **Server client** (`src/lib/supabase/server.ts`): `createServerClient` from `@supabase/ssr`, used in Route Handlers and Server Components.
- **Browser client** (`src/lib/supabase/client.ts`): `createBrowserClient`, available for client components if needed.
- **Table**: `timetable_entries` with columns `week_start` (date), `cell_key` (text), `task` (text), `color` (text). Unique constraint on `(week_start, cell_key)` — used for upsert conflict resolution.
- Env vars: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.

### Timetable grid

- Days: Mon–Fri (5 columns). Hours: 06:00–19:00 (14 rows of 1-hour slots).
- `cellKey` format: `"monday-09"`, `"friday-14"`, etc. — used as the DB `cell_key`.
- `weekStart` is always the Monday of the displayed week (ISO date string `YYYY-MM-DD`).
- All date math is vanilla JS (no date library) inside `timetable-view.tsx`.

### UI

- **shadcn/ui** (v3.8.5, Tailwind v4 style) — components in `src/components/ui/`. Add new ones with `npx shadcn add <component>`.
- `TooltipProvider` wraps the entire app in `src/app/layout.tsx` — required for shadcn `Tooltip` to work anywhere.
- Styling uses Tailwind v4 CSS variables defined in `src/app/globals.css` (oklch color space). Dark mode via `.dark` class.
- `cn()` utility from `src/lib/utils.ts` (clsx + tailwind-merge) is used everywhere for conditional class names.

## Git Workflow

- main: production-ready code only
- develop: integration branch for features
- Feature branches: created from and merged into develop
- Branch naming: feature/<slugified-name>
- Commit style: conventional commits (feat:, fix:, chore:, etc.)
