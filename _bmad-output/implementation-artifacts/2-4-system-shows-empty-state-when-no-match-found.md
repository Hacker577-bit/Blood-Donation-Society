---
baseline_commit: NO_VCS
---

# Story 2.4: System Shows Empty State When No Match Found

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a searcher who found no match even after area expansion,
I want a clear, worded explanation and next steps,
so that I know to try elsewhere instead of hitting a dead end.

## Acceptance Criteria

1. **Given** my area-expansion re-search (Story 2.3) returned zero Matches, **when** the result loads, **then** I see a text-led Empty State — a real heading plus body copy in plain language that explicitly states no match was found. No illustration, no icon, no decorative graphic. [Source: epics.md#Story-2.4, FR-7, DESIGN.md `empty-state` (`icon: 'none — text-led, not illustration-led'`), EXPERIENCE.md Component Patterns]
2. **And** Story 2.3's stopgap `"We couldn't find a match in nearby areas either."` is **deleted**, not extended — exactly as Story 2.3 deleted Story 2.2's `"No matches were found in this area yet."` placeholder. Two competing zero-match UIs must not coexist. [Source: 2-3 story AC #7 + Completion Notes; `app/search/page.tsx:201-205`]
3. **And** the Empty State names the areas that were actually searched, drawn from `expandSearch`'s `areasSearched` (currently returned by the action but discarded by the screen) — so I can tell the app really did widen the search rather than giving up silently. [Source: FR-6 "shows which area(s) …"; `app/actions/expandSearch.ts:154`]
4. **And** it offers exactly **one** next-step action link — not two, not a second primary button. [Source: EXPERIENCE.md Component Patterns "one clear next-step action link"; DESIGN.md Components "One primary button visible per screen; never two competing primary actions"]
5. **And** that link's copy is honest about the session cost: my Searcher token's budget of 2 is fully spent (submit + expansion, AD-4), so starting another search requires re-verifying my phone. The link therefore points at `/search/verify`, and the copy must not imply a free instant retry. A link that silently dead-ends or 404s is the exact "dead end" this story exists to remove. [Source: ARCHITECTURE-SPINE.md AD-4; `lib/domain/session.ts`; 2-1 `SEARCHER_SESSION_BUDGET = 2`]
6. **And** the system never renders a generic error, blank screen, or silent timeout on this path — the Empty State is a designed, worded screen reached deterministically, not an error fallthrough. [Source: PRD FR-7 Consequences; EXPERIENCE.md State Patterns]
7. **And** no ineligible donor is ever substituted in as a fallback at any point in this flow — the Empty State renders **zero** `MatchCard`s. The domain-level guarantee already exists (Story 2.3's `findMatchesAcrossAreas` routes through `computeEligibility`); this story must not introduce a UI-side "show something anyway" path. [Source: PRD FR-4, AD-5]
8. **And** an expansion that finds nothing sends no notifications and shows no matched-areas summary line — the summary is for results, not for absence. [Source: FR-8 (Notification per Match); 2-3 `didExpand` gating]

## Tasks / Subtasks

- [x] Task 1: Add the `"empty"` step to the Search screen (AC: #1, #2, #6, #7)
  - [x] `app/search/page.tsx` (modified) — **read the whole file before editing.** It is a working Story 2.2 + 2.3 screen; every existing behaviour listed under *Files Being Modified* below must survive.
  - [x] Widen `type Step` from `"form" | "expand" | "results"` to `"form" | "expand" | "results" | "empty"`.
  - [x] In `handleExpand`'s success branch, replace `setStep("results")` with `setStep(result.matches.length === 0 ? "empty" : "results")`. Keep `setMatches(result.matches)` and `setDidExpand(true)` as they are.
  - [x] **Delete the `matches.length === 0 ? <p>We couldn't find a match in nearby areas either.</p> : (…)` ternary from the `"results"` block entirely** (AC #2). With the `"empty"` step routing zero-match expansions away, that branch is unreachable — the `"results"` block then renders the `didExpand` summary and the `MatchCard` list unconditionally, with no wrapping fragment/ternary. Leaving a dead branch behind is how the 2.2 → 2.3 placeholder problem repeats itself a third time.
  - [x] `handleSubmit` is **unchanged**: a zero-match *first-pass* search still routes to `"expand"`, never to `"empty"`. Routing a first-pass zero directly to the Empty State would skip area expansion and violate FR-6. [Source: EXPERIENCE.md State Patterns — "Zero matches (first pass) … Routes to Area Expansion Prompt, not directly to Empty State"]

- [x] Task 2: Capture `areasSearched` from the expansion response (AC: #3)
  - [x] Add `const [areasSearched, setAreasSearched] = useState<string[]>([])` and set it in `handleExpand`'s success branch: `setAreasSearched(result.areasSearched)`. The action already returns this field (`app/actions/expandSearch.ts:154`) — the screen currently throws it away. **Do not change the action, its return type, or its tests.**
  - [x] Map to display labels via the existing `AREA_LABELS` import: `areasSearched.map((a) => AREA_LABELS[a as keyof typeof AREA_LABELS])`. Same cast style the file already uses — do not introduce a new helper.

- [x] Task 3: Render the Empty State (AC: #1, #3, #4, #5)
  - [x] Render inline as a step inside the **same** `<main className="mx-auto flex w-full max-w-140 flex-col gap-6 px-4 py-8 sm:px-8 motion-reduce:transition-none">` container the other three steps use. **Not a modal** — EXPERIENCE.md permits one-level modals only for Delete Confirmation and the Area Expansion Prompt, and the Empty State is not on that list. No modal primitive exists in this codebase anyway. [Source: EXPERIENCE.md Information Architecture, line 37]
  - [x] Heading: `<h1 className="text-heading text-ink-primary">` — e.g. `"No match found yet."` Use `text-heading`, **not** `text-display`: DESIGN.md reserves `display` for "the single confirmation/climax moment on each flow," and a dead end is not that moment. [Source: DESIGN.md Typography]
  - [x] Body: `<p className="text-body text-ink-secondary">` naming the origin area and the searched areas, e.g. `"We checked {AREA_LABELS[area]} and {searchedLabels.join(", ")}, and no eligible donor is listed for {BLOOD_TYPE_LABELS[bloodType]} right now."` **Guard the empty-list case**: `expandSearch` returns `areasSearched: []` when the origin area has no neighbours (`app/actions/expandSearch.ts:111-113`), so never emit a sentence ending in a dangling `", ."`. Fall back to naming only the origin area.
  - [x] Voice: calm desk clerk. Plain complete sentences, no exclamation marks, no "⚠️", no jargon, numerals for any dates/codes. The `"yet"` in EXPERIENCE.md's model copy (`"We couldn't find a match in Gulberg yet."`) is deliberate — keep that register. [Source: EXPERIENCE.md Voice and Tone]
  - [x] Exactly **one** next-step action link (AC #4), styled as a link and not a `Button`: `<a href="/search/verify" className="text-meta text-accent underline-offset-2 hover:underline">` — same treatment as the existing `errorBlock` verify link and the Resend link in `app/search/verify/page.tsx:225`. Copy must state the re-verify cost plainly, e.g. `"Start a new search"` preceded by one short sentence such as `"To try a different area, verify your phone again."` (AC #5).
  - [x] **Do not build a blood-bank directory link.** The epic's `"Find a blood bank near you"` example has no destination in this product — PRD §6.2 excludes hospital/blood-bank integration and paid mapping APIs from v1, and no such route or dataset exists. Shipping a link to nowhere recreates the dead end. See Open Question 1.
  - [x] Do **not** render `skeletonBlock` in this step (nothing is pending) and do **not** render any `MatchCard` (AC #7). Keep `errorBlock` out of this step too — it is a terminal success state, not an error state.
  - [x] Do not add `aria-live`. EXPERIENCE.md scopes `aria-live` to form errors announced on submit; the whole `<main>` is replaced here and the `<h1>` sits first in reading order. Adding a live region is an undocumented extension — see Open Question 2.
  - [x] Accessibility: real `<h1>` in reading order, text-paired signalling only (no color-only cue), `ink-secondary` on `surface-base` for body copy (both AA-compliant token pairs), no transition/fade on the `expand → empty` step change — consistent with the existing `motion-reduce:transition-none` treatment. [Source: EXPERIENCE.md Accessibility Floor]
  - [x] Do not create a new `EmptyState` component under `app/components/ui/`. It has exactly one call site; the other steps are all inline. A shared primitive here is unrequested abstraction.

- [x] Task 4: Tests (all AC)
  - [x] `app/search/page.test.tsx` (modified) — Vitest + React Testing Library, already configured. Extend the existing `describe("Search screen")` block; reuse `selectBloodTypeAndArea` and the existing `submitSearchMock` / `expandSearchMock` mocks. Do not add new test tooling or a new test file.
  - [x] **Rewrite** the existing test `"renders the Story 2.4 stopgap when the expansion also finds nothing"` (`page.test.tsx:236-248`) — it asserts the string this story deletes and will otherwise fail. Replace it with a test that a zero-match expansion lands on the Empty State heading **and** asserts `expect(screen.queryByText(/couldn't find a match in nearby areas either/i)).not.toBeInTheDocument()` (AC #2). That absence assertion is the only thing preventing a fourth competing zero-match UI; it is the direct analogue of 2.3's placeholder-absence test at `page.test.tsx:155`.
  - [x] Empty State names the areas actually searched, from the mocked `areasSearched` (AC #3) — e.g. mock `{ matches: [], areasSearched: ["ModelTown", "Cantt"] }` and assert both `"Model Town"` and `"Cantt"` render.
  - [x] Empty State renders exactly one next-step link, pointing at `/search/verify` (AC #4, #5).
  - [x] Empty State renders **no** `MatchCard` and no `matched-areas-summary` (AC #7, #8) — assert `queryByTestId("matched-areas-summary")` is absent and no phone `link` role is present.
  - [x] `areasSearched: []` renders the Empty State without a malformed sentence (AC #3 guard) — assert the heading renders and the body has no `", ."` sequence.
  - [x] A zero-match **first-pass** search still lands on the Area Expansion Prompt, never the Empty State (AC #6, FR-6 boundary) — the existing test at `page.test.tsx:147` covers the positive half; add the negative assertion that the Empty State heading is absent at that point.
  - [x] Every other existing test in `page.test.tsx` must keep passing **unmodified**. The only permitted edit is the stopgap test above.
  - [x] Do **not** add tests to `app/actions/expandSearch.test.ts`, `lib/domain/matching.test.ts`, or `lib/domain/areaAdjacency.test.ts`. This story changes none of that code, and AC #7's domain-level guarantee is already covered by Story 2.3's ineligible-donor exclusion test in `matching.test.ts`. Re-testing it here adds noise, not coverage.
  - [x] Run `npx vitest run`; fall back to `npx vitest run --no-file-parallelism` if the sandboxed worker-OOM crash from Stories 1.4/2.1 recurs. Baseline is 203/203 passing across 31 files.

### Review Findings

Code review 2026-07-26 (3 parallel adversarial layers). Suite verified green at 218/218 by all
three reviewers before analysis, so every finding below is a gap the passing suite does not catch.

- [x] [Review][Patch] Empty State sentence is malformed for **every** real search — `checkedPhrase` composes `"{origin} and {a, b, c}"`, so a Gulberg searcher reads *"We checked Gulberg and Model Town, Cantt, Garden Town, DHA, and no eligible donor is listed for O- right now."* — two conjunctions, an unmarked comma list, run-on. Every one of the 10 areas has 2–6 neighbours, so the `length >= 2` branch is the only reachable one: 100% of users who reach this screen see broken copy. The guard that was written covers the case that cannot happen; the case that always happens is unguarded. Also: the second paragraph ends with no terminal punctuation. AC #1 "plain language" / EXPERIENCE.md "plain, complete sentences". [app/search/page.tsx:245-248,257-265]
- [x] [Review][Patch] The `areasSearched: []` guard test is vacuous — a reviewer deleted the guard entirely and all 24 tests still passed. Unguarded output is `"We checked Gulberg and , and no eligible donor…"`, which matches neither `/,\s*\./` nor `/\s{2,}/`. The story named this its "second highest-value test" and it detects nothing. No test anywhere pins the composed sentence — `toHaveTextContent` on individual labels passes on any word order, which is exactly why the finding above shipped green. [app/search/page.test.tsx:331-344,280-297]
- [x] [Review][Patch] The sole next-step link is identified by colour alone and misses the tap-target floor — Tailwind preflight sets `a { text-decoration: inherit }` and the parent `<p>` is `none`, so there is **no underline at rest** and `underline-offset-2` is inert; `hover:underline` reaches neither touch nor keyboard users. Measured `accent` vs `ink-secondary` is 1.22:1, far under WCAG 1.4.1's 3:1 for colour-only link identification. It is also a 14px `text-meta` anchor with no `min-h`, under 44×44px — while `MatchCard`'s phone link uses `min-h-[44px]` and every `Button` uses 48px. On a dead-end screen whose entire deliverable is one way forward, this is the highest-consequence miss. EXPERIENCE.md Accessibility Floor names this surface explicitly: "every … empty state pairs colour with explicit text — never a colour-only signal". Note the spec prescribed this class string, but project precedent (deferred-work, Story 3.1) is that **new** screens meet the floor. [app/search/page.tsx:259-264]
- [x] [Review][Patch] `areaLabel` can silently return `undefined`, and 2.4 is the first story to put it in prose — `AREA_LABELS[area as keyof typeof AREA_LABELS]` infers `string` but the cast suppresses the miss. `areasSearched` is typed `string[]` at the action boundary, not `AreaValue[]`, so `[undefined].join(", ")` coerces to `""`, yielding *"We checked Gulberg and Model Town, , and no eligible donor…"*. Pre-existing 2.2/2.3 helper, newly load-bearing here. [app/search/page.tsx:23-25,242]
- [x] [Review][Patch] No Empty State test pins the heading level or type token — all four use `getByRole("heading", { name: /no match found/i })` with no `level: 1`. Task 3 specifies `<h1>` and `text-heading` explicitly *not* `text-display`; demoting to `<h3>` or swapping the token keeps every test green. [app/search/page.test.tsx:274,308,324,356]
- [x] [Review][Patch] The `areasSearched: []` guard test omits the heading assertion Task 4 required — Task 4 says "assert the heading renders and the body has no `", ."` sequence"; only the second half is present. [app/search/page.test.tsx:331-344]
- [x] [Review][Defer] Focus is dumped to `<body>` on every step transition, with nothing announced [app/search/page.tsx:151,250] — deferred, cross-cutting. The clicked button unmounts when `<main>` is replaced, so focus resets to document top; with no `aria-live` (Open Question 2) a screen-reader user gets silence and must Tab from the top to find the only link. Affects all four steps equally, including 2.3's `expand → results`. Should be one decision covering every step, matching the spec's own reasoning for deferring `aria-live`.
- [x] [Review][Defer] A dropped response on the expansion burns the final budget unit and permanently blocks the Empty State [app/search/page.tsx:152-157] — deferred, pre-existing 2.3 slice. `consumeSessionUse` runs server-side before matching, so on flaky mobile data donors are texted and `Search` rows written, but the client falls into `catch` and shows a retryable message. `UNEXPECTED` is not in `isSessionTerminal`, so the button stays enabled and invites the retry the copy asks for; the second click returns `SESSION_EXHAUSTED`. The searcher never sees the Empty State or the matches, while notified donors expect a call.
- [x] [Review][Defer] Refresh or back/forward escapes the terminal step into a fully-enabled search form [app/search/page.tsx:73] — deferred, pre-existing architecture. `step` lives in component state while `sessionToken` sits in the query string, so any remount returns the user to `"form"` on a spent token. The Empty State is terminal only while the component stays mounted. 2.4 is the first step whose correctness depends on terminality. Related to the already-deferred "no way back to the form" item.

## Dev Notes

### Scope Boundary — This Is a UI-Only Story

No Server Action, no domain module, no repository, no Prisma schema, no migration, no env var, and no dependency changes. `expandSearch` already returns everything this screen needs (`{ matches, areasSearched }`); the work is consuming it. If you find yourself editing `app/actions/`, `lib/domain/`, or `prisma/`, stop — you have left the story.

Epic 2 closes with this story. Nothing after it depends on a new export from here.

### Files Being Modified — Current State and What Must Survive

**`app/search/page.tsx`** (Stories 2.2 + 2.3, 281 lines) — the only source file this story changes.

*Current state:* client component, `Step = "form" | "expand" | "results"`, wrapped in `<Suspense fallback={null}>` around an inner `SearchForm` that reads `sessionToken` and `name` from `useSearchParams()` and `router.replace("/search/verify")`s in a `useEffect` when either is missing. Owns `SkeletonRow` and `MatchCard` (the latter holding `matchMedia("(pointer: coarse)")` dialer-vs-clipboard logic and its own `copied` state). Story 2.3 hoisted `errorBlock` and `skeletonBlock` into shared consts used by the `form` and `expand` steps.

*What this story changes:* the `Step` union (+`"empty"`), one line in `handleExpand`'s success branch, deletion of the zero-match ternary in `"results"`, one new `areasSearched` state field, and one new render block.

*What must not break:* the Suspense/`useSearchParams` wrapper; the missing-param redirect; the `bloodType` `<select>`; the single-select `AreaChip` group; the disabled-until-valid `Button`; `MatchCard`'s pointer logic and `Copied` state; both `role="alert"` paths via `errorBlock`; the `expand` step's nearby-area naming; the `didExpand`-gated matched-areas summary; `SkeletonRow` rendering during both pending states.

**`app/search/page.test.tsx`** (15 tests) — one test rewritten, several added. All others untouched.

**Not modified by this story, but read before editing:** `app/actions/expandSearch.ts` (for the exact `areasSearched` shape and the `nearbyAreas.length === 0` short-circuit at lines 111-113), and `app/search/verify/page.tsx` (for the established link styling).

### Architecture Compliance

- **AD-4 is the load-bearing constraint here.** The Searcher token carries a budget of exactly 2 — `submit` (Story 2.2) + one expansion (Story 2.3). By the time the Empty State renders, both are spent. There is no third search on this token, and there is **no budget top-up path** — do not add one, do not raise `SEARCHER_SESSION_BUDGET`, do not attempt a silent re-search behind the next-step link. This is AD-4 working as designed. [Source: ARCHITECTURE-SPINE.md AD-4; 2-3 Open Question 4]
- **AD-5 / FR-4:** eligibility stays derived and query-time; the Empty State is what *correct* exclusion looks like from the Searcher's side. A UI fallback showing ineligible donors "so the screen isn't empty" is precisely the failure FR-4 forbids.
- **FR-7 / SM-2:** the empty state is inside the same 30-second result budget as a full Match list — it is a *result*, not a timeout. This story adds no network call, so the budget is unaffected. [Source: PRD SM-2]
- **Layering:** no new imports beyond what `page.tsx` already has (`AREA_LABELS`, `BLOOD_TYPE_LABELS` from `lib/presentation/labels`). No adapter reaches the presentation layer. Nothing new crosses a port boundary.
- Capability map row unchanged: "Search & Area Expansion (FR-5, FR-6, FR-7) | `app/actions/submitSearch`, `lib/domain/matching.ts` | AD-1, AD-3, AD-4, AD-7". FR-7 is the last unbuilt third of that row. [Source: ARCHITECTURE-SPINE.md, Capability → Architecture Map]

### Relationship to Prior Stories

- **Story 2.3** built the `"expand"` step, `getNearbyAreas`, `findMatchesAcrossAreas`, and `expandSearch` — and left this story's stopgap with an explicit instruction to *replace, not extend* it (2-3 AC #7, Completion Notes). Honour that.
- **Story 2.2** built `MatchCard`, `SkeletonRow`, the `after()` notification pattern, and the first zero-match placeholder. It set the precedent this story follows for the third time: each story deletes its predecessor's stopgap rather than layering a new UI beside it.
- **Story 2.1** set `SEARCHER_SESSION_BUDGET = 2` in `verifySearcherOtp.ts`. That `2` is why AC #5 exists. Do not change it.
- **No Home screen exists yet.** `app/page.tsx` is still the untouched `create-next-app` template. `/search` is reachable only by URL with `sessionToken` and `name` query params, via `/search/verify`. This story does **not** build Home, and the next-step link must therefore point at `/search/verify`, not `/`.
- **Known accepted gap, do not "fix" here:** `sessionStore.consume`'s get-then-`decr` is non-atomic. Accepted MVP trade-off, logged in `deferred-work.md`. [Source: deferred-work.md]

### Design Tokens / Component Reuse

- No new primitives, no new component file. Existing `<main>` container classes only.
- Heading `text-heading text-ink-primary`; body `text-body text-ink-secondary`; next-step link `text-meta text-accent underline-offset-2 hover:underline` (matching `errorBlock`'s verify link at `page.tsx:148` and the Resend link at `search/verify/page.tsx:225`). Page background is `surface-base` from `app/globals.css`. All token names are already defined in `@theme` — do not add CSS variables. [Source: DESIGN.md Colors + Typography; `app/globals.css:7-48`]
- DESIGN.md's `empty-state` block specifies only `background`, `icon: none`, and `text: {typography.body}` — it deliberately fixes no text color, so `ink-primary` (heading) / `ink-secondary` (body) are chosen here to satisfy the AA contrast floor. [Source: DESIGN.md components.empty-state]
- Link, not button: DESIGN.md allows one primary button per screen and EXPERIENCE.md calls for a next-step *action link*. A full-width teal `Button` on a dead-end screen reads as an urgent call to action the app cannot honour without re-verification.

### Testing Standards

- Vitest + React Testing Library, already configured (`vitest.config.ts`, `vitest.setup.ts`). No new tooling.
- **Highest-value test:** the assertion that `"We couldn't find a match in nearby areas either."` is gone (AC #2). Cheap, and the only guard against a third zero-match UI accumulating.
- **Second:** the `areasSearched: []` guard. It is the one input shape that produces malformed user-facing copy, and it is reachable only through a future PM adjacency edit — exactly the kind of thing that ships unnoticed.
- **Third:** first-pass zero still routes to `"expand"`, not `"empty"`. A one-character mistake in `handleSubmit` would skip area expansion entirely and silently break FR-6.
- `@testing-library/user-event`'s `setup()` installs its own `navigator.clipboard` polyfill that shadows a `writeText` spy attached in a shared `beforeEach`. The file already works around this via `setupUserWithClipboardSpy()` — keep using it; do not move the spy into `beforeEach`. [Source: 2-2 Dev Agent Record]
- The `"Not implemented: navigation to another Document"` jsdom warning in the coarse-pointer test is expected and benign. [Source: 2-2/2-3 Dev Agent Record]
- **Environment note:** this workspace may arrive without `node_modules` or a `.env`. Run `npm install` if needed (lockfile should not change). `npx next build` fails on `/register/confirmation` with `DATABASE_URL is not set` when no env file exists — a pre-existing Story 1.4 condition, unrelated to this story. Pass placeholder env vars inline rather than writing a local `.env`. [Source: 2-3 Debug Log]

### Project Structure Notes

- **New:** none.
- **Modified:** `app/search/page.tsx`, `app/search/page.test.tsx`.
- **No Prisma schema change, no migration** — `prisma/migrations/` still does not exist in this repo and no live Postgres is wired up here. Do not run `prisma migrate`.
- **No new dependencies. No new env vars.**

### Latest Tech Notes

Nothing to research. This story introduces no library, SDK, or framework API — it is React state and JSX against an existing Server Action. Stack unchanged: Next 16.2.10, React 19.2.4, Zod 4.4.3, Prisma 7.8.0, Vitest 4.1.10, Tailwind 4. [Source: package.json]

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.4] — story ACs; Epic 2 boundary; UX-DR2/UX-DR5 empty-state rules
- [Source: _bmad-output/planning-artifacts/prds/prd-BloodDonorApp-2026-07-06/prd.md] — FR-7 + its testable consequences, FR-4, FR-6, SM-2, SM-3, §6.2 non-goals (no blood-bank/hospital integration, no paid mapping API)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-BloodDonorApp-2026-07-06/ARCHITECTURE-SPINE.md] — AD-4 (session budget of 2), AD-5, Capability → Architecture Map, layering
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-BloodDonorApp-2026-07-06/EXPERIENCE.md] — Information Architecture ("Empty State | Area Expansion Prompt, still zero matches | Worded dead-end with next-step suggestions"; modal allowlist excludes Empty State), State Patterns (first-pass zero → expansion, post-expansion zero → Empty State), Component Patterns ("one clear next-step action link"), Voice and Tone, Accessibility Floor
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-BloodDonorApp-2026-07-06/DESIGN.md] — `components.empty-state` (text-led, no illustration), Typography (`heading` labels each screen; `display` reserved for climax moments), Colors, one-primary-button rule
- [Source: _bmad-output/implementation-artifacts/2-3-system-suggests-nearby-area-expansion-on-no-match.md] — the stopgap this story deletes; `areasSearched` contract; Open Question 4 (no re-expansion)
- [Source: _bmad-output/implementation-artifacts/2-1-searcher-verifies-identity-via-otp.md] — `SEARCHER_SESSION_BUDGET = 2`
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — accepted non-atomic `sessionStore.consume` race; do not fix here
- [Source: app/search/page.tsx, app/search/page.test.tsx] — the two files this story modifies; read both in full first
- [Source: app/actions/expandSearch.ts:111-113,152-155] — `areasSearched` shape and the empty-neighbour short-circuit
- [Source: app/search/verify/page.tsx:225, app/globals.css:7-48, lib/presentation/labels.ts] — link styling precedent, theme tokens, area/blood-type display labels

## Open Questions For Dev

1. **The next-step link is "start a new search," not "find a blood bank."** The epic and PRD both offer *"contact a blood bank"* as an example next step, but v1 explicitly excludes hospital/blood-bank integration and paid mapping APIs (PRD §6.2), so no destination exists — an external search-engine URL would be inventing a product decision inside a UI story. `"Try another area"` (the other doc-sanctioned option) is implemented here as a re-verify link, since AD-4 leaves no budget for an in-session retry. If PM wants a real blood-bank resource, that is a content/scope decision and its own story.
2. **No `aria-live` on the Empty State.** EXPERIENCE.md's Accessibility Floor scopes `aria-live` to form errors on submit. The `expand` step (Story 2.3) likewise announces nothing, so adding a live region only here would be inconsistent. Flagged rather than silently added; a general "announce async step changes" decision should cover all four steps at once.
3. **Epic 2 has no Home screen to return to.** `app/page.tsx` is still the `create-next-app` template, so every "start over" path in this flow lands on `/search/verify`. Not a defect of this story, but the Empty State is where its absence is most visible to a user.
4. **UX-DR3 says "all 12 surfaces" then lists 13**, and EXPERIENCE.md's IA table has 13 rows. Cosmetic doc drift; noted so it isn't read as a missing surface.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npx vitest run` — **218/218 passing across 31 test files**. The suite was red (5 failures) when this story was picked up: `page.test.tsx` already contained this story's Empty State assertions from an earlier in-flight session, with no implementation behind them. Those 5 are now green and no other test regressed.
- `npx tsc --noEmit` — clean.
- `npx next build` — succeeds; `/search` still prerenders static (`○`). Placeholder env vars passed inline, never written to a local `.env` (per the story's Environment note).

### Completion Notes List

- **Partial prior work was already on disk.** Task 1's `Step` union widening and `handleExpand` routing, and all of Task 2's `areasSearched` capture, had already been applied in an earlier session, along with Task 4's tests. What was missing was the render branch itself — so `setStep("empty")` fell through every `if` guard to the form `return`, silently re-rendering the search form after a doubly-empty search. That is the exact dead end FR-7 exists to remove, and it is why the 5 tests were red. This session added the `"empty"` render block and deleted the dead ternary.
- **AC #2 (stopgap deletion) done properly.** Story 2.3's `"We couldn't find a match in nearby areas either."` was not merely unreachable — it is deleted, along with the `matches.length === 0` ternary that guarded it. The `"results"` block now renders the summary and `MatchCard` list unconditionally, since `handleExpand` routes every zero-match expansion to `"empty"`. Third consecutive story to delete its predecessor's stopgap rather than layer beside it.
- **AC #3's empty-list guard.** `expandSearch` returns `areasSearched: []` when the origin area has no neighbours, so the body composes a `checkedPhrase` that falls back to naming only the origin area — never a sentence trailing into `", ."`. Covered by a test asserting the rendered text contains no `", ."` and no double spaces.
- **AC #4/#5 — one link, honest copy.** A single `<a href="/search/verify">` styled as a link, not a `Button`. AD-4 leaves the budget of 2 fully spent by this point, so the copy states the re-verify cost plainly ("To try a different area, verify your phone again.") rather than implying a free retry. No blood-bank link was built — PRD §6.2 excludes that integration and there is no destination, so shipping one would recreate the dead end (Open Question 1).
- **Deliberately not added:** no `aria-live` (Open Question 2 — EXPERIENCE.md scopes it to form errors, and the sibling `expand` step announces nothing either); no `EmptyState` component under `app/components/ui/` (one call site, and every other step is inline); no `skeletonBlock`, `errorBlock`, or `MatchCard` in this step — it is a terminal success state, not an error or a result.
- **Scope held.** No Server Action, domain module, repository, schema, migration, env var, or dependency was touched. `expandSearch` already returned `{ matches, areasSearched }`; this story only consumes it.

### File List

- `app/search/page.tsx` (modified — `"empty"` render block added; zero-match ternary deleted from `"results"`)
- `app/search/page.test.tsx` (modified — Empty State coverage; stopgap-absence regression test)

## Change Log

- 2026-07-26: Story created — ready-for-dev.
- 2026-07-26: Implemented the text-led Empty State as a fourth step on the Search screen, naming the origin area, the areas actually searched, and the blood type, with a single re-verify next-step link and a guard against the empty-`areasSearched` sentence. Deleted Story 2.3's stopgap and its now-unreachable ternary. Completed partially-applied prior work (the `"empty"` step had been routed to but never rendered, leaving 5 tests red). Suite 218/218 passing, `tsc` and `next build` clean. No new files, dependencies, env vars, or schema changes. Status: ready-for-dev → review.
- 2026-07-26: Code review (3 adversarial layers) — 6 patch findings applied, 0 decisions needed, 3 deferred. **The headline fix: the Empty State sentence was malformed for every reachable case.** `checkedPhrase` composed `"{origin} and {a, b, c}"`, producing a run-on with two conjunctions ("We checked Gulberg and Model Town, Cantt, Garden Town, DHA, and no eligible donor…"). Since all 10 areas have 2–6 neighbours, the broken branch was the *only* reachable one — the guard written and tested covered the case that cannot happen. Now composed as one list with a single conjunction (`"Gulberg, Model Town and Cantt"`), and the trailing link moved out of the sentence so no paragraph ends unpunctuated. **The test that should have caught it was vacuous** — a reviewer deleted the guard entirely and all 24 tests still passed, because assertions used `toHaveTextContent` on individual labels, which passes on any word order. Replaced with exact full-sentence assertions for the 1-area, 2-area, and realistic 4-area cases, plus a conjunction count. **Accessibility:** the sole next-step link was colour-only (Tailwind preflight makes `underline-offset-2` inert without an underline; `accent` vs `ink-secondary` measures 1.22:1 against WCAG 1.4.1's 3:1) and a 14px anchor under the 44px tap-target floor — now `underline` at rest, `text-body`, `min-h-[44px]`, with both properties asserted. Also: `areaLabel` now falls back to the raw code instead of silently rendering `undefined` in prose, and all four Empty State heading assertions pin `level: 1` so the `<h1>`/`text-heading` choice cannot regress unnoticed. Suite 219 passing, `tsc` and `next build` clean.

### Review Note — a spec/reality drift worth knowing

Two spec claims were verified untrue, both from the 2.4 story being authored *before* Story 2.3's
code review landed: the stated test baseline of "203/203" (2.3's review took it to 213), and the
"281 lines / 15 tests" file descriptions (actually ~307 / 19 pre-2.4). The `app/search/page.tsx:201-205`
citation for the stopgap is likewise stale. None affected the implementation — the Dev Agent Record's
own numbers were independently confirmed accurate — but it is why a reader comparing spec to code
will find line references that no longer match.
