---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - "_bmad-output/planning-artifacts/prds/prd-BloodDonorApp-2026-07-06/prd.md"
  - "_bmad-output/planning-artifacts/prds/prd-BloodDonorApp-2026-07-06/addendum.md"
  - "_bmad-output/planning-artifacts/architecture/architecture-BloodDonorApp-2026-07-06/ARCHITECTURE-SPINE.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-BloodDonorApp-2026-07-06/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-BloodDonorApp-2026-07-06/EXPERIENCE.md"
---

# BloodDonorApp - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for BloodDonorApp (Blood Donor Availability Matcher / "Lifeline Lahore"), decomposing the requirements from the PRD, UX Design, and Architecture Spine into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-1: Donor submits registration details — name, phone, blood type, one or more Areas, and last donation date (optional/unknown). Rejected with inline error if blood type, phone, or at least one Area is missing. Not searchable until phone verification (FR-2) completes.

FR-2: Donor verifies phone via OTP. OTP expires after a short fixed window (~5 min assumed). Registration only becomes active/searchable after successful verification. Resend supported, rate-limited.

FR-3: System computes donor eligibility — eligible when (today - lastDonationDate) >= 90 days, or when no Last Donation Date is on record. Computed at query time, never stored as a stale flag.

FR-4: Ineligible donors are excluded from search — never shown as fallback, at the searched Area or any expanded nearby Area, regardless of blood type. A Search for a blood type held only by ineligible Donors returns zero Matches (triggers area-expansion/empty-state path), not a false match.

FR-5: Searcher registers (name + phone), verifies via OTP, then submits a blood type + one Area to search for eligible Matches. Match list not returned and no Notification triggered until OTP succeeds. OTP behavior mirrors Donor's (short fixed expiry, resendable, rate-limited). Full Match list (name, phone, Area) returned directly, not anonymized.

FR-6: System suggests expanding to nearby areas when no match exists in the selected Area; on Searcher confirmation, re-searches those areas and shows which area(s) produced results. (Nearby-area adjacency mapping is an open product decision — Open Question 1.)

FR-7: System shows a clear, worded empty state (never a generic error, blank screen, or silent timeout) when no eligible Donor exists in the selected Area or its nearby areas. Ineligible donors are never substituted as fallback (FR-4).

FR-8: System notifies matched donors by SMS (Twilio) and email (SendGrid) the instant a Search returns one or more Matches, containing Searcher's name, phone, blood type needed, and Area. Notification dispatch does not delay the Searcher's own result. A Donor without a registered email receives SMS only.

FR-9: Donor starts a self-service session via OTP to their registered phone number. The OTP session grants access only to the registration matching that verified phone number.

FR-10: Donor updates their last donation date, which resets their 90-day Eligibility Window; immediately excluded from Match results until 90 days from the new date have passed.

FR-11: Donor deletes their own registration, permanently and immediately excluded from all future Match results. Deletion is not reversible; no soft-delete/undo in MVP.

FR-12: System rate-limits requests per IP address across registration, search, and OTP endpoints. Requests beyond threshold receive a clear rate-limit response, not silent drop/crash. (Exact thresholds are an open product decision — Open Question 3.)

### NonFunctional Requirements

NFR-1 (Performance — SM-1): A Donor completes registration, including OTP verification and Area selection, in under 60 seconds.

NFR-2 (Performance — SM-2): A Searcher receives a result — full Match list or empty state — within 30 seconds of starting a search, including OTP verification. The added OTP round-trip must not push total search time past this budget.

NFR-3 (Availability/Reliability — FR-8): Notification firing (SMS via Twilio, email via SendGrid) must never block or delay the Searcher's own result; both are external dependencies whose latency/failures must not surface to the Searcher.

NFR-4 (Security/Abuse Prevention — FR-5, FR-12): Searcher OTP verification plus per-IP rate limiting together must gate the real, cost-incurring SMS/email sends triggered by every search.

NFR-5 (Security — FR-1, FR-2, FR-9): OTP-gating on Donor registration and self-service reduces fake/junk Donor records; an OTP session must grant access only to the matching phone number's own data, never another Donor's.

