---
title: Blood Donor Availability Matcher
status: final
created: 2026-07-06
updated: 2026-07-06
---

# PRD: Blood Donor Availability Matcher
*Working title — confirm.*

## 0. Document Purpose

This PRD defines the MVP for the Blood Donor Availability Matcher, an internal-org tool scoped to Lahore. It is written for the PM, the org stakeholders approving the build, and the downstream UX/architecture/epics workflows that will consume it. Structure: vocabulary is Glossary-anchored (§3), features are grouped with functional requirements (FRs) nested and globally numbered, and every place this document had to infer without direct confirmation is tagged inline `[ASSUMPTION]` and indexed in §9. No prior product brief, UX spec, or architecture doc exists yet — this is the founding artifact. `[ASSUMPTION: the deploying organization's name and exact user scale were not specified — this PRD is written generically for "the org" and should be updated once known.]`

## 1. Vision

During a blood emergency, people currently scramble through informal WhatsApp groups, forwarded messages, and cold calls to find someone with the right blood type nearby — with no way to know who's actually eligible to donate right now, or whether a number still works. The Blood Donor Availability Matcher replaces that scramble with a structured, always-current registry scoped to Lahore: willing donors register once and stay discoverable by locality (until they've recently donated or choose to leave), and anyone in an emergency can search by blood type and area and immediately see every eligible, matching donor's name, phone number, and area — no waiting, no intermediary.

To maximize the odds a donor actually sees the request in time, the system also proactively notifies every matching donor by SMS and email the moment a search is submitted — so both sides can move: the searcher can call any donor on the list directly, and a notified donor can reach out first if they see the request before being called.

This is a deliberate trade toward speed and directness over the anonymized, broadcast-only model considered earlier in this PRD's drafting `[NOTE FOR PM: this reverses a privacy-preserving design considered earlier for donor-privacy reasons — see Constraints & Guardrails › Privacy for the trade-off this reintroduces.]`. For the org deploying it, this is a lightweight, low-cost, Lahore-specific coordination layer — no paid mapping API, no geolocation permission friction, no WhatsApp Business API — built to get a searcher to a real, reachable, eligible donor as fast as possible.

## 2. Target User

### 2.1 Jobs To Be Done

**Searchers (people seeking blood during an emergency):**
- Find someone with a compatible blood type in my area, right now, without relying on a chain of WhatsApp forwards.
- See real contact information immediately, so I can start calling without waiting on anyone else's action.
- Know quickly whether *anyone* eligible is listed nearby, so I can decide whether to widen my search elsewhere (blood bank, hospital, wider social network).

**Donors (people willing to be found):**
- Be discoverable when I'm actually eligible, and invisible when I'm not (i.e., recently donated).
- Be reachable by the areas I actually travel to, not just where I live.
- Hear about a nearby request even if I'm not actively checking the app.
- Keep my status current with minimal effort, and leave the registry entirely if I no longer want to participate.

### 2.2 Non-Users (v1)

- Hospitals, blood banks, and blood-drive organizers — no institutional integration in v1 (see §6.2).
- Anyone outside Lahore — the area list is Lahore-specific in v1; no other city is supported.
- Anyone needing donation-history verification (e.g. for medical/legal proof of past donation) — this product is a discovery/matching layer, not a verified donation record.

### 2.3 Key User Journeys

- **UJ-1. Amara searches for a nearby donor during a family emergency.**
  - **Persona + context:** Amara's father needs O-negative blood urgently at a hospital in Gulberg; the hospital's own stock is short.
  - **Entry state:** Unauthenticated, on her phone browser, no prior account needed.
  - **Path:** Opens the app → enters her own name and phone number → verifies it via a quick OTP → selects blood type O-negative and area "Gulberg" → sees the full list of eligible donors matching (name, phone, area) → picks the first one and calls directly.
  - **Climax:** She reaches a donor on the first or second call, because the list gave her real, current contact info immediately.
  - **Resolution:** If a donor she calls agrees, she coordinates directly; the app's job is done. Meanwhile, the matched donors have also received an SMS and email about her request, so some may call her first.
  - **Edge case:** The OTP step adds one extra round-trip before results appear — worth watching against the 30-second success target (see §7 SM-2 note).
  - **Edge case:** No eligible donor found in Gulberg — the app suggests expanding to nearby areas; if still nothing after that, she sees a clear, worded empty state rather than a dead end (§4.3).

