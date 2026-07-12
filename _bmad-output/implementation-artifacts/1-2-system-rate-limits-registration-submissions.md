---
baseline_commit: NO_VCS
---

# Story 1.2: System Rate-Limits Registration Submissions

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the org operating this service,
I want registration submissions rate-limited per IP address,
so that abusive or automated registration attempts don't degrade the service or pollute the donor registry.

## Acceptance Criteria

1. **Given** the shared Redis sliding-window rate-limit utility does not yet exist, **when** this story is implemented, **then** one utility keyed by `ip + endpoint` is created in `lib/domain/rate-limit.ts`, using the platform-trusted client IP (Vercel's resolved IP, never a raw client-supplied `x-forwarded-for`) — built once here so Epic 2 (search) and Epic 3 (self-service) reuse it without rebuilding it. [Source: epics.md#Story-1.2, FR-12, AD-3]
2. **And** the registration-submission endpoint (`registerDonor`, Story 1.1) is wrapped by this utility. [Source: epics.md#Story-1.2, FR-12]
3. **And** a request beyond the configured threshold receives a clear, structured 429 response (`{ error: { code, message } }`) rather than being silently dropped or crashing the service. [Source: epics.md#Story-1.2, FR-12]
4. **And** exact thresholds are left as tunable config (PRD Open Question 3 remains open — not blocking this story). [Source: epics.md#Story-1.2, PRD §8 Open Question 3]

## Tasks / Subtasks

- [x] Task 1: Build the shared Redis sliding-window rate-limit utility (AC: #1, #4)
  - [x] `lib/domain/rate-limit.ts` — pure domain service exposing `checkRateLimit(key: { ip: string; endpoint: string }): Promise<{ allowed: boolean; retryAfterSeconds?: number }>` (or equivalent). Per the layered-monolith rule (Presentation → Domain → Infrastructure, Domain never depends on a concrete adapter), this function must depend only on a small port interface for the counter store — not import the Upstash Redis client directly — so it stays unit-testable without live Redis, matching the pattern the architecture spine expects of `lib/domain/*` files
  - [x] Implement the actual sliding-window counter against Redis in `lib/infra/redis.ts` (the Upstash client wired in Story 1.1 Task 4) behind that port — either hand-roll a sorted-set/`ZADD`+`ZREMRANGEBYSCORE` sliding window, or use `@upstash/ratelimit`'s `Ratelimit.slidingWindow()` as the concrete implementation of the port (current stable line: `@upstash/ratelimit` 2.0.8x) — either is acceptable as long as the Domain-layer function signature stays adapter-agnostic
  - [x] Key shape: `ip + ":" + endpoint` (e.g. `"203.0.113.4:registerDonor"`) — one shared key convention so Epic 2/3 endpoints compose cleanly under the same utility without prefix collisions
  - [x] Threshold and window are tunable config (env vars, e.g. `RATE_LIMIT_REGISTER_MAX` / `RATE_LIMIT_REGISTER_WINDOW_SECONDS`), not hardcoded — exact numbers are PRD Open Question 3 and intentionally left open; pick a reasonable placeholder default (e.g. 5 requests / 60s) and document it as adjustable, not final
  - [x] Resolve the platform-trusted client IP using `ipAddress()` from `@vercel/functions` (add as a dependency) — inside a Server Action there is no raw `Request` object, so call `await headers()` from `next/headers` and pass that `Headers` object to `ipAddress()`: `ipAddress(await headers())`. Do **not** read `request.ip` (removed from current Next.js) or trust a manually-parsed `x-forwarded-for` header directly — `ipAddress()` reads Vercel's edge-sanitized header value, which is what makes it "platform-trusted" per AD-3
- [x] Task 2: Wrap the `registerDonor` Server Action with the rate-limit utility (AC: #2, #3)
  - [x] In `app/actions/registerDonor.ts` (built in Story 1.1), call `checkRateLimit({ ip, endpoint: "registerDonor" })` before Zod validation / repository calls run
  - [x] On `allowed: false`, return the shared error shape immediately: `{ error: { code: "RATE_LIMITED", message: "..." } }` — do not throw an unhandled exception or return a bare 500; this must be the exact same envelope shape every other Server Action/Route Handler in the app uses
  - [x] Message copy should follow UX-DR5's "generic try again shortly" rule — do not promise an unenforceable exact retry time, even though `retryAfterSeconds` may be available internally for logging/telemetry
  - [x] This story does **not** touch the Donor Registration screen's UI/UX beyond surfacing this one new error case through the existing inline-error rendering path already built in Story 1.1 Task 8 (rate-limit errors are not field-level — they are not tied to a specific form field, so they should render the same way a non-field-specific submission error would; if Story 1.1 only wired field-level errors, extend the form's error handling minimally to also show a non-field error banner-equivalent inline near the Submit button, still never a top-of-page banner per UX-DR5)
- [x] Task 3: Tests (all AC)
  - [x] Unit tests for `lib/domain/rate-limit.ts`: allows requests under threshold; rejects the request that crosses threshold; different `ip+endpoint` keys are independent; test against a fake/in-memory port implementation, not live Redis (this is the point of the port boundary)
  - [x] Integration test for `registerDonor`: N+1th submission from the same IP within the window returns `{ error: { code: "RATE_LIMITED", ... } }` and does **not** create a Donor record; requests from a different IP are unaffected
  - [x] Confirm a rate-limited response never crashes the Server Action or returns an unstructured/uncaught error

## Dev Notes

### Architecture Compliance
- Layered monolith, one dependency direction: Presentation (`app/`) → Domain (`lib/domain/`) → Infrastructure (`lib/infra/`), through port interfaces. **Domain never depends on a concrete adapter** (Prisma, Twilio, SendGrid — and here, the Upstash Redis client). `lib/domain/rate-limit.ts` must be structured so its core logic is testable without a real Redis connection, exactly like `lib/domain/eligibility.ts`/`matching.ts`/`otp.ts` will be. [Source: ARCHITECTURE-SPINE.md, Design Paradigm, Invariants & Rules]
- AD-3 (binds FR-12): **one** shared Redis sliding-window utility keyed by `ip + endpoint`, using the platform-trusted client IP — never a raw client-supplied `x-forwarded-for` value. This is the single utility every rate-limited endpoint across all three epics calls; do not let Epic 2 (search) or Epic 3 (self-service) build a second one later. The 429 response body shares one shape across all of them — lock that shape down now. [Source: ARCHITECTURE-SPINE.md, AD-3]
- Error shape is fixed project-wide: `{ error: { code, message } }` from every Server Action/Route Handler — this story's `RATE_LIMITED` code must use this exact envelope, matching the shape Story 1.1 already established for validation/uniqueness errors in `registerDonor`. [Source: ARCHITECTURE-SPINE.md, Consistency Conventions]
- Capability map places Abuse Prevention (FR-12) at `lib/domain/rate-limit.ts`, governed by AD-3 — this is the canonical location; do not place the utility under `lib/infra/` even though it talks to Redis, since the Domain-layer function is the port consumer, not the adapter itself. [Source: ARCHITECTURE-SPINE.md, Capability → Architecture Map]

### Relationship to Story 1.1 (in-progress)
- This story extends `app/actions/registerDonor.ts` and reuses `lib/infra/redis.ts`, both scaffolded in Story 1.1. Story 1.1 was still `in-progress` at the time this story was created — confirm both files exist with the shape described in Story 1.1's Dev Notes/File List before starting; if Story 1.1's Donor activation-flag field name or error-shape details changed during its implementation, follow what actually landed, not what's summarized here.
- Story 1.1 explicitly deferred rate-limiting out of scope ("leave the `registerDonor` action as a plain call the Story 1.2 utility will wrap") — this story is that wrap. Do not re-litigate or modify Story 1.1's validation/repository logic beyond adding the rate-limit gate ahead of it.
- No OTP, session-token, or eligibility logic belongs in this story (those are Stories 1.3/1.4 and Epic 2/3) — scope is strictly the rate-limit utility + wiring it onto one existing endpoint.

### Latest Tech Notes (verified 2026-07-07)
- **Client IP on Vercel/Next.js 16**: `NextRequest.ip` has been removed from current Next.js — do not use it. The trusted, first-party way to read the client IP on Vercel is `ipAddress()` from the `@vercel/functions` package, which reads Vercel's edge-sanitized `x-forwarded-for` value rather than a raw, spoofable client header. Inside a Server Action (no `Request` object available), get headers via `await headers()` from `next/headers` and pass that directly to `ipAddress()` — it accepts a `Headers` object, not only a `Request`. [Source: Vercel/Next.js discussions on client IP access, verified via web search 2026-07-07]
- **`@upstash/ratelimit`**: current stable line is 2.0.8x, GA, HTTP-based (Edge/serverless-compatible, matching the already-chosen Upstash Redis client). Provides a `Ratelimit.slidingWindow(limit, window)` primitive that can serve as the concrete Infrastructure-side implementation behind this story's Domain-layer port, if the team prefers a library over hand-rolled `ZADD`/`ZREMRANGEBYSCORE` — either is acceptable as long as `lib/domain/rate-limit.ts` itself stays adapter-agnostic per the layering rule. [Source: @upstash/ratelimit npm/GitHub, verified via web search 2026-07-07]

### Project Structure Notes
- Files touched: `lib/domain/rate-limit.ts` (new), `lib/infra/redis.ts` (extend — already scaffolded in Story 1.1 Task 4), `app/actions/registerDonor.ts` (extend — already scaffolded in Story 1.1 Task 7). No new routes/screens; no Prisma schema changes.
- New dependency: `@vercel/functions` (for `ipAddress()`). Optionally `@upstash/ratelimit` if the library-based sliding-window implementation is chosen over a hand-rolled one.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.2] — story ACs
- [Source: _bmad-output/planning-artifacts/architecture/architecture-BloodDonorApp-2026-07-06/ARCHITECTURE-SPINE.md] — layering, AD-3, error-shape convention, Capability → Architecture Map
- [Source: _bmad-output/planning-artifacts/prds/prd-BloodDonorApp-2026-07-06/prd.md] — FR-12, Open Question 3
- [Source: _bmad-output/implementation-artifacts/1-1-donor-submits-registration-details.md] — prior scaffolding this story extends (`lib/infra/redis.ts`, `app/actions/registerDonor.ts`, error-shape precedent)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-BloodDonorApp-2026-07-06/EXPERIENCE.md] — UX-DR5 (generic "try again shortly" copy rule for rate-limited actions)

## Open Questions For Dev

1. **Exact rate-limit thresholds** are an explicitly open product decision (PRD Open Question 3) — pick a reasonable placeholder (documented above as a suggestion, not a mandate) exposed via env config, and record the chosen default in Completion Notes so it's easy to retune later without a code change.
2. **Hand-rolled sliding window vs. `@upstash/ratelimit` library** — both satisfy AD-3's "one shared utility" rule; pick whichever keeps `lib/domain/rate-limit.ts` free of a direct Upstash SDK import, and record the choice in Completion Notes so Epic 2/3 stories know which pattern they're extending.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npx tsc --noEmit` — clean, no type errors.
- `npx next build` — production build succeeds; `/register` still prerenders as static content.
- `npx vitest run` — 48/48 tests passing across 5 test files (rate-limit domain unit tests, donor repository, registerDonor action incl. new rate-limit integration tests, registration form component, Zod schema).

### Completion Notes List

- Resolved Open Question 1 (rate-limit thresholds): defaults to 5 requests / 60s window per `ip + endpoint`, tunable via `RATE_LIMIT_REGISTER_MAX` / `RATE_LIMIT_REGISTER_WINDOW_SECONDS` env vars (documented in `.env.example`). Placeholder per PRD Open Question 3, not final.
- Resolved Open Question 2 (implementation approach): hand-rolled sliding window using a Redis sorted set (`ZADD` + `ZREMRANGEBYSCORE` + `ZCARD` + `ZRANGE ... WITHSCORES`) in `lib/infra/rateLimitStore.ts`, rather than adding `@upstash/ratelimit` as a dependency — the existing `@upstash/redis` client already provides everything needed, and this keeps `lib/domain/rate-limit.ts` adapter-agnostic behind a small `RateLimitCounterStore` port (`recordAndCount(key, windowSeconds)`), matching the pattern later `eligibility.ts`/`matching.ts`/`otp.ts` should follow.
- `lib/domain/rate-limit.ts` is the first file in `lib/domain/` — established the port-interface pattern (domain function takes the store as a parameter rather than importing an adapter) for future domain services to follow.
- `registerDonor.ts` now resolves the client IP via `ipAddress(await headers())` from `@vercel/functions`/`next/headers` per the story's Latest Tech Notes; added `@vercel/functions` (^3.7.5) as a new dependency.
- Rate-limit check runs before Zod validation in `registerDonor`, so even a request with invalid form data still counts against the IP's budget (prevents a validation-error loop from bypassing the limiter).
- No changes were needed to `app/register/page.tsx` for Task 2's UI requirement — the existing `submitError` state (set from `result.error.message` regardless of error code) already renders as a non-field-specific inline message near Submit, which is exactly the rendering path a `RATE_LIMITED` response (no `fieldErrors`) takes. Added a component test confirming a non-field error renders via this same path.
- Test strategy for the rate limiter's integration into `registerDonor`: `app/actions/registerDonor.test.ts` now mocks `next/headers`, `@vercel/functions`, and `lib/infra/rateLimitStore` (an in-memory fake), so the **real** `checkRateLimit` domain logic executes end-to-end through the Server Action without live Redis — this is stronger than mocking `checkRateLimit` itself, since it verifies the actual sliding-window wiring. Pre-existing tests unrelated to rate-limiting each get a unique fake IP (via an incrementing counter in `beforeEach`) so they never accumulate hits against a shared threshold.
- No live Upstash Redis instance was available in this environment (same constraint Story 1.1 noted for Postgres) — `lib/infra/rateLimitStore.ts` is untested against real Redis; its port-conformant unit coverage lives in `lib/domain/rate-limit.test.ts` against a fake store, and the Server Action integration tests exercise the same domain logic through a different in-memory fake. Verifying against live Upstash Redis is an environment-setup step for deployment, not a code gap.

### File List

- `lib/domain/rate-limit.ts` (new — `checkRateLimit`, `RateLimitCounterStore`/`RateLimitKey`/`RateLimitConfig`/`RateLimitResult` types)
- `lib/domain/rate-limit.test.ts` (new — unit tests against a fake in-memory store)
- `lib/infra/rateLimitStore.ts` (new — `redisRateLimitStore`, Redis sorted-set sliding-window implementation of the port)
- `app/actions/registerDonor.ts` (modified — wraps the action with `checkRateLimit`/`redisRateLimitStore`, resolves client IP via `ipAddress(await headers())`, returns `RATE_LIMITED` error shape)
- `app/actions/registerDonor.test.ts` (modified — mocks `next/headers`/`@vercel/functions`/`rateLimitStore`; added 3 new rate-limit integration tests; existing tests use per-test unique IPs)
- `app/register/page.test.tsx` (modified — mocks `next/headers`/`@vercel/functions`/`rateLimitStore` since the real `registerDonor` action now performs a rate-limit check; added 1 new test for the non-field error rendering path)
- `.env.example` (modified — documented `RATE_LIMIT_REGISTER_MAX` / `RATE_LIMIT_REGISTER_WINDOW_SECONDS`)
- `package.json` / `package-lock.json` (modified — added `@vercel/functions` dependency)

## Change Log

- 2026-07-08: Implemented shared Redis sliding-window rate-limit utility (`lib/domain/rate-limit.ts` + `lib/infra/rateLimitStore.ts`), wrapped `registerDonor` with it, added `RATE_LIMITED` error handling and platform-trusted IP resolution. 16 new/updated tests, full suite 48/48 passing. Status: ready-for-dev → review.