NFR-6 (Privacy/Data handling): Only name, phone number, blood type, and Area are ever displayed or transmitted — no address, no ID/CNIC, no medical history beyond last donation date. Donor data retained only while registration is active (deleted immediately on FR-11); Searcher data retained only as long as needed to deliver that search's Notifications.

NFR-7 (Cost/Operational constraint): Twilio free-trial accounts can only send to manually-verified numbers — this is a functional blocker for real SMS delivery (FR-8) that must be resolved before any real-world use, not merely a cost concern. SendGrid free-tier daily send-volume cap must be checked against expected search volume before launch.

NFR-8 (Accessibility — WCAG 2.1 AA, from UX EXPERIENCE.md): All text/background pairs meet WCAG 2.1 AA contrast; all form fields have persistent, programmatically-associated visible labels; every status badge/empty state pairs color with explicit text; tap targets ≥44×44px/48×48dp; screen reader support for OTP digit position announcements and `aria-live` form-error announcements; visible focus order matching reading order; `prefers-reduced-motion` respected (no transition/fade on state changes).

NFR-9 (Non-goals / explicit exclusions, from PRD §5-6.2): No GPS/browser geolocation or distance calculation (Haversine or otherwise) — Area matching only. No paid mapping API. No WhatsApp integration (Business API or `wa.me`) in any form. No in-app chat/messaging. No hospital/blood-bank system integration. No donation verification. Lahore-only in v1. No persistent Searcher accounts/login beyond per-search OTP.

### Additional Requirements

- **Architecture paradigm (AD, ARCHITECTURE-SPINE.md):** Layered monolith — Next.js App Router single deployment, one dependency direction Presentation → Domain → Infrastructure, through port interfaces; Domain never depends on concrete adapters (Prisma, Twilio, SendGrid).
- **AD-1 — No persisted Searcher identity:** Searcher's name/phone are inlined fields on the `Search` record only; no `Searcher` table.
- **AD-2 — OTP challenges live only in Redis, never Postgres:** every OTP challenge (`phone + purpose -> codeHash, expiresAt, attempts`) is a Redis key with ~5 min TTL; no OTP table in the relational schema; all three OTP flows (Donor registration, Searcher verify, self-service entry) call one shared `otp` service.
- **AD-3 — One shared rate-limit utility:** all rate-limited endpoints (registration, search, OTP) call one Redis sliding-window utility keyed by `ip + endpoint`, using the platform-trusted client IP (never a raw client-supplied `x-forwarded-for`); one shared 429 response shape.
- **AD-4 — Post-OTP session as short-lived server-enforced bearer token:** successful OTP verification at Searcher-verify, self-service-entry, or self-service-action issues a signed JWT (~15 min TTL) scoped to one phone/Donor id with a unique `jti`; server tracks each `jti`'s remaining permitted uses in Redis (Searcher budget: 2 — submit + at most one area-expansion re-search; Donor self-service: exactly one of update or delete per issuance). Donor registration (FR-1/FR-2) issues no session token — OTP verification there directly activates the registration in the same request.
- **AD-5 — Eligibility derived, never stored:** `isEligible = (today - lastDonationDate) >= 90 days OR lastDonationDate IS NULL`, computed at query time in the domain layer; no eligibility flag persisted.
- **AD-6 — Notification dispatch never blocks Searcher response:** Search response returns immediately once Matches are computed; SMS+email dispatch runs via the framework's post-response (`after()`) hook, which itself awaits the full dispatch-and-log sequence before returning; failures logged, never surfaced to the Searcher.
- **AD-7 — Area adjacency is static code, not an editable resource:** one static, versioned TypeScript module keyed by the `Area` enum, imported by the domain matching service (concrete adjacency values still an open product decision — Open Question 1).
- **Data model:** `Donor` (id, name, phone E.164 unique, email optional, bloodType, lastDonationDate nullable), `DonorArea` (donorId, area), `Search` (id, searcherName, searcherPhone, bloodType, area, createdAt) — PostgreSQL 17.
- **Stack:** Next.js 16.2.x (App Router, Turbopack), React 19.2, Node.js 24.x LTS, TypeScript 5.x, Prisma ORM 7.x, Redis (Upstash, serverless/TTL-native) for OTP + rate-limit store, Zod 4.x for input validation at the Presentation boundary, Twilio SDK (SMS — OTP + Notification), @sendgrid/mail (email — Notification), Tailwind CSS (implements DESIGN.md tokens as theme config), deployed on Vercel.
- **Conventions:** IDs via Prisma `cuid()`; phone in E.164 everywhere (storage, Twilio calls, uniqueness key); dates ISO 8601 date-only for `lastDonationDate`; `Area` fixed 10-value enum; `BloodType` fixed 8-value ABO/Rh enum; errors as `{ error: { code, message } }` from every Server Action/Route Handler; all writes go through Prisma inside `lib/infra/repositories/*` (no direct Prisma calls from `app/`); secrets (Twilio, SendGrid, DB, Redis, JWT signing key) are env vars only.
- **No starter template specified** — greenfield Next.js App Router build from scratch; Epic 1 Story 1 should establish project scaffolding (Next.js + Prisma + Tailwind + Redis client wiring) rather than adopting a named starter.
- Deferred/out of architecture scope (owned by PM or future phase, not builders): concrete area-adjacency values (Open Question 1), exact per-IP rate-limit thresholds (Open Question 3), Twilio free-trial-to-paid upgrade (ops/launch-readiness), SendGrid free-tier volume check (Open Question 4), formal PII/data-protection compliance review (Open Question 5), observability/monitoring stack, detailed automated-testing strategy split.