- **UJ-2. Rohan gets an SMS that someone nearby needs his blood type.**
  - **Persona + context:** Rohan, O-negative, registered as a donor in Gulberg and DHA three months ago and hasn't donated since.
  - **Entry state:** Not in the app at all — this happens via SMS/email.
  - **Path:** Receives an SMS and email: "Amara (03xx-xxxxxxx) needs O-negative blood in Gulberg." → decides he's willing and available → calls Amara directly.
  - **Climax:** Rohan and Amara connect directly, possibly before Amara even reaches him from her own call list.
  - **Resolution:** If Rohan donates, he's expected to self-update his last-donation date (UJ-4) so he drops out of matches for the next 90 days.

- **UJ-3. Priya registers as a donor for the first time.**
  - **Persona + context:** Priya wants to be discoverable as a B-positive donor across the parts of Lahore she can realistically travel to.
  - **Entry state:** Unauthenticated, first visit.
  - **Path:** Fills in name, phone, blood type, last donation date (or "never / not recently") → selects one or more areas from the predefined Lahore dropdown (e.g. Model Town and Iqbal Town) → receives an OTP to verify her phone → enters the OTP → registration is live.
  - **Climax:** Confirmation screen shows her current eligibility status ("Eligible now" or "Eligible again on [date]") and the areas she's listed under.
  - **Resolution:** She's now discoverable — with her name and phone visible to any Searcher who matches her blood type and one of her selected areas — until she updates or deletes her registration.

- **UJ-4. Priya logs a new donation and later deletes her registration.**
  - **Persona + context:** Priya donates blood two months after registering, and a year later moves abroad and wants to be removed entirely.
  - **Entry state:** Returning to the app, not logged in (no persistent session by design).
  - **Path:** Requests an OTP to her registered phone number → verifies it → sees her own registration → updates last-donation date (resets her 90-day eligibility clock) or taps delete (immediate, permanent removal).
  - **Climax:** The registration reflects her new state instantly — either newly ineligible until the date passes, or gone entirely.
  - **Resolution:** She's excluded from search results accordingly.

## 3. Glossary

- **Donor** — A registered person willing to be matched for blood donation. Has a Blood Type, one or more Areas, and a Last Donation Date. Name and phone number are visible to any Searcher who matches on blood type and Area.
- **Searcher** — A person who registers their own name and phone number, verifies it via OTP, then submits a Search.
- **Blood Type** — One of the standard ABO/Rh blood group values (e.g. O-negative). Primary match key between Donor and Search.
- **Area** — One of ten predefined Lahore localities (Johar Town, DHA, Gulberg, Model Town, Bahria Town, Cantt, Iqbal Town, Garden Town, Wapda Town, Faisal Town). A Donor may select multiple Areas; a Search specifies exactly one Area as its starting point.
- **Eligibility Window** — The 90-day period after a Donor's Last Donation Date during which they are excluded from Match results.
- **Match** — A Donor who is eligible, shares the requested Blood Type, and has the searched Area (or an expanded nearby Area, per FR-6) among their selected Areas.
- **Search** — A Searcher's submitted blood type + Area (+ their own name and phone number), which returns the full list of current Matches and simultaneously triggers Notifications to those Matches.
- **Notification** — The SMS and email sent to a Match at the moment a Search is submitted, informing them of the Searcher's name, phone number, blood type needed, and Area.
- **OTP (One-Time Password)** — A short code sent to a phone number to verify ownership. Required at Donor registration, to start a Donor self-service session, and now at Searcher registration before a Search can be submitted.

