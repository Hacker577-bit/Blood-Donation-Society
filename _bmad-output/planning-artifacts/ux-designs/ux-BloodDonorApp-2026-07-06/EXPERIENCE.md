---
name: Lifeline Lahore
status: draft
updated: 2026-07-06
sources:
  - "{planning_artifacts}/prds/prd-BloodDonorApp-2026-07-06/prd.md"
---

# Lifeline Lahore — Experience Spine

## Foundation

Responsive web app, mobile-first with desktop support — a single codebase and IA, not separate mobile/desktop experiences. `[ASSUMPTION: confirmed with S — mobile is the design target (UJ-1 explicitly happens "on her phone browser"), desktop is supported for cases like an org staffer or family member coordinating from a desk during an emergency, but gets no distinct layout beyond wider margins and a centered column — see Responsive & Platform.]`

No UI system named — this spine assumes a custom-built component set per `DESIGN.md`, not an inherited library (shadcn/MUI/etc.). `DESIGN.md` is the visual identity reference; this spine is the behavior.

No persistent login exists anywhere in this product (by PRD design — OTP-per-session is the only identity mechanism, both for Donors and now Searchers). Every flow below either starts fresh or re-verifies via OTP; there is no "logged in" state to design around.

## Information Architecture

| Surface | Reached from | Purpose |
|---|---|---|
| Home | App open (cold) | Fork: "I need blood" (Searcher) vs "I want to help" (Donor register) vs "Manage my registration" (Donor self-service) |
| Donor Registration | Home → "I want to help" | Name, phone, email (optional), blood type, Area(s), last donation date |
| Donor OTP Verify | After Donor Registration submit | Verify phone via OTP to activate registration |
| Registration Confirmation | After Donor OTP success | Eligibility status + Areas listed, realizes UJ-3 climax |
| Searcher Verify | Home → "I need blood" | Searcher's own name + phone, then OTP |
| Search Form | After Searcher OTP success | Blood type + one Area |
| Match Results | After Search submit | Full list: name, phone, Area per Match |
| Area Expansion Prompt | Match Results, zero matches | Suggests nearby areas, re-searches on confirm |
| Empty State | Area Expansion Prompt, still zero matches | Worded dead-end with next-step suggestions |
| Self-Service Entry | Home → "Manage my registration" | Request OTP to registered phone |
| Self-Service OTP Verify | After Self-Service Entry submit | Verify phone to unlock own registration |
| Self-Service Dashboard | After Self-Service OTP success | View status, update donation date, or delete registration |
| Delete Confirmation | Self-Service Dashboard → Delete | One explicit confirm step before permanent deletion |

No tab bar, no drawer, no persistent nav chrome — each surface is a step in one of three linear flows (register / search / self-service), forked once at Home. Modal/sheet stacks one level deep, never two (used only for Delete Confirmation and the Area Expansion Prompt).

→ Composition reference: none yet — see Key-Screen Mocks note in Finalize. Spine wins on conflict.

## Voice and Tone

Microcopy only — aesthetic posture lives in `DESIGN.md.Brand & Style`. Governing rule: **this app is a calm desk clerk, not a siren.** A stressed Searcher and a possibly mid-task Donor should never be startled, scolded, or spoken to with false urgency the app itself can't back up.

| Do | Don't |
|---|---|
| "We couldn't find a match in Gulberg yet." | "No results! ⚠️" |
| "Enter the 6-digit code we sent to 03xx-xxxxxxx." | "Verify NOW to continue!" |
| "You're eligible again on 4 October." | "Sorry, you're still on cooldown 😢" |
| "This can't be undone." (delete confirm) | "Are you REALLY sure??" |
| Plain, complete sentences, no jargon | Technical terms (e.g. "authentication", "payload", "endpoint") in user-facing copy |
| Numerals for dates and codes ("4 October", "03xx-xxxxxxx") | Relative vague time ("soon", "a while ago") for anything eligibility-related |

`[ASSUMPTION: no organization name/brand voice was specified in the PRD (§0, §9) — "Lifeline Lahore" is a placeholder working title for this UX pass, matching the PRD's own "working title, confirm" note. Rename freely; the tone rules above hold regardless of final name.]`

## Component Patterns

Behavioral. Visual specs live in `DESIGN.md.Components`.