### UX Design Requirements

UX-DR1: Implement the full design token set from DESIGN.md as Tailwind theme config — colors (surface-base, surface-raised, ink-primary, ink-secondary, ink-disabled, border-hairline, accent "Lifeline Teal" + hover, accent-on, status-success/-caution/-error + backgrounds), typography scale (display, heading, body, body-large, meta, label), rounded scale (sm/md/lg/full), spacing scale (4/8/12/16/24/32/48px + gutter/margin-mobile/margin-desktop).

UX-DR2: Build the following reusable components per DESIGN.md/EXPERIENCE.md behavioral + visual specs: Button (primary), Input field, OTP input (6 discrete digit boxes, numeric keyboard, auto-advance/auto-back, paste-to-fill/SMS autofill), Donor match card (tap-to-call phone link, name/phone in body-large, area as meta tag), Status badge (eligible/cooldown, always paired with explicit date text), Area chip (multi-select for registration, single-select for search), Empty state (text-led, no illustration, one next-step action link), Resend OTP link (countdown text, disabled→tappable state change reinforced by text change, not color alone).

UX-DR3: Information Architecture — implement all 12 surfaces as a single responsive IA (no separate mobile/desktop experiences, no tab bar/drawer/persistent nav): Home (three-way fork), Donor Registration, Donor OTP Verify, Registration Confirmation, Searcher Verify, Search Form, Match Results, Area Expansion Prompt, Empty State, Self-Service Entry, Self-Service OTP Verify, Self-Service Dashboard, Delete Confirmation.

UX-DR4: Form and OTP behavioral rules — labels always visible above field (never placeholder-only); validate on blur, not every keystroke; email field explicitly labeled "Optional," never blocks submit when blank; primary button disabled (not hidden) until required fields valid, shows inline spinner + "Sending…"/"Searching…" on submit (never a silent freeze); exactly one primary action per screen.

UX-DR5: State-pattern requirements — inline field-level validation errors (never a top banner); OTP sending/expired/wrong-code have distinct, plain-language messages (not a generic "invalid code"); search loading uses skeleton list rows (not spinner-only blank screen); zero-matches routes to Area Expansion Prompt first, then Empty State only after expansion also yields nothing; rate-limited actions show a generic "try again shortly" message without promising an unenforceable retry time; delete requires an explicit two-step confirm ("This can't be undone") with no undo/toast afterward.

