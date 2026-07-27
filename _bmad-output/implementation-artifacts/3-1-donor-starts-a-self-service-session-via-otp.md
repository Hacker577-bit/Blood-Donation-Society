---
baseline_commit: NO_VCS
---

# Story 3.1: Donor Starts a Self-Service Session via OTP

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a returning donor,
I want to request and verify an OTP to my registered phone number,
so that I can access only my own registration without needing a persistent login.

## Acceptance Criteria

1. **Given** I tap "Manage my registration" on Home and land on Self-Service Entry, **when** I submit my registered phone number, **then** an OTP is requested via the shared `otp` service with `purpose: "self_service"` (Story 1.3, AD-2), rate-limited via the shared utility under a new endpoint key `"requestSelfServiceOtp"` (Story 1.2, extending FR-12 to the self-service-entry endpoint). [Source: epics.md#Story-3.1, FR-9, AD-2, AD-3]

2. **When** I submit a phone number that is not a verified registration, **then** the response is indistinguishable from the success case — `{ requested: true }`, no SMS sent, no `NOT_FOUND` leaked — so the endpoint cannot be used to enumerate which phone numbers are registered. [Source: epics.md#NFR-5, epics.md#NFR-6]

3. **When** I enter the correct code before expiry, **then** a signed JWT session token (~15 min TTL, unique `jti`) is issued via the existing `issueSessionToken` with **`subject` = my Donor `id`** and **`budget` = 1**, authorizing exactly one of update (Story 3.2) or delete (Story 3.3) per issuance (AD-4). [Source: epics.md#Story-3.1, ARCHITECTURE-SPINE.md#AD-4]

4. **When** the token is issued, **then** it is stored in an `httpOnly` cookie set in the same response that navigates to the Dashboard — never a URL query parameter — so a bearer credential that authorizes deletion of donor PII is not written into browser history, referrer headers, or server access logs. [Source: epics.md#NFR-5, epics.md#NFR-6]

5. **And** the Self-Service Dashboard shows only the registration whose Donor `id` matches the verified token's `subject` — never any other Donor's data; an absent, malformed, expired, or unverifiable token redirects to `/manage` and renders no donor data at all (FR-9). [Source: epics.md#Story-3.1, FR-9, NFR-5]

6. **And** rendering the Dashboard **does not** consume the token's budget — only Story 3.2's update and Story 3.3's delete consume it. A donor who lands on the Dashboard must still have exactly 1 action available. [Source: ARCHITECTURE-SPINE.md#AD-4]

7. **And** expired-code and wrong-code states reuse the exact messages from Story 1.3 — `"This code has expired."` and `"That code didn't match. Check the SMS and try again."` — never a merged generic message (UX-DR5). [Source: epics.md#Story-3.1, epics.md#UX-DR5, EXPERIENCE.md:77-78]

8. **And** Home is replaced with the three-way fork specified in the IA — "I need blood" → `/search/verify`, "I want to help" → `/register`, "Manage my registration" → `/manage` — since `app/page.tsx` is still the unmodified `create-next-app` template and AC #1 cannot be satisfied without it. [Source: EXPERIENCE.md:23, epics.md#UX-DR3]

## Tasks / Subtasks

- [x] Task 1: Add the phone→donor lookup to the repository (AC: #2, #3)
  - [x] Add `findDonorByPhone(phone: string): Promise<DonorRecord | null>` to `lib/infra/repositories/donorRepository.ts`, mirroring the exact shape of `findDonorById` (`donorRepository.ts:57-62`) with `where: { phone }` and `select: { id: true, phone: true, isVerified: true }`. `Donor.phone` is `@unique` (`prisma/schema.prisma:37`), so `findUnique` is valid.
  - [x] **Additive only.** Do not modify or refactor `findDonorById`, `findDonorWithAreas`, `activateDonor`, or `findVerifiedDonorsByBloodTypeAndArea`. Narrow single-purpose functions are this repository's established shape — do not consolidate the two id/phone lookups into one parameterized query.
  - [x] Tests in `lib/infra/repositories/donorRepository.test.ts` — extend the existing file, do not create a new one.

- [x] Task 2: Add the self-service phone-only validation schema (AC: #1)
  - [x] Create `lib/validation/selfServiceEntry.ts` exporting `selfServiceEntrySchema` and `type SelfServiceEntryInput = z.infer<typeof selfServiceEntrySchema>`.
  - [x] Single field `phone`. **Import `E164_PHONE_REGEX` from `@/lib/validation/registerDonor`** — it is already exported and already cross-imported by `lib/validation/searcherVerify.ts:2`. Do **not** write a third phone regex.
  - [x] Reuse the exact message string `"Enter a valid phone number, e.g. +923001234567."`
  - [x] Do not reuse `searcherVerifySchema` — it requires `name`, which self-service does not collect.
  - [x] Tests in `lib/validation/selfServiceEntry.test.ts`.

- [x] Task 3: Build `app/actions/requestSelfServiceOtp.ts` (AC: #1, #2)
  - [x] **Structure: copy `app/actions/requestSearcherOtp.ts`'s type declarations and validation block** — its `ActionError` (`:17-23`) includes `fieldErrors?: Partial<Record<string, string>>`, which Task 6's client reads. Do **not** copy `requestDonorOtp.ts`'s `ActionError` (`:17-22`); it omits `fieldErrors` because that action runs no Zod, and copying it will either fail to type-check or silently drop inline field errors.
  - [x] **Ordering: copy `requestDonorOtp.ts`'s rate-limit-FIRST sequence, not `requestSearcherOtp.ts`'s validate-first.** Rate-limit before Zod follows the 4-of-5 majority (`registerDonor.ts:57`, `submitSearch.ts:42`, `expandSearch.ts:46`, `requestDonorOtp.ts:34`) and prevents an attacker burning cycles on validation. `requestSearcherOtp.ts:34` is the lone outlier — take its *shape*, not its *order*.
  - [x] `"use server"` on line 1, module-level rate-limit config const, exported `RequestSelfServiceOtpResult` union.
  - [x] IP: `const ip = ipAddress(await headers()) ?? "unknown";` from `@vercel/functions` + `next/headers`. Never read `x-forwarded-for` (AD-3).
  - [x] Endpoint key: `"requestSelfServiceOtp"`. **Reuse `RATE_LIMIT_OTP_MAX` / `RATE_LIMIT_OTP_WINDOW_SECONDS`** (defaults 5 / 60) — no new env vars. The `ip + endpoint` composite already gives this endpoint an isolated bucket; this mirrors `expandSearch.ts:25-26` reusing the search tunables under a distinct key.
  - [x] Look up the donor with `findDonorByPhone(parsed.data.phone)` — **the Zod-parsed value, not the raw input.** The schema trims, and passing the raw string would silently miss a donor whose input had trailing whitespace. Pass that same `parsed.data.phone` to `requestOtp`, so the lookup key and the OTP challenge key cannot diverge.
  - [x] **If the donor is null OR `isVerified === false`, return `{ requested: true }` without sending an SMS.** This is AC #2 — an unverified/absent registration must be indistinguishable from a real one. Do not return `NOT_FOUND` here; that would turn the endpoint into a phone-enumeration oracle. (`requestDonorOtp.ts:51-53` returns `NOT_FOUND`, but it takes an opaque server-issued `donorId`, not a user-guessable phone — the situations are not analogous.)
  - [x] On a real verified donor: `await requestOtp({ phone: parsed.data.phone, purpose: "self_service" }, redisOtpStore, twilioOtpSender)`.
  - [x] `"self_service"` is the reserved purpose string — already asserted by `lib/domain/otp.test.ts:108,112`. `lib/domain/otp.ts` needs **zero changes**; `purpose` is a free-form `string` param (`otp.ts:33`).
  - [x] Tests in `app/actions/requestSelfServiceOtp.test.ts`.

- [x] Task 4: Build `app/actions/verifySelfServiceOtp.ts` (AC: #3, #4, #7)
  - [x] Declare `const SELF_SERVICE_SESSION_BUDGET = 1;` at module top, mirroring `const SEARCHER_SESSION_BUDGET = 2;` (`verifySearcherOtp.ts:9`).
  - [x] Call `verifyOtp({ phone, purpose: "self_service", code }, redisOtpStore)` and `switch` on `status` exactly as `verifySearcherOtp.ts:33-53` does. Map `"expired"` **and** `"not_found"` → `OTP_EXPIRED` / `"This code has expired."`; map `"wrong_code"` → `OTP_INCORRECT` / `"That code didn't match. Check the SMS and try again."`
  - [x] On `"verified"`: re-look-up the donor by phone (`findDonorByPhone`) to obtain the Donor `id`, then `issueSessionToken({ subject: donor.id, budget: SELF_SERVICE_SESSION_BUDGET }, joseTokenSigner, redisSessionBudgetStore)`.
  - [x] **Handle the null branch on that re-lookup.** `findDonorByPhone` returns `DonorRecord | null`, and the row can legitimately vanish between request and verify once Story 3.3 ships deletion. Return `{ error: { code: "NOT_FOUND", message: "We couldn't find that registration." } }` — the same pair `requestDonorOtp.ts:52` uses. Do **not** reach for `donor!.id`.
  - [x] **`subject` is the Donor `id` (a cuid), NOT the phone.** See Dev Notes → "Why subject is donorId" — this is a load-bearing security decision, not a style choice.
  - [x] Set the token as a cookie: `(await cookies()).set("self_service_session", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/manage", maxAge: 900 })`. `900` matches `SESSION_TTL_SECONDS` in `lib/domain/session.ts:11`. `path: "/manage"` is correct and deliberate — RFC 6265 §5.1.4 prefix-matching sends it to `/manage/dashboard` too. Do not "fix" it to `/`; the narrower path is the point.
  - [x] **Then call `redirect("/manage/dashboard")` from inside this Server Action.** Do not return the token, and do not leave the navigation to the client.
  - [x] **Why this matters — read before deviating.** Setting the cookie in the action and then navigating with a client-side `router.push()` is a documented race (vercel/next.js#49675): the RSC payload request can be issued before the browser commits `Set-Cookie`, so Task 7's Server Component reads no cookie and bounces the donor straight back to `/manage` — an infinite verify loop. It is timing-dependent, so it will **not** reproduce in the mocked unit tests this story prescribes, and there is no browser in this sandbox to catch it. Redirecting from inside the action puts `Set-Cookie` and the navigation on the same response, which closes the race. If you must return to the client instead, you need `revalidatePath("/manage", "layout")` in the action *and* `router.refresh()` before `router.push()` — strictly more moving parts for the same outcome.
  - [x] `redirect()` throws a control-flow signal by design, so call it **after** the cookie is set and outside any `try`/`catch` that would swallow it. Test it the way `app/register/confirmation/page.test.tsx:12-14` does — mock `next/navigation`'s `redirect` to record its argument and throw, then assert with `.rejects.toThrow(...)`.
  - [x] The action's success path therefore returns `never`, not a value. Its result type covers only the error cases.
  - [x] `phone` arrives unvalidated from the client, exactly as `verifySearcherOtp.ts:26` accepts it. That is safe here and needs no Zod: possession of a valid OTP for that phone is the actual credential, and an attacker supplying someone else's number still cannot produce their code. Do not add validation "for symmetry" — it would diverge from the established verify-action shape for no gain.
  - [x] Do **not** modify `lib/domain/session.ts` or `lib/infra/jwt.ts`. `issueSessionToken` is already parameterized by `budget` precisely so this story can pass `1` (recorded in `2-1-…md:27`).
  - [x] Tests in `app/actions/verifySelfServiceOtp.test.ts`.

- [x] Task 5: Build the Home three-way fork in `app/page.tsx` (AC: #8)
  - [x] Replace the entire `create-next-app` template. The current file is not merely unstyled — it references `bg-foreground` / `text-background` (`app/page.tsx:39`), CSS vars that no longer exist since `globals.css` was rewritten with the DESIGN.md `@theme` block, and its `bg-zinc-50 dark:bg-black` wrappers fight `app/layout.tsx:16`'s `bg-surface-base text-ink-primary`.
  - [x] Three links with the exact labels from `EXPERIENCE.md:23`: `"I need blood"` → `/search/verify`, `"I want to help"` → `/register`, `"Manage my registration"` → `/manage`.
  - [x] Use the standard container: `<main className="mx-auto flex w-full max-w-140 flex-col gap-6 px-4 py-8 sm:px-8">`. Heading `text-display text-ink-primary`. Server component — no `"use client"`.
  - [x] Use `next/link`, not `<a>`. Each link needs `min-h-[48px]` and `flex items-center` to meet the ≥44px tap-target floor (UX-DR8).
  - [x] Delete the now-unused `next/image` import. Do not delete `public/next.svg` or `public/vercel.svg` — out of scope.
  - [x] No microcopy for the Home heading exists in any planning artifact. Author one in EXPERIENCE.md's voice (`EXPERIENCE.md:43` — "a calm desk clerk, not a siren"). Suggested: `"Lifeline Lahore"` as `h1`, with a one-line `text-body text-ink-secondary` subtitle. Logged as Open Question #4.
  - [x] Tests in `app/page.test.tsx` — assert all three links render with correct `href`s.

- [x] Task 6: Build `app/manage/page.tsx` — Self-Service Entry + OTP Verify (AC: #1, #7)
  - [x] **One route, two client-side steps** — `type Step = "entry" | "otp"`, `useState<Step>("entry")`. Copy the structure of `app/search/verify/page.tsx`, not the `/register` → `/register/verify` two-route split.
  - [x] Rationale: the phone number must stay in React state so step 2 can pass it to `verifySelfServiceOtp`. The `/register` split works only because step 1 creates a server record and carries an opaque `donorId` in the URL; self-service creates no record, so a two-route split would force the raw phone number into the URL — an FR-9/NFR-5 leak. Do not "fix" this into two routes.
  - [x] No `useSearchParams()` is used, so **no `Suspense` wrapper is needed** (unlike `app/register/verify/page.tsx:143-149`).
  - [x] Entry step: single `<InputField id="phone" label="Phone number" placeholder="+923001234567" …>`, validate-on-blur via the `touchedFields` + `useMemo(safeParse)` + `useEffect` pattern copied verbatim from `app/search/verify/page.tsx:43-66`. Primary `<Button disabled={!isValid} loading={isSubmitting}>`.
  - [x] OTP step: `<OtpInput value={code} onChange={setCode} disabled={isSending || isVerifying} />`, `<Button disabled={code.length !== 6 || isSending} loading={isVerifying}>Verify</Button>`.
  - [x] Render `OTP_EXPIRED`, `OTP_INCORRECT`, `NOT_FOUND`, and `RATE_LIMITED` as separate `<p role="alert" className="text-meta text-status-error">` blocks keyed on `errorCode`, following `app/search/verify/page.tsx:201-215`. Use `role="alert"`, **not** `aria-live` — the codebase has zero `aria-live` attributes and 13 `role="alert"` usages, and `role="alert"` carries an implicit `aria-live="assertive"`, so UX-DR8's announcement requirement is satisfied either way. Consistency wins.
  - [x] Resend link: `const RESEND_COUNTDOWN_SECONDS = 45;` at module scope, the `setInterval` countdown effect from `app/search/verify/page.tsx:114-122`, and the `canResend ? "Resend code" : "Resend in 0:NN"` swap from `:221-233`. Reset to 45 on every successful send.
  - [x] **Add the unregistered-phone exit.** AC #2 makes an unregistered or unverified phone indistinguishable from a real one, so such a donor reaches the OTP step and waits for an SMS that will never arrive. Without an exit this is the silent dead end UX-DR5 forbids. When the countdown first reaches 0, render a persistent `text-meta text-ink-secondary` line beneath the resend control: `"Didn't get a code? This number may not have a verified registration."` followed by a `next/link` to `/register` labelled `"Register instead"`. This is the only place the enumeration-resistant design surfaces to a real user — do not omit it.
  - [x] **One deliberate improvement over the two existing copies:** add `min-h-[44px] inline-flex items-center` to the resend `<button>`. The Epic 1/2 copies render a bare 14px text button, violating UX-DR8's ≥44px floor. Meet the floor on the new screen; backfilling the other two is logged as deferred work.
  - [x] Button `loadingText`: leave the `Button` default `"Sending…"` (`Button.tsx:12`). `EXPERIENCE.md:76` specifies `"Sending code…"` for OTP triggers, but neither existing OTP screen overrides the default, and a third screen differing from the other two is worse for users than a doc mismatch. Logged as deferred work to change all three together.
  - [x] On successful verify the action itself redirects (Task 4) — **the client does no navigation.** There is no `router.push` and no `useRouter` on this page. `verifySelfServiceOtp` returns only on failure, so the client's post-await code path handles errors exclusively.
  - [x] Tests in `app/manage/page.test.tsx`.

- [x] Task 7: Build `app/manage/dashboard/page.tsx` — read-only Self-Service Dashboard (AC: #5, #6)
  - [x] Async **Server Component**. Model it on `app/register/confirmation/page.tsx` — that is the established read-view pattern (repository read + `computeEligibility` + `StatusBadge` + area pills).
  - [x] Read the cookie: `const token = (await cookies()).get("self_service_session")?.value;`. If absent → `redirect("/manage")`.
  - [x] `const session = await verifySessionToken(token, joseTokenSigner);` If `null` → `redirect("/manage")`. This covers expired, tampered, and wrong-key tokens; `joseTokenSigner.verify` never throws (`jwt.ts:30-34`), it returns `null`.
  - [x] `const donor = await findDonorWithAreas(session.subject);` If `null` or `!donor.isVerified` → `redirect("/manage")`. **This is the FR-9 guarantee** — the rendered donor is derived solely from the signed token's subject, never from a query param, cookie value the client can set, or form field.
  - [x] **Do NOT call `consumeSessionUse` here.** Viewing the dashboard must not spend the budget-of-1, or the donor would arrive with zero remaining actions and Stories 3.2/3.3 would be unreachable. Budget is consumed only by the update/delete actions.
  - [x] Render: `<h1 className="text-display text-ink-primary">` with the donor's name; `StatusBadge` per `computeEligibility({ lastDonationDate: donor.lastDonationDate })` — `"Eligible now"` (`status="eligible"`) or `` `Eligible again on ${dateFormatter.format(eligibleAgainOn!)}` `` (`status="cooldown"`); areas as static pills via `AREA_LABELS` using the exact `<li>` class string from `app/register/confirmation/page.tsx:57`.
  - [x] Also render the donor's blood type via `BLOOD_TYPE_LABELS` (`lib/presentation/labels.ts:16`), as a `text-label` / `text-body` pair matching the Areas block. `app/register/confirmation/page.tsx` does not show blood type, so there is no class string to copy — this surface differs because `EXPERIENCE.md:34` scopes the Dashboard to "View status" of the whole registration, and blood type is the one registration field a returning donor most needs to confirm. Deliberate addition, not an oversight.
  - [x] Reuse the `Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" })` formatter from `app/register/confirmation/page.tsx:7-10` → renders `"4 October"`, matching `EXPERIENCE.md:49`.
  - [x] **Scope line — render NO action controls.** Omit "Update donation date" (Story 3.2) and "Delete registration" (Story 3.3) entirely. Do not render them disabled: UX-DR5 forbids silently non-functional controls, and UX-DR4 allows exactly one primary action per screen, which 3.2/3.3 must arbitrate when they land.
  - [x] Do not use `AreaChip` — it is an interactive `role="checkbox"` control. This view is read-only.
  - [x] Tests in `app/manage/dashboard/page.test.tsx`.

- [x] Task 8: Tests (all AC)
  - [x] Red-green-refactor per task: write the failing test first, confirm it fails, then implement.
  - [x] **Baseline before starting: 219/219 passing across 31 files, zero failures** (`npx vitest run --no-file-parallelism`, verified 2026-07-26). Any failure you see is one you caused. Story 3.1 is complete when the suite is at 219 + your new tests, still with zero failures.
  - [x] Run with `--no-file-parallelism`. A full parallel run has OOM-crashed the worker in this sandbox across Stories 1.4 and 2.1.
  - [x] **Every infra module the action transitively imports must be `vi.mock`'d**, including ones you do not assert on — `lib/infra/redis.ts:8-12`, `jwt.ts:11`, `twilio.ts:10-21`, `prisma.ts:9-13` all throw at import time on missing env vars. Stub to `{}`. Missing one is the most common way an action test fails to even load.
  - [x] Mock domain functions with the stable-ref thunk idiom: `vi.mock("@/lib/domain/otp", () => ({ verifyOtp: (...args: unknown[]) => verifyOtpMock(...args) }))`. Import the action under test *after* all `vi.mock` calls.
  - [x] Rate-limit test isolation: the fake `rateLimitStore`'s `hits` Map lives inside each file's own `vi.mock` factory, so it persists across that file's tests but never leaks across files. Assign a unique IP in `beforeEach` — `currentTestIp = \`198.51.100.${++ipCounter}\`` — and pin a dedicated literal for rate-limit-specific tests.
  - [x] Assert the budget explicitly: `expect(issueSessionTokenMock.mock.calls[0][0]).toEqual({ subject: DONOR_ID, budget: 1 })`. A regression to `2` must fail the suite.
  - [x] Assert AC #2 directly: an unregistered phone and an unverified donor each return `{ requested: true }` **and** `expect(requestOtpMock).not.toHaveBeenCalled()`.
  - [x] Assert AC #6 directly: rendering the dashboard never calls `consumeSessionUse`.
  - [x] Assert AC #5 directly: a token whose `subject` is another donor's id renders only that other donor — i.e. the page never reads identity from anywhere but the token.
  - [x] Mock `next/headers`' `cookies()` in both action and page tests, and mock `next/navigation`'s `redirect` to record its argument and throw. For the async Server Component, use the Story 1.4 pattern: `await Page()` to resolve it before handing the JSX to RTL's `render()`, asserting redirects via `.rejects.toThrow(...)` — see `app/register/confirmation/page.test.tsx:12-14,65-98` for the working shape.
  - [x] Assert Task 4's redirect target explicitly: on a verified code, `expect(redirectMock).toHaveBeenCalledWith("/manage/dashboard")`, and assert the cookie was set **before** the redirect threw.

## Dev Notes

### Why `subject` is the Donor `id`, not the phone

AD-4 permits either ("scoped to exactly one phone number / Donor id"). Choosing `donorId` is the better of two imperfect options, and it is worth understanding exactly what it does and does not buy.

The JWT payload is `{ sub, jti, iat, exp }` (`lib/infra/jwt.ts:15-20`). There is **no `purpose` or `scope` claim**, and both flows sign with the same `JWT_SIGNING_KEY`. A Searcher token and a self-service token are therefore structurally indistinguishable, and each will pass the other flow's `verifySessionToken`.

**What `donorId` fixes — Searcher token used against self-service.** Stories 3.2/3.3 resolve the subject via `findDonorById`. A Searcher token's `sub` is an E.164 phone, which can never match a `cuid()`, so the lookup returns `null` and the request is rejected. Closed, with no change to Story 2.1's `done` code.

**What it does NOT fix — self-service token used against search.** `submitSearch.ts:104` does `const searcherPhone = verifiedToken.subject;` and writes it straight into the `Search` row with no format validation (same at `expandSearch.ts`). A self-service token would buy one free search and write a cuid into `Search.searcherPhone`, corrupting the FR-8 notification payload for that row. This direction is **not** closed by this story — it needs a `purpose`/`aud` claim in `session.ts`, which is out of scope here. Logged as deferred work. Do not read the `donorId` choice as an audited cross-flow invariant; it is one direction of two.

It is also simply what 3.2/3.3 need: both operate on a `Donor` row, and `findDonorById` already exists.

### Reuse map — build none of these

| Need | Already exists | Location |
|---|---|---|
| OTP generate/send/verify | `requestOtp`, `verifyOtp` | `lib/domain/otp.ts:32,49` |
| OTP Redis adapter | `redisOtpStore` | `lib/infra/otpStore.ts:14` |
| SMS sender | `twilioOtpSender` | `lib/infra/twilio.ts:29` |
| Rate limiting | `checkRateLimit` | `lib/domain/rate-limit.ts:32` |
| Rate-limit adapter | `redisRateLimitStore` | `lib/infra/rateLimitStore.ts:4` |
| Token issue / verify | `issueSessionToken`, `verifySessionToken` | `lib/domain/session.ts:13,34` |
| JWT signer | `joseTokenSigner` | `lib/infra/jwt.ts:13` |
| Budget store | `redisSessionBudgetStore` | `lib/infra/sessionStore.ts:4` |
| Eligibility | `computeEligibility` | `lib/domain/eligibility.ts:13` |
| Donor + areas read | `findDonorWithAreas` | `lib/infra/repositories/donorRepository.ts:95` |
| Phone regex | `E164_PHONE_REGEX` | `lib/validation/registerDonor.ts:27` |
| Area / blood-type labels | `AREA_LABELS`, `BLOOD_TYPE_LABELS` | `lib/presentation/labels.ts:3,16` |
| OTP boxes, button, input, badge | `OtpInput`, `Button`, `InputField`, `StatusBadge` | `app/components/ui/` |

Only **two** genuinely new pieces of logic exist in this story: `findDonorByPhone` and `selfServiceEntrySchema`. Everything else is composition.

`SESSION_TTL_SECONDS = 15 * 60` (`lib/domain/session.ts:11`) is module-private and not parameterizable — it already matches AD-4's ~15 min. Do not add a second issuance function to vary it.

### Architecture compliance

- **AD-2:** OTP challenges stay in Redis under `${phone}:self_service`, TTL 300s. No Postgres OTP table. `otp.ts` is untouched.
- **AD-3:** One shared limiter, new endpoint key, platform-trusted IP via `ipAddress(await headers())`. The `RATE_LIMITED` return shape is locked across all actions — do not add `retryAfterSeconds` to it, even though `checkRateLimit` computes one that no caller surfaces.
- **AD-4:** Server-enforced budget of 1, tracked in Redis by `jti`. A stateless "trust the TTL" implementation does not satisfy this rule.
- **AD-5:** Eligibility is computed at query time on the dashboard. Never persist a flag.
- **Layering:** Presentation → Domain → Infrastructure. Domain functions receive adapters as parameters; they never import one. A page reading through a repository is established precedent (`app/register/confirmation/page.tsx:4`).
- **Error envelope:** `{ error: { code, message } }` from every action, with `fieldErrors` nested *inside* `error` when present — never a sibling key.

### Error codes and copy — reuse verbatim

| Code | Message |
|---|---|
| `VALIDATION_ERROR` | `Please fix the highlighted fields and try again.` |
| `RATE_LIMITED` | `Too many attempts. Please try again shortly.` |
| `OTP_EXPIRED` | `This code has expired.` |
| `OTP_INCORRECT` | `That code didn't match. Check the SMS and try again.` |

Client-side catch-all on an action throw: `"Something went wrong. Please try again."` The ellipsis in `"Sending…"` is U+2026, a single character.

### Design tokens and layout

Container, verbatim on every screen: `mx-auto flex w-full max-w-140 flex-col gap-6 px-4 py-8 sm:px-8` (`max-w-140` = 560px, the top of EXPERIENCE.md's 480–560px band). OTP screens append `motion-reduce:transition-none`.

Type: `text-display` (confirmation/climax moments — Home h1, Dashboard h1), `text-heading` (step headings), `text-body` (supporting paragraphs), `text-meta` (errors, resend), `text-label` (field labels). Colors: `text-ink-primary`, `text-ink-secondary`, `text-ink-disabled`, `text-status-error`, `bg-surface-raised`, `border-border-hairline`, `bg-accent`.

Spacing tokens are **non-linear past step 4** (`app/globals.css:56`) — `gap-6` is 32px, not 24px. Copy existing class strings rather than reasoning from numbers.

Accessibility is inherited by using the existing components: `OtpInput` already emits `aria-label="Code digit N of 6"` per box and wraps in `role="group"`; `InputField` already wires `aria-invalid` + `aria-describedby` + `role="alert"`; `Button`, `InputField`, and `OtpInput` boxes are all ≥48px. `app/globals.css:73-82` already handles `prefers-reduced-motion` globally.

### Relationship to prior stories

Story 2.1 (`done`) built `session.ts` deliberately generic — "parameterize by `budget`, do not hardcode `2`… it will be reused as-is by Story 3.1 (self-service session, budget 1)" (`2-1-…md:27`). This story is the redemption of that design. If you find yourself editing `session.ts`, stop and re-read.

Story 1.3 built `otp.ts` with a free-form `purpose` so a third flow would need no changes. `lib/domain/otp.test.ts:108` already asserts `purpose: "self_service"` namespaces correctly.

### Known gotchas

- `verifyOtp` deletes the challenge on success (`otp.ts:70`), so a double-submitting client sees `not_found` → `"This code has expired."` This is expected. Do not "fix" it.
- `otp.ts` tracks an `attempts` counter but **nothing reads it** — there is no max-attempts lockout anywhere, and `verify*Otp` actions are not rate-limited. See Open Question #1.
- Redis keys share one flat keyspace with no prefixes: OTP `${phone}:${purpose}`, rate-limit `${ip}:${endpoint}`, session budget the bare `jti` UUID. Adding `"self_service"` is safe; do not invent a differently-shaped key.
- `sessionStore.consume` checks existence before `DECR` to avoid Redis's zombie-key bug (a `DECR` on a missing key creates it at `-1` with no TTL). Do not refactor it.
- Prisma 7: `.env` is not auto-loaded; `prisma/migrations/` does not exist and there is no live Postgres/Redis/Twilio in this environment — all infra is mock-covered only. **Never run `prisma migrate`.**
- There is no `lint` or `typecheck` npm script. `npm test` is the only gate; type errors surface only if a test imports the broken module. Run `npx tsc --noEmit` manually before marking the story done.
- `.env.example` does not exist on disk despite appearing in five prior File Lists. This story adds no new env vars, so no action needed.

### Project structure notes

New files: `app/actions/requestSelfServiceOtp.ts`, `app/actions/verifySelfServiceOtp.ts`, `lib/validation/selfServiceEntry.ts`, `app/manage/page.tsx`, `app/manage/dashboard/page.tsx`, plus a colocated `.test.ts`/`.test.tsx` for each — and `app/page.test.tsx`, which does not exist yet. Modified: `app/page.tsx`, `lib/infra/repositories/donorRepository.ts` and its existing `donorRepository.test.ts`.

Route naming: `ARCHITECTURE-SPINE.md:176` fixes the action-file family as `app/actions/selfService*`; `requestSelfServiceOtp` / `verifySelfServiceOtp` satisfies that while matching the `request*Otp` / `verify*Otp` verb pattern. The `/manage` route path has **no precedent** — it is chosen to mirror the `"Manage my registration"` link label and the `/register` + `/register/confirmation` shape. Stories 3.2/3.3 inherit it, so a change here is cheapest now (Open Question #3).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.1] — ACs, FR-9, NFR-5/6, UX-DR2/4/5/8/9
- [Source: _bmad-output/planning-artifacts/architecture/architecture-BloodDonorApp-2026-07-06/ARCHITECTURE-SPINE.md] — AD-2 (:44), AD-3 (:50), AD-4 (:56), AD-5 (:62), conventions (:80-86), capability map (:176)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-BloodDonorApp-2026-07-06/EXPERIENCE.md] — IA table (:19-37), Flow 4 (:151-159), form rules (:60-85), a11y (:96-107), responsive (:113-116)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-BloodDonorApp-2026-07-06/DESIGN.md] — tokens, status badge (:172), resend link (:175)
- [Source: _bmad-output/implementation-artifacts/2-1-searcher-verifies-identity-via-otp.md] — session/JWT precedent, budget parameterization rationale, zombie-key guard
- [Source: _bmad-output/implementation-artifacts/1-3-donor-verifies-phone-via-otp.md] — OTP screen precedent, distinct expired/wrong-code messages
- [Source: _bmad-output/implementation-artifacts/1-4-donor-views-confirmed-eligibility-status.md] — async Server Component read-view + test pattern
- [Source: app/search/verify/page.tsx] — one-route/two-step OTP UI to copy
- [Source: app/register/confirmation/page.tsx] — read-only dashboard view to copy
- [Source: app/actions/requestDonorOtp.ts] — canonical action structure
- [Source: lib/domain/session.ts] — `issueSessionToken` budget parameter

## Open Questions For Dev

1. **OTP brute-force on verify is unmitigated, and the blast radius is larger here.** `verify*Otp` actions are not rate-limited, and `otp.attempts` is tracked but never read. A 6-digit code inside a 5-minute window is brute-forceable given enough request throughput. For the Searcher flow the prize is a search; here it is a token that will authorize **deleting a donor's registration** (Story 3.3). This is a pre-existing systemic gap across all three OTP flows, already on the deferred ledger from Story 2.1 — not introduced by this story, and out of scope to fix in it. Flagging it because Epic 3 raises its severity. Recommend a dedicated hardening story before launch.

2. **`httpOnly` cookie + redirect-from-action is a deliberate divergence from the established session transport.** Story 2.1 chose query-param transport and explicitly warned against introducing a second mechanism. This story diverges because the self-service token authorizes destructive action on donor PII, where a URL-borne bearer credential lands in browser history, referrers, and logs — a materially different risk calculus from a search token. The cost is that this flow's navigation shape (action redirects; client does not) differs from every other screen in the app. If you prefer strict consistency, overrule this and use a query param — but then Stories 3.2/3.3 inherit it, and a delete-authorizing token sits in the URL.

3. **This story is the first use of `cookies()` anywhere in the codebase.** There is no existing pattern to copy and no browser in this sandbox to verify against. Task 4's redirect-from-inside-the-action is the shape that avoids the known `Set-Cookie`/`router.push()` race, but it is reasoned from the Next.js issue tracker rather than observed working here. Worth a manual browser check on the first real deploy.

4. **Route path `/manage` is unprecedented and unspecified.** Neither EXPERIENCE.md nor ARCHITECTURE-SPINE.md names URLs for self-service. `/self-service` and `/donor` are the alternatives. Stories 3.2/3.3 build under whatever this story picks.

5. **No microcopy exists for the Home heading or the Self-Service Entry heading/helper text.** The planning artifacts specify link labels and error strings but no screen headings for these surfaces. This story authors them in EXPERIENCE.md's established voice; a PM/UX pass may want to revise. The unregistered-phone exit copy in Task 6 is likewise authored here, not sourced.

6. **AD-4's budget of 1 means update-then-delete requires a second OTP.** A donor who updates their donation date and then decides to delete must re-verify. EXPERIENCE.md never mentions this, and Flow 4 sidesteps it by framing the two actions as separate visits. This story issues the budget-1 token, so the constraint enters the system here even though it surfaces in 3.2/3.3. Confirm this is the intended product behavior.

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m] (Amelia, Senior Software Engineer)

### Debug Log References

- `npx vitest run --no-file-parallelism` — **275 passed / 275, 37 files, zero failures.** Baseline was 219/31; this story adds exactly 56 tests across 6 new files plus 3 appended to `donorRepository.test.ts`.
- `npx tsc --noEmit` — clean, no output.
- Per-task red-green confirmed individually before each implementation: Task 1 3 failed → 11 passed; Task 2 module-missing → 6 passed; Task 3 module-missing → 10 passed; Task 4 module-missing → 9 passed; Task 5 4 passed; Task 6 12 passed; Task 7 12 passed.
- Dev server verified serving `/`, `/manage`, `/manage/dashboard` (200) against a placeholder `.env`.

### Completion Notes List

- **Added an `UNEXPECTED` catch-all to Task 6's OTP submit, beyond what the task specified.** The first green run surfaced an unhandled promise rejection: `handleOtpSubmit` had `try`/`finally` with no `catch`, so any action throw escaped the handler entirely and the donor saw nothing. `app/search/verify/page.tsx:124-148` has the same gap, but the story's own Dev Notes mandate the `"Something went wrong. Please try again."` catch-all, so the new screen honours it. The entry step already had one.
- **Wrapped the unregistered-phone exit sentence in a `<span>`.** The copy is followed by a `Register instead` link inside the same `<p>`, so the paragraph's text content includes the link label and no exact-text assertion could anchor to the sentence alone.
- Used `&apos;` rather than `&rsquo;` for apostrophes, matching `app/register/confirmation/page.tsx:41` and `app/search/page.tsx:199`. This also keeps rendered copy on ASCII `'`, identical to the error strings the actions return.
- `verifySelfServiceOtp`'s success path returns `never` — `redirect()` throws after the cookie is set. `VerifySelfServiceOtpResult` is therefore the error shape alone, not a union. Tests assert the success path via `.rejects.toThrow("NEXT_REDIRECT:/manage/dashboard")` and assert cookie-set-before-redirect ordering with `mock.invocationCallOrder`.
- The dashboard test asserts AC #5 by driving a *different* subject through the token and confirming the page follows it — proving identity is read from nowhere but the token — rather than merely asserting the happy path.
- **Not done, out of scope:** the cross-flow gap in the other direction. A self-service token still passes `submitSearch`'s `verifySessionToken` and writes a cuid into `Search.searcherPhone`. Closing it needs a `purpose`/`aud` claim in `lib/domain/session.ts`, which would reopen Story 2.1's `done` code. Already on the deferred ledger.
- **Not verifiable here:** Task 4's redirect-from-action shape is reasoned from vercel/next.js#49675, not observed. There is no live Redis/Postgres/Twilio in this sandbox, so no end-to-end OTP run was possible — mocked unit tests cannot catch a `Set-Cookie` timing race by construction. Needs a manual browser pass on first real deploy (Open Question #3).

### File List

**New**
- `lib/validation/selfServiceEntry.ts`
- `lib/validation/selfServiceEntry.test.ts`
- `app/actions/requestSelfServiceOtp.ts`
- `app/actions/requestSelfServiceOtp.test.ts`
- `app/actions/verifySelfServiceOtp.ts`
- `app/actions/verifySelfServiceOtp.test.ts`
- `app/manage/page.tsx`
- `app/manage/page.test.tsx`
- `app/manage/dashboard/page.tsx`
- `app/manage/dashboard/page.test.tsx`
- `app/page.test.tsx`

**Modified**
- `app/page.tsx` — create-next-app template replaced with the three-way fork
- `lib/infra/repositories/donorRepository.ts` — added `findDonorByPhone`, additive only
- `lib/infra/repositories/donorRepository.test.ts` — appended a `findDonorByPhone` describe block

**Unchanged, as required** — `lib/domain/session.ts`, `lib/domain/otp.ts`, `lib/infra/jwt.ts`.

## Change Log

- 2026-07-26: Story created with full implementation context. Status: backlog → ready-for-dev.
- 2026-07-26: All 8 tasks implemented red-green-refactor. 275/275 tests passing, `tsc --noEmit` clean. Status: in-progress → review.