| Component | Use | Behavioral rules |
|---|---|---|
| Button (primary) | Every form submit, every screen | Exactly one per screen. Disabled (not hidden) until required fields are valid. Shows inline spinner + "Sending…" / "Searching…" on submit — never a silent freeze. |
| Input field | Name, phone, email, area dropdown, date | Label always visible above field (never placeholder-only). Validates on blur, not on every keystroke. Email field is explicitly labeled "Optional" and never blocks submit if left blank — a blank email is a valid, expected state, not an error (PRD §4.4: SMS-only Donors are by design). |
| OTP input | Donor reg, Searcher verify, Self-service entry | 6 discrete digit boxes, auto-advance per digit, numeric keyboard invoked on mobile. Paste-to-fill supported (SMS autofill on supporting browsers). |
| Donor match card | Match Results list | Tap phone number to call directly (`tel:` link). Entire card is not tappable — only the phone number and, secondarily, the name row for expansion (no expansion content exists in v1, so name is static text). |
| Status badge | Registration Confirmation, Self-Service Dashboard | Always paired with explicit date text — see `DESIGN.md.components.status-badge-eligible` / `-cooldown`. |
| Area chip | Donor Registration (multi-select), Search Form (single-select) | Donor Registration: tap toggles on/off, no upper limit `[ASSUMPTION: PRD says "one or more Areas," no stated max — assumed unlimited within the 10 predefined localities.]`. Search Form: tap selects exactly one, selecting a new one deselects the prior. |
| Resend OTP link | Every OTP Verify surface | Inactive (greyed, plain text) with visible countdown ("Resend in 0:45"); becomes tappable at 0:00. Rate-limited per §4.6 — after the limit, replaced with the rate-limit message, not a silently non-functional link. |
| Empty state | Empty State surface | Text + one clear next-step action link (e.g. "Try another area" / "Find a blood bank near you"). No decorative illustration — see `DESIGN.md`. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Form validation error | Any form | Inline, below the specific field, in `status-error` — never a top-of-page banner that separates the error from its cause. |
| OTP sending | Any OTP trigger | Button shows "Sending code…" spinner; field for code appears only once send is acknowledged. |
| OTP expired | Any OTP Verify | "This code has expired." + prominent Resend action — never a generic "invalid code" that reads the same as a typo. `[ASSUMPTION: expiry window ~5 minutes per PRD §9 assumption — exact value owned by architecture.]` |
| OTP wrong (not expired) | Any OTP Verify | "That code didn't match. Check the SMS and try again." Distinct from the expired message. |
| Search loading | Search Form → Match Results | Skeleton list rows, max a few seconds per SM-2's 30-second full budget — no spinner-only blank screen. |
| Zero matches (first pass) | Match Results | Routes to Area Expansion Prompt, not directly to Empty State — see FR-6. |
| Zero matches (after expansion) | Empty State | Explicit worded empty state per FR-7 — never a blank screen, generic error, or silent timeout. |
| Rate-limited | Any rate-limited action (§4.6) | Clear message stating to try again shortly — no specific retry-timer promised unless architecture confirms one is enforceable. `[ASSUMPTION: exact thresholds are an open PRD question (§8 Q3); copy is written generic enough to not overpromise a retry time.]` |
| Delete confirmed | Self-Service Dashboard → Delete Confirmation | Explicit two-step: tap Delete → confirm sheet stating "This can't be undone" → final delete. No undo/toast-with-undo afterward, matching FR-11's no-soft-delete assumption. |
| Registration active | Registration Confirmation | Immediate status badge (Eligible now / Eligible again on [date]) + list of selected Areas — the climax beat of UJ-3. |
| Notification fire-and-forget | (no in-app surface — SMS/email only) | The app itself shows no state for "notification sent" beyond the Searcher's own Match Results appearing — notifications are entirely out-of-band per FR-8. Email/SMS copy: see Key Flows, UJ-2. |

## Interaction Primitives

- Tap phone number → native dialer (`tel:` link) on mobile; on desktop, a tap copies the number to clipboard with a brief "Copied" confirmation `[ASSUMPTION: desktop has no dialer to hand off to — clipboard-copy is the practical equivalent; confirm if the org prefers a different desktop behavior.]`.
- OTP digit boxes auto-advance forward on entry, auto-back on delete; full paste from SMS autofill supported where the browser exposes it.
- Area selection: chips, not a native `<select>` dropdown, for both registration (multi) and search (single) — chips let a user see all 10 options at once rather than scrolling a closed list, useful under time pressure.
- Confirm-before-destroy: delete registration always requires the explicit confirm-sheet step — no swipe-to-delete, no undo toast (irreversible per FR-11).
- No infinite scroll, carousels, or auto-advancing content anywhere — every screen is a single deliberate step.
- **Banned:** push-notification re-engagement prompts, gamified streak/badge mechanics, decorative loading animations that extend perceived wait time, auto-playing media.

## Accessibility Floor

Behavioral; visual contrast lives in `DESIGN.md`.

- WCAG 2.1 AA contrast minimum on all text/background pairs defined in `DESIGN.md.colors`.
- All form fields have a persistent visible `<label>`, programmatically associated — never placeholder-as-label.
- Every status badge and empty state pairs color with explicit text — never a color-only signal (colorblind-safe by construction).
- Tap targets ≥ 44×44px (iOS-equivalent) / 48×48dp minimum, including OTP digit boxes and area chips.
- Screen reader: OTP input announces each digit's position ("Code digit 1 of 6"); form errors are announced on submit via `aria-live`, not just visually inserted.
- Focus order follows visual/reading order on every surface; focus visibly indicated (not suppressed) on all interactive elements.
- Language: plain, short sentences throughout (see Voice and Tone) — `[ASSUMPTION: UI copy is English-only per the PRD's silence on localization; no Urdu/Punjabi translation is in scope for this MVP pass, flagged as a gap worth a PM decision if the org's actual user base skews toward non-English-first speakers.]`
- Reduced motion: skip any transition/fade on state changes (e.g. skeleton-to-content) for users with `prefers-reduced-motion` — content simply appears.