UX-DR6: Voice and tone — calm, plain-language, jargon-free microcopy throughout (no exclamation-mark urgency, no false scolding, no technical terms like "authentication"/"payload"/"endpoint" in user-facing copy); numerals for dates/codes, never vague relative time for eligibility-related copy.

UX-DR7: Interaction primitives — tap phone number opens native dialer (`tel:` link) on mobile, copies to clipboard with "Copied" confirmation on desktop; area selection via chips (not native `<select>`), multi-select on registration/single-select on search; explicit confirm-before-destroy for deletion (no swipe-to-delete, no undo toast); banned patterns: push-notification re-engagement prompts, gamified streak/badge mechanics, decorative loading animations that extend perceived wait, auto-playing media, infinite scroll/carousels/auto-advancing content.

UX-DR8: Accessibility floor (behavioral) — WCAG 2.1 AA contrast on all text/background pairs; persistent programmatically-associated `<label>` on every field; color-paired-with-text on every status signal; ≥44×44px/48×48dp tap targets including OTP digit boxes and area chips; screen-reader announcements for OTP digit position and `aria-live` for form errors; visible focus order matching reading order; `prefers-reduced-motion` support (skip transitions, content simply appears); English-only UI copy in this MVP pass (flagged as an open gap, not a decision).

UX-DR9: Responsive breakpoints — mobile (<768px): single column, full-width buttons/inputs, 16px margins; desktop (≥768px): same single-column flow centered in a ~480–560px max-width column with 32px outer margins, no added columns/sidebar; area chips wrap responsively; OTP digit boxes stay fixed-size and centered at both breakpoints; no distinct tablet treatment.

### FR Coverage Map

FR1: Epic 1 - Donor submits registration details
FR2: Epic 1 - Donor verifies phone via OTP
FR3: Epic 1 - System computes donor eligibility
FR12: Epic 1 - System rate-limits requests per IP address (shared utility, reused by Epic 2 & 3 endpoints)
FR4: Epic 2 - Ineligible donors excluded from search
FR5: Epic 2 - Searcher registers, verifies via OTP, and submits a search
FR6: Epic 2 - System suggests expanding to nearby areas when no match exists
FR7: Epic 2 - System shows a clear empty state when no match exists
FR8: Epic 2 - System notifies matched donors by SMS and email on search submission
FR9: Epic 3 - Donor starts a self-service session via OTP
FR10: Epic 3 - Donor updates their last donation date
FR11: Epic 3 - Donor deletes their own registration

## Epic List

### Epic 1: Donor Registration & Eligibility
A prospective donor can register (name, phone, blood type, one or more Areas, last donation date), verify via OTP, and see their confirmed eligibility status and Areas — becoming discoverable. Establishes the shared OTP service (AD-2), shared rate-limit utility (AD-3), Donor/DonorArea data model, and project scaffolding (Next.js/Prisma/Tailwind/Redis) reused by later epics.
**FRs covered:** FR-1, FR-2, FR-3, FR-12

### Epic 2: Search, Matching & Donor Notification
A searcher can verify their own phone via OTP, search by blood type + one Area, see the full eligible-match list (name/phone/area) with area-expansion suggestion and a worded empty state — while every matched donor is simultaneously notified by SMS + email. Reuses Epic 1's OTP service and rate-limit utility; adds the post-OTP session token (AD-4), matching domain logic, and Twilio/SendGrid notification dispatch via the `after()` hook (AD-6).
**FRs covered:** FR-4, FR-5, FR-6, FR-7, FR-8

### Epic 3: Donor Self-Service
A donor can return anytime, re-verify via OTP, view only their own registration, update their last-donation date (resetting eligibility), or permanently delete their registration. Reuses Epic 1's OTP service and Epic 2's session-token pattern (AD-4 scopes the token to exactly one update-or-delete action per issuance).
**FRs covered:** FR-9, FR-10, FR-11

## Epic 1: Donor Registration & Eligibility

A prospective donor can register (name, phone, blood type, one or more Areas, last donation date), verify via OTP, and see their confirmed eligibility status and Areas — becoming discoverable. Establishes the shared OTP service (AD-2), shared rate-limit utility (AD-3), Donor/DonorArea data model, and project scaffolding (Next.js/Prisma/Tailwind/Redis) reused by later epics.

