---
baseline_commit: NO_VCS
---

# Story 2.3: System Suggests Nearby Area Expansion on No Match

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a searcher who found no match in my selected Area,
I want the system to suggest nearby areas and re-search on my confirmation,
so that I don't hit a dead end when help might be one neighborhood over.

## Acceptance Criteria

1. **Given** my search (Story 2.2) returned zero Matches in the selected Area, **when** the result loads, **then** I see the Area Expansion Prompt — **not** the Empty State and **not** Story 2.2's current `"No matches were found in this area yet."` placeholder — naming the nearby areas that would be searched, sourced from a static, versioned TypeScript adjacency module keyed by the `Area` enum. No DB-backed, seeded, or admin-editable adjacency. [Source: epics.md#Story-2.3, FR-6, AD-7, EXPERIENCE.md State Patterns]
2. **When** I confirm expansion, **then** the system re-searches the adjacent area(s) and consumes the second and final unit of my session token's budget. A second confirm attempt on an exhausted token is rejected server-side with `SESSION_EXHAUSTED`, never silently re-run. [Source: epics.md#Story-2.3, AD-4]
3. **And** if the expanded search returns Matches, I see the standard Match Results view (Story 2.2's `MatchCard`), and the area(s) that produced results are explicitly named on screen — a Searcher must be able to tell *which* nearby area a given donor came from, not just that "some nearby area" matched. [Source: epics.md#Story-2.3, FR-6 "The Searcher sees which area(s) ultimately produced results"]
4. **And** ineligible donors are excluded from the expanded search exactly as they are from the original search — an expanded Area is not a fallback tier with looser eligibility rules. [Source: PRD FR-4 "at the searched Area **or any expanded nearby Area**", AD-5]
5. **And** every Match found by the expanded search is notified by SMS + email on the same terms as Story 2.2 — dispatch runs via `after()`, never blocking my response, failures logged and never surfaced to me. [Source: PRD FR-8, AD-6]
6. **And** a donor who is registered in two or more of the expanded areas appears exactly once in my results and receives exactly one notification — not one per area searched. [Source: FR-8 (one Notification per Match), Data model (`DonorArea` is many-per-donor)]
7. **And** if the expanded search also returns zero Matches, control passes to Story 2.4's Empty State — which does not exist yet, so this story renders a deliberate, clearly-labelled stopgap, exactly as Story 2.2 did for this story. [Source: epics.md#Story-2.4 boundary]

## Tasks / Subtasks

- [x] Task 1: Create the static area-adjacency module (AC: #1)
  - [x] Create `lib/domain/areaAdjacency.ts` (new) — pure data + one accessor, no Prisma/Redis/Twilio imports, same port-boundary discipline as every other `lib/domain/*` module.
  - [x] Export `AREA_ADJACENCY: Record<(typeof AREA_VALUES)[number], ReadonlyArray<(typeof AREA_VALUES)[number]>>`, typed against `AREA_VALUES` from `lib/validation/registerDonor.ts` — **reuse that existing const, do not redeclare the 10 area strings.** Typing it as a total `Record` over `AREA_VALUES` makes a missing area a compile error, which is the entire point of AD-7's "static code, not data."
  - [x] Export `getNearbyAreas(area: string): string[]` — returns `AREA_ADJACENCY[area] ?? []` as a plain array. Returns `[]` (never throws) for an unrecognised area; the caller's Zod schema is what rejects bad input, so this accessor stays total.
  - [x] Concrete values to use — this is a **PM-owned open decision (PRD Open Question 1) that has not been answered**, so these are a documented working assumption, not a product ruling. Add a file-header comment stating exactly that, plus the invariant below, so a future PM edit doesn't silently break symmetry:
    ```ts
    JoharTown:  ["ModelTown", "FaisalTown", "WapdaTown", "IqbalTown", "GardenTown", "BahriaTown"]
    DHA:        ["Cantt", "Gulberg"]
    Gulberg:    ["ModelTown", "Cantt", "GardenTown", "DHA"]
    ModelTown:  ["Gulberg", "FaisalTown", "GardenTown", "JoharTown"]
    BahriaTown: ["JoharTown", "WapdaTown"]
    Cantt:      ["DHA", "Gulberg"]
    IqbalTown:  ["JoharTown", "WapdaTown"]
    GardenTown: ["ModelTown", "Gulberg", "FaisalTown", "JoharTown"]
    WapdaTown:  ["JoharTown", "IqbalTown", "FaisalTown", "BahriaTown"]
    FaisalTown: ["ModelTown", "GardenTown", "JoharTown", "WapdaTown"]
    ```
  - [x] **Invariants this table must satisfy (assert them in tests, Task 6):** symmetric (`B ∈ adjacency[A]` ⟺ `A ∈ adjacency[B]`); no self-reference (`A ∉ adjacency[A]`); every area has ≥1 neighbour (otherwise expansion is a guaranteed dead end for that area); every listed neighbour is a member of `AREA_VALUES`.

- [x] Task 2: Add multi-area matching to the domain layer (AC: #4, #6)
  - [x] `lib/domain/matching.ts` (modified) — add `findMatchesAcrossAreas(criteria: { bloodType: string; areas: string[] }, lookup: DonorMatchLookup, now: Date = new Date()): Promise<DonorMatch[]>`.
  - [x] Implement it by calling the **existing** `findMatches` once per area and concatenating — do **not** widen `DonorMatchLookup`, do not add a new repository method, do not reimplement the eligibility filter. `findMatches` already applies `computeEligibility` (AD-5), which is what satisfies AC #4; routing expansion through it is what makes an expanded Area structurally incapable of being a looser-eligibility fallback tier. Neighbour counts are 2–6, so this is at most 6 indexed queries — not worth a new port shape.
  - [x] Run the per-area lookups with `Promise.all`, not a sequential `for await` loop — SM-2's 30-second budget already absorbed an OTP round-trip, and this is the second search in the same session.
  - [x] **Deduplicate by `phone`, keeping the first occurrence**, so a donor registered in both DHA and Gulberg appears once (AC #6). Iterate `criteria.areas` in the given order and keep the first area that matched a given phone — the retained `DonorMatch.area` is therefore the first expanded area (in adjacency-list order) that donor was found in. Phone is the correct dedup key: it is the E.164 unique column on `Donor` (`prisma/schema.prisma`), and `DonorMatch` carries no id.
  - [x] Do not change `findMatches`'s existing signature or behaviour — Story 2.2's `submitSearch` and its tests depend on it as-is.

- [x] Task 3: Build the `expandSearch` Server Action (AC: #2, #3, #4, #5, #6)
  - [x] Create `lib/validation/expandSearch.ts` (new) — `expandSearchSchema = z.object({ searcherName: z.string().trim().min(1, "Enter your name.").max(200, "Name is too long."), bloodType: z.enum(BLOOD_TYPE_VALUES, { error: "Select a blood type." }), originArea: z.enum(AREA_VALUES, { error: "Select an area." }) })`, importing `AREA_VALUES`/`BLOOD_TYPE_VALUES` from `lib/validation/registerDonor.ts`. Mirror `lib/validation/submitSearch.ts` exactly, including its error copy.
  - [x] **`searcherPhone` is deliberately absent from this schema and from the client-submitted input** — it comes only from the verified token's `subject`. Same rule, same reason as `submitSearch.ts`: the token is the only proof of phone ownership.
  - [x] Create `app/actions/expandSearch.ts` (new). Follow `app/actions/submitSearch.ts`'s step order **exactly** — deviating from it is how the two search paths drift apart:
    1. Rate-limit first, before touching the token: `checkRateLimit({ ip, endpoint: "expandSearch" }, redisRateLimitStore, config)` with `ip = ipAddress(await headers()) ?? "unknown"`. **Reuse the existing `RATE_LIMIT_SEARCH_MAX`/`RATE_LIMIT_SEARCH_WINDOW_SECONDS` env pair** (same defaults `5`/`60`) — expansion is the same cost category as search (it triggers the same real SMS/email sends), so it needs no new tunable. The `endpoint: "expandSearch"` key still gives it its own bucket per AD-3's `ip + endpoint` keying, so an expansion cannot exhaust the primary search budget or vice versa. **Do not add new env vars for this.**
    2. Validate via `expandSearchSchema.safeParse` → `VALIDATION_ERROR` with `fieldErrors`, same shape and copy as `submitSearch`.
    3. `verifySessionToken(sessionToken, joseTokenSigner)` → `null` gives `{ error: { code: "SESSION_INVALID", message: "Your session has expired. Please verify your phone again." } }`.
    4. `consumeSessionUse(verifiedToken.jti, redisSessionBudgetStore)` → `allowed: false` gives `{ error: { code: "SESSION_EXHAUSTED", message: "This search session has been used up. Please verify your phone again." } }`. **This decrement is what satisfies AC #2 and must happen before any DB write**, so a re-search is never both recorded and left un-decremented. Story 2.1 issues a budget of exactly 2; Story 2.2 spends the first — this action spends the second and last, which is precisely AD-4's "at most one area-expansion re-search."
    5. `const nearbyAreas = getNearbyAreas(originArea)`. **If `nearbyAreas` is empty, short-circuit to `{ matches: [], areasSearched: [] }`** — no repository calls, no `Search` rows, no `after()` scheduling. (Task 1's invariants make this unreachable today; it is a cheap guard against a future PM adjacency edit, not speculative generality.) Note the budget unit is still consumed at step 4 — do not try to refund it.
    6. `const matches = await findMatchesAcrossAreas({ bloodType, areas: nearbyAreas }, donorRepository)`.
    7. Record the expansion: call `createSearch({ searcherName, searcherPhone: verifiedToken.subject, bloodType, area })` **once per area in `nearbyAreas`**, via `Promise.all`. Rationale: `Search.area` is a single `Area` column (`prisma/schema.prisma`) and this story adds **no** schema change or migration — one row per area actually searched is the only representation that keeps SM-3 ("% of Searches that produce at least one Match in the selected Area *or its nearby areas*") computable from the table. See Open Question 2 if this row-count inflation is unwanted.
    8. Build the client response **before** scheduling dispatch: `{ matches: matches.map(({ name, phone, area }) => ({ name, phone, area })), areasSearched: nearbyAreas }`. Strip `email` — the Searcher never sees a donor's email (same rule as `submitSearch`).
    9. Schedule notifications inside `after(async () => { try { await notifyMatches(...) } catch (err) { console.error("expandSearch: notification dispatch failed", err) } })`, importing `{ after }` from `next/server`. Pass the full `matches` (with `email`) plus context `{ searcherName, searcherPhone: verifiedToken.subject, bloodType: BLOOD_TYPE_LABELS[bloodType], area: AREA_LABELS[originArea] }`. **The notification's `area` is the searcher's `originArea`, not the area the donor matched in** — the message tells a donor *where blood is needed*, not where they themselves are registered ("Amara needs O- blood in Gulberg", per EXPERIENCE.md Flow 2). Getting this backwards sends a donor a message about their own neighbourhood, which reads as nonsense. The `after()` callback must `await` the full `notifyMatches` call (AD-6 — never fire-and-forget *inside* `after()`); the outer try/catch is a last-resort guard, since `notifyMatches` already catches per-match.
    10. Return the response. Task 2's dedup is what guarantees AC #6's one-notification-per-donor — `notifyMatches` sends once per array element and has no dedup of its own, so a duplicate reaching it would double-text a real person.
  - [x] Reuse `notifyMatches`, `twilioNotificationSender`, `sendgridEmailNotifier`, `createSearch`, `checkRateLimit`, `verifySessionToken`, `consumeSessionUse` **verbatim**. This story modifies none of them.

- [x] Task 4: Replace the zero-match placeholder with the Area Expansion Prompt (AC: #1, #2, #3, #7)
  - [x] `app/search/page.tsx` (modified). **Read the whole file before editing** — it is a working Story 2.2 screen and every existing behaviour below must survive.
  - [x] Widen `type Step` from `"form" | "results"` to `"form" | "expand" | "results"`.
  - [x] In `handleSubmit`'s success branch, replace the unconditional `setStep("results")` with: `setStep(result.matches.length === 0 ? "expand" : "results")`. **Delete the `matches.length === 0 ? <p>No matches were found in this area yet.</p> : ...` ternary from the `"results"` block** — that placeholder was Story 2.2's explicit stopgap for this story and must not survive alongside the real prompt (AC #1). The `"results"` block can then render the match list unconditionally.
  - [x] `"expand"` step renders the Area Expansion Prompt inline (same `<main>` container/classes as the other steps): a plain-language heading and body in EXPERIENCE.md's calm-desk-clerk voice — e.g. `"We couldn't find a match in {AREA_LABELS[area]} yet."` and `"We can also check nearby areas: {nearby.map(a => AREA_LABELS[a]).join(", ")}."` — the nearby list computed client-side via `getNearbyAreas(area)` so the prompt **names** the areas rather than saying "nearby areas" abstractly (AC #1). Importing `lib/domain/areaAdjacency.ts` into a client component is fine: it is pure data with no server-only imports, exactly like `lib/validation/registerDonor.ts` which `page.tsx` already imports.
  - [x] One primary `Button` — "Search nearby areas" — with `loadingText="Searching…"` (UX-DR4: exactly one primary action per screen; matches the existing submit's copy). On click, call `expandSearch({ sessionToken, searcherName, bloodType, originArea: area })`, showing the same 3 `SkeletonRow`s while pending that the first search shows (UX-DR5) — reuse the existing `SkeletonRow` component, do not write a second one.
  - [x] On expansion success with matches: `setMatches(result.matches)`, store `result.areasSearched`, `setStep("results")`.
  - [x] The `"results"` block must name the matched areas when the results came from an expansion (AC #3). Each `MatchCard` already renders `AREA_LABELS[match.area]`, which is the per-donor half; add the summary half — e.g. `"Found in {matchedAreaLabels.join(", ")}."` above the list, derived from `new Set(matches.map(m => m.area))` (the areas that actually produced results, not every area searched). Show this line only after an expansion, not after a first-pass search.
  - [x] On expansion returning zero matches (AC #7): render a minimal, explicitly-labelled stopgap — e.g. `"We couldn't find a match in nearby areas either."` — and **do not build the worded Empty State with its next-step action link.** That is Story 2.4's job; building it here is scope creep into an unstarted story, exactly as Story 2.2 declined to build this prompt.
  - [x] Error handling: reuse the existing `errorCode`/`errorMessage` state and both existing `role="alert"` blocks unchanged. `SESSION_INVALID`/`SESSION_EXHAUSTED` from `expandSearch` must render with the same "Verify your phone again" link to `/search/verify` that `submitSearch`'s do — the existing conditional already keys on the code, so it covers this if you set the same state.
  - [x] Reduced motion: no transition or fade on the new `form → expand → results` transitions, matching the existing `motion-reduce:transition-none` on the `<main>` and `motion-reduce:animate-none` on `SkeletonRow`.
  - [x] Do not modify `AreaChip.tsx`, `Button.tsx`, or `MatchCard` — all three are reused as-is.

- [x] Task 5: Tests (all AC)
  - [x] `lib/domain/areaAdjacency.test.ts` (new) — assert the four Task 1 invariants (symmetry, no self-reference, ≥1 neighbour per area, all neighbours ∈ `AREA_VALUES`) by iterating `AREA_VALUES`, **not** by restating the table. A test that hardcodes the same values twice catches nothing; a test that checks the *properties* survives a PM editing the values. Plus: `getNearbyAreas` returns `[]` for an unknown area.
  - [x] `lib/domain/matching.test.ts` (modified) — for `findMatchesAcrossAreas`, against a fake in-memory `DonorMatchLookup` (no live Prisma): aggregates matches across all requested areas; **excludes a donor whose `lastDonationDate` is inside the 90-day window even though blood type + an expanded area match** (direct regression coverage for AC #4 — this is the single most important new test in this story); returns a donor present in two requested areas exactly once, with `area` set to the first requested area they matched (AC #6); returns `[]` for an empty `areas` array without calling the lookup.
  - [x] `app/actions/expandSearch.test.ts` (new) — mirror `app/actions/submitSearch.test.ts`'s structure and mocking. Cover: invalid input → `VALIDATION_ERROR` with `fieldErrors`; rate-limited → `RATE_LIMITED`; bad token → `SESSION_INVALID`; exhausted budget → `SESSION_EXHAUSTED` **and no `createSearch` call and no `after()` scheduling** (proves the budget gate precedes every side effect, AC #2); happy path → returns `{ matches, areasSearched }`, `createSearch` called once per nearby area with `searcherPhone` equal to the **token's** `subject` (never a client value), budget consumed exactly once; notification context asserted to carry the **origin** area label, not a matched-donor area label (the Task 3 step-9 trap); response resolves without awaiting the mocked `after()` callback.
  - [x] `app/search/page.test.tsx` (modified) — a search returning `{ matches: [] }` lands on the Area Expansion Prompt and **not** on the old `"No matches were found in this area yet."` text (assert that string is absent — this is the regression test that the stopgap was actually removed); the prompt names the specific nearby areas for the chosen origin area; confirming calls `expandSearch` with `originArea` set to the originally-searched area; skeleton rows render while the expansion is pending; expansion matches render as `MatchCard`s with the matched-area summary line; expansion returning zero renders the stopgap message; `SESSION_EXHAUSTED` from `expandSearch` renders with the `/search/verify` link. Existing Story 2.2 tests must keep passing unmodified except where they asserted the deleted placeholder.
  - [x] `lib/validation/expandSearch.test.ts` (new) — mirror `lib/validation/submitSearch.test.ts`.

### Review Findings

Code review 2026-07-26 (3 parallel adversarial layers). Note: at review time the suite was red due to
in-flight Story 2.4 work in `app/search/page.tsx` / `page.test.tsx`, not due to the findings below.

- [x] [Review][Decision] `expandSearch` is callable without any prior search — notification amplification — The session token carries only `sub`/`jti`; nothing proves an initial search ran or returned zero matches, and nothing binds the expansion's `bloodType`/`originArea` to it. A client can call `expandSearch` as its first action with `originArea: "JoharTown"` (6 neighbours) and notify 6 areas' donors for one budget unit, vs. 1 area per unit via `submitSearch`. Still gated by OTP, rate limit, and the budget of 2 — but it is a ~6x real-SMS/email amplification with no server-side check. Fix requires deciding a mechanism (signed search context in the token, server-side search record lookup, or accept). [app/actions/expandSearch.ts:107]
- [x] [Review][Decision] `createSearch` fan-out rests on a rationale that does not hold — The inline comment justifies one `Search` row per expanded area as "what keeps SM-3 computable". SM-3 is "% of Searches producing ≥1 Match"; the `Search` model has no match count, result flag, or correlation id, so SM-3 is not computable at any row granularity. The fan-out instead inflates SM-3's denominator 4–6x for exactly the expansion journeys it measures, biasing it downward, and duplicates searcher name/phone across up to 6 rows. Needs a product call: keep, add a correlation id, or write one origin row. [app/actions/expandSearch.ts:120-131]
- [x] [Review][Decision] Phone-dedup (AC #6) makes the "Found in …" summary (AC #3) under-report — `findMatchesAcrossAreas` keeps only the first area a phone matched in; the screen derives the summary from `new Set(matches.map(m => m.area))`. A donor registered in both Model Town and Cantt is tagged Model Town only, so the summary asserts Cantt produced nothing when it did. The two ACs pull against each other and the resolution is a product call. [lib/domain/matching.ts:69-80, app/search/page.tsx:196]
- [x] [Review][Patch] Unguarded `Promise.all` over `createSearch` discards found matches and skips all notifications — One failed insert rejects before `after()` is registered, so the budget is spent, matches exist, and no donor is ever notified. Up to 6 writes = 6x the failure surface of `submitSearch`'s single write. [app/actions/expandSearch.ts:122-131]
- [x] [Review][Patch] Client handlers have `try`/`finally` with no `catch` — a rejected action fails silently — Spinner stops, button re-enables, no `role="alert"` renders, and there is no `app/**/error.tsx` in the repo. The budget unit is already spent, so the retry returns SESSION_EXHAUSTED. [app/search/page.tsx:117-142]
- [x] [Review][Patch] Expand button stays enabled after a terminal SESSION_EXHAUSTED — Nothing keys off `errorCode`, so each re-click burns an `expandSearch` rate-limit slot for a call that can never succeed. [app/search/page.tsx:183-190]
- [x] [Review][Patch] Up to 12 sequential DB round trips on the response path — Up to 6 `findMany` (one per area) plus up to 6 individual `create`. One `area: { in: nearbyAreas }` query and one `createMany` would do the same work against SM-2's 30s budget. [lib/domain/matching.ts:65-67, app/actions/expandSearch.ts:123]
- [x] [Review][Patch] `didExpand` and `areasSearched` never reset on a new first-pass search — Once a path back to the form exists, a plain single-area search renders the expansion "Found in …" summary from stale state. [app/search/page.tsx:71,137]
- [x] [Review][Patch] No test binds the prompt's promised areas to the areas the server actually searches — `expandSearch.test.ts` mocks `getNearbyAreas` wholesale and `page.test.tsx` mocks the action wholesale, so the real `AREA_ADJACENCY` is never exercised end-to-end. [app/actions/expandSearch.test.ts:18-20, app/search/page.test.tsx:19-21]
- [x] [Review][Patch] Test name claims a freeze that does not exist — "returns a plain mutable array, not the frozen source" — nothing calls `Object.freeze`; `ReadonlyArray` is erased at runtime, so `AREA_ADJACENCY.DHA.push(...)` succeeds and would silently corrupt every later expansion. [lib/domain/areaAdjacency.test.ts:56]
- [x] [Review][Patch] The no-neighbours branch is tested only against a state the table makes impossible — `expandSearch.test.ts` forces `getNearbyAreas` to `[]` while `areaAdjacency.test.ts` asserts every area has ≥1 neighbour. The test would keep passing if the branch were wrong. [app/actions/expandSearch.test.ts:186-196]
- [x] [Review][Patch] Area strings lose their `Area` type at the port boundary — `getNearbyAreas` returns `string[]` and `DonorMatchLookup.area` is `string`, but the concrete repo requires `Area`. Only TS parameter bivariance makes this compile; the Zod enum is the sole runtime guard, so a typo'd adjacency edit would compile and fail at the DB. [lib/domain/areaAdjacency.ts:32, lib/domain/matching.ts:11-15]
- [x] [Review][Defer] Rate-limit response discards the `retryAfterSeconds` it computed [app/actions/expandSearch.ts:52-59] — deferred, pre-existing (inherited verbatim from `submitSearch.ts`)
- [x] [Review][Defer] No affordance to return to the form from the expand step [app/search/page.tsx:166-193] — deferred, pre-existing pattern (step is component state, not URL; affects the 2.2 screen shape generally)

## Dev Notes

### Files Being Modified — Current State and What Must Survive

**`app/search/page.tsx`** (Story 2.2, ~209 lines) — the only pre-existing file with meaningful behaviour change. Current state: a client component with `Step = "form" | "results"`, wrapped in `<Suspense fallback={null}>` around an inner `SearchForm` that reads `sessionToken` and `name` from `useSearchParams()` and `router.replace("/search/verify")`s in a `useEffect` if either is missing. It owns `SkeletonRow` and `MatchCard` (the latter holding the `matchMedia("(pointer: coarse)")` dialer-vs-clipboard logic and its own `copied` state). **What this story changes:** the `Step` union, the success-branch routing, deletion of the zero-match placeholder ternary, and two new render blocks. **What must not break:** the Suspense/`useSearchParams` wrapper, the missing-param redirect, the `bloodType` `<select>`, the single-select `AreaChip` group, the disabled-until-valid `Button`, `MatchCard`'s pointer logic, and both `role="alert"` error blocks.

**`lib/domain/matching.ts`** (Story 2.2, 44 lines) — pure domain, imports only `computeEligibility`. `findMatches` filters candidates through `computeEligibility` then maps `area` to the *searched* area. **Additive change only**: a new exported function alongside it. `submitSearch.ts` and `matching.test.ts` both depend on the existing signature.

**`app/actions/submitSearch.ts`** (Story 2.2) — **not modified by this story.** It is the structural template for `expandSearch.ts` (step order, error codes, error copy, `after()` shape). Read it before writing the new action; copy its ordering rather than inventing one.

### Architecture Compliance
- **AD-7 (binds FR-6) — the invariant this story exists to satisfy:** adjacency is one static, versioned TypeScript module keyed by the `Area` enum, imported by the domain matching layer. No Prisma model, no seed table, no env-var-driven config, no admin UI. [Source: ARCHITECTURE-SPINE.md, AD-7]
- **AD-4:** the Searcher's budget of 2 is `submit + at most one area-expansion re-search` — this story spends unit two. The server-side Redis decrement is the enforcement; a stateless TTL check does not satisfy AD-4. [Source: ARCHITECTURE-SPINE.md, AD-4]
- **AD-5 / FR-4:** eligibility stays derived and query-time. PRD FR-4 explicitly extends exclusion to "any expanded nearby Area" — expansion widens *geography only*, never eligibility. [Source: PRD FR-4; ARCHITECTURE-SPINE.md, AD-5]
- **AD-6 / FR-8:** expansion matches are Matches; they get the same non-blocking `after()` SMS+email dispatch, failures logged not surfaced. [Source: ARCHITECTURE-SPINE.md, AD-6]
- **AD-3:** `expandSearch` goes through the shared `checkRateLimit` with its own `endpoint` key. Do not hand-roll a second limiter. [Source: ARCHITECTURE-SPINE.md, AD-3]
- **AD-1:** still no `Searcher` table; `searcherName`/`searcherPhone` stay inlined on `Search` rows. [Source: ARCHITECTURE-SPINE.md, AD-1]
- **Layering:** `lib/domain/areaAdjacency.ts` and the `matching.ts` addition import no adapter. `app/actions/expandSearch.ts` calls repositories, never `prisma` directly. Error shape is `{ error: { code, message } }` everywhere. [Source: ARCHITECTURE-SPINE.md, Design Paradigm + Consistency Conventions]
- Capability map already anticipated this: "Search & Area Expansion (FR-5, FR-6, FR-7) | `app/actions/submitSearch`, `lib/domain/matching.ts` | AD-1, AD-3, AD-4, **AD-7**" — `areaAdjacency.ts` is the AD-7 half of that row, previously unbuilt. [Source: ARCHITECTURE-SPINE.md, Capability → Architecture Map]

### Relationship to Prior Stories
- **Story 2.2** built everything this story composes: `findMatches`, `notifyMatches`, `createSearch`, `twilioNotificationSender`, `sendgridEmailNotifier`, the `after()` pattern, `SkeletonRow`, `MatchCard`. It also left the exact stopgap this story replaces, documented in its own Open Question 2: *"Confirm this reads as an obvious placeholder… so it's clear Story 2.3 needs to replace it rather than extend it."* Replace it.
- **Story 2.1** built `session.ts` / `jwt.ts` / `sessionStore.ts` and set `SEARCHER_SESSION_BUDGET = 2` in `verifySearcherOtp.ts` — that `2` is sized for exactly this story's re-search. Do not change it, and do not add a budget top-up path.
- **Story 1.4** built `computeEligibility`; reached only through `findMatches`. Do not touch it.
- **No Home screen exists yet** (Stories 2.1/2.2 both noted this) — `/search` remains reachable only by URL with `sessionToken` and `name` query params. This story does not build Home.
- **Known accepted gap, do not "fix" here:** `sessionStore.consume`'s get-then-`decr` is non-atomic. Explicitly accepted as an MVP trade-off in Story 2.1's Dev Notes and logged in `deferred-work.md`. Two concurrent expansion confirms could in principle both pass; out of scope. [Source: deferred-work.md]

### Design Tokens / Component Reuse
- Area Expansion Prompt: no new primitives. Existing `<main>` container classes, `text-heading` / `text-body` / `text-ink-secondary`, one `Button`. [Source: DESIGN.md, Typography]
- **Rendered inline as a step, not as a modal.** EXPERIENCE.md's IA table lists Area Expansion Prompt as a modal/sheet one level deep, but no modal primitive exists in this codebase and every screen so far (`app/search/verify/page.tsx`, `app/register/verify/page.tsx`, and `app/search/page.tsx` itself) uses in-place step state. Building a first modal primitive here would be unrequested scope. Flagged as Open Question 1.
- Match cards, skeleton rows, tap-to-call chip: `MatchCard` / `SkeletonRow` reused verbatim from `app/search/page.tsx`. No new card component.
- Matched-area summary line: `text-meta text-ink-secondary`, consistent with the `meta` area-tag treatment. [Source: DESIGN.md, Components — donor-match-card]
- Voice: EXPERIENCE.md's own example copy is the model — *"We couldn't find a match in Gulberg yet."* Note the "yet," the full sentence, the named area. No exclamation marks, no "No results ⚠️", no `[ASSUMPTION]`-style hedging in user-visible text. [Source: EXPERIENCE.md, Voice and Tone]
- Accessibility: the prompt's headline is a real heading in reading order; the confirm control is a real `<button>` ≥44×44px (the `Button` component's `min-h-[48px]` already satisfies this); no color-only signalling. [Source: EXPERIENCE.md, Accessibility Floor]

### Testing Standards
- Vitest + React Testing Library, already configured (`vitest.config.ts`, `vitest.setup.ts`). No new test tooling. Run `npx vitest run`; fall back to `npx vitest run --no-file-parallelism` if the sandboxed worker-OOM crash from Stories 1.4/2.1 recurs.
- Domain modules unit-tested against fakes, never live Prisma/Twilio/SendGrid/Redis — unchanged discipline from every prior story.
- **Highest-value test in this story:** the ineligible-donor exclusion inside `findMatchesAcrossAreas` (AC #4). Expansion is precisely where a "just show them something" fallback would be tempting, and FR-4 forbids it. Do not skip it.
- **Second:** the adjacency symmetry test. It is the guard that survives a PM answering Open Question 1 with different values.
- **Third:** the assertion that the old `"No matches were found in this area yet."` string is gone — cheap, and it is the only thing preventing two competing zero-match UIs.
- `@testing-library/user-event`'s `setup()` installs its own `navigator.clipboard` polyfill that silently shadows a `writeText` spy attached in a shared `beforeEach`. `app/search/page.test.tsx` already works around this via `setupUserWithClipboardSpy()` — keep using it; do not move the spy into `beforeEach`. [Source: 2-2 Dev Agent Record]
- The `"Not implemented: navigation to another Document"` jsdom warning in the coarse-pointer test is expected and benign. [Source: 2-2 Dev Agent Record]

### Project Structure Notes
- **New:** `lib/domain/areaAdjacency.ts`, `lib/domain/areaAdjacency.test.ts`, `lib/validation/expandSearch.ts`, `lib/validation/expandSearch.test.ts`, `app/actions/expandSearch.ts`, `app/actions/expandSearch.test.ts`.
- **Modified:** `lib/domain/matching.ts` (+`findMatchesAcrossAreas`), `lib/domain/matching.test.ts`, `app/search/page.tsx`, `app/search/page.test.tsx`.
- **No Prisma schema change, no migration.** `Search` already has every column needed; `prisma/migrations/` still does not exist in this repo and no live Postgres is wired up in this environment (unchanged since Story 1.1). Do not run `prisma migrate`.
- **No new dependencies.**
- **No new env vars** — `expandSearch` deliberately reuses `RATE_LIMIT_SEARCH_MAX` / `RATE_LIMIT_SEARCH_WINDOW_SECONDS`, already documented in `.env.example` by Story 2.2.

### Latest Tech Notes
- Nothing new to research. This story introduces no library, no SDK, and no framework API beyond `after()` from `next/server` — already stable in Next.js 16 and already in production use in `app/actions/submitSearch.ts` since Story 2.2, which verified it on 2026-07-11. Stack is unchanged: Next 16.2.10, React 19.2.4, Zod 4.4.3, Prisma 7.8.0, Vitest 4.1.10. [Source: package.json; 2-2 Latest Tech Notes]

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.3] — story ACs; Story 2.4 boundary; FR Coverage Map
- [Source: _bmad-output/planning-artifacts/architecture/architecture-BloodDonorApp-2026-07-06/ARCHITECTURE-SPINE.md] — AD-1, AD-3, AD-4, AD-5, AD-6, **AD-7**, Capability → Architecture Map, layering, error-shape convention
- [Source: _bmad-output/planning-artifacts/prds/prd-BloodDonorApp-2026-07-06/prd.md] — FR-4 ("or any expanded nearby Area"), FR-6, FR-7, FR-8, SM-2, SM-3, §8 Open Question 1 (adjacency values, unresolved), §8 Open Question 3 (rate-limit thresholds)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-BloodDonorApp-2026-07-06/EXPERIENCE.md] — IA (Area Expansion Prompt), State Patterns (zero-matches-first-pass routes to expansion, not Empty State), Voice and Tone examples, Flow 1 edge case, Flow 2 notification copy, Accessibility Floor
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-BloodDonorApp-2026-07-06/DESIGN.md] — donor-match-card, empty-state (text-led), typography tokens
- [Source: _bmad-output/implementation-artifacts/2-2-searcher-submits-search-views-matches-and-matched-donors-are-notified.md] — everything reused; its Open Question 2 explicitly hands the placeholder to this story
- [Source: _bmad-output/implementation-artifacts/2-1-searcher-verifies-identity-via-otp.md] — `SEARCHER_SESSION_BUDGET = 2` sized for this re-search
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — accepted non-atomic `sessionStore.consume` race; do not fix here
- [Source: lib/domain/matching.ts, lib/domain/session.ts, lib/domain/notify.ts, lib/infra/sessionStore.ts, lib/infra/repositories/donorRepository.ts, lib/infra/repositories/searchRepository.ts, lib/presentation/labels.ts, lib/validation/registerDonor.ts, lib/validation/submitSearch.ts, prisma/schema.prisma] — exact current signatures this story extends and must not break
- [Source: app/actions/submitSearch.ts, app/actions/submitSearch.test.ts, app/search/page.tsx, app/search/page.test.tsx] — structural templates for the new action and screen changes

## Open Questions For Dev

1. **Prompt as an inline step, not a modal.** EXPERIENCE.md's IA lists the Area Expansion Prompt among the two surfaces allowed to be a one-level modal/sheet. This story specifies an inline step instead, because no modal primitive exists and every prior screen uses in-place step state. If a modal is genuinely wanted, that is a new shared component and should be its own story.
2. **One `Search` row per expanded area.** `Search.area` is a single column, so an expansion across 4 neighbours writes 4 rows sharing a `createdAt`. This keeps SM-3 computable but inflates raw search counts. The alternative — one row carrying only the origin area — loses the record of what was actually searched. Flagging the trade-off; not blocking.
3. **Adjacency values are a working assumption, not a product decision.** PRD Open Question 1 is still open. The Task 1 table is a plausible Lahore-geography draft that satisfies the stated invariants. If PM supplies real values, swap the table — the property-based tests are written so they keep passing without edits.
4. **No re-expansion from an expanded result.** The budget of 2 permits exactly one expansion. If an expanded search returns matches but the Searcher wants to widen further, they must re-verify by OTP. That is AD-4 working as designed, not a gap — flagged only so it isn't "fixed" by quietly raising the budget.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npx vitest run` — full suite: **203/203 passing across 31 test files**, no regressions (up from Story 2.2's 164/28). No `--no-file-parallelism` workaround needed.
- `npx tsc --noEmit` — clean, no type errors.
- `npx next build` — production build succeeds; `/search` still prerenders static (`○`), unchanged from Story 2.2.
- **Environment note:** this workspace copy arrived with no `node_modules` and no `.env`/`.env.example`. Ran `npm install` (lockfile unchanged, no new deps). The build initially failed on `/register/confirmation` with `DATABASE_URL is not set` — a pre-existing Story 1.4 route this story does not touch, failing only because no env file exists here. Re-ran the build with placeholder env vars passed inline (not written to disk, so no local `.env` was created or overwritten) and it succeeded cleanly.
- Red-green-refactor per task, tests written and confirmed failing before each implementation: adjacency (9 tests RED → GREEN), `findMatchesAcrossAreas` (5 new RED, 5 existing still passing → GREEN), `expandSearch` + schema (19 RED → GREEN), Search screen (6 RED → 15 GREEN).

### Completion Notes List

- `findMatchesAcrossAreas` (`lib/domain/matching.ts`) composes the **existing** `findMatches` once per area via `Promise.all` rather than widening `DonorMatchLookup` or adding a repository method. This is what structurally guarantees AC #4: an expanded area cannot become a looser-eligibility fallback tier, because it routes through the identical `computeEligibility` filter (AD-5). `findMatches`'s signature is untouched, so Story 2.2's `submitSearch` and all its tests were unaffected.
- Dedup is by `phone` (the E.164 unique column on `Donor`), keeping the first area in request order — so a donor in several expanded areas yields one card and one notification (AC #6). This matters beyond the UI: `notifyMatches` sends once per array element and has no dedup of its own, so a duplicate reaching it would double-text a real person.
- `expandSearch` reuses `RATE_LIMIT_SEARCH_MAX`/`RATE_LIMIT_SEARCH_WINDOW_SECONDS` (**no new env vars**), with `endpoint: "expandSearch"` giving it its own AD-3 bucket so an expansion can't exhaust the primary search's allowance or vice versa.
- Notification context carries the searcher's **`originArea`**, not the donor's matched area — the message tells a donor where blood is needed ("…needs O- blood in Gulberg"), per EXPERIENCE.md Flow 2. There is an explicit test asserting this, since the inverse is a silently plausible bug that would send donors messages about their own neighbourhood.
- The `nearbyAreas.length === 0` short-circuit returns before any repository call, `Search` write, or `after()` scheduling. Task 1's symmetry/≥1-neighbour invariants make it unreachable today; it is a guard against a future PM adjacency edit. The budget unit is still consumed (no refund path), matching the story's instruction.
- One `Search` row is written per expanded area via `Promise.all`, since `Search.area` is a single column and SM-3 needs to know what was actually searched. **No schema change, no migration** — confirmed `prisma/migrations/` still does not exist in this repo.
- Adjacency tests are **property-based**, not value-restating: they iterate `AREA_VALUES` and assert symmetry, no self-reference, ≥1 neighbour, and membership. A PM answering PRD Open Question 1 with different values keeps these tests passing without edits — which was the point of writing them this way.
- `app/search/page.tsx` refactor: the previously duplicated skeleton and error markup were hoisted into shared `skeletonBlock`/`errorBlock` consts so the `form` and `expand` steps render identical treatments. The two prior `role="alert"` conditionals collapsed into one with a nested session-link fragment — same rendered output, same test assertions, no behaviour change. Story 2.2's `MatchCard`, `SkeletonRow`, `AreaChip`, and `Button` are all untouched.
- Story 2.2's `"No matches were found in this area yet."` placeholder is **deleted**, with a test asserting that string is absent — the only thing preventing two competing zero-match UIs.
- The `didExpand` flag gates the matched-areas summary line so it appears only after an expansion, never after a first-pass search (AC #3).
- Zero-match-after-expansion renders the documented stopgap only; the worded Empty State with its next-step action link is deliberately **not** built — that is Story 2.4's scope, per AC #7.
- The `"Not implemented: navigation to another Document"` jsdom warning persists in the coarse-pointer test. Expected and benign, as documented in Story 2.2.

### File List

- `lib/domain/areaAdjacency.ts` (new — `AREA_ADJACENCY`, `getNearbyAreas`; AD-7 static adjacency)
- `lib/domain/areaAdjacency.test.ts` (new — property-based invariant tests)
- `lib/domain/matching.ts` (modified — new `findMatchesAcrossAreas` export; `findMatches` unchanged)
- `lib/domain/matching.test.ts` (modified — new `findMatchesAcrossAreas` suite, incl. FR-4 exclusion and dedup)
- `lib/validation/expandSearch.ts` (new — `expandSearchSchema`)
- `lib/validation/expandSearch.test.ts` (new)
- `app/actions/expandSearch.ts` (new — Server Action: rate-limited, session-gated expansion re-search + notify dispatch)
- `app/actions/expandSearch.test.ts` (new)
- `lib/infra/repositories/searchRepository.ts` (modified — new `createSearches` batch export; `createSearch` unchanged)
- `app/search/page.tsx` (modified — `"expand"` step, Area Expansion Prompt, matched-areas summary, placeholder removed, shared skeleton/error blocks)
- `app/search/page.test.tsx` (modified — expansion coverage; placeholder-absence regression test)

## Change Log

- 2026-07-26: Story created — ready-for-dev.
- 2026-07-26: Implemented the AD-7 static area-adjacency module, multi-area domain matching with eligibility parity and phone-based dedup, the `expandSearch` Server Action (final session-budget unit, own rate-limit bucket, `after()`-based notification dispatch using the origin area), and the Area Expansion Prompt replacing Story 2.2's zero-match placeholder. 39 new tests added; full suite 203/203 passing; `tsc` and `next build` clean. No new dependencies, no new env vars, no schema change. Status: ready-for-dev → review.
- 2026-07-26: Code review (3 adversarial layers) — 9 patch findings applied, 3 decision-needed items left open for PM, 2 deferred. Fixes: `createSearch` fan-out replaced with a single `createSearches` batch wrapped in try/catch so an audit-write failure can no longer cost matched donors their notification; `catch` added to both client handlers so a rejected action shows a recoverable message instead of failing silently; expand and search buttons disabled on terminal session errors; `didExpand`/`areasSearched` reset on each new first-pass search; `AREA_ADJACENCY` deep-frozen with a test that verifies immutability rather than claiming it; `getNearbyAreas` now returns the typed `AreaValue[]` so a bad adjacency edit fails at compile rather than at the database; new tests exercise the real adjacency table end-to-end through the action (origin area never re-searched, for all 10 areas) and cover audit-write failure. Suite 210 passing, `tsc` clean.
- 2026-07-26: All 3 review decisions resolved (Ahmad). **D1 — notification amplification:** `expandSearch` now rejects with `SESSION_INVALID` ("Start a search before expanding to nearby areas.") when the token still has budget remaining after decrementing. AD-4 makes an expansion always the *final* unit, so leftover budget proves `submitSearch` never ran — this closes the path where a caller skipped straight to expansion and notified 2–6 areas of donors for the budget unit that buys one area through the front door. No schema or token-shape change. **D2 — `Search` fan-out rationale:** the fan-out stands (it records the real extent of an expansion), but the comment claiming it "keeps SM-3 computable" was false and is corrected in place — `Search` has no match count, result flag, or correlation id, so SM-3 is not computable at any row granularity, and the fan-out inflates any naive row count for expansion journeys. Making SM-3 genuinely computable needs a `correlationId` column and a migration; logged as a PM/metrics item, deliberately out of scope here. **D3 — AC #3 vs AC #6:** `findMatchesAcrossAreas` now returns `ExpandedDonorMatch` carrying `matchedAreas` (every requested area a donor was found in) alongside the deduped primary `area`. Dedup for cards and notifications is unchanged, so AC #6 holds; the summary line and each match card now derive from `matchedAreas`, so an area is never reported as empty merely because a donor also matched elsewhere. Suite 213 passing, `tsc` clean.

### Review Note — suite state at review time

The 5 failing tests in `app/search/page.test.tsx` at review time are **Story 2.4's** Empty State
assertions, not Story 2.3 defects. Timestamps confirm the sequence: this story's implementation
finished ~08:33 with the suite green at 203/203; the Story 2.4 file was created at 08:51,
sprint-status flipped 2.4 to `in-progress` at 08:52, and `page.tsx`/`page.test.tsx` were edited at
08:53–08:54 adding the `"empty"` step and its tests. The `"empty"` step having no render branch,
and the now-unreachable `"We couldn't find a match in nearby areas either."` stopgap, are both
in-flight Story 2.4 work. All three review layers reported them as 2.3 failures because they could
not see that history. They are Story 2.4's to complete — deliberately not touched here.