## Responsive & Platform

Triggered because form factor spans mobile + desktop (per S's confirmation). Single IA and single set of surfaces — no desktop-only or mobile-only screens.

- **Mobile (< 768px):** Single column, full-width buttons and inputs, 16px margins, content fills the viewport width.
- **Desktop (≥ 768px):** Same single-column flow, centered in a max-width content column (`[ASSUMPTION: ~480–560px max-width — narrow enough that a form-and-list app doesn't stretch into unreadable full-width desktop lines]`), 32px outer margins. No added columns, no sidebar — the task (fill a form, scan a list) doesn't benefit from extra desktop-only layout complexity.
- Area chips wrap responsively; OTP digit boxes stay fixed-size and centered at both breakpoints.
- No distinct tablet treatment specified — tablet viewports fall into the desktop breakpoint's centered-column behavior. `[ASSUMPTION: acceptable given no tablet-specific journey was named.]`

## Key Flows

### Flow 1 — Amara searches for a nearby donor during a family emergency (realizes UJ-1)

1. Amara opens the app on her phone browser, no account. Taps "I need blood" on Home.
2. Searcher Verify: enters her name and phone number.
3. Requests OTP → enters the 6-digit code → verified.
4. Search Form: selects O-negative, selects "Gulberg."
5. Taps Search. Skeleton rows appear briefly.
6. Match Results: full list of eligible donors — name, phone, area — appears within the 30-second SM-2 budget including her OTP step.
7. She taps the first donor's phone number → her phone's dialer opens pre-filled.
8. **Climax:** She reaches a donor on the first or second call, because the list gave her real, current contact info immediately — no waiting on anyone else's action.

Edge case (no match in Gulberg): step 6 instead shows the Area Expansion Prompt ("No match in Gulberg yet — try nearby areas?"); on confirm, re-searches and either shows Match Results (labeled with which area matched) or the Empty State if still nothing.

### Flow 2 — Rohan gets an SMS that someone nearby needs his blood type (realizes UJ-2)

1. Rohan, registered O-negative in Gulberg and DHA, is not in the app at all when this happens.
2. He receives an SMS and an email the instant Amara's search (Flow 1, step 5) completes: *"Amara (03xx-xxxxxxx) needs O-negative blood in Gulberg. Call her directly if you're able to help."* `[ASSUMPTION: exact notification copy not specified in PRD — drafted here in the same calm, direct voice as in-app copy; owned jointly by UX/PM, not architecture.]`
3. He decides he's willing and available, and calls Amara directly — entirely outside the app.
4. **Climax:** Rohan and Amara connect directly, possibly before Amara even reaches him from her own call list — both sides were moving at once.
5. Later, if Rohan donates, he's expected to return via Flow 4 (self-service) to update his last-donation date so he drops out of matches for the next 90 days.

### Flow 3 — Priya registers as a donor for the first time (realizes UJ-3)

1. Priya opens the app, taps "I want to help" on Home.
2. Donor Registration: enters name, phone, email (optional — labeled "so you also get an email alert, not just SMS" `[ASSUMPTION: exact helper copy explaining why email is asked; per PRD §4.4 a Donor without email gets SMS-only, so the field must read as optional, not broken.]`), blood type (B-positive), taps Area chips for Model Town and Iqbal Town, enters her last donation date (or "Never / not recently").
3. Taps Submit → Donor OTP Verify: enters the 6-digit code sent to her phone.
4. **Climax:** Registration Confirmation shows her status badge ("Eligible now") and her selected Areas (Model Town, Iqbal Town) — she can see exactly how she'll appear to a future Searcher.
5. She's now discoverable — name and phone visible to any Searcher matching blood type + one of her Areas — until she changes or deletes her registration (Flow 4).

Edge case: missing blood type, phone, or Area at step 2 → inline field error per FR-1, not a blocked silent submit.

### Flow 4 — Priya logs a new donation and later deletes her registration (realizes UJ-4)

1. Priya returns to the app, taps "Manage my registration" on Home.
2. Self-Service Entry: enters her registered phone number, requests OTP.
3. Self-Service OTP Verify: enters the code → Self-Service Dashboard unlocks — showing only her own registration, per FR-9.
4. **Two later, separate visits, same entry point:**
   - *Two months after registering:* she taps "Update donation date," enters today's date. Dashboard immediately reflects her new cooldown badge ("Eligible again on [date + 90 days]") — she's excluded from Match results starting now (FR-10).
   - *A year later, moving abroad:* she taps "Delete registration" → Delete Confirmation ("This can't be undone.") → confirms → registration is gone immediately and permanently (FR-11).
5. **Climax:** In both cases, the Dashboard reflects her new state instantly — proof the system heard her without needing to trust a background process.