## 4. Features

### 4.1 Donor Registration

**Description:** A prospective Donor provides their name, phone number, blood type, one or more Areas (from the predefined Lahore dropdown), and last donation date (or indicates they've never donated / don't recall). Phone number is verified via OTP before the registration becomes active — both to prevent fake/junk registrations and to establish the identity check reused later for self-service (§4.5). Realizes UJ-3.

**Functional Requirements:**

#### FR-1: Donor submits registration details
A prospective Donor can submit name, phone number, blood type, one or more Areas, and last donation date (optional/unknown) to create a Donor record. Realizes UJ-3.

**Consequences (testable):**
- Registration is rejected with a clear inline error if blood type, phone, or at least one Area is missing.
- A Donor can select more than one Area; the record matches a Search on any of them.
- A Donor record is not searchable until phone verification (FR-2) completes.

#### FR-2: Donor verifies phone via OTP
A prospective Donor can verify ownership of the submitted phone number by entering an OTP sent to that number. Realizes UJ-3.

**Consequences (testable):**
- OTP expires after a short, fixed window `[ASSUMPTION: exact expiry not specified — e.g. ~5 minutes, to be finalized in architecture.]`
- Registration only becomes active/searchable after successful OTP verification.
- A Donor can request OTP resend, rate-limited (see §4.6).

**Out of Scope:** Full account/password authentication — OTP is the only identity mechanism, no persistent login session.

### 4.2 Eligibility

**Description:** The system continuously derives each Donor's eligibility from their last donation date, rather than requiring the Donor to manually toggle a status. A Donor who forgets to update anything still ages back into eligibility automatically once 90 days pass.

**Functional Requirements:**

#### FR-3: System computes donor eligibility
The system determines a Donor eligible when today's date minus their Last Donation Date is 90 days or more, or when no Last Donation Date is on record.

**Consequences (testable):**
- A Donor who registered 89 days after donating is excluded from Match results; on day 90 they appear automatically without any action on their part.
- Eligibility is computed at query time, not stored as a stale flag.

#### FR-4: Ineligible donors are excluded from search — never shown as fallback
Ineligible Donors never appear in Match results for any Search, at the searched Area or any expanded nearby Area, regardless of blood type.

**Consequences (testable):**
- A Search for a blood type held only by ineligible Donors returns zero Matches (triggers the area-expansion/empty-state path in §4.3), not a false match.

### 4.3 Search & Area Expansion

**Description:** A Searcher first provides their own name and phone number and verifies it via OTP, then selects the blood type needed and one Area from the predefined Lahore dropdown. The system returns the full list of current Matches — name, phone number, and Area for each — so the Searcher can start contacting donors immediately through any channel they prefer. If no Match exists in the selected Area, the system suggests expanding to nearby areas; if still nothing, the Searcher sees a clear, informative empty state rather than a dead end. Realizes UJ-1.

**Functional Requirements:**

#### FR-5: Searcher registers, verifies via OTP, and submits a search
A Searcher can provide their name and phone number, verify it via an OTP sent to that number, then submit a blood type and one Area to search for eligible Matches. Realizes UJ-1.

**Consequences (testable):**
- The Match list is not returned, and no Notification is triggered, until the Searcher's OTP verification succeeds — this is the sole gate on the abuse/cost vector identified in review (unauthenticated searches previously could trigger real SMS/email spend at will).
- OTP behavior mirrors the Donor's (FR-2): short fixed expiry, resendable, rate-limited (§4.6).
- The full Match list (name, phone, Area) is returned directly to the Searcher — not anonymized — once verified.

**Feature-specific NFRs:**
- The added OTP round-trip should not push total search time past the 30-second target in SM-2 — `[NOTE FOR PM: if OTP delivery latency threatens this target, consider a longer-lived Searcher verification (e.g. valid for the browser session) rather than re-verifying every search.]`

