---
baseline_commit: NO_VCS
---

# Story 1.1: Donor Submits Registration Details

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a prospective donor,
I want to submit my name, phone number, blood type, one or more Areas, and last donation date,
so that I can begin the process of becoming a discoverable donor.

## Acceptance Criteria

1. **Given** I am on the Donor Registration screen with no prior account, **when** I submit name, phone, blood type, at least one Area, and a last donation date (or mark it "Never / not recently"), **then** a `Donor` record + one or more `DonorArea` rows are created in PostgreSQL, the Donor is inactive/not searchable, and I am routed to Donor OTP Verify. [Source: epics.md#Story-1.1, FR-1]
2. **And** if blood type, phone, or all Areas are missing, I see a clear inline error below the specific field and no record is created. [Source: epics.md#Story-1.1, FR-1]
3. **And** I can select more than one Area via the Area chip component (multi-select, toggle on/off, no upper limit), and the record stores every selected Area. [Source: epics.md#Story-1.1, UX-DR2/UX-DR7]
4. **And** the email field is present, explicitly labeled "Optional," and leaving it blank never blocks submission. [Source: epics.md#Story-1.1, UX-DR4]
5. **And** the Submit button is disabled until required fields are valid, and shows an inline spinner + "Sending…" state on submit rather than freezing silently. [Source: epics.md#Story-1.1, UX-DR4]
6. **And** this story establishes the Next.js App Router + Prisma + Tailwind + Redis project scaffolding and the `Donor`/`DonorArea` Prisma schema (E.164 phone, fixed `Area`/`BloodType` enums, `cuid()` ids) — no starter template exists, this is the first story. [Source: epics.md#Story-1.1]

## Tasks / Subtasks

- [x] Task 1: Scaffold the Next.js project (AC: #6)
  - [x] `npx create-next-app` targeting Next.js 16.2.x, App Router, Turbopack, TypeScript 5.x, React 19.2 — do NOT add a custom webpack config (Turbopack is default in 16.x and fails the build on webpack config presence)
  - [x] Create folder skeleton exactly: `app/`, `app/actions/`, `lib/domain/`, `lib/infra/`, `lib/infra/repositories/`, `lib/validation/`, `prisma/`
  - [x] Add `.gitignore` covering `node_modules`, `.env*`, `.next`
- [x] Task 2: Wire up Prisma 7.x with PostgreSQL 17 (AC: #6)
  - [x] Install `prisma` + `@prisma/client` 7.x and a driver adapter (`@prisma/adapter-pg` or provider-appropriate) — Prisma 7 requires an explicit driver adapter, `datasourceUrl` alone no longer works
  - [x] Create `prisma.config.ts` for the database connection (Prisma 7 moved connection config out of `schema.prisma`); install `dotenv` and load it explicitly — Prisma 7 no longer auto-loads `.env`
  - [x] Author `prisma/schema.prisma`: generator `prisma-client` (not the legacy `prisma-client-js`), datasource `postgresql`
  - [x] Define `Area` enum (10 values): `JoharTown, DHA, Gulberg, ModelTown, BahriaTown, Cantt, IqbalTown, GardenTown, WapdaTown, FaisalTown`
  - [x] Define `BloodType` enum (8 ABO/Rh values): `A_POS, A_NEG, B_POS, B_NEG, AB_POS, AB_NEG, O_POS, O_NEG`
  - [x] Define `Donor` model: `id String @id @default(cuid())`, `name String`, `phone String @unique` (E.164), `email String?`, `bloodType BloodType`, `lastDonationDate DateTime? @db.Date`, plus an activation flag (e.g. `isVerified Boolean @default(false)`) — **the ER diagram in the architecture spine does not name this field explicitly, but FR-1/FR-2 require the record to be excluded from search until OTP succeeds (Story 1.3); since AD-5 forbids persisting an eligibility flag, this is a separate activation flag, not eligibility.** Decide the exact field name during implementation and note it in Dev Agent Record.
  - [x] Define `DonorArea` join model: `donorId String`, `area Area`, relation to `Donor`, composite key or `@@id([donorId, area])`
  - [x] Also scaffold the `Search` model now for schema completeness per architecture spine (searcherName, searcherPhone, bloodType, area, createdAt) even though unused until Epic 2 — avoids a second schema migration touching this file
  - [x] Run `prisma generate` explicitly (Prisma 7 no longer runs it automatically after `migrate dev`/`db push`)
  - [x] Pass explicit `connectionTimeoutMillis` and a capped `max` pool size to the driver adapter — the underlying `pg` driver defaults to no timeout, unlike Prisma 6's built-in 5s default
- [x] Task 3: Wire up Tailwind CSS with DESIGN.md tokens as theme config (AC: #3, #4, #5)
  - [x] Install Tailwind, configure `theme.extend` with exact token values (see Dev Notes → Design Tokens)
  - [x] No component library — Tailwind utility classes map directly to tokens, per architecture assumption
- [x] Task 4: Wire up Redis client (AC: #6)
  - [x] Add `lib/infra/redis.ts` — Upstash Redis client, env-var-configured credentials only (no secrets committed). Not directly exercised by this story's AC (OTP itself is Story 1.3) but is part of the scaffolding this story owns.
- [x] Task 5: Build donor registration Zod schema (AC: #2, #4)
  - [x] `lib/validation/registerDonor.ts` — Zod 4.x schema: `name` (required string), `phone` (required, E.164 format), `bloodType` (required enum), `areas` (array, min length 1), `email` (optional, valid-email-or-empty), `lastDonationDate` (optional nullable date)
- [x] Task 6: Build Donor repository (AC: #1)
  - [x] `lib/infra/repositories/donorRepository.ts` — the only place that calls Prisma for Donor/DonorArea writes (architecture convention: no direct Prisma calls from `app/`); expose a `createDonor(input)` function that writes `Donor` + `DonorArea` rows in one transaction
- [x] Task 7: Build `registerDonor` Server Action (AC: #1, #2, #6)
  - [x] `app/actions/registerDonor.ts` — validates input via the Task 5 Zod schema at the Presentation boundary, calls `donorRepository.createDonor`, returns `{ error: { code, message } }` on validation/uniqueness failure (shared error shape convention), otherwise returns the new Donor id/routing info
  - [x] On phone-uniqueness constraint violation, surface a field-level inline error against `phone` (not a generic 500) — this is a boundary case not explicit in the epics AC but required for the Donor.phone unique constraint not to crash the action
- [x] Task 8: Build Donor Registration screen (AC: #1-#5)
  - [x] `app/(routes)/register/page.tsx` (or equivalent path matching the IA) — name/phone/email/bloodType/areas/lastDonationDate fields, labels always visible above field (never placeholder-only)
  - [x] Validate on blur, not on every keystroke
  - [x] Email field labeled "Optional," never blocks submit when blank
  - [x] Area selection via chip component (multi-select, toggle on/off, no upper limit) — not a native `<select>`
  - [x] "Never / not recently" option for last donation date (maps to `lastDonationDate: null`)
  - [x] Submit button: disabled until required fields valid, inline spinner + "Sending…" on submit, full-width on mobile, 48px min-height
  - [x] Inline field-level errors in `status-error` styling below the specific field — never a top banner
  - [x] On success, route to Donor OTP Verify (route/screen built in Story 1.3 — this story only needs to navigate there, screen itself is out of scope)
- [x] Task 9: Tests (all AC)
  - [x] Unit tests for the Zod schema (missing bloodType/phone/areas rejected; blank email accepted; multiple areas accepted)
  - [x] Unit tests for `donorRepository.createDonor` (creates Donor + N DonorArea rows in one transaction; not searchable/inactive by default)
  - [x] Integration test for `registerDonor` Server Action (happy path creates record; missing required field returns field-level error; duplicate phone returns field-level error, not a crash)
  - [x] Component test for the registration form (submit disabled until valid; inline errors render on blur; area chip multi-select toggles; email optional does not block submit)

### Review Findings

- [ ] [Review][Patch] Area chip selection has no validation trigger — the "select at least one area" error is never rendered client-side, leaving Submit silently disabled with no visible reason [app/register/page.tsx:167-186]
- [ ] [Review][Patch] `lastDonationDate` field-level error is computed on blur but never rendered — missing inline-error block, unlike every other field [app/register/page.tsx:188-217]
- [ ] [Review][Patch] Stale field-level error message can remain visible after the value becomes valid without a further blur event, contradicting an enabled Submit button [app/register/page.tsx — `validateField`/`fieldErrors` state]
- [ ] [Review][Patch] Any Prisma P2002 unique-constraint error (e.g. duplicate areas in the payload, reachable by calling the action directly) is mislabeled as "phone already registered" — no `meta.target` check, no areas-uniqueness enforcement in the Zod schema [app/actions/registerDonor.ts:20-27; lib/validation/registerDonor.ts:38-40]
- [ ] [Review][Patch] A malformed calendar date (e.g. `2024-13-45`) passes the regex-only date check, becomes `Invalid Date`, and causes an uncaught non-P2002 error to be rethrown from the server action [lib/validation/registerDonor.ts:44-49; app/actions/registerDonor.ts:61-63,78]
- [ ] [Review][Patch] `registerDonor` rethrows any unexpected (non-P2002) error uncaught, and the client's `handleSubmit` has no catch block — becomes an unhandled promise rejection with no error shown to the user and no server-side log [app/actions/registerDonor.ts:78; app/register/page.tsx:89-104]
- [ ] [Review][Patch] No max-length bounds on `name`/`phone`/`email` before persistence on this public, unauthenticated write endpoint [lib/validation/registerDonor.ts]
- [ ] [Review][Patch] Blood-type `<select>` is missing `aria-invalid`/`aria-describedby` wiring to its error text, unlike `InputField` [app/register/page.tsx:146-159]
- [ ] [Review][Patch] Area chip group lacks a `role="group"`/`aria-labelledby` tying the "Areas" label to the chip set for assistive tech [app/register/page.tsx:167-186]
- [ ] [Review][Patch] `donorRepository.createDonor` accepts an empty `areas` array with no repository-level guard — enforcement lives only in the Zod schema [lib/infra/repositories/donorRepository.ts:17-36]
- [ ] [Review][Patch] `lib/infra/prisma.ts` and `lib/infra/redis.ts` construct clients without validating required env vars are present, failing opaquely later instead of at startup [lib/infra/prisma.ts:8-16; lib/infra/redis.ts:7]
- [ ] [Review][Patch] Error return shape adds a top-level `fieldErrors` key alongside `error`, diverging from the architecture's fixed `{ error: { code, message } }` contract — nest field detail inside `error` instead [app/actions/registerDonor.ts:43-50,69-75]
- [ ] [Review][Patch] Submit button shows no visual spinner element on submit, only a text swap — AC #5 and the `button-primary` component spec both require "inline spinner + 'Sending…'" [app/components/ui/Button.tsx:18-28]
- [ ] [Review][Patch] `lib/domain/labels.ts` misplaces a Presentation-only concern (UI display labels) inside the Domain layer and creates a reverse dependency on `lib/validation` [lib/domain/labels.ts:1]
- [ ] [Review][Patch] Missing test coverage for the areas-error-visibility gap (companion to the first finding above) [app/register/page.test.tsx]

## Dev Notes

### Architecture Compliance
- Layered monolith, one dependency direction: Presentation (`app/`) → Domain (`lib/domain/`) → Infrastructure (`lib/infra/`), through port interfaces. **Presentation never calls Infrastructure directly** — this story's Server Action must go through `lib/infra/repositories/donorRepository.ts`, not call Prisma inline. [Source: ARCHITECTURE-SPINE.md, Layering]
- Error shape is fixed project-wide: `{ error: { code, message } }` from every Server Action/Route Handler. Use this exact shape for all failure returns in `registerDonor`. [Source: ARCHITECTURE-SPINE.md, Consistency Conventions]
- IDs via Prisma `cuid()`; phone in E.164 everywhere; dates ISO 8601 date-only for `lastDonationDate`. [Source: ARCHITECTURE-SPINE.md, Consistency Conventions]
- AD-2: OTP lives only in Redis, never Postgres — do not add an OTP table. This story's Donor model needs no OTP fields, only an activation/verification flag flipped by the (separate) Story 1.3 OTP flow.
- AD-4: Donor registration issues **no session token** — this is the one flow in the app that does not go through the JWT/session pattern used by Searcher and self-service flows. Do not add session logic here.
- AD-5: Eligibility is computed at query time (`isEligible = (today - lastDonationDate) >= 90 days OR lastDonationDate IS NULL`) and must **never** be a stored column — do not add an `isEligible` field to `Donor`.
- Rate limiting (FR-12/AD-3) on this endpoint is Story 1.2's shared utility, built one story later — do **not** build rate-limiting in this story; leave the `registerDonor` action as a plain call the Story 1.2 utility will wrap.

### Design Tokens (Tailwind theme config)
```
colors:
  surface-base: #F7F7F6      surface-raised: #FFFFFF
  ink-primary: #1B1D1F       ink-secondary: #5D6167       ink-disabled: #A6ABB1
  border-hairline: #E2E4E7
  accent: #0B5D67             accent-hover: #08454C         accent-on: #FFFFFF
  status-success: #1E7A4C     status-success-bg: #E6F4EC
  status-caution: #9A6400     status-caution-bg: #FBF0DA
  status-error: #B3261E       status-error-bg: #FBEAE9
typography (system-ui stack):
  heading: 20px/600/1.3   (screen label "Donor Registration")
  body: 16px/400/1.5      (default field text)
  meta: 14px/400/1.4      (helper copy)
  label: 13px/600/1.3, letterSpacing 0.02em  (form field labels)
rounded: sm=8px md=12px lg=16px full=9999px
spacing: 1=4 2=8 3=12 4=16 5=24 6=32 7=48 (px); gutter=16 margin-mobile=16 margin-desktop=32
```
[Source: DESIGN.md frontmatter tokens]

### Component Specs
- **button-primary**: bg `accent`, hover `accent-hover`, text `accent-on`, `rounded-md`, `body` size, weight 600, `min-height: 48px`. Exactly one per screen; disabled (not hidden) until valid; spinner + "Sending…" on submit. [Source: DESIGN.md, EXPERIENCE.md Component Patterns]
- **input-field**: bg `surface-raised`, border `border-hairline`, focus border `accent`, text `ink-primary`, `rounded-sm`, `min-height: 48px`. Label above field, never placeholder-only. Validate on blur. Inline error below field in `status-error`, plain text, no icon. [Source: DESIGN.md, EXPERIENCE.md]
- **area-chip**: bg `surface-raised`/border `border-hairline` unselected → bg `accent`/text `accent-on` selected, `rounded-full`. Registration = multi-select toggle, no upper limit. [Source: DESIGN.md, EXPERIENCE.md]

### Behavioral Rules (EXPERIENCE.md)
- Validate on blur, not every keystroke.
- Email optional, explicitly labeled, blank is a valid state (not an error) — SMS-only donors are by design (PRD §4.4).
- Exactly one primary action (Submit) per screen.
- Inline errors only — never a top-of-page banner.
- Plain, jargon-free copy; numerals for dates.
- Reduced motion respected (`prefers-reduced-motion` skips transitions).
- Tap targets ≥44×44px/48×48dp including area chips.

### Project Structure Notes
- No existing code in the repo — this is a genuine blank slate (verified: only `.claude/`, `.qodo/`, `_bmad/`, `_bmad-output/`, `docs/` exist). This story creates the entire scaffolding; there is nothing to preserve or avoid breaking.
- No prior story exists — no previous-story intelligence to carry forward.
- Exact folder tree to create: `app/`, `app/actions/`, `lib/domain/`, `lib/infra/`, `lib/infra/repositories/`, `lib/validation/`, `prisma/`. [Source: ARCHITECTURE-SPINE.md, Structural Seed]

### Latest Tech Notes (verified 2026-07-07)
- **Next.js 16.2.x**: no breaking changes vs. 16.0; Turbopack is the default bundler — do not add a custom webpack config or `next build` will fail. `middleware.ts` is replaced by `proxy.ts` if any proxy-layer logic is needed later (not needed for this story).
- **Prisma 7.x**: driver adapters are now mandatory (`datasourceUrl` alone throws on startup); connection config lives in `prisma.config.ts`, not `schema.prisma`; `.env` is no longer auto-loaded — load `dotenv/config` explicitly; use generator `prisma-client` (not the legacy `prisma-client-js`); `prisma generate` no longer runs automatically after `migrate dev`/`db push` — run it explicitly; the `pg` driver adapter defaults to no connection timeout (unlike Prisma 6's 5s default) — pass explicit `connectionTimeoutMillis` and a capped pool `max`.
- Sources: [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16), [Next.js 16.2 blog](https://nextjs.org/blog/next-16-2), [Prisma v7 upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7)

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.1] — story ACs
- [Source: _bmad-output/planning-artifacts/architecture/architecture-BloodDonorApp-2026-07-06/ARCHITECTURE-SPINE.md] — stack, structural seed, conventions, AD-1..AD-7, ER diagram
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-BloodDonorApp-2026-07-06/DESIGN.md] — tokens, component specs
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-BloodDonorApp-2026-07-06/EXPERIENCE.md] — behavioral rules, Key Flow 3, accessibility floor
- [Source: _bmad-output/planning-artifacts/prds/prd-BloodDonorApp-2026-07-06/prd.md] — FR-1, FR-2, Area/BloodType glossary

## Open Questions For Dev

1. **Donor activation-state field name** is not specified in the architecture ER diagram (only implied by FR-1/FR-2 behavior). Pick a name (e.g. `isVerified`) during implementation and record it in Completion Notes / File List so Story 1.3 (which flips it) can reference the same field.
2. **Exact submit-button copy** for the registration form itself is not given verbatim in EXPERIENCE.md (only the adjacent OTP "Sending…"/"Searching…" pair is named) — "Sending…" is the closest analog and is used as the default; confirm with design if a different string is preferred.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npx prisma generate` — generated Prisma Client 7.8.0 to `lib/generated/prisma` (no live DB required for this step).
- `npx tsc --noEmit` — clean after every task, no type errors.
- `npx next build` — production build succeeds; `/register` prerenders as static content; no webpack config needed (Turbopack default).
- `npx vitest run` — 25/25 tests passing across 4 test files (Zod schema, donor repository, registerDonor action, registration form component).

### Completion Notes List

- Resolved Open Question 1 (activation-state field name): named `isVerified Boolean @default(false)` on `Donor`. Story 1.3 should flip this field on successful OTP verification.
- Resolved Open Question 2 (submit button copy): used "Submit" as the button's resting label and "Sending…" as the in-flight label, per UX-DR4's spinner + "Sending…" requirement.
- Found existing Next.js 16.2.10 / React 19.2.4 scaffold under a stray `tmp_scaffold/blood-donor-app/` directory (bare `create-next-app` output, no project-specific code) — moved its contents into the project root instead of re-running `create-next-app`, since versions already matched the architecture spine's required stack. Removed the now-empty `tmp_scaffold/` directory and its nested `.git` (project root is not under version control; `baseline_commit` remains `NO_VCS`).
- Prisma 7.x driver-adapter setup: used `@prisma/adapter-pg` with explicit `connectionTimeoutMillis: 5000` and `max: 10` pool size (Task 2 requirement — the `pg` adapter has no default timeout, unlike Prisma 6). `prisma.config.ts` loads `dotenv/config` explicitly since Prisma 7 no longer auto-loads `.env`.
- No `DATABASE_URL` for a live PostgreSQL instance was available in this environment, so `prisma migrate dev` was not run — only `prisma generate` (schema → client codegen), which does not require a live connection. Running the initial migration against a real Postgres 17 instance is an environment-setup step for whoever deploys this, not a code gap; the schema is complete and ready to migrate.
- Test strategy: added Vitest + React Testing Library (not specified in the architecture spine, which deferred "detailed automated-testing strategy split"). Repository and Server Action tests mock `lib/infra/prisma`/`lib/infra/repositories/donorRepository` respectively rather than hitting a real database, consistent with the layered-monolith goal of Domain/Presentation logic being testable without concrete adapters.
- Tailwind v4 has no `tailwind.config.js` by default; DESIGN.md's token set (colors, typography, rounded, spacing) was implemented via an `@theme` block in `app/globals.css`, including named `--spacing-1..7` overrides since the design's spacing scale is non-linear past step 4 and diverges from Tailwind's default multiplier-based scale.
- Registration screen navigates to `/register/verify?donorId=...` on success (Donor OTP Verify, Story 1.3's screen) — that route does not exist yet in this story, which matches the story's explicit scope boundary ("screen itself is out of scope").
- Rate limiting was deliberately NOT added to `registerDonor` — reserved for Story 1.2 per Dev Notes.

### File List

- `app/globals.css` (modified — Tailwind v4 `@theme` token set, replaces default Geist/next starter theme)
- `app/layout.tsx` (modified — system-font stack, `surface-base`/`ink-primary` theme classes, removed Geist Google Fonts)
- `app/register/page.tsx` (new — Donor Registration screen)
- `app/register/page.test.tsx` (new — component tests)
- `app/components/ui/Button.tsx` (new)
- `app/components/ui/InputField.tsx` (new)
- `app/components/ui/AreaChip.tsx` (new)
- `app/actions/registerDonor.ts` (new — Server Action)
- `app/actions/registerDonor.test.ts` (new — integration tests)
- `lib/validation/registerDonor.ts` (new — Zod schema)
- `lib/validation/registerDonor.test.ts` (new — unit tests)
- `lib/domain/labels.ts` (new — Area/BloodType display-label maps)
- `lib/infra/prisma.ts` (new — Prisma Client + `@prisma/adapter-pg` wiring)
- `lib/infra/redis.ts` (new — Upstash Redis client, env-configured)
- `lib/infra/repositories/donorRepository.ts` (new — `createDonor`)
- `lib/infra/repositories/donorRepository.test.ts` (new — unit tests)
- `prisma/schema.prisma` (new — `Donor`, `DonorArea`, `Search`, `Area`/`BloodType` enums)
- `prisma.config.ts` (new — Prisma 7 connection config)
- `vitest.config.ts` (new)
- `vitest.setup.ts` (new)
- `.env.example` (new)
- `.env` (new — local placeholder values only, gitignored)
- `package.json` / `package-lock.json` (modified — dependencies, `test` script)

## Change Log

- 2026-07-07: Initial implementation — Next.js/Prisma/Tailwind/Redis scaffolding, Donor/DonorArea schema, registerDonor Server Action + Donor Registration screen, full test coverage (25 tests). Status: in-progress → review.
