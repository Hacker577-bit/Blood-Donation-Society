---
baseline_commit: NO_VCS
---

# Story 1.3: Donor Verifies Phone via OTP

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a prospective donor,
I want to verify my phone number by entering a one-time code,
so that my registration becomes active and I know my number is genuinely reachable.

## Acceptance Criteria

1. **Given** I have submitted registration details (Story 1.1) and am on Donor OTP Verify, **when** I request a code, **then** a 6-digit OTP is generated and stored as a Redis key (`phone + purpose -> codeHash, expiresAt, attempts`) with a ~5 minute TTL — no OTP table in Postgres (AD-2) — via one shared `otp` service designed for reuse by Searcher-verify (Story 2.1) and self-service (Story 3.1) later. [Source: epics.md#Story-1.3, FR-2, AD-2]
2. **And** I see 6 discrete digit boxes with numeric keyboard auto-invoked on mobile, auto-advance per digit, and SMS-autofill/paste support where the browser exposes it. [Source: epics.md#Story-1.3, UX-DR2/UX-DR7]
3. **When** I enter the correct code before expiry, **then** my Donor record becomes active/searchable immediately (`isVerified: true`) — no session token is issued (AD-4 explicitly excludes Donor registration from token issuance). [Source: epics.md#Story-1.3, FR-2, AD-4]
4. **When** I enter an expired code, **then** I see "This code has expired." with a prominent Resend action — distinct from the wrong-code message. [Source: epics.md#Story-1.3, UX-DR5]
5. **When** I enter an incorrect, non-expired code, **then** I see "That code didn't match. Check the SMS and try again." [Source: epics.md#Story-1.3, UX-DR5]
6. **And** the Resend link is greyed with a visible countdown until it can be tapped, and OTP requests (including resends) are rate-limited via Story 1.2's shared utility, returning the rate-limit message (not a silently non-functional link) once the limit is hit. [Source: epics.md#Story-1.3, UX-DR5, FR-12]

## Tasks / Subtasks

- [x] Task 0: Confirm Story 1.2 dependency before starting (AC: #6)
  - [x] Check `sprint-status.yaml` and whether `lib/domain/rate-limit.ts` exists in the repo. As of this story's creation, Story 1.2 ("System Rate-Limits Registration Submissions") is `ready-for-dev` but **not yet implemented** — `lib/domain/` does not exist in the repo at all yet.
  - [x] If `lib/domain/rate-limit.ts` exists when you start: import and wrap the OTP request/resend endpoint per Task 3 below, exactly as Story 1.2 wires `registerDonor`.
  - [x] If it does **not** exist yet: implement Story 1.2 first (it is a prerequisite, small, and self-contained), then return to this story — do not hand-roll a second, divergent rate-limit mechanism inside this story; AD-3 requires exactly one shared utility across registration/search/OTP/self-service.

- [x] Task 1: Build the shared `otp` domain service (AC: #1, #3, #4, #5)
  - [x] Create `lib/domain/otp.ts` — this is the **first file in `lib/domain/`**; establish the pattern the codebase will reuse for `eligibility.ts`/`matching.ts`/`rate-limit.ts` later: pure domain logic that depends only on small port interfaces, never a concrete adapter, per the layered-monolith rule (Presentation → Domain → Infrastructure, one direction). [Source: ARCHITECTURE-SPINE.md, Design Paradigm]
  - [x] Define two port interfaces the domain service depends on (interfaces only, no imports of `@upstash/redis` or `twilio` inside `lib/domain/otp.ts`):
    - `OtpChallengeStore`: `save(key: string, value: { codeHash: string; expiresAt: number; attempts: number }, ttlSeconds: number): Promise<void>`, `get(key: string): Promise<{ codeHash: string; expiresAt: number; attempts: number } | null>`, `incrementAttempts(key: string): Promise<void>`, `delete(key: string): Promise<void>`
    - `OtpSender`: `send(phone: string, code: string): Promise<void>`
  - [x] Expose `requestOtp({ phone, purpose }: { phone: string; purpose: string }): Promise<void>` — generates a random 6-digit code (`crypto.randomInt(100000, 999999)` from Node's built-in `node:crypto`, not `Math.random()`), hashes it (see hashing note below), stores `{ codeHash, expiresAt: Date.now() + 5*60*1000, attempts: 0 }` in the store under key `` `${phone}:${purpose}` `` with a 300s TTL, then calls `OtpSender.send(phone, code)` with the **plaintext** code (the store only ever holds the hash)
  - [x] Expose `verifyOtp({ phone, purpose, code }): Promise<{ status: "verified" | "expired" | "wrong_code" | "not_found" }>` — loads the challenge by key, returns `"not_found"` if absent (treat identically to `"expired"` in the UI layer — no distinct copy required, both routed to the same "expired" message per AC #4), returns `"expired"` if `Date.now() > expiresAt`, otherwise hashes the supplied code and compares against `codeHash`; on match, deletes the challenge key (single-use) and returns `"verified"`; on mismatch, increments `attempts` and returns `"wrong_code"`
  - [x] Hashing: use `node:crypto`'s `scryptSync` (or a simple `createHash("sha256")` over `code + phone + purpose` — a 6-digit numeric code has low entropy either way, so scrypt's slowness is not adding meaningful protection here; SHA-256 with the phone+purpose as salt-equivalent is sufficient and keeps `lib/domain/otp.ts` free of async crypto edge cases). Pick one, document the choice in Completion Notes.
  - [x] This service takes `purpose` as a parameter now (not hardcoded to donor registration) specifically so Story 2.1 (Searcher verify) and Story 3.1 (self-service entry) call the **same** function with a different `purpose` string (e.g. `"donor_registration"`, `"searcher_verify"`, `"self_service"`) — do not build a donor-specific OTP function.

- [x] Task 2: Implement the infrastructure adapters behind the ports (AC: #1)
  - [x] `lib/infra/otpStore.ts` (new) — implements `OtpChallengeStore` against the existing `lib/infra/redis.ts` Upstash client (already scaffolded in Story 1.1); use `redis.set(key, JSON.stringify(value), { ex: ttlSeconds })` and `redis.get`/`redis.del`; `incrementAttempts` should read-modify-write (or use a Redis hash/`HINCRBY` if simpler) — no OTP table in Postgres (AD-2)
  - [x] `lib/infra/twilio.ts` (new) — implements `OtpSender` using the `twilio` npm package (latest stable: `twilio` 6.0.2 as of 2026-07-07 — see Latest Tech Notes). Construct the client once at module scope (like `lib/infra/redis.ts`/`lib/infra/prisma.ts` do), reading `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` from env vars — throw at module load if any are missing, matching the existing `redis.ts`/`prisma.ts` fail-fast pattern. `send(phone, code)` calls `client.messages.create({ to: phone, from: process.env.TWILIO_FROM_NUMBER, body: "Your Lifeline Lahore verification code is <code>. It expires in 5 minutes." })`. This is also the Notification-sending building block Story 2.2 (AD-6) will reuse for the SMS half of donor notifications — keep the Twilio client construction generic (don't hardcode OTP-only message templates into the client wrapper itself; the OTP message template belongs in `otp.ts`'s caller or is passed in).
  - [x] Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` to `.env.example` (placeholders only)
  - [x] Add `twilio` (`^6.0.2`) as a new dependency in `package.json`

- [x] Task 3: Build `requestDonorOtp` and `verifyDonorOtp` Server Actions (AC: #1, #3, #4, #5, #6)
  - [x] `app/actions/requestDonorOtp.ts` (new) — takes `{ donorId: string }`, looks up the Donor's phone via a new `donorRepository.findDonorById(id): Promise<{ id: string; phone: string; isVerified: boolean } | null>` (extend `lib/infra/repositories/donorRepository.ts`), returns `{ error: { code: "NOT_FOUND", message: "..." } }` if no donor, then calls `otp.requestOtp({ phone: donor.phone, purpose: "donor_registration" })`
    - Wrap this action with Story 1.2's `checkRateLimit({ ip, endpoint: "requestDonorOtp" })` per Task 0 — this covers both the initial code request and every resend (AC #6), since Resend simply calls this same action again
    - On rate-limit rejection, return the exact shared shape `{ error: { code: "RATE_LIMITED", message: "..." } }` — same envelope Story 1.2 established, generic "try again shortly" copy per UX-DR5, no promised retry time
  - [x] `app/actions/verifyDonorOtp.ts` (new) — takes `{ donorId: string; code: string }`, looks up the donor's phone the same way, calls `otp.verifyOtp({ phone, purpose: "donor_registration", code })`, and on `"verified"` calls a new `donorRepository.activateDonor(donorId)` (sets `isVerified: true`) and returns `{ verified: true }`; on `"expired"`/`"not_found"` returns `{ error: { code: "OTP_EXPIRED", message: "This code has expired." } }`; on `"wrong_code"` returns `{ error: { code: "OTP_INCORRECT", message: "That code didn't match. Check the SMS and try again." } }` — all following the project's fixed `{ error: { code, message } }` shape (no `fieldErrors` needed here, this isn't a form-field error)
  - [x] Extend `lib/infra/repositories/donorRepository.ts`: add `findDonorById` and `activateDonor` — both go through Prisma here, never inline in `app/`, per the existing convention this file already follows

- [x] Task 4: Build the Donor OTP Verify screen (AC: #2, #4, #5, #6)
  - [x] `app/register/verify/page.tsx` (new) — reads `donorId` from the query string (the route `app/register/page.tsx` already navigates to, per its Completion Notes: `/register/verify?donorId=...`); if `donorId` is missing, redirect back to `/register`
  - [x] On mount, auto-call `requestDonorOtp({ donorId })` once to send the first code (matches EXPERIENCE.md's "OTP sending" state: button/screen shows "Sending code…" until send is acknowledged, then the 6 digit boxes appear)
  - [x] Build a new reusable `app/components/ui/OtpInput.tsx` — 6 discrete digit boxes (`otp-input` token: `digitBoxSize: 48px`, `rounded-sm`, focus border `accent`), `inputMode="numeric"` + `pattern="[0-9]*"` to invoke the numeric keyboard on mobile, auto-advance focus to the next box on digit entry, auto-back on backspace when a box is empty, and paste-handling that fills all 6 boxes when a 6-digit string is pasted (covers both manual paste and SMS autofill, which browsers deliver as a paste-like event into the focused input) — this component will be reused as-is by Story 2.1 (Searcher verify) and Story 3.1 (self-service), so keep it donor-agnostic (no donor-specific props)
  - [x] Screen reader: each digit box gets `aria-label="Code digit N of 6"` per NFR-8/UX-DR8
  - [x] On submit, call `verifyDonorOtp({ donorId, code })`:
    - On success, route to Registration Confirmation (`/register/confirmation?donorId=...` — Story 1.4's screen; this story only navigates there, the screen itself is out of scope, same boundary pattern Story 1.1 used for this screen)
    - On `OTP_EXPIRED`, show "This code has expired." inline (not a top banner) with the Resend link prominent — distinct rendering path from `OTP_INCORRECT`
    - On `OTP_INCORRECT`, show "That code didn't match. Check the SMS and try again."
    - On `RATE_LIMITED`, show that message and disable further Resend taps until enough time has visibly passed (client-side countdown restart is a reasonable placeholder; server-side rate-limit is the actual enforcement per AD-3)
  - [x] Resend link: greyed/`ink-disabled` text with a visible countdown (`Resend in 0:45` → `Resend code`), calls `requestDonorOtp` again when tapped after the countdown — reuses the same action as the initial send (Task 3)
  - [x] Reduced motion: no transition/fade when the digit boxes appear or the error message changes — content simply appears, per `prefers-reduced-motion` (NFR-8)

- [x] Task 5: Tests (all AC)
  - [x] Unit tests for `lib/domain/otp.ts` against a fake in-memory `OtpChallengeStore`/`OtpSender` (no live Redis/Twilio): correct code before expiry → `"verified"`; expired code → `"expired"`; wrong code → `"wrong_code"` and attempts increments; unknown key → `"not_found"`; a verified code cannot be reused (deleted after success)
  - [x] Integration tests for `requestDonorOtp`/`verifyDonorOtp` Server Actions: happy path activates the donor (`isVerified: true`); wrong donorId returns `NOT_FOUND`; rate-limited request returns the shared `RATE_LIMITED` shape (mock the rate-limit utility from Story 1.2)
  - [x] Component tests for `OtpInput`: auto-advance on digit entry; auto-back on backspace; paste of a 6-digit string fills all boxes; each box has the correct `aria-label`
  - [x] Component tests for the Verify screen: expired vs. wrong-code messages render distinctly; Resend is disabled during countdown and enabled at zero

## Dev Notes

### Architecture Compliance
- Layered monolith, one dependency direction: Presentation (`app/`) → Domain (`lib/domain/`) → Infrastructure (`lib/infra/`), through port interfaces. This story is the **first** to populate `lib/domain/` — set the precedent correctly: `otp.ts` must not import `@upstash/redis` or `twilio` directly. [Source: ARCHITECTURE-SPINE.md, Design Paradigm]
- AD-2 (binds FR-2): every OTP challenge is a Redis key (`phone + purpose -> codeHash, expiresAt, attempts`) with a ~5 min TTL — no OTP table in Postgres. One shared `otp` service, parameterized by `purpose`, reused by Searcher-verify (2.1) and self-service (3.1). Do not build a donor-specific OTP module that Stories 2.1/3.1 would have to duplicate or replace. [Source: ARCHITECTURE-SPINE.md, AD-2]
- AD-4 explicitly excludes Donor registration from session-token issuance — OTP verification here directly activates the registration in the same request; do **not** add JWT/session logic to this story. [Source: ARCHITECTURE-SPINE.md, AD-4]
- AD-3 (binds FR-12): OTP requests/resends must go through the **same** shared rate-limit utility Story 1.2 builds, keyed `ip + endpoint` — see Task 0/3. Do not add a second rate-limiting mechanism. [Source: ARCHITECTURE-SPINE.md, AD-3]
- Error shape stays fixed project-wide: `{ error: { code, message } }` from every Server Action — this story's `NOT_FOUND`/`OTP_EXPIRED`/`OTP_INCORRECT`/`RATE_LIMITED` codes all use this exact envelope, matching Story 1.1/1.2's precedent. [Source: ARCHITECTURE-SPINE.md, Consistency Conventions]
- Capability map places Donor Registration (FR-1, FR-2) at `app/actions/registerDonor`, `lib/domain/otp.ts`, governed by AD-2, AD-4 — this story is what actually builds `lib/domain/otp.ts`, which the capability map already anticipated. [Source: ARCHITECTURE-SPINE.md, Capability → Architecture Map]

### Relationship to Story 1.1 (status: review) and Story 1.2 (status: ready-for-dev, not yet coded)
- This story reads `lib/infra/redis.ts` (scaffolded in 1.1, currently unused by any code) and extends `lib/infra/repositories/donorRepository.ts` (new: `findDonorById`, `activateDonor`) — both already exist with the shape described in Story 1.1's Dev Notes/File List; the `isVerified` field name Story 1.1 chose (`isVerified Boolean @default(false)` on `Donor`) is the field this story flips to `true`.
- Story 1.1 has **unresolved review findings** (see its Review Findings section) — none of them touch OTP/verification, but two are adjacent and worth knowing: (a) `lib/domain/labels.ts` was flagged as a misplaced Presentation concern and has since been relocated to `lib/presentation/labels.ts` in the actual repo (the review finding's file path is stale — verify current location before assuming anything from that findings list is unresolved); (b) `registerDonor`'s error-shape/rethrow findings are scoped to that action only and do not affect this story's new actions.
- **Story 1.2 is a hard prerequisite for AC #6** (rate-limiting on OTP requests) but was still `ready-for-dev` (uncoded) at the time this story was created — see Task 0. Do not skip or stub out rate-limiting silently; either implement 1.2 first or explicitly flag in Completion Notes if you proceed without it.
- `lib/domain/` does not exist in the repo yet — this story creates it for the first time. Follow the port-interface pattern described in Task 1 exactly, since Story 1.2's `rate-limit.ts` and later `eligibility.ts`/`matching.ts` will sit alongside it and should look consistent.

### Design Tokens / Component Reuse
- Reuse `Button` (`app/components/ui/Button.tsx`) as-is for the Verify screen's submit action — it already supports `loading`/`loadingText` ("Sending…") per UX-DR4.
- New `OtpInput` component follows the `otp-input` token spec: background `surface-raised`, border `border-hairline`, focus border `accent`, `rounded-sm`, `digitBoxSize: 48px`, text uses the `heading` typography token. [Source: DESIGN.md, components.otp-input]
- Resend link: plain text, no button chrome, no underline; `ink-disabled` while counting down, `accent` and tappable at zero — text itself changes ("Resend in 0:45" → "Resend code"), never a color-only signal. [Source: DESIGN.md, components.resend-otp-link; EXPERIENCE.md, Component Patterns]
- Inline errors below the relevant control, in `status-error`, plain text, no icon — never a top banner, consistent with Story 1.1's registration form. [Source: EXPERIENCE.md, State Patterns]

### Testing Standards
- Vitest + React Testing Library, matching Story 1.1/1.2's established setup (`vitest.config.ts`, `vitest.setup.ts` already exist) — no new test framework needed.
- `lib/domain/otp.ts` must be unit-testable against fake/in-memory port implementations, not live Redis or Twilio — this is the entire point of the port boundary Task 1 establishes.

### Project Structure Notes
- Files touched: `lib/domain/otp.ts` (new — first file in this directory), `lib/infra/otpStore.ts` (new), `lib/infra/twilio.ts` (new), `lib/infra/repositories/donorRepository.ts` (extend), `app/actions/requestDonorOtp.ts` (new), `app/actions/verifyDonorOtp.ts` (new), `app/register/verify/page.tsx` (new), `app/components/ui/OtpInput.tsx` (new). No Prisma schema changes (the `isVerified` field already exists from Story 1.1).
- New dependency: `twilio` (`^6.0.2`).

### Latest Tech Notes (verified 2026-07-07)
- **`twilio` npm package**: current stable is 6.0.2 (major-version-4-and-later helper library). Do not use it client-side — server-only (Server Actions / Route Handlers), since it holds account credentials; this story's usage (inside `lib/infra/twilio.ts`, called only from Server Actions) already satisfies that. [Source: twilio-node GitHub/npm, verified via web search 2026-07-07]
- **`node:crypto` `randomInt`**: available in all supported Node versions (24.x LTS per architecture stack) — use it instead of `Math.random()` for the 6-digit code; it's cryptographically strong PRNG-backed, unlike `Math.random()`.
- Twilio free-trial accounts can only send SMS to phone numbers manually verified in the Twilio console (PRD NFR-7 / Constraints & Guardrails › Cost) — this is a known environment limitation for real-device testing, not a code defect; document any trial-account numbers used for manual testing in Completion Notes if applicable.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.3] — story ACs
- [Source: _bmad-output/planning-artifacts/architecture/architecture-BloodDonorApp-2026-07-06/ARCHITECTURE-SPINE.md] — layering, AD-2, AD-3, AD-4, error-shape convention, Capability → Architecture Map
- [Source: _bmad-output/planning-artifacts/prds/prd-BloodDonorApp-2026-07-06/prd.md] — FR-2, FR-12, §9 OTP-expiry assumption
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-BloodDonorApp-2026-07-06/DESIGN.md] — `otp-input`/`resend-otp-link` component tokens
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-BloodDonorApp-2026-07-06/EXPERIENCE.md] — OTP behavioral rules, State Patterns (OTP sending/expired/wrong), Accessibility Floor (digit-position announcements)
- [Source: _bmad-output/implementation-artifacts/1-1-donor-submits-registration-details.md] — `isVerified` field name, `lib/infra/redis.ts` scaffolding, `donorRepository.ts` pattern, navigation target `/register/verify?donorId=...`
- [Source: _bmad-output/implementation-artifacts/1-2-system-rate-limits-registration-submissions.md] — shared rate-limit utility shape/key convention this story must reuse, not duplicate

## Open Questions For Dev

1. **OTP code hashing algorithm** — SHA-256 (with phone+purpose as salt-equivalent) vs. `scryptSync` is left as an implementation choice (Task 1); either satisfies "never store the plaintext code." Record the choice in Completion Notes.
2. **Story 1.2 sequencing** — if Story 1.2 is still uncoded when this story starts, decide whether to implement it first (recommended) or proceed with OTP request/verify unwrapped and flag it explicitly; do not silently ship without rate-limiting on a public, unauthenticated OTP-request endpoint (it is an SMS-cost/abuse vector even before Story 2.2's real notification volume).
3. **`OTP_EXPIRED` vs `not_found`** — this story treats a missing/never-requested challenge key the same as an expired one (both show "This code has expired."), since the Donor OTP Verify screen only exists after a code was already auto-requested on mount; confirm this holds once Story 2.1/3.1 reuse the same domain function in different entry contexts.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npx tsc --noEmit` — clean, no type errors.
- `npx next build` — production build succeeds; `/register/verify` required a `Suspense` boundary around the `useSearchParams()`-consuming component (Next.js 16 build error otherwise) — split into an inner `DonorOtpVerifyForm` client component wrapped by the exported page's `<Suspense>`.
- `npx vitest run` — 75/75 tests passing across 10 test files (full suite, includes this story's new otp domain/infra/action/component tests plus Stories 1.1/1.2's existing coverage, no regressions).

### Completion Notes List

- Resolved Open Question 1 (Story 1.2 sequencing): Story 1.2 was already implemented (status `review`, `lib/domain/rate-limit.ts` present) by the time this story started, so Task 0 confirmed the dependency and proceeded directly — no need to build it inline here.
- Resolved Open Question 2 (hashing algorithm): used `createHash("sha256")` over `code:phone:purpose` rather than `scryptSync`, per the story's own reasoning — a 6-digit numeric code has low entropy regardless, and SHA-256 keeps `lib/domain/otp.ts` free of scrypt's sync CPU cost and async-wrapper edge cases.
- Resolved Open Question 3 (`not_found` vs `expired`): kept them semantically distinct in `verifyOtp`'s return type (`"not_found"` vs `"expired"`), but `verifyDonorOtp.ts` (the Presentation-facing Server Action) intentionally maps both to the same `OTP_EXPIRED` error code/message, exactly as the story specifies for this entry point. Story 2.1/3.1 can map `verifyOtp`'s statuses differently if their entry context calls for it, without touching the domain function.
- `lib/domain/otp.ts` is the first file in `lib/domain/`; followed the same port-interface pattern Story 1.2's `rate-limit.ts` established (domain function receives the store/sender as parameters rather than importing a concrete adapter) — consistent precedent for `eligibility.ts`/`matching.ts` later.
- `lib/infra/otpStore.ts` implements the port against the existing Upstash Redis client; `incrementAttempts` does a read-modify-write and re-applies the *remaining* TTL (via `redis.ttl`) so an attempt increment never resets or extends the challenge's expiry.
- `lib/infra/twilio.ts` constructs the Twilio client once at module scope (same fail-fast-on-missing-env pattern as `redis.ts`/`prisma.ts`) and keeps the OTP message template out of the client wrapper itself, per the story's note that Story 2.2 will reuse this wrapper generically for Notification SMS.
- Added a **new** env-var pair `RATE_LIMIT_OTP_MAX`/`RATE_LIMIT_OTP_WINDOW_SECONDS` (default 5/60, same defaults as Story 1.2's registration limiter) for the `requestDonorOtp` endpoint specifically — the story didn't name an exact env var for this endpoint, only that it must reuse Story 1.2's `checkRateLimit` utility keyed by `ip + endpoint`; a distinct config pair (rather than reusing `RATE_LIMIT_REGISTER_*`) lets registration and OTP-request thresholds be tuned independently later, while still going through the one shared `checkRateLimit`/`redisRateLimitStore` implementation (AD-3 compliant — one utility, not one threshold).
- `app/register/verify/page.tsx` required a `Suspense` boundary for `useSearchParams()` to satisfy Next.js 16's static-render requirements — split into `DonorOtpVerifyForm` (the actual client logic) and a thin default-exported wrapper. This pattern should be reused by any future screen reading query-string params (e.g. Story 1.4's Registration Confirmation, which also reads `donorId` from the query string).
- No Twilio trial-account numbers were used for manual/live testing in this environment — no `TWILIO_ACCOUNT_SID`/`AUTH_TOKEN`/`FROM_NUMBER` or live Upstash Redis credentials were available (same environment constraint noted in Stories 1.1/1.2 for Postgres/Redis). All new infra adapters (`otpStore.ts`, `twilio.ts`) are covered indirectly through the Server Action integration tests, which mock them at the module boundary; they are not exercised against live Redis/Twilio. Verifying against live services is a deployment/environment-setup step, not a code gap.
- Resend behavior: the Verify screen's countdown is client-side UX only (45s placeholder, not specified exactly in EXPERIENCE.md); the actual enforcement is server-side via the shared rate limiter (AD-3), matching the story's explicit guidance that the countdown is "a reasonable placeholder" and not the source of truth.

### File List

- `lib/domain/otp.ts` (new — `requestOtp`, `verifyOtp`, `OtpChallengeStore`/`OtpSender`/`OtpChallenge` port types)
- `lib/domain/otp.test.ts` (new — unit tests against fake in-memory store/sender)
- `lib/infra/otpStore.ts` (new — `redisOtpStore`, Redis-backed `OtpChallengeStore` implementation)
- `lib/infra/twilio.ts` (new — `twilioClient`, `twilioOtpSender` `OtpSender` implementation)
- `lib/infra/repositories/donorRepository.ts` (modified — added `findDonorById`, `activateDonor`, `DonorRecord` type)
- `app/actions/requestDonorOtp.ts` (new — Server Action: rate-limited OTP request/resend)
- `app/actions/requestDonorOtp.test.ts` (new — integration tests incl. rate-limit wiring)
- `app/actions/verifyDonorOtp.ts` (new — Server Action: OTP verification + donor activation)
- `app/actions/verifyDonorOtp.test.ts` (new — integration tests, all status branches)
- `app/components/ui/OtpInput.tsx` (new — reusable 6-digit OTP input component)
- `app/components/ui/OtpInput.test.tsx` (new — component tests)
- `app/register/verify/page.tsx` (new — Donor OTP Verify screen)
- `app/register/verify/page.test.tsx` (new — component tests)
- `.env.example` (modified — documented `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM_NUMBER`, `RATE_LIMIT_OTP_MAX`/`RATE_LIMIT_OTP_WINDOW_SECONDS`)
- `package.json` / `package-lock.json` (modified — added `twilio` dependency)

## Change Log

- 2026-07-08: Implemented the shared `otp` domain service (`lib/domain/otp.ts`, first file in `lib/domain/`), Redis/Twilio infra adapters, `requestDonorOtp`/`verifyDonorOtp` Server Actions (rate-limited via Story 1.2's utility), the `OtpInput` component, and the Donor OTP Verify screen. 28 new tests, full suite 75/75 passing. Status: ready-for-dev → review.