#### FR-6: System suggests expanding to nearby areas when no match exists
Given a Search with zero Matches in the selected Area, the system suggests expanding the search to nearby areas and, on Searcher confirmation, re-searches those areas. Realizes UJ-1.

**Consequences (testable):**
- The Searcher sees which area(s) ultimately produced results.
- `[ASSUMPTION: the "nearby areas" adjacency mapping between Lahore's ten localities is not yet defined — flagged as Open Question 1.]`

#### FR-7: System shows a clear empty state when no match exists
When no eligible Donor of the requested blood type exists in the selected Area or its nearby areas, the Searcher sees an explicit, non-blocking empty state explaining no match was found and suggesting next steps (e.g. try another area, contact a blood bank). Realizes UJ-1.

**Consequences (testable):**
- The system never returns a generic error, blank screen, or silent timeout in this case — the empty state is a designed, worded screen.
- Ineligible donors are never substituted in as a fallback (FR-4).

### 4.4 Donor Notification

**Description:** The moment a Search is submitted, the system automatically sends an SMS (via Twilio) and an email (via SendGrid) to every current Match, containing the Searcher's name, phone number, blood type needed, and Area. This runs in parallel with the Searcher receiving the full Match list (§4.3) — both sides get what they need at the same instant. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-8: System notifies matched donors by SMS and email on search submission
The instant a Search returns one or more Matches, the system sends both an SMS and an email to each Match containing the Searcher's name, phone number, blood type needed, and Area. Realizes UJ-2.

**Consequences (testable):**
- Notification firing does not delay the Searcher's own result — the Match list (§4.3) is returned to the Searcher without waiting on SMS/email delivery confirmation.
- A Donor without a registered email address on file receives SMS only `[ASSUMPTION: email is optional at registration — see §9]`.

**Feature-specific NFRs:**
- SMS delivery depends on Twilio; email delivery depends on SendGrid. Both are external dependencies (see Constraints & Guardrails, Cost).

**Out of Scope:** In-app chat or reply/delivery-receipt tracking — the Notification is fire-and-forget from the app's perspective; any resulting contact happens by phone call, outside the app.

### 4.5 Donor Self-Service

**Description:** A Donor can return at any time to update their last donation date or delete their registration entirely, without a persistent login — each session is authenticated fresh via OTP to the Donor's registered phone number. Realizes UJ-4.

**Functional Requirements:**

#### FR-9: Donor starts a self-service session via OTP
A Donor can request and verify an OTP to their registered phone number to access their own registration.

**Consequences (testable):**
- The OTP session grants access only to the registration matching that verified phone number, not any other Donor's data.

#### FR-10: Donor updates their last donation date
An authenticated Donor can log a new last donation date, which resets their 90-day Eligibility Window. Realizes UJ-4.

**Consequences (testable):**
- Immediately after update, the Donor is excluded from Match results until 90 days from the new date have passed (FR-3).

#### FR-11: Donor deletes their own registration
An authenticated Donor can permanently delete their registration. Realizes UJ-4.

**Consequences (testable):**
- A deleted Donor record is immediately and permanently excluded from all future Match results.
- Deletion is not reversible; no soft-delete/undo in MVP `[ASSUMPTION].`

### 4.6 Abuse Prevention

**Description:** Baseline protection against automated abuse of registration, search, and OTP endpoints, scoped to MVP simplicity.

**Functional Requirements:**

#### FR-12: System rate-limits requests per IP address
The system limits the rate of registration submissions, searches, and OTP requests per originating IP address.

**Consequences (testable):**
- Requests beyond the threshold receive a clear rate-limit response rather than being silently dropped or crashing the service.
- `[ASSUMPTION: exact thresholds not specified — to be set during architecture/implementation. See Open Question 3.]`

**Out of Scope:** CAPTCHA, device fingerprinting, or account-based (as opposed to IP-based) throttling — `[NOTE FOR PM: revisit if per-IP limiting proves insufficient once live, especially since every search now fires real SMS/email sends that cost money or count against free-tier quotas.]`

