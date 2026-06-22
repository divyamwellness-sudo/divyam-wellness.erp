# Divyam Wellness ERP

Herbalife & Wellness business management system — single business MVP.

## Tech Stack

- React 19 + TypeScript
- Tailwind CSS
- Supabase (Auth + PostgreSQL)
- Vercel

## Phase 1 — What's Included

- Supabase migration: `profiles`, `business_settings`, RLS
- Email/password authentication
- Login page
- Protected routes
- Dashboard layout with sidebar navigation

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the migration in **SQL Editor** or via Supabase CLI:

```bash
npx supabase db push
```

Migration file: `supabase/migrations/001_profiles_and_settings.sql`

3. Create an admin user in **Authentication → Users → Add user**
4. Copy `.env.example` to `.env` and fill in your Supabase URL and anon key

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 4. Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Set environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

## Project Structure

```
src/
├── app/           # Router, providers, App shell
├── components/    # Shared UI and layout
├── config/        # Env, navigation
├── features/      # Feature modules (auth, dashboard, …)
├── hooks/         # Route guards
├── lib/           # Supabase client, utilities
└── types/         # Database types
```

## Next Phase

Phase 2 — Customers & Weight Tracking
