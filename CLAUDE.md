# Attendance App

Next.js 16 + Electron desktop app for employee attendance tracking. Uses Supabase for auth and data.

## Commands

```bash
npm run dev           # Next.js dev server (webpack, localhost:3000)
npm run dev:turbo     # Next.js dev server (turbopack)
npm run build         # Production build
npm run lint          # ESLint
npm run test          # Run tests (vitest)
npm run test:watch    # Vitest watch mode
npm run seed          # Seed database (tsx scripts/seed.ts)

# Electron
npm run electron:dev    # Run Next.js + Electron concurrently (dev)
npm run electron:build  # Build + compile + package for Windows (.exe)
npm run electron:start  # Run packaged Electron app (production mode)
```

## Architecture

```
app/
  admin/          # Admin routes (analytics, attendance, calendar, schedule, settings, users)
  user/           # User routes (attendance, calendar, profile, schedule)
  api/            # API routes (auth, attendances, dtr, me, schedules, users, attendance-corrections)
  layout.tsx      # Root layout
components/
  admin/          # Admin-specific components
  user/           # User-specific components
  ui/             # Shared UI primitives
lib/
  supabase/       # Supabase clients: client.ts, server.ts, middleware.ts, admin.ts
  auth.ts         # Auth helpers
  attendance-compute.ts / attendance-status.ts / time-calc.ts  # Core business logic
  date-utils.ts / format-time.ts / schedule-utils.ts
types/            # Shared TypeScript types (attendance.ts, schedule.ts, user.ts)
contexts/         # React contexts (loading-context.tsx)
electron/         # Electron main/preload (compiled from .ts → .js)
supabase/migrations/  # Database migrations
```

## Environment

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Server-side Supabase (service role) keys are also expected — check `lib/supabase/admin.ts` for exact var names.

## Key Patterns

- **Auth**: Middleware-based (`middleware.ts` + `lib/supabase/middleware.ts`). Session handled server-side via SSR cookies.
- **Supabase clients**: Use `lib/supabase/server.ts` for Server Components/API routes, `lib/supabase/client.ts` for Client Components, `lib/supabase/admin.ts` for service-role operations.
- **Electron**: `electron/main.ts` compiles to `electron/main.js`. Run `npm run electron:compile` after changes before packaging.
- **Path alias**: `@` maps to project root.

## Testing

```bash
npm run test          # vitest run (single pass)
npm run test:watch    # vitest watch
```

Tests live in `lib/__tests__/` and `app/api/__tests__/`. Path alias `@` is configured in `vitest.config.ts`.

## Gotchas

- `npm run dev` uses webpack (stable). `dev:turbo` uses Turbopack and may have edge cases.
- Electron build targets Windows only (`--win`). Uses NSIS installer with custom install directory support.
- `.env.local` must be present for Electron production builds — it gets bundled as an `extraResource`.
- `next.config.ts` must have `output: 'standalone'` for Electron packaging to work.