### Story 1.1: Donor Submits Registration Details

As a prospective donor,
I want to submit my name, phone number, blood type, one or more Areas, and last donation date,
So that I can begin the process of becoming a discoverable donor.

**Acceptance Criteria:**

**Given** I am on the Donor Registration screen with no prior account
**When** I submit name, phone, blood type, at least one Area, and a last donation date (or mark it as "never/not recently")
**Then** a Donor record is created in PostgreSQL (Donor + DonorArea tables), inactive/not searchable, and I am routed to Donor OTP Verify

**And** if I submit with blood type, phone, or all Areas missing, I see a clear inline error below the specific field and the record is not created

**And** I can select more than one Area via the Area chip component (UX-DR2/UX-DR7), and the record stores all selected Areas

**And** the email field is present and explicitly labeled "Optional," and leaving it blank does not block submission (UX-DR4)

**And** the Submit button is disabled until required fields are valid, and shows an inline spinner + "Sending…" state on submit rather than freezing silently (UX-DR4)

**And** this story establishes the Next.js App Router + Prisma + Tailwind + Redis project scaffolding, and the `Donor`/`DonorArea` Prisma schema (E.164 phone, fixed Area/BloodType enums, `cuid()` ids), since no starter template exists

### Story 1.2: System Rate-Limits Registration Submissions

As the org operating this service,
I want registration submissions rate-limited per IP address,
So that abusive or automated registration attempts don't degrade the service or pollute the donor registry.

**Acceptance Criteria:**

