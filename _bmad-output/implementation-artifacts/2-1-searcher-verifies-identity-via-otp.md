---
baseline_commit: NO_VCS
---

# Story 2.1: Searcher Verifies Identity via OTP

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a searcher,
I want to provide my own name and phone number and verify it via a one-time code,
so that I'm allowed to run a search that triggers real donor notifications.

## Acceptance Criteria

1. **Given** I am on Home and tap "I need blood," landing on Searcher Verify, **when** I submit my name and phone number, **then** an OTP is requested using the shared `otp` service from Story 1.3 (AD-2), and the request is rate-limited via Story 1.2's shared utility (extending FR-12 coverage to the Searcher-verify endpoint). [Source: epics.md#Story-2.1, FR-5, AD-2, AD-3]
2. **When** I enter the correct code before expiry, **then** a signed JWT session token (~15 min TTL, unique `jti`) is issued, scoped to my phone number, with a budget of 2 remaining uses tracked in Redis (AD-4) — one for submitting the search, one for at most one area-expansion re-search (Story 2.3). [Source: epics.md#Story-2.1, AD-4]
3. **And** expired-code and wrong-code states show the same distinct messages as Story 1.3 ("This code has expired." / "That code didn't match. Check the SMS and try again."). [Source: epics.md#Story-2.1, UX-DR5]
4. **And** no Match list or Notification is triggered until this verification succeeds — this is the sole gate on the search cost/abuse vector (FR-5). [Source: epics.md#Story-2.1, FR-5]

## Tasks / Subtasks

- [x] Task 1: Build the shared `session` domain service (AC: #2)
  - [x] Create `lib/domain/session.ts` — this is the **first file to implement AD-4** (post-OTP session tokens); it will be reused as-is by Story 3.1 (self-service session, budget 1) — parameterize by `budget`, do not hardcode `2`.
  - [x] Define two port interfaces (interfaces only — `lib/domain/session.ts` must not import `jose` or `@upstash/redis` directly, same port-boundary discipline as `otp.ts`/`rate-limit.ts`):
    - `TokenSigner`: `sign(payload: { sub: string; jti: string }, ttlSeconds: number): Promise<string>`, `verify(token: string): Promise<{ sub: string; jti: string } | null>` (return `null` on any invalid/expired/malformed token — never throw across this boundary)
    - `SessionBudgetStore`: `initialize(jti: string, budget: number, ttlSeconds: number): Promise<void>`, `consume(jti: string): Promise<{ allowed: boolean; remaining: number } | null>` (`null` = jti unknown/expired)
  - [x] Export `issueSessionToken({ subject, budget }: { subject: string; budget: number }, signer: TokenSigner, store: SessionBudgetStore): Promise<{ token: string; jti: string }>` — generate `jti` via `crypto.randomUUID()` (global, no import needed — same usage as `lib/infra/rateLimitStore.ts`), sign `{ sub: subject, jti }` with a 900-second (15 min) TTL, then `store.initialize(jti, budget, 900)` **using the same 900s TTL as the token** so the budget record and the token expire together, then return `{ token, jti }`.
  - [x] Export `consumeSessionUse(jti: string, store: SessionBudgetStore): Promise<{ allowed: boolean; remaining: number }>` — calls `store.consume(jti)`; if it returns `null` (unknown/expired), return `{ allowed: false, remaining: 0 }`.
  - [x] Export `verifySessionToken(token: string, signer: TokenSigner): Promise<{ subject: string; jti: string } | null>` — thin wrapper over `signer.verify`, mapping `{ sub, jti }` to `{ subject, jti }`; returns `null` on any failure. This function and `consumeSessionUse` are **not exercised by this story's own AC** (nothing here submits a search yet) but are required now so Story 2.2 (`submitSearch`) and Story 2.3 (area-expansion re-search) can call the same module without rebuilding it — same "build the shared service once" precedent Story 1.3 set for `otp.ts`.
  - [x] This is the file the architecture's Capability → Architecture Map anticipated: "Search & Area Expansion (FR-5, FR-6, FR-7) ... governed by AD-1, AD-3, **AD-4**, AD-7." [Source: ARCHITECTURE-SPINE.md, Capability → Architecture Map]

- [x] Task 2: Implement the infrastructure adapters behind the session ports (AC: #2)
  - [x] `lib/infra/jwt.ts` (new) — implements `TokenSigner` using the `jose` package (latest stable: `jose` 6.2.3 as of 2026-07-11 — see Latest Tech Notes). Read `JWT_SIGNING_KEY` from env, encode once at module scope via `new TextEncoder().encode(process.env.JWT_SIGNING_KEY)`; **throw at module load if missing** (same fail-fast pattern as `redis.ts`/`prisma.ts`/`twilio.ts`).
    - `sign`: `new SignJWT({ sub, jti }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds).sign(secretKey)` — always set `alg` explicitly via `setProtectedHeader`; never rely on a default (jose requires this argument, it will not compile without it).
    - `verify`: `await jwtVerify(token, secretKey, { algorithms: ["HS256"] })` inside a `try/catch` — `jwtVerify` throws (`JWTExpired`, `JWSSignatureVerificationFailed`, etc.) on any invalid/expired token; catch and return `null`, never let the exception cross the port boundary. Extract `sub`/`jti` from `payload` (both are custom claims here, not the standard-registered ones jose types natively — read them as `payload.sub as string` / `payload.jti as string`, since `jti` was set as a plain claim in `sign`, not via jose's separate `setJti()` helper... actually **use `.setJti(jti)` when signing** (jose's registered-claim helper) so `jwtVerify`'s returned payload types `jti` correctly as `string | undefined` — prefer this over passing `jti` as a bare custom field).
  - [x] `lib/infra/sessionStore.ts` (new) — implements `SessionBudgetStore` against the existing `lib/infra/redis.ts` Upstash client:
    - `initialize(jti, budget, ttlSeconds)`: `await redis.set(jti, budget, { ex: ttlSeconds })`.
    - `consume(jti)`: **must check existence before decrementing** — Redis's `DECR` on a nonexistent key silently creates it at `-1` with **no TTL**, which would leak a permanent zombie key and incorrectly report "disallowed forever" for a reused `jti` (extremely unlikely but real bug class). Implementation: `const exists = await redis.get(jti); if (exists === null) return null;` then `const remaining = await redis.decr(jti); return { allowed: remaining >= 0, remaining: Math.max(remaining, 0) };`. This has a small non-atomic get-then-decr race window, which is acceptable here — the sessions this guards are single-user, budget-of-2 flows, not a high-concurrency resource; do not over-engineer with Lua scripting for this MVP.
  - [x] Add `JWT_SIGNING_KEY` to `.env.example` (placeholder only — a long random string, e.g. generated via `openssl rand -base64 32`).
  - [x] Add `jose` (`^6.2.3`) as a new dependency in `package.json`.

- [x] Task 3: Build `requestSearcherOtp` and `verifySearcherOtp` Server Actions (AC: #1, #2, #3, #4)
  - [x] Create `lib/validation/searcherVerify.ts` (new) — `searcherVerifySchema = z.object({ name: ..., phone: ... })`, reusing the **exact same** name/phone rules as `registerDonorSchema` (`lib/validation/registerDonor.ts`) for consistent error copy across the app. `E164_PHONE_REGEX` is currently defined but **not exported** from `registerDonor.ts` — export it (`export const E164_PHONE_REGEX = ...`) and import it here rather than redefining/duplicating the pattern (single source of truth for phone format validation).
  - [x] `app/actions/requestSearcherOtp.ts` (new) — takes `{ name: string; phone: string }`, validates with `searcherVerifySchema` via `safeParse` (return `{ error: { code: "VALIDATION_ERROR", message, fieldErrors } }` on failure, same shape as `registerDonor.ts`), then wraps with `checkRateLimit({ ip, endpoint: "requestSearcherOtp" }, redisRateLimitStore, config)` — **reuse the existing `RATE_LIMIT_OTP_MAX`/`RATE_LIMIT_OTP_WINDOW_SECONDS` env vars** (Story 1.3 already introduced these for OTP-category actions; `ip + endpoint` already gives Searcher-OTP its own independent counting bucket via the distinct `"requestSearcherOtp"` endpoint string, so a second env-var pair isn't needed — document this choice in Completion Notes, deviating from Story 1.3's own precedent of one dedicated pair per endpoint, since here the *category* is identical and a fresh pair adds config surface without a clear benefit).
    - On rate-limit rejection, return `{ error: { code: "RATE_LIMITED", message: "Too many attempts. Please try again shortly." } }` (identical copy to `requestDonorOtp.ts`).
    - On success, call `requestOtp({ phone: data.phone, purpose: "searcher_verify" }, redisOtpStore, twilioOtpSender)` (same shared `otp` service, third `purpose` string after `"donor_registration"`) and return `{ requested: true }`.
    - **Do not persist a Searcher record anywhere** — AD-1 forbids a `Searcher` table; `name`/`phone` here exist only to (a) reach the OTP send and (b) be carried forward client-side to Story 2.2's search submission. Nothing about this action writes to Postgres.
  - [x] `app/actions/verifySearcherOtp.ts` (new) — takes `{ phone: string; code: string }` (name is **not** needed here — the JWT scopes to phone only, per AD-4's literal "scoped to my phone number"), calls `verifyOtp({ phone, purpose: "searcher_verify", code }, redisOtpStore)`:
    - `"verified"` → call `issueSessionToken({ subject: phone, budget: 2 }, joseTokenSigner, redisSessionBudgetStore)` and return `{ verified: true, sessionToken: token }`.
    - `"expired"` / `"not_found"` → `{ error: { code: "OTP_EXPIRED", message: "This code has expired." } }` (same mapping precedent as `verifyDonorOtp.ts` — both statuses collapse to the same message).
    - `"wrong_code"` → `{ error: { code: "OTP_INCORRECT", message: "That code didn't match. Check the SMS and try again." } }`.
    - All error responses use the fixed `{ error: { code, message } }` envelope, matching every other action in the codebase.

- [x] Task 4: Build the Searcher Verify screen (AC: #1, #2, #3, #4)
  - [x] `app/search/verify/page.tsx` (new) — **this is one screen with two client-side steps (name+phone entry, then OTP entry), not two separate routes.** EXPERIENCE.md's Information Architecture table lists a single "Searcher Verify" surface covering both "Searcher's own name + phone, then OTP" — this is a deliberate difference from the Donor flow's two-route split (`/register` → `/register/verify`); do not "fix" this into two routes to match the Donor pattern, it would contradict the IA spec.
  - [x] Step 1 (name + phone form): reuse `InputField` (`app/components/ui/InputField.tsx`) for `name` and `phone`, reuse `Button` for submit, client-side validate via `searcherVerifySchema` (Task 3) the same on-blur/re-validate-on-change pattern `app/register/page.tsx` already established (`touchedFields` set, re-check on every form change, clear an error the moment its field becomes valid). On submit: call `requestSearcherOtp({ name, phone })`; on success, transition local state to step 2, keeping `name`/`phone` in component state (do not navigate to a new route for step 2).
  - [x] Step 2 (OTP entry): reuse `OtpInput` (already donor-agnostic per Story 1.3's Dev Notes) and the same countdown/resend UX as `app/register/verify/page.tsx` (`RESEND_COUNTDOWN_SECONDS = 45`, greyed "Resend in 0:45" → tappable "Resend code", resend calls `requestSearcherOtp` again with the same `name`/`phone` already in state). On submit: call `verifySearcherOtp({ phone, code })`.
    - `OTP_EXPIRED` → "This code has expired." inline, Resend prominent.
    - `OTP_INCORRECT` → "That code didn't match. Check the SMS and try again."
    - `RATE_LIMITED` → same generic message, reuses the existing error-rendering pattern from `app/register/verify/page.tsx`.
    - On success (`verified: true, sessionToken`) → navigate to `` `/search?sessionToken=${encodeURIComponent(sessionToken)}&name=${encodeURIComponent(name)}` `` — Story 2.2 builds `/search` itself (out of scope here, same boundary Story 1.3 used for `/register/confirmation`); this story only wires the forward navigation. **Carrying the JWT and name via query params mirrors this codebase's existing `donorId` carry-forward convention** (no cookies, no client-side storage APIs exist anywhere in this codebase yet) — do not introduce a new session-transport mechanism (cookies, `localStorage`) for this one flow; staying consistent with the established pattern is more important than textbook JWT-in-URL avoidance at this MVP scale (token is single-purpose, 15-minute-lived, and budget-capped at 2 uses regardless of how it leaks into history/referrer).
  - [x] Screen reader / a11y: reuse `OtpInput`'s existing `aria-label="Code digit N of 6"` per-digit labels (already built); apply the same `role="alert"` inline-error pattern as `InputField`/registration form for step-1 field errors.
  - [x] Reduced motion: no transition/fade on the step-1 → step-2 swap or on error-message changes — content simply appears, matching `app/register/verify/page.tsx`'s `motion-reduce:transition-none` precedent.
  - [x] **No Home screen exists yet** — `app/page.tsx` is still the unmodified `create-next-app` template; no story in Epic 1 built the "I need blood / I want to help / Manage my registration" fork either (Donor Registration is reached by navigating directly to `/register`, with no Home link). Follow that same precedent: this story does **not** build or modify Home. `/search/verify` must be directly reachable by URL; wiring Home's fork is not this story's scope (no epic/FR assigns Home construction to any specific story) — do not add it unless a future story explicitly calls for it.

- [x] Task 5: Tests (all AC)
  - [x] Unit tests for `lib/domain/session.ts` against fake in-memory `TokenSigner`/`SessionBudgetStore` (no live `jose`/Redis): `issueSessionToken` calls `store.initialize` with the requested budget and a 900s TTL, returns a token + jti; `consumeSessionUse` returns `{ allowed: true, remaining: N }` while budget remains, `{ allowed: false, remaining: 0 }` once exhausted or for an unknown jti; `verifySessionToken` returns `null` when the fake signer's `verify` returns `null`.
  - [x] Unit tests for `lib/infra/sessionStore.ts` (mock the Redis client, following `lib/infra/otpStore.ts`'s existing mocking pattern): `consume` on a nonexistent key returns `null` **without** calling `decr` (assert `decr` was never invoked — this is the regression test for the zombie-key bug Task 2 calls out); `consume` on an existing key with remaining budget calls `decr` and returns `allowed: true`; `consume` when budget is already at 0 returns `allowed: false`.
  - [x] Unit tests for `lib/infra/jwt.ts` — round-trip: `sign` then `verify` returns the original `sub`/`jti`; `verify` returns `null` for a tampered token (flip a character) and for an expired token (sign with `ttlSeconds: -1` or mock `Date.now`); `verify` returns `null` for a token signed with a different key.
  - [x] Integration tests for `requestSearcherOtp`/`verifySearcherOtp` Server Actions (mirroring `requestDonorOtp.test.ts`/`verifyDonorOtp.test.ts`'s structure): invalid name/phone → `VALIDATION_ERROR` with `fieldErrors`; rate-limited → shared `RATE_LIMITED` shape (mock the rate-limit utility); happy path on verify → `{ verified: true, sessionToken }` and confirm `redisSessionBudgetStore.initialize`/equivalent was invoked with budget `2`; wrong/expired code → correct error codes, matching Story 1.3's exact message strings.
  - [x] Component tests for the Searcher Verify screen: step-1 submit with valid name/phone transitions to step-2 (OTP boxes render); invalid phone shows inline `role="alert"` error and does not submit; step-2 renders distinct expired-vs-wrong-code messages (reuse Story 1.3's Verify-screen test structure); on successful verify, asserts navigation to `/search?sessionToken=...&name=...` was called (mock `next/navigation`'s router, same mocking style as `app/register/page.test.tsx`).

### Review Findings

- [x] [Review][Patch] `jwt.ts`'s `verify()` re-throws non-`JOSEError` exceptions, violating the spec's explicit "never throw across this boundary" contract for `TokenSigner.verify` [lib/infra/jwt.ts:23-29] — fixed: catch is now unconditional, always returns `null`
- [x] [Review][Defer] Rate limiting is IP-only, not phone-based — a distributed-IP SMS-bomb against one victim phone isn't blocked [app/actions/requestSearcherOtp.ts:47-65] — deferred, pre-existing (AD-3 design from Story 1.2; PRD §4.6 explicitly scopes IP-only rate limiting for MVP and flags phone-based throttling as a post-launch revisit)
- [x] [Review][Defer] `ipAddress()` "unknown" fallback collapses all IP-less clients into one shared rate-limit bucket [app/actions/requestSearcherOtp.ts:47] — deferred, pre-existing (identical pattern in `registerDonor.ts`/`requestDonorOtp.ts` since Stories 1.1/1.3)
- [x] [Review][Defer] No rate-limiting or lockout on `verifySearcherOtp` itself — the 6-digit code is brute-forceable via repeated verify calls, even though `OtpChallenge.attempts` is tracked [app/actions/verifySearcherOtp.ts; lib/domain/otp.ts] — deferred, pre-existing (identical gap in `verifyDonorOtp.ts` since Story 1.3; no lockout enforcement exists anywhere in the shared `otp` service yet)
- [x] [Review][Defer] Server Actions calling out to Redis/Twilio (`requestSearcherOtp`, and pre-existing `requestDonorOtp`/`registerDonor`) have no try/catch around those calls — an outage surfaces as an unstyled framework error rather than a graceful message [app/actions/requestSearcherOtp.ts:56-65] — deferred, pre-existing (identical pattern since Stories 1.1/1.3)
- [x] [Review][Defer] `sessionStore.consume`'s get-then-decr has a small non-atomic race window (TTL could expire between the two calls) [lib/infra/sessionStore.ts:8-16] — deferred, already explicitly accepted as an MVP trade-off in this story's own Dev Notes ("acceptable here — single-user, budget-of-2 flows, not a high-concurrency resource")

## Dev Notes

### Architecture Compliance
- Layered monolith, one dependency direction: Presentation (`app/`) → Domain (`lib/domain/`) → Infrastructure (`lib/infra/`), through port interfaces. This story is the **first to populate AD-4** — `lib/domain/session.ts` must not import `jose` or `@upstash/redis` directly, exactly the same discipline `otp.ts`/`rate-limit.ts` already established. [Source: ARCHITECTURE-SPINE.md, Design Paradigm]
- AD-1 (binds FR-5, FR-8): a Searcher has **no persisted identity** — `name`/`phone` collected here are never written to Postgres by this story; they only reach the OTP send and are carried forward client-side. No `Searcher` table exists or should be created. `searcherName`/`searcherPhone` only get persisted later, inlined on the `Search` record itself (Story 2.2's job, not this one's). [Source: ARCHITECTURE-SPINE.md, AD-1]
- AD-2 (binds FR-2, FR-5, FR-9): reuse the **exact same** shared `otp` service (`lib/domain/otp.ts`, `requestOtp`/`verifyOtp`) built in Story 1.3, passing `purpose: "searcher_verify"` — do not fork or duplicate OTP logic. [Source: ARCHITECTURE-SPINE.md, AD-2]
- AD-3 (binds FR-12): `requestSearcherOtp` must go through the **same** shared `checkRateLimit` utility (Story 1.2), keyed `ip + endpoint`, with `endpoint: "requestSearcherOtp"` giving it an independent counting bucket automatically — do not add a second rate-limiting mechanism. [Source: ARCHITECTURE-SPINE.md, AD-3]
- AD-4 (binds FR-5 here; also FR-9, FR-10, FR-11 for Story 3.1 later) — this is the story that **implements** AD-4 for the first time: successful OTP verification issues a signed JWT (~15 min TTL) scoped to exactly the phone number, unique `jti`, server-tracked remaining-uses budget in Redis (2 for Searcher: submit-search + at most one area-expansion re-search). **A stateless "trust the TTL" implementation does not satisfy this rule** — the budget must be explicitly tracked and decremented server-side (Task 1/2's `SessionBudgetStore`), not inferred from the token alone. Donor registration (Story 1.1-1.3) explicitly does **not** use this pattern (AD-4 excludes it) — do not confuse this story's session token with anything in the Donor flow. [Source: ARCHITECTURE-SPINE.md, AD-4]
- Capability → Architecture Map: "Search & Area Expansion (FR-5, FR-6, FR-7) | `app/actions/submitSearch`, `lib/domain/matching.ts` | AD-1, AD-3, **AD-4**, AD-7" — this story builds the session/JWT machinery that map anticipates, even though `submitSearch`/`matching.ts` themselves belong to Story 2.2. [Source: ARCHITECTURE-SPINE.md, Capability → Architecture Map]
- Error shape convention (`{ error: { code, message } }`) applies to both new Server Actions, matching every existing action (`registerDonor`, `requestDonorOtp`, `verifyDonorOtp`). [Source: ARCHITECTURE-SPINE.md, Consistency Conventions]
- Zod validation at the Presentation boundary: the new `searcherVerifySchema` follows the exact same rule as `registerDonorSchema` — colocated in `lib/validation/`, invoked before any domain/infra call. [Source: ARCHITECTURE-SPINE.md, Consistency Conventions]

### Relationship to Stories 1.1-1.4 (all status: review) and Story 1.2/1.3 specifically
- `lib/domain/otp.ts`'s `requestOtp`/`verifyOtp` are reused **verbatim** — this story is the second consumer (after Donor registration) of the `purpose`-parameterized design Story 1.3 deliberately built for this exact reuse. Do not modify `otp.ts` itself; if a change seems needed, it almost certainly belongs in the *caller* (this story's new Server Actions), not the shared service.
- `lib/domain/rate-limit.ts`'s `checkRateLimit` and `lib/infra/rateLimitStore.ts`'s `redisRateLimitStore` are reused as-is — same pattern as `requestDonorOtp.ts`/`registerDonor.ts`. Do not touch these files.
- `OtpInput` (`app/components/ui/OtpInput.tsx`, built Story 1.3) is reused with zero modification — it was already built donor-agnostic (no donor-specific props), confirming Story 1.3's own stated design intent.
- `Button`/`InputField` (`app/components/ui/`) are reused as-is for the name/phone form, same as `app/register/page.tsx`.
- This story does **not** touch `lib/domain/eligibility.ts`, `donorRepository.ts`, or anything from Story 1.4 — no overlap.
- **New precedent this story sets:** the first `lib/domain/` module (`session.ts`) with **two** infra adapters behind it (`jwt.ts` for signing, `sessionStore.ts` for budget tracking) rather than one — Stories 3.1 (self-service session, budget 1) and later Story 2.2/2.3 (session verification + consumption) will depend on this exact module; keep `subject`/`budget` fully generic (no `"searcher"`-specific naming inside `session.ts` itself, same discipline `otp.ts` used for `purpose`).

### Design Tokens / Component Reuse
- No new visual components needed — Step 1 reuses `InputField`/`Button`/`AreaChip`-adjacent form patterns (no `AreaChip` needed here, no area selection in this story); Step 2 reuses `OtpInput` and the resend-link treatment (`ink-disabled` countdown text → `accent` tappable text, never color-only) exactly as built in Story 1.3.
- Inline errors: below the relevant control, `status-error`, plain text, `role="alert"` — same as every existing form in this codebase. [Source: EXPERIENCE.md, State Patterns]
- Reduced motion: no transition on the step-1/step-2 swap, matching `app/register/verify/page.tsx`'s existing `motion-reduce:transition-none` class usage.

### Testing Standards
- Vitest + React Testing Library, matching Stories 1.1-1.4's established setup (`vitest.config.ts`/`vitest.setup.ts` already exist, no new framework).
- `lib/domain/session.ts` must be unit-testable against fake in-memory `TokenSigner`/`SessionBudgetStore`, never live `jose`/Redis — same port-boundary testing discipline as `otp.ts`'s existing tests.
- The `lib/infra/sessionStore.ts` zombie-key regression test (Task 5) is the most important new test in this story — it's the one real correctness bug identified during story creation; do not skip it.

### Project Structure Notes
- Files touched: `lib/domain/session.ts` (new), `lib/domain/session.test.ts` (new), `lib/infra/jwt.ts` (new), `lib/infra/jwt.test.ts` (new), `lib/infra/sessionStore.ts` (new), `lib/infra/sessionStore.test.ts` (new), `lib/validation/searcherVerify.ts` (new), `lib/validation/registerDonor.ts` (modified — export `E164_PHONE_REGEX`, no behavior change), `app/actions/requestSearcherOtp.ts` (new), `app/actions/requestSearcherOtp.test.ts` (new), `app/actions/verifySearcherOtp.ts` (new), `app/actions/verifySearcherOtp.test.ts` (new), `app/search/verify/page.tsx` (new), `app/search/verify/page.test.tsx` (new).
- No Prisma schema changes — this story writes nothing to Postgres (AD-1: no `Searcher` table; `Search` table itself is Story 2.2's addition).
- New dependency: `jose` (`^6.2.3`).
- New env vars: `JWT_SIGNING_KEY` (added to `.env.example`, placeholder only). Reuses existing `RATE_LIMIT_OTP_MAX`/`RATE_LIMIT_OTP_WINDOW_SECONDS` — no new rate-limit env vars (see Task 3's explicit reasoning).

### Latest Tech Notes (verified 2026-07-11)
- **`jose` npm package**: current stable is `6.2.3` (per npm, verified via web search 2026-07-11). It's the 2026 standard for JWT in Node.js — uses Web Crypto API, works across Node/Edge/Cloudflare Workers/Deno/Bun runtimes, tree-shakeable ESM, zero dependencies. Preferred over the legacy `jsonwebtoken` package (Node-only, no edge-runtime support, defaults to HS256 without requiring an explicit algorithm — a common source of confusion/vulnerability this codebase avoids by explicitly using `jose`). [Source: npm/jose package page + GitHub panva/jose, verified via web search 2026-07-11]
- **Explicit algorithm declaration is required and is a security feature, not boilerplate**: `SignJWT` requires `.setProtectedHeader({ alg: "HS256" })` before `.sign()` — omitting it is a compile/runtime error, by design, to prevent algorithm-confusion attacks. `jwtVerify` should always pin `{ algorithms: ["HS256"] }` explicitly on the verify side too, rather than trusting the token's own header. HS256 (symmetric, shared secret) is correct here since this app is both the sole issuer and sole verifier of these tokens (`JWT_SIGNING_KEY`), unlike a cross-service OAuth scenario that would call for RS256. [Source: jose docs/GitHub, verified via web search 2026-07-11]
- **`node:crypto` `randomUUID()`**: available as a Web-standard global (`crypto.randomUUID()`, no import needed) in the Node.js version this project targets (24.x LTS) — already used this way in `lib/infra/rateLimitStore.ts`; reuse that exact calling convention for the new `jti` generation, not a `randomInt`-based scheme (that pattern is specific to `otp.ts`'s 6-digit numeric codes, not applicable here).

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.1] — story ACs
- [Source: _bmad-output/planning-artifacts/architecture/architecture-BloodDonorApp-2026-07-06/ARCHITECTURE-SPINE.md] — AD-1, AD-2, AD-3, AD-4 (the core rule this story implements), Capability → Architecture Map, layering, error-shape convention
- [Source: _bmad-output/planning-artifacts/prds/prd-BloodDonorApp-2026-07-06/prd.md] — FR-5, FR-12, §8 Open Question 6 (resolved by AD-4: re-verify per search, not per browser session)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-BloodDonorApp-2026-07-06/DESIGN.md] — `otp-input`/`resend-otp-link` tokens (reused, no new tokens needed)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-BloodDonorApp-2026-07-06/EXPERIENCE.md] — Information Architecture (single "Searcher Verify" surface, contrast with Donor's two-route split), State Patterns (OTP expired/wrong messages), Flow 1 step 2-3
- [Source: _bmad-output/implementation-artifacts/1-3-donor-verifies-phone-via-otp.md] — shared `otp` service design (`purpose` parameter built exactly for this reuse), rate-limit env-var precedent, `OtpInput` component, exact expired/wrong-code copy this story must match verbatim
- [Source: _bmad-output/implementation-artifacts/1-2-system-rate-limits-registration-submissions.md] — shared rate-limit utility shape/key convention this story must reuse, not duplicate
- [Source: lib/domain/otp.ts, lib/domain/rate-limit.ts, lib/infra/rateLimitStore.ts, lib/infra/redis.ts, lib/infra/twilio.ts] — exact current signatures/patterns this story's new code must match
- [Source: app/register/verify/page.tsx, app/register/page.tsx] — existing OTP-screen and form patterns this story's Searcher Verify screen reuses/adapts

## Open Questions For Dev

1. **Rate-limit config sharing** — Task 3 recommends reusing `RATE_LIMIT_OTP_MAX`/`RATE_LIMIT_OTP_WINDOW_SECONDS` for `requestSearcherOtp` rather than introducing a dedicated pair (deviating from Story 1.3's own one-pair-per-endpoint precedent, since the `ip+endpoint` key already isolates counting). If independent tuning turns out to matter, adding a dedicated pair later is a small, backward-compatible change — do not block on this, just document the choice made in Completion Notes.
2. **`jti` claim style** — Task 2 recommends `jose`'s `.setJti(jti)` registered-claim helper over passing `jti` as a bare custom payload field, for cleaner typing on verify. Confirm this works cleanly with `.setExpirationTime()`'s absolute-seconds form; if `jose`'s API surface has shifted since the verified date, fall back to relative expressions (e.g. `.setExpirationTime("15m")`) — either is acceptable as long as the token actually expires at ~15 minutes and this is documented.
3. **Session-token query-param transport** — Task 4 documents carrying the JWT via `?sessionToken=...` to `/search`, matching this codebase's `donorId` convention. This is a deliberate consistency choice, not a security-first design; if it ever needs hardening (cookie-based transport), that's a cross-cutting change affecting Story 2.2/2.3/3.1 too, out of scope for this single story.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npx vitest run` — hit the same sandboxed worker-OOM crash noted in Story 1.4 on the first attempt (all files reported `Cannot read properties of undefined (reading 'config')` after teardown); re-ran with `--no-file-parallelism` per that story's precedent — 124/124 tests passing across 20 test files (full suite, includes this story's new session/jwt/sessionStore/validation/action/component tests plus Stories 1.1-1.4's existing coverage, no regressions).
- `npx tsc --noEmit` — clean, no type errors.
- `npx next build` — production build succeeds; `/search/verify` renders as static (`○`), consistent with `/register/verify`'s precedent (a pure client component with no page-level `searchParams` read).

### Completion Notes List

- Resolved Open Question 1 (rate-limit config sharing): reused the existing `RATE_LIMIT_OTP_MAX`/`RATE_LIMIT_OTP_WINDOW_SECONDS` env vars for `requestSearcherOtp` rather than introducing a dedicated pair — the `ip + endpoint` composite key already isolates Searcher-OTP counting from Donor-OTP counting via the distinct `"requestSearcherOtp"` endpoint string, so a separate threshold pair added config surface without a clear benefit at this stage.
- Resolved Open Question 2 (`jti` claim style): used `jose`'s `.setJti(jti)` registered-claim helper when signing, combined with `.setExpirationTime(Math.floor(Date.now()/1000) + ttlSeconds)` (absolute-seconds form) — both worked together cleanly with no API friction.
- Resolved Open Question 3 (session-token query-param transport): implemented as documented — `/search?sessionToken=...&name=...` via `URLSearchParams`, matching the codebase's existing `donorId` carry-forward convention. No cookie/localStorage mechanism introduced.
- `lib/domain/session.ts` follows the exact port-boundary discipline of `otp.ts`/`rate-limit.ts` — no `jose`/`@upstash/redis` imports; unit-tested against fake in-memory `TokenSigner`/`SessionBudgetStore`.
- `lib/infra/jwt.ts`'s unit tests (`jwt.test.ts`) required a `// @vitest-environment node` override — jsdom's polyfilled `TextEncoder`/`Uint8Array` realm caused `jose`'s webapi build to throw `TypeError: payload must be an instance of Uint8Array` on `sign()`; running that one test file under the `node` environment (rather than the project-wide `jsdom` default) resolved it with zero changes to `jwt.ts` itself. This is a test-environment-only concern; the module runs fine in real Node (Server Actions execute server-side, never in jsdom).
- `lib/infra/sessionStore.ts`'s `consume()` guards against the Redis `DECR`-on-missing-key zombie-key bug identified during story creation: it calls `redis.get(jti)` first and returns `null` without ever calling `decr` if the key doesn't exist — covered by a dedicated regression test asserting `decr` was never invoked.
- `E164_PHONE_REGEX` was exported (previously private) from `lib/validation/registerDonor.ts` with no behavior change, and reused as-is by the new `lib/validation/searcherVerify.ts` — single source of truth for phone-format validation, no duplication.
- The Searcher Verify screen (`app/search/verify/page.tsx`) is one component with two client-side steps (`"details"` | `"otp"`), per EXPERIENCE.md's single-surface IA — deliberately not split into two routes like the Donor flow's `/register` → `/register/verify`.
- No Home screen fork was built or modified — consistent with the precedent that no Epic 1 story built it either; `/search/verify` is directly reachable by URL.
- No live Upstash Redis/Twilio/real JWT signing key was available in this environment (same constraint noted in Stories 1.1-1.4) — `lib/infra/jwt.ts`'s real `jose` round-trip is exercised directly (with a test-only signing key), but `lib/infra/sessionStore.ts` and the Server Actions are covered via mocked Redis/otp/session-domain boundaries, not a live database/cache.

### File List

- `lib/domain/session.ts` (new — `issueSessionToken`, `consumeSessionUse`, `verifySessionToken`, `TokenSigner`/`SessionBudgetStore` port types)
- `lib/domain/session.test.ts` (new — unit tests against fake in-memory signer/store)
- `lib/infra/jwt.ts` (new — `joseTokenSigner`, `TokenSigner` implementation using `jose`)
- `lib/infra/jwt.test.ts` (new — round-trip/tamper/expiry/wrong-key tests, `node` environment override)
- `lib/infra/sessionStore.ts` (new — `redisSessionBudgetStore`, `SessionBudgetStore` implementation with zombie-key guard)
- `lib/infra/sessionStore.test.ts` (new — mocked-Redis tests incl. the zombie-key regression test)
- `lib/validation/searcherVerify.ts` (new — `searcherVerifySchema`)
- `lib/validation/searcherVerify.test.ts` (new — schema validation tests)
- `lib/validation/registerDonor.ts` (modified — exported `E164_PHONE_REGEX`, no behavior change)
- `app/actions/requestSearcherOtp.ts` (new — Server Action: validated, rate-limited OTP request for Searcher verify)
- `app/actions/requestSearcherOtp.test.ts` (new — integration tests incl. validation/rate-limit wiring)
- `app/actions/verifySearcherOtp.ts` (new — Server Action: OTP verification + session-token issuance)
- `app/actions/verifySearcherOtp.test.ts` (new — integration tests, all status branches)
- `app/search/verify/page.tsx` (new — Searcher Verify screen, two-step client component)
- `app/search/verify/page.test.tsx` (new — component tests incl. resend and navigation)
- `.env.example` (modified — documented `JWT_SIGNING_KEY`)
- `package.json` / `package-lock.json` (modified — added `jose` dependency)

## Change Log

- 2026-07-11: Implemented the shared `session` domain service (`lib/domain/session.ts`, first file to implement AD-4), `jose`/Redis infra adapters (`jwt.ts`, `sessionStore.ts`), `requestSearcherOtp`/`verifySearcherOtp` Server Actions (reusing Story 1.3's shared `otp` service), and the two-step Searcher Verify screen. 36 new tests, full suite 124/124 passing. Status: ready-for-dev → review.
