# SDO Attendance System

An attendance tracking application built with Next.js 16 (App Router), Supabase (auth and database), and Tailwind CSS. Supports user and admin roles, QR-based clock-in, schedules, attendance corrections, and analytics.

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### Environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

Required variables (see `.env.example` for descriptions):

- `NEXT_PUBLIC_SUPABASE_URL` – your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` – Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` – Supabase service role key (for admin operations)
- `LOCAL_ADMIN_EMAIL` – email of the admin user (can access `/admin`)

Optional: `LOCAL_ADMIN_USERNAME`, `QR_ATTENDANCE_SECRET`, `NEXT_PUBLIC_QR_BASE_URL`.

### Database migrations

Run Supabase migrations to create and update tables (using the Supabase CLI, or apply the SQL in `supabase/migrations/` via the Supabase dashboard).

### Seed data (optional)

To seed the database with sample data:

```bash
npm run seed
```

Ensure `.env.local` (or the env used by the script) has `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set.

### Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app redirects to the login page; use the admin email (and password you set in Supabase) to sign in. The admin user is redirected to `/admin`; other users go to `/user`.

### Build and start

```bash
npm run build
npm start
```

### Lint and tests

```bash
npm run lint
npm run test
```

- **Lint:** runs ESLint on the project (`eslint .`).
- **Test:** runs Vitest once (`vitest run`). Use `npm run test:watch` for watch mode.

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
