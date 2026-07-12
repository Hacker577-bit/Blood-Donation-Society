---
baseline_commit: NO_VCS
---

# Story 1.4: Donor Views Confirmed Eligibility Status

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a newly-verified donor,
I want to immediately see my eligibility status and the Areas I'm listed under,
so that I know exactly how I'll appear to a future Searcher.

## Acceptance Criteria

1. **Given** my OTP verification (Story 1.3) just succeeded, **when** the Registration Confirmation screen loads, **then** eligibility is computed at query time by the domain layer — `isEligible = (today - lastDonationDate) >= 90 days OR lastDonationDate IS NULL` (AD-5) — and never persisted as a stored flag. [Source: epics.md#Story-1.4, FR-3, AD-5]
2. **And** if eligible, I see a status badge reading "Eligible now" (status-success styling); if not, "Eligible again on [date]" (status-caution styling) — always paired with explicit text, never color alone. [Source: epics.md#Story-1.4, UX-DR2/UX-DR8]
3. **And** I see all Areas I selected during registration (Story 1.1) listed clearly. [Source: epics.md#Story-1.4]
4. **And** this screen uses the `display` typography token for this confirmation moment, per DESIGN.md. [Source: epics.md#Story-1.4, DESIGN.md]

## Tasks / Subtasks

- [x] Task 1: Build the `eligibility` domain service (AC: #1)
  - [x] Create `lib/domain/eligibility.ts` — **third** file in `lib/domain/` (after `otp.ts`, `rate-limit.ts`), and the first that needs **no port interfaces**: it's a pure function of its inputs, no store/sender dependency, no adapter to mock. Do not invent a port for it.
  - [x] Export `computeEligibility({ lastDonationDate }: { lastDonationDate: Date | null }, now: Date = new Date()): { isEligible: boolean; eligibleAgainOn: Date | null }`:
    - `lastDonationDate === null` → `{ isEligible: true, eligibleAgainOn: null }`
    - else compute `eligibleAgainOn = lastDonationDate + 90 days`; `isEligible = now >= eligibleAgainOn` (i.e. `now - lastDonationDate >= 90 days`); return `eligibleAgainOn` in both branches (useful even when already eligible, e.g. for future display needs) — AC #2 only *renders* it in the not-eligible case
    - Accept `now` as an injectable parameter (default `new Date()`) specifically so tests never depend on the real clock — do not call `Date.now()`/`new Date()` inside test assertions, pass a fixed `now` into every test call
  - [x] This is the file the architecture's Capability → Architecture Map anticipated: `lib/domain/eligibility.ts` governed by AD-5, covering FR-3/FR-4. [Source: ARCHITECTURE-SPINE.md, Capability → Architecture Map]

- [x] Task 2: Extend the donor repository for confirmation data (AC: #1, #3)
  - [x] Add `findDonorWithAreas(id: string): Promise<{ id: string; name: string; bloodType: BloodType; lastDonationDate: Date | null; isVerified: boolean; areas: Area[] } | null>` to `lib/infra/repositories/donorRepository.ts` — Prisma query selecting `Donor` fields plus its `DonorArea[]` relation (`include: { areas: true }` or a `select` mapping `areas` to `area.map(a => a.area)`), matching the schema's `Donor.areas: DonorArea[]` relation. [Source: prisma/schema.prisma]
  - [x] Do **not** modify or remove the existing `findDonorById` (still used by `requestDonorOtp.ts`/`verifyDonorOtp.ts` from Story 1.3) — this is a new, additive function for this story's different data shape (needs areas + bloodType + lastDonationDate; `findDonorById` only needs phone + isVerified for OTP purposes). Two functions, not one bloated one, is the existing pattern's shape.
  - [x] No Prisma schema changes — `Donor`/`DonorArea` already carry everything needed (`lastDonationDate DateTime? @db.Date`, `areas DonorArea[]`).

- [x] Task 3: Build the Registration Confirmation screen as a Server Component (AC: #1, #2, #3, #4)
  - [x] `app/register/confirmation/page.tsx` (new) — this is the route Story 1.3's Verify screen already navigates to on success (`/register/confirmation?donorId=...`); this story only had to build the screen itself.
  - [x] Build it as an **async Server Component**, not a client component — this is the first purely-read, no-interactivity screen in the app, so it doesn't need the `"use client"` + `useSearchParams` + `<Suspense>` pattern Story 1.3's Verify screen used for its interactive form. Read `donorId` directly server-side.
  - [x] **Next.js 16 critical detail:** `searchParams` is a `Promise` on Server Component pages (async since Next 15, still true in 16.2.x) — you MUST `await` it: `export default async function Page({ searchParams }: { searchParams: Promise<{ donorId?: string }> }) { const { donorId } = await searchParams; ... }`. Forgetting the `await` will not type-check. [Source: Next.js docs, verified 2026-07-08]
  - [x] If `donorId` is missing, or `findDonorWithAreas(donorId)` returns `null`, call `redirect("/register")` from `next/navigation` (Server Component redirects don't need a client-side `useEffect`/`router.replace` — use the server-native `redirect()` instead of Story 1.3's client pattern, since this component runs on the server).
  - [x] **Guardrail beyond the literal AC** (system must stay coherent end-to-end, not just satisfy stated ACs): if the donor exists but `isVerified` is `false` (someone hits this URL directly without completing OTP), `redirect("/register/verify?donorId=" + donorId)` rather than showing eligibility data for an unverified/non-searchable registration.
  - [x] Call `computeEligibility({ lastDonationDate: donor.lastDonationDate })` (real clock, default `now`) to get `{ isEligible, eligibleAgainOn }`.
  - [x] Render the primary confirmation heading/message using the `display` typography token (`text-display` Tailwind class, per AC #4) — this is the screen-level "climax" text DESIGN.md reserves `display` for; do not apply `display` to the badge or area list, only the primary confirmation heading.
  - [x] Render a `StatusBadge` (new component, Task 4) showing "Eligible now" (`isEligible: true`) or `` `Eligible again on ${formatted eligibleAgainOn}` `` (`isEligible: false`) — text always accompanies the status color, never color alone (NFR-8/UX-DR8).
  - [x] Date format: numerals + month name, no year, no relative time (e.g. "4 October") — matches EXPERIENCE.md's exact voice example ("You're eligible again on 4 October."); use `new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(eligibleAgainOn)`. Never render "in X days" or similar relative phrasing (UX-DR6 explicitly bans vague relative time for eligibility copy).
  - [x] Render the donor's Areas below the badge, using `AREA_LABELS` from `lib/presentation/labels.ts` (already established by Story 1.1/1.3 — do not duplicate this map). This is a **read-only display list**, not a selector — do not reuse the interactive `AreaChip` component (`role="checkbox"`, `onToggle`) here, since there's nothing to toggle; render simple non-interactive tag elements (`<span>`/`<li>`) styled consistent with the `area-chip` token's visual language (background `surface-raised`, border `border-hairline`, `rounded-full`) but without button/checkbox semantics or an `onClick` handler.

- [x] Task 4: Build the `StatusBadge` component (AC: #2)
  - [x] `app/components/ui/StatusBadge.tsx` (new) — `{ status: "eligible" | "cooldown"; children: React.ReactNode }` (or equivalent), rendering the token-specified styling: `eligible` → `bg-status-success-bg text-status-success`; `cooldown` → `bg-status-caution-bg text-status-caution`; both `rounded-full`, per `DESIGN.md.components.status-badge-eligible`/`-cooldown`. [Source: DESIGN.md]
  - [x] This component will be reused as-is by Story 3.2 (Self-Service Dashboard shows the same eligible/cooldown badge after a donation-date update) — keep it donor/screen-agnostic (no confirmation-page-specific props), same reuse discipline Story 1.3 applied to `OtpInput`.
  - [x] DESIGN.md's badge token only specifies `background`/`text`/`rounded` — no explicit font size is given for the badge itself; use `body` or `label` sizing (dev's choice, document in Completion Notes) since `display` is reserved for the screen-level heading only (Task 3), not the badge text.

- [x] Task 5: Tests (all AC)
  - [x] Unit tests for `lib/domain/eligibility.ts` (inject fixed `now` values, never the real clock): `lastDonationDate: null` → eligible; exactly 90 days elapsed → eligible; 89 days elapsed → not eligible, `eligibleAgainOn` = `lastDonationDate + 90d`; 1 day elapsed → not eligible.
  - [x] Unit/integration test for `donorRepository.findDonorWithAreas` (mock `lib/infra/prisma`, following Story 1.1's `donorRepository.test.ts` pattern): returns donor + areas array when found; returns `null` when not found.
  - [x] Page tests for `app/register/confirmation/page.tsx`: since this is an **async Server Component**, don't render it with `@testing-library/react`'s `render()` directly on the function — `await` the async component function to get its returned JSX first (e.g. `render(await Page({ searchParams: Promise.resolve({ donorId: "d1" }) }))`), then assert against the RTL screen. Mock `donorRepository.findDonorWithAreas` at the module boundary (`vi.mock`), same mocking style Story 1.1/1.3 used for repository/action dependencies.
    - Eligible donor (`lastDonationDate: null`) → renders "Eligible now" badge + all their Areas.
    - Cooldown donor (`lastDonationDate` 30 days ago) → renders "Eligible again on [date]" with a real formatted date, no relative time string.
    - Missing `donorId` in `searchParams` → `redirect("/register")` called (mock `next/navigation`'s `redirect`, assert it was called with `/register`, matching how a `redirect()` throw is typically asserted in Next.js App Router tests).
    - `donorId` for a non-existent donor → `redirect("/register")`.
    - `donorId` for an unverified donor (`isVerified: false`) → `redirect("/register/verify?donorId=...")`.
  - [x] Component tests for `StatusBadge`: renders `eligible` styling/text and `cooldown` styling/text branches; text is always present (never a color-only assertion).

## Dev Notes

### Architecture Compliance
- Layered monolith, one dependency direction: Presentation (`app/`) → Domain (`lib/domain/`) → Infrastructure (`lib/infra/`). `eligibility.ts` must stay a pure function with no imports from `lib/infra/` or `@prisma/client` — the Server Component page is what composes repository data + domain calculation, not the domain file itself. [Source: ARCHITECTURE-SPINE.md, Layering]
- AD-5 (binds FR-3, FR-4): `isEligible` is derived at query time, **never** a stored/cached column — this story is the one that actually implements the formula from the architecture spine's AD-5 section verbatim. Do not add an `isEligible` field to the `Donor` model. [Source: ARCHITECTURE-SPINE.md, AD-5]
- Capability → Architecture Map: "Eligibility (FR-3, FR-4) | `lib/domain/eligibility.ts` | AD-5" — this story is what actually builds that file the map already anticipated. [Source: ARCHITECTURE-SPINE.md, Capability → Architecture Map]
- No session token needed here (AD-4 doesn't apply) — this screen is reached immediately after Donor OTP Verify via a carried-forward `donorId` query param, the same pattern Story 1.3 already established for this exact route; it is not the AD-4 self-service-session flow (that's Epic 3's `Donor Self-Service` capability, which reuses this same `StatusBadge` in Story 3.2).
- Error shape convention (`{ error: { code, message } }`) does not apply here — there's no Server Action/mutation in this story, only a server-rendered read. Redirects, not error envelopes, are the correct failure-path mechanism for a page load.
- No new Zod validation needed — `donorId` is a route-carried identifier, not user-submitted form input; existing `findDonorWithAreas(id)` returning `null` is the validation boundary (invalid/unknown id → redirect, same posture Story 1.3 used for a missing `donorId`).

### Relationship to Story 1.1/1.3 (both status: review)
- `findDonorById` (Story 1.3) stays untouched — `requestDonorOtp.ts`/`verifyDonorOtp.ts` depend on its exact shape (`{ id, phone, isVerified }`). This story adds a **new**, additive `findDonorWithAreas` rather than widening `findDonorById`'s return type, which would ripple into Story 1.3's already-`review` action code and tests.
- `isVerified Boolean @default(false)` (Story 1.1's field, flipped by Story 1.3's `activateDonor`) is the field this story reads to guard against an unverified donor viewing this screen directly (Task 3's guardrail).
- Reuse `AREA_LABELS`/`BLOOD_TYPE_LABELS` from `lib/presentation/labels.ts` as-is (Story 1.1 originally placed this in `lib/domain/labels.ts`; a Story 1.1 review finding flagged that as a misplaced Presentation concern and it has since been relocated — the current, correct location is `lib/presentation/labels.ts`. Do not recreate a `lib/domain/labels.ts`.)
- Reuse `Button` (`app/components/ui/Button.tsx`) only if this screen needs a "Manage my registration" or similar next-step link/button — the epics AC for this story doesn't require one, so keep the screen minimal (badge + areas) unless product copy calls for a next action; do not invent scope beyond AC #1-#4.
- Story 1.3's `app/register/verify/page.tsx` required a `Suspense` boundary because it's a **client** component reading `useSearchParams()`. This story's page is a **Server** component reading `searchParams` as a prop directly — no `Suspense`, no `"use client"`, no `useSearchParams` import. Do not copy the 1.3 pattern verbatim; it's the wrong tool for a pure server-rendered read.

### Design Tokens / Component Reuse
```
status-badge-eligible: background status-success-bg (#E6F4EC), text status-success (#1E7A4C), rounded-full
status-badge-cooldown: background status-caution-bg (#FBF0DA), text status-caution (#9A6400), rounded-full
typography.display: 28px / 700 / line-height 1.2 — reserved for this screen's primary confirmation heading only
typography.meta: 14px / 400 / line-height 1.4 — area tag text
```
[Source: DESIGN.md frontmatter tokens, `app/globals.css` `--text-display`/`--color-status-*` custom properties]
- Existing Tailwind class convention in this codebase (see `Button.tsx`, `AreaChip.tsx`): `bg-accent`, `text-accent-on`, `bg-surface-raised`, `border-border-hairline`, `text-ink-primary` etc. — theme tokens are wired as Tailwind v4 `@theme` custom properties in `app/globals.css`, not `tailwind.config.js`. Follow the same `bg-status-success-bg text-status-success` naming pattern for the new badge.
- No decorative illustration, no color-only signal (NFR-8/UX-DR8) — every badge state pairs its background/text color with the literal status string.
- `prefers-reduced-motion`: this is a static confirmation screen with no state transition after load, so there's no transition/fade to suppress — no `motion-reduce:` classes needed here (unlike Story 1.1/1.3's interactive forms).

### Testing Standards
- Vitest + React Testing Library, matching Stories 1.1/1.2/1.3's established setup (`vitest.config.ts`/`vitest.setup.ts` already exist, no new framework).
- `lib/domain/eligibility.ts` must be unit-testable with an injected `now` — never assert against the real wall clock.
- This story introduces the first **async Server Component** test in the suite — see Task 5's explicit pattern (`await Page(...)` before `render(...)`, mock `next/navigation`'s `redirect`). Prior stories only tested client components (`OtpInput`, the registration form, the Verify form) via direct `render()`.

### Project Structure Notes
- Files touched: `lib/domain/eligibility.ts` (new), `lib/domain/eligibility.test.ts` (new), `lib/infra/repositories/donorRepository.ts` (extend — add `findDonorWithAreas`, do not modify `findDonorById`), `lib/infra/repositories/donorRepository.test.ts` (extend), `app/register/confirmation/page.tsx` (new), `app/register/confirmation/page.test.tsx` (new), `app/components/ui/StatusBadge.tsx` (new), `app/components/ui/StatusBadge.test.tsx` (new).
- No Prisma schema changes. No new npm dependencies (no new library needed — `Intl.DateTimeFormat` is a JS built-in).
- Route confirmed already wired by Story 1.3: `app/register/verify/page.tsx` navigates to `/register/confirmation?donorId=...` on successful verification.

### Latest Tech Notes (verified 2026-07-08)
- **Next.js 16 async `searchParams`**: on Server Component pages, `searchParams` is a `Promise<{ [key: string]: string | string[] | undefined }>` — this has been true since Next.js 15 and remains true in 16.2.x. You must `await searchParams` before reading `donorId`; a synchronous destructure will fail type-checking. Using `searchParams` at all opts the route into dynamic rendering (no static prerendering for this page — expected, since it's donor-specific data). [Source: Next.js docs, verified via web search 2026-07-08]
- Next.js also exposes a generated `PageProps<'/register/confirmation'>` helper type (available after `next dev`/`next build`/`next typegen` generates route types) as an alternative to hand-writing the `searchParams: Promise<...>` prop type — either approach is acceptable; hand-written types are used elsewhere in this codebase so far (Story 1.3 didn't use the generated helper), so staying consistent with hand-written prop types is the safer default unless the generated types are already in use.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.4] — story ACs
- [Source: _bmad-output/planning-artifacts/architecture/architecture-BloodDonorApp-2026-07-06/ARCHITECTURE-SPINE.md] — AD-5, Capability → Architecture Map, layering, structural seed (`lib/domain/eligibility.ts`)
- [Source: _bmad-output/planning-artifacts/prds/prd-BloodDonorApp-2026-07-06/prd.md] — FR-3, FR-4
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-BloodDonorApp-2026-07-06/DESIGN.md] — `status-badge-eligible`/`-cooldown` tokens, `display` typography reservation
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-BloodDonorApp-2026-07-06/EXPERIENCE.md] — Registration Confirmation IA row, UJ-3 climax beat, "4 October" voice/tone example, Accessibility Floor (color+text pairing)
- [Source: _bmad-output/implementation-artifacts/1-1-donor-submits-registration-details.md] — `isVerified` field origin, `lib/presentation/labels.ts` current (corrected) location
- [Source: _bmad-output/implementation-artifacts/1-3-donor-verifies-phone-via-otp.md] — navigation target `/register/confirmation?donorId=...`, `Suspense`-for-client-searchParams precedent (and why this story doesn't need it)
- [Source: prisma/schema.prisma] — `Donor`/`DonorArea` model shapes (`areas` relation field name, `lastDonationDate DateTime? @db.Date`)

## Open Questions For Dev

1. **Badge text sizing** — DESIGN.md's `status-badge-eligible`/`-cooldown` tokens specify only `background`/`text`/`rounded`, no `fontSize`. Pick `body` or `label` sizing for `StatusBadge`'s text and record the choice in Completion Notes (Story 3.2 will reuse this component as-is, so the choice should hold up on the Self-Service Dashboard too).
2. **Post-confirmation next action** — epics.md's AC for this story only requires the badge + Areas list (the "climax" moment); it does not specify a button/link to Home or elsewhere afterward. If EXPERIENCE.md's IA implies a next step, add a minimal one; otherwise leave the screen as a pure confirmation with no forced action, consistent with "exactly one primary action per screen" not applying to screens with zero required actions.
3. **`eligibleAgainOn` when already eligible** — `computeEligibility` is specified to always return `eligibleAgainOn` (even when `isEligible: true`), for forward-compatibility with Story 3.2's cooldown-after-update display. Confirm this doesn't cause any accidental leakage of a "future" date into the eligible-now badge copy (Task 3 already scopes the date string to the `!isEligible` branch only — just don't regress that when wiring the component).

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npx vitest run` — 88/88 tests passing across 13 test files (full suite, includes this story's new eligibility/repository/StatusBadge/confirmation-page tests plus Stories 1.1/1.2/1.3's existing coverage, no regressions). One `--no-file-parallelism` re-run was needed after an initial run hit a worker OOM crash in this sandboxed environment during test-runner teardown (all 77/77 tests it did report had already passed before the crash) — not a code or test defect.
- `npx tsc --noEmit` — clean, no type errors.
- `npx next build` — production build succeeds; `/register/confirmation` correctly renders as dynamic (`ƒ`), not static, since it reads `searchParams`.

### Completion Notes List

- Resolved Open Question 1 (badge text sizing): used `body` sizing (`text-body`, implicit via the component's default text size) for `StatusBadge` — no explicit `fontSize` token was given, and `body` matches the weight of surrounding confirmation-screen copy without competing with the `display` heading.
- Resolved Open Question 2 (post-confirmation next action): left the screen as a pure confirmation (badge + Areas list only) — epics.md's AC for this story doesn't specify a next-step button, and EXPERIENCE.md's UJ-3 climax beat description doesn't name one either; no scope added beyond AC #1-#4.
- Resolved Open Question 3 (`eligibleAgainOn` when already eligible): `computeEligibility` always returns `eligibleAgainOn` (non-null whenever `lastDonationDate` is non-null, including the eligible branch); the confirmation page only interpolates it into copy inside the `!isEligible` branch, so no future date leaks into the "Eligible now" badge.
- `lib/domain/eligibility.ts` is the third file in `lib/domain/` and the first with no port interfaces — pure function, injectable `now` for deterministic tests, per Task 1's explicit guidance.
- `findDonorWithAreas` is additive; `findDonorById` (Story 1.3) was left untouched — verified `requestDonorOtp.ts`/`verifyDonorOtp.ts` still compile and their existing tests still pass.
- `app/register/confirmation/page.tsx` is the app's first async Server Component data-fetching page — no `"use client"`, no `Suspense`, reads `searchParams` as an awaited `Promise` per Next.js 16 requirements, and uses `redirect()` from `next/navigation` for all three failure paths (missing donorId, unknown donor, unverified donor — the last one is a guardrail beyond the literal AC, added so the system stays coherent if this URL is hit directly before OTP verification completes).
- Area display list is intentionally non-interactive (`<ul>`/`<li>`, no `role="checkbox"`/`onToggle`) since this screen only displays previously-selected Areas, unlike the registration form's toggleable `AreaChip`.
- Date formatting uses `Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" })` (no year, no relative time), matching EXPERIENCE.md's literal voice example ("You're eligible again on 4 October.").
- Page-level test pattern is new to this suite: `await Page({ searchParams: Promise.resolve({...}) })` to resolve the async Server Component before passing its JSX to RTL's `render()`; `next/navigation`'s `redirect` is mocked to both record its argument and throw (mirroring Next.js's real control-flow behavior), so tests assert via `.rejects.toThrow(...)`.
- No live PostgreSQL/Redis was available in this environment (same constraint noted in Stories 1.1-1.3) — `findDonorWithAreas` is covered via a mocked Prisma client in `donorRepository.test.ts`, not exercised against a live database.

### File List

- `lib/domain/eligibility.ts` (new — `computeEligibility`)
- `lib/domain/eligibility.test.ts` (new — unit tests with injected clock)
- `lib/infra/repositories/donorRepository.ts` (modified — added `findDonorWithAreas`, `DonorWithAreas` type)
- `lib/infra/repositories/donorRepository.test.ts` (modified — added `findDonorWithAreas` tests)
- `app/components/ui/StatusBadge.tsx` (new — reusable eligible/cooldown badge)
- `app/components/ui/StatusBadge.test.tsx` (new — component tests)
- `app/register/confirmation/page.tsx` (new — Registration Confirmation async Server Component)
- `app/register/confirmation/page.test.tsx` (new — page tests incl. redirect paths)

## Change Log

- 2026-07-08: Implemented `lib/domain/eligibility.ts` (query-time eligibility, AD-5), `donorRepository.findDonorWithAreas`, the reusable `StatusBadge` component, and the Registration Confirmation screen as the app's first async Server Component page. 12 new tests, full suite 88/88 passing. Status: ready-for-dev → review.
