# Lifeline Lahore — Blood Donor Availability Matcher

A blood donor matching platform for Lahore, Pakistan. Donors register their blood type and area with one-tap Google sign-in; searchers find eligible matches instantly and reach out directly.

## Highlights

- **One-tap Google login** — no OTP, no phone codes, no SMS costs
- **Instant registration** — name, email and avatar details prefilled from Google
- **Fast search** — eligible donors near you matched and notified immediately
- **Beautiful, mobile-first UI** designed to get people donating

## Architecture

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5
- **Database**: PostgreSQL 17 via Prisma ORM
- **Auth**: Google OAuth via NextAuth 5 (JWT sessions)
- **Cache/Rate limiting**: Upstash Redis (falls back to Postgres, then memory)
- **SMS**: Twilio (optional, donor notifications)
- **Email**: SendGrid (optional, donor notifications)
- **Validation**: Zod 4
- **Testing**: Vitest + Testing Library (180 tests)
- **Deployment**: Vercel (recommended) / Docker

## Prerequisites

- Node.js 20+
- PostgreSQL 17+ (or Upstash Redis)
- A Google OAuth client (for sign-in)

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url> && cd blood-donor-app
npm install
```

### 2. Environment setup

```bash
cp .env.example .env
# Edit .env with your Google OAuth + database credentials
```

### 3. Database setup

```bash
npx prisma generate
npx prisma db push
```

### 4. Start dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
app/                 # Next.js App Router pages and Server Actions
  actions/           # Server Actions (register, search, OTP, etc.)
  components/ui/     # Reusable UI components
  manage/            # Self-service dashboard
  register/          # Donor registration flow
  search/            # Search flow
  api/health/        # Health check endpoint

lib/                 # Application logic
  domain/            # Business logic (matching, eligibility, notify, rate-limiting)
  infra/             # Infrastructure adapters (Prisma, Redis, Twilio, SendGrid, NextAuth)
  validation/        # Zod input schemas
  presentation/      # UI labels

prisma/              # Database schema
scripts/             # Utility scripts (cleanup, load testing)
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (DB + Redis) |
| GET/POST | `/api/auth/[...nextauth]` | NextAuth Google OAuth handlers |

All other operations use Next.js Server Actions (POST via form/JSON).

## Key Features

- **Google OAuth registration**: One-tap sign-in; donors verify instantly with their Google account (no OTP costs)
- **Donor Registration**: Name, phone, blood type, areas, last donation date
- **Eligibility Computation**: Derived at query time (90-day cooldown)
- **Search**: By blood type + area, with nearby area expansion
- **Notifications**: SMS (Twilio) + email (SendGrid) to matched donors
- **Self-Service**: View your dashboard, eligibility and areas
- **Rate Limiting**: Per-IP sliding window across sensitive endpoints

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Start production server
npm test             # Run tests
npm run cleanup:searches  # Purge old Search records
```

## Docker

```bash
docker compose up --build
```

This starts PostgreSQL, Redis, and the app.

## Deployment

### Vercel (recommended)

1. Push this repo to GitHub and import it into Vercel.
2. Add the environment variables from `.env.example`.
3. Set the Google OAuth authorized redirect URI to `https://<your-app>.vercel.app/api/auth/callback/google`.
4. Deploy — the included GitHub Action (`.github/workflows/deploy.yml`) can auto-deploy on push to `main`.

### Docker

```bash
docker build -t blood-donor-app .
docker run -p 3000:3000 --env-file .env blood-donor-app
```

## CI/CD

GitHub Actions workflows:
- `.github/workflows/ci.yml` — Tests on push/PR to main
- `.github/workflows/deploy.yml` — Deploys to Vercel on push to main (requires `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` secrets)

## License

Private — internal use.