## 5. Non-Goals (Explicit)

- This product does not verify that a donation actually occurred — it is a discovery/matching layer, not a medical or legal record.
- This product does not mediate or track the outcome of a Donor–Searcher connection — what happens next (call, no response, actual donation) happens outside the app.
- This product does not integrate with hospital or blood bank systems, inventory, or scheduling in v1.
- This product does not provide in-app messaging/chat — all contact happens by phone call, outside the app.
- This product does not use GPS/browser geolocation or any distance calculation (Haversine or otherwise) — matching is by predefined Area only.
- This product does not use any paid mapping API, and does not use WhatsApp in any form (neither Business API nor `wa.me` links) — SMS and email are the only notification channels.
- This product supports Lahore only — no other city's areas are modeled in v1.

## 6. MVP Scope

### 6.1 In Scope
- Donor registration with OTP phone verification and multi-Area selection (§4.1)
- Automatic eligibility computation from last donation date (§4.2)
- Blood-type + Area search returning the full Match list (name, phone, Area) directly to the Searcher (§4.3)
- Area-expansion suggestion on no-match, then a designed empty state (§4.3)
- Automatic SMS (Twilio) + email (SendGrid) Donor Notification on every search submission (§4.4)
- Donor self-service: update donation date, delete registration, both OTP-gated (§4.5)
- Basic per-IP rate limiting (§4.6)

### 6.2 Out of Scope for MVP
- In-app chat between Searcher and Donor — contact happens by phone call, outside the app.
- Hospital or blood-bank system integration — deferred to a later phase if the org pursues institutional partnerships.
- Donation verification (proof a donation actually happened) — no mechanism in v1.
- GPS/browser geolocation, Haversine distance calculation, or any paid mapping API — replaced entirely by predefined Area matching.
- WhatsApp in any form (Business API or `wa.me` links) — superseded by SMS + email.
- Support for any city other than Lahore.
- Persistent Searcher accounts — Searchers OTP-verify per search (FR-5), but there is no login/session beyond that.

## 7. Success Metrics

**Primary**
- **SM-1**: A Donor completes registration, including OTP verification and Area selection, in under 60 seconds. Validates FR-1, FR-2.
- **SM-2**: A Searcher receives a result — the full Match list, or the empty state — within 30 seconds of starting a search, *including* OTP verification. Validates FR-5, FR-6, FR-7. `[NOTE FOR PM: OTP delivery latency is now inside this budget — see FR-5 NFR note; monitor once real SMS delivery is in place.]`

**Secondary**
- **SM-3**: Percentage of Searches that produce at least one Match in the selected Area or its nearby areas. Validates FR-6, FR-7.
- **SM-4**: Percentage of notified Donors who are contacted or who reach out first (self-reported or inferred from a subsequent donation-date update). Validates FR-8.

**Counter-metrics (do not optimize)**
- **SM-C1**: Donor opt-out / self-deletion rate following Notifications. A rising rate signals notification fatigue or discomfort with having phone number exposed directly to Searchers — do not chase SM-3/SM-4 at the expense of donor trust. Counterbalances SM-3, SM-4.
- **SM-C2**: Rate of Donors who never update a stale last-donation date (silently making the registry look more available than it is).

## 8. Open Questions

1. What "nearby areas" adjacency exists between Lahore's ten predefined localities, for the area-expansion suggestion in FR-6 (e.g. is Model Town "nearby" to Iqbal Town)?
2. Is a Donor's email address required at registration, or optional (Donor receives SMS-only if absent)?
3. What are the concrete per-IP rate-limit thresholds (requests per time window) for registration, search, and OTP — especially important since every search now triggers a real, cost-incurring SMS + email send?
4. What is the deploying organization's name, and what is the expected scale (number of Donors/Searchers) the system should be sized for — relevant to whether Twilio/SendGrid free tiers will suffice (see Constraints & Guardrails › Cost)?
5. Are there formal data-protection or compliance requirements (Pakistani PII/data-protection law, health-data handling rules) that apply to storing and directly displaying phone numbers, names, and blood type?
6. Should Searcher OTP verification persist for the browser session (verify once, search multiple times) or re-verify on every individual search? Affects both UX friction and the SM-2 time budget.