**Given** the shared Redis sliding-window rate-limit utility does not yet exist
**When** this story is implemented
**Then** one utility keyed by `ip + endpoint` is created in `lib/domain/rate-limit.ts`, using the platform-trusted client IP (Vercel's resolved IP, never a raw client-supplied `x-forwarded-for`) — built once here so Epic 2 (search) and Epic 3 (self-service) reuse it without rebuilding it

**And** the registration-submission endpoint (Story 1.1) is wrapped by this utility

**And** a request beyond the configured threshold receives a clear, structured 429 response (`{ error: { code, message } }`) rather than being silently dropped or crashing the service

**And** exact thresholds are left as tunable config (PRD Open Question 3 remains open — not blocking this story)

### Story 1.3: Donor Verifies Phone via OTP

As a prospective donor,
I want to verify my phone number by entering a one-time code,
So that my registration becomes active and I know my number is genuinely reachable.

**Acceptance Criteria:**

**Given** I have submitted registration details (Story 1.1) and am on Donor OTP Verify
**When** I request a code
**Then** a 6-digit OTP is generated and stored as a Redis key (`phone + purpose -> codeHash, expiresAt, attempts`) with a ~5 minute TTL — no OTP table in Postgres (AD-2) — via one shared `otp` service reused by Searcher-verify and self-service later

**And** I see 6 discrete digit boxes with numeric keyboard auto-invoked on mobile, auto-advance per digit, and SMS-autofill/paste support where the browser exposes it (UX-DR2/UX-DR7)

**When** I enter the correct code before expiry
**Then** my Donor record becomes active/searchable immediately — no session token is issued (AD-4 explicitly excludes Donor registration from token issuance)

**When** I enter an expired code
**Then** I see "This code has expired." with a prominent Resend action — distinct from a wrong-code message (UX-DR5)

**When** I enter an incorrect, non-expired code
**Then** I see "That code didn't match. Check the SMS and try again." (UX-DR5)

**And** the Resend link is greyed with a visible countdown until it can be tapped, and OTP requests (including resends) are rate-limited via Story 1.2's shared utility, returning the rate-limit message (not a silently non-functional link) once the limit is hit (UX-DR5)

### Story 1.4: Donor Views Confirmed Eligibility Status

As a newly-verified donor,
I want to immediately see my eligibility status and the Areas I'm listed under,
So that I know exactly how I'll appear to a future Searcher.

**Acceptance Criteria:**

**Given** my OTP verification (Story 1.3) just succeeded
**When** the Registration Confirmation screen loads
**Then** eligibility is computed at query time by the domain layer — `isEligible = (today - lastDonationDate) >= 90 days OR lastDonationDate IS NULL` (AD-5) — and never persisted as a stored flag

**And** if eligible, I see a status badge reading "Eligible now" (status-success styling); if not, "Eligible again on [date]" (status-caution styling) — always paired with explicit text, never color alone (UX-DR2/UX-DR8)

**And** I see all Areas I selected during registration (Story 1.1) listed clearly

**And** this screen uses the `display` typography token for this confirmation moment, per DESIGN.md

## Epic 2: Search, Matching & Donor Notification

A searcher can verify their own phone via OTP, search by blood type + one Area, see the full eligible-match list (name/phone/area) with area-expansion suggestion and a worded empty state — while every matched donor is simultaneously notified by SMS + email. Reuses Epic 1's OTP service and rate-limit utility; adds the post-OTP session token (AD-4), matching domain logic, and Twilio/SendGrid notification dispatch via the `after()` hook (AD-6).

### Story 2.1: Searcher Verifies Identity via OTP

As a searcher,
I want to provide my own name and phone number and verify it via a one-time code,
So that I'm allowed to run a search that triggers real donor notifications.

**Acceptance Criteria:**

**Given** I am on Home and tap "I need blood," landing on Searcher Verify
**When** I submit my name and phone number
**Then** an OTP is requested using the shared `otp` service from Story 1.3 (AD-2), and the request is rate-limited via Story 1.2's shared utility (extending FR-12 coverage to the Searcher-verify endpoint)

**When** I enter the correct code before expiry
**Then** a signed JWT session token (~15 min TTL, unique `jti`) is issued, scoped to my phone number, with a budget of 2 remaining uses tracked in Redis (AD-4) — one for submitting the search, one for at most one area-expansion re-search (Story 2.3)

**And** expired-code and wrong-code states show the same distinct messages as Story 1.3 ("This code has expired." / "That code didn't match…") (UX-DR5)

**And** no Match list or Notification is triggered until this verification succeeds — this is the sole gate on the search cost/abuse vector (FR-5)

### Story 2.2: Searcher Submits Search, Views Matches, and Matched Donors Are Notified

As a searcher,
I want to submit a blood type and one Area and immediately see every eligible matching donor's name, phone, and area, while those donors are notified,
So that I can start calling directly without delay, and donors who might reach out first are alerted right away.

**Acceptance Criteria:**

**Given** I have a valid Searcher session token (Story 2.1) with remaining budget
**When** I select a blood type and one Area (via the single-select Area chip, UX-DR7) and tap Search
**Then** the matching domain service returns every Donor who is eligible (per AD-5), shares the requested blood type, and has the searched Area among their selected Areas — ineligible Donors are never included, regardless of blood type (FR-4)

**And** this story establishes the `Search` Prisma table (searcherName, searcherPhone E.164, bloodType, area, createdAt) and records the submitted search there — the first story that needs it

**And** I see skeleton list rows while the search runs, not a spinner-only blank screen (UX-DR5), and the full result (name, phone, Area per Match) is returned directly, not anonymized

**And** each Donor match card shows name and phone in `body-large` type with Area as a `meta` tag, and the phone number is a tap-to-call `tel:` link on mobile / copy-to-clipboard on desktop (UX-DR2/UX-DR7)

**And** once Matches are computed, my response returns immediately without waiting for SMS/email delivery — dispatch runs via the framework's post-response `after()` hook, which itself awaits the full dispatch-and-log sequence before returning; delivery failures are logged, never surfaced to me (AD-6, FR-8)

**And** every Match receives both an SMS (Twilio) and an email (SendGrid, if they have one on file — SMS-only otherwise) containing my name, phone number, the blood type needed, and the Area (FR-8)

**And** this action consumes one unit of my session token's 2-use budget (AD-4)

### Story 2.3: System Suggests Nearby Area Expansion on No Match

As a searcher who found no match in my selected Area,
I want the system to suggest nearby areas and re-search on my confirmation,
So that I don't hit a dead end when help might be one neighborhood over.

**Acceptance Criteria:**

**Given** my search (Story 2.2) returned zero Matches in the selected Area
**When** the result loads
**Then** I see the Area Expansion Prompt (not directly the Empty State) suggesting nearby areas, per a static, versioned TypeScript adjacency module keyed by the `Area` enum (AD-7) — no DB-backed or admin-editable adjacency

**When** I confirm expansion
**Then** the system re-searches the adjacent area(s), consuming the second and final unit of my session token's budget (AD-4), and I see which area(s) ultimately produced results

**And** if the expanded search now returns Matches, I see the standard Match Results view (Story 2.2) labeled with the area that matched

### Story 2.4: System Shows Empty State When No Match Found

As a searcher who found no match even after area expansion,
I want a clear, worded explanation and next steps,
So that I know to try elsewhere instead of hitting a dead end.

**Acceptance Criteria:**

**Given** my area-expansion re-search (Story 2.3) also returned zero Matches
**When** the result loads
**Then** I see a text-led Empty State (no illustration) explicitly stating no match was found, with a next-step action link (e.g., "Find a blood bank near you") (UX-DR2/UX-DR5)

**And** the system never returns a generic error, blank screen, or silent timeout in this case

**And** ineligible donors are never substituted in as a fallback at any point in this flow (FR-4)

## Epic 3: Donor Self-Service

A donor can return anytime, re-verify via OTP, view only their own registration, update their last-donation date (resetting eligibility), or permanently delete their registration. Reuses Epic 1's OTP service and Epic 2's session-token pattern (AD-4 scopes the token to exactly one update-or-delete action per issuance).

### Story 3.1: Donor Starts a Self-Service Session via OTP

As a returning donor,
I want to request and verify an OTP to my registered phone number,
So that I can access only my own registration without needing a persistent login.

**Acceptance Criteria:**

**Given** I tap "Manage my registration" on Home and land on Self-Service Entry
**When** I submit my registered phone number
**Then** an OTP is requested via the shared `otp` service (Story 1.3, AD-2), rate-limited via the shared utility (Story 1.2, extending FR-12 to the self-service-entry endpoint)

**When** I enter the correct code before expiry
**Then** a signed JWT session token (~15 min TTL, unique `jti`) is issued scoped to exactly my phone number/Donor id, authorizing exactly one of update (Story 3.2) or delete (Story 3.3) per issuance (AD-4)

**And** the Self-Service Dashboard shows only the registration matching my verified phone number — never any other Donor's data (FR-9)

**And** expired-code and wrong-code states reuse the same distinct messages as Story 1.3 (UX-DR5)

### Story 3.2: Donor Updates Last Donation Date

As a donor who has just donated,
I want to log a new last-donation date,
So that I'm correctly excluded from matches for the next 90 days and my eligibility resets.

**Acceptance Criteria:**

**Given** I have a valid self-service session token (Story 3.1)
**When** I tap "Update donation date" and submit a new date
**Then** my Donor record's `lastDonationDate` is updated, consuming my token's one-action budget (AD-4)

**And** the Dashboard immediately reflects my new cooldown badge ("Eligible again on [date + 90 days]") since eligibility is recomputed at query time (AD-5) — I am excluded from Match results starting now (FR-10)

**And** the update happens instantly, without requiring a fresh page load to trust that the system heard me

### Story 3.3: Donor Deletes Registration

As a donor who no longer wants to participate,
I want to permanently delete my registration,
So that I'm immediately and completely removed from all future searches.

**Acceptance Criteria:**

**Given** I have a valid self-service session token (Story 3.1)
**When** I tap "Delete registration"
**Then** I see a Delete Confirmation step stating "This can't be undone." before any deletion occurs — no swipe-to-delete, no single-tap delete (UX-DR5/UX-DR7)

**When** I confirm deletion
**Then** my Donor record (and associated DonorArea rows) is immediately and permanently removed, consuming my token's one-action budget (AD-4), and is excluded from all future Match results (FR-11)

**And** deletion is not reversible — no soft-delete, no undo toast afterward, matching the MVP assumption in PRD §9
