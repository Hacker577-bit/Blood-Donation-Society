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
  admin/             # Password-protected donor management
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
npm run db:seed      # Insert/update donors from scripts/donors.csv
npm run cleanup:searches  # Purge old Search records
```

## Managing Donor Data

Donors can be added in three ways:

1. **Self-registration (recommended):** Donors sign in with Google on the app
   and fill the registration form. Records are created automatically.
2. **Admin panel:** Open `/admin`, sign in with the shared `ADMIN_PASSWORD`,
   and add/delete donors straight from the web. Great for the society admin.
3. **Seed script:** Add rows to `scripts/donors.csv` (name, phone, bloodType,
   semicolon-separated areas, lastDonationDate, email) and run
   `npm run db:seed` with `DATABASE_URL` set. Rows are upserted by phone number,
   so re-running is safe. Example:
   ```bash
   DATABASE_URL=postgresql://... npm run db:seed
   ```

To use the admin panel, set `ADMIN_PASSWORD` in your environment (Vercel →
Project → Settings → Environment Variables) and visit `https://<your-app>.vercel.app/admin`.
Admin sessions last 12 hours and are secured with an httpOnly, signed cookie
(backed by `AUTH_SECRET`).

Phone numbers must be international format (`+92...`). Blood types use the enum
codes `A_POS`, `A_NEG`, `B_POS`, `B_NEG`, `AB_POS`, `AB_NEG`, `O_POS`, `O_NEG`.
Areas are one or more of `JoharTown;DHA;Gulberg;ModelTown;BahriaTown;Cantt;IqbalTown;GardenTown;WapdaTown;FaisalTown`.
Leave `lastDonationDate` empty for donors who have never donated. The 90-day
eligibility window is computed automatically at search time.

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