## 9. Assumptions Index

- §0 — Organization name and exact user scale not specified; PRD written generically.
- §4.1 (FR-2) — OTP expiry window not specified; assumed short and fixed (e.g. ~5 minutes).
- §4.4 (FR-8) — Donor email address assumed optional at registration; Donors without one get SMS only (Open Question 2).
- §4.3 (FR-6) — "Nearby areas" adjacency between the ten Lahore localities not yet defined (Open Question 1).
- §4.5 (FR-11) — Registration deletion assumed permanent/non-reversible, no soft-delete or undo.
- §4.6 (FR-12) — Exact rate-limit thresholds not specified; deferred to architecture/implementation (Open Question 3).
- Integration and Dependencies — OTP delivery channel assumed to reuse Twilio SMS (not re-specified after the WhatsApp-to-Twilio/SendGrid switch).

---

## Constraints and Guardrails

**Privacy**
- This design directly exposes a Donor's name and phone number to any Searcher who matches on blood type and Area — a deliberate reversal of an earlier, more privacy-preserving broadcast-only design considered during this PRD's drafting. `[NOTE FOR PM: the research digest gathered during discovery (see addendum.md) found raw phone-number exposure is the leading driver of donor attrition and privacy anxiety in comparable donor directories (e.g. 67% of donors in one study worried about contact-info misuse). This trade-off is accepted here for speed and directness — worth revisiting if donor churn or complaints emerge post-launch.]`
- Similarly, a Searcher's own name and phone number is sent to every matched Donor via Notification (§4.4) — symmetric exposure, not one-directional.
- **Data handling baseline (MVP):** name, phone number, blood type, and Area are the only fields ever displayed or transmitted — no address, no ID/CNIC, no medical history beyond last donation date. Data is retained only as long as the Donor's registration is active (deleted immediately on FR-11) or, for Searchers, only as long as needed to deliver that search's Notifications. `[NOTE FOR PM: this is a working baseline, not a compliance sign-off — Open Question 5 (formal PII/data-protection law) is still unresolved and should be confirmed before launch.]`

**Safety**
- Searcher OTP verification (FR-5) plus per-IP rate limiting (§4.6) together gate the real, cost-incurring SMS/email sends triggered by every search — `[NOTE FOR PM: revisit stronger throttling if abuse is still observed post-launch despite OTP-gating.]`
- OTP-gating on Donor registration and self-service reduces fake/junk Donor records.

**Cost**
- **Twilio (SMS):** free-trial accounts can only send to phone numbers manually verified in the Twilio console — it will not reach real donors' numbers until the account is upgraded to a paid plan. `[NOTE FOR PM: this is a functional blocker for real-world use of FR-8's SMS channel, not just a cost concern — needs resolving before launch, regardless of the "free trial only" plan.]`
- **SendGrid (email):** free tier caps daily send volume (subject to current SendGrid terms) — worth confirming against expected search volume before launch (Open Question 4).

## Integration and Dependencies

- **Twilio** — SMS delivery for Donor Notifications (§4.4) and possibly Donor OTP delivery `[ASSUMPTION: OTP delivery channel — SMS vs. another method — not respecified after the WhatsApp-to-Twilio/SendGrid switch; assumed Twilio SMS is reused for OTP too.]`
- **SendGrid** — email delivery for Donor Notifications (§4.4).
- **Predefined Area list** — a static, Lahore-specific configuration (ten localities), no external API or geocoding dependency.
- No browser Geolocation API, no mapping/geocoding API, no WhatsApp integration of any form.
