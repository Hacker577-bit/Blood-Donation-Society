# Addendum: Blood Donor Availability Matcher

*Technical-how and supplementary context volunteered during PRD discovery that doesn't belong in the PRD's capability-level narrative. For architecture/solution-design consumption.*

## Tech Stack (stakeholder-specified)

- **Backend:** Python, Flask
- **Database:** PostgreSQL
- **Frontend:** A polished, high-quality ("exquisite") web frontend — stakeholder explicitly ruled out any 3D visual treatment. No specific framework named; open for architecture/UX to propose.
- **Location/matching:** Predefined dropdown of ten Lahore localities, exact-match only. No geocoding, no distance calculation, no Haversine, no lat/long storage, no browser geolocation permission.
- **Notifications:** Twilio (SMS, free trial) + SendGrid (email, free tier), both fired automatically on search submission.

## Decision History — Contact & Location Model (superseded twice)

This PRD's contact and location model changed twice during drafting. Recorded here so architecture/UX understand the final state is a deliberate, considered choice, not an oversight:

1. **v0 (initial brain dump):** direct contact reveal — searcher sees matched donor's phone number. Location via browser geolocation + Haversine distance, radius auto-widening 15km→30km→50km.
2. **v1 (mid-discovery revision):** superseded v0 for privacy reasons. Switched to a broadcast-only model — searcher shares their own contact number, system notifies matching donors via WhatsApp, donor decides whether to reach out; donor's number never shown to searcher. Reason: research into comparable donor directories (Friends2Support, eRaktKosh, community WhatsApp groups) surfaced donor-privacy concerns and stale/raw-number exposure as the leading cause of donor attrition from such registries.
3. **v2 (final, current PRD):** superseded v1. Reverted to direct contact reveal (donor list with name/phone/area shown to searcher) for speed/directness, layered with automatic dual-channel notification (SMS + email, not WhatsApp) to matched donors at search time. Location switched from geolocation/Haversine to a predefined Lahore-only area dropdown, exact match, no distance math. Stakeholder decision, explicitly marked "not open for change." The privacy risk identified in v1's research still applies to v2's model — see PRD Constraints & Guardrails › Privacy for the `[NOTE FOR PM]` flag carried forward.

## Notification Channel Trade-off

- Stakeholder considered a `wa.me` pre-filled-link approach (no WhatsApp Business API needed, searcher manually clicks per-donor) as an intermediate step, then finalized on **Twilio SMS + SendGrid email**, both firing automatically server-side on search submission — no manual click-through, no WhatsApp involvement at all in the final design.
- **Real risk, not just a cost note:** Twilio's free-trial tier can only send SMS to phone numbers manually verified in the Twilio console. It will not reach arbitrary real donor numbers until the account is upgraded to paid. This needs resolving before any real-world pilot, independent of budget — flagged in the PRD's Constraints & Guardrails as a functional blocker, not merely a cost concern.
- SendGrid's free tier has a daily send-volume cap; architecture should size expected search volume against it before launch.

## Landscape Research Digest (for context)

- **Friends2Support.org** (India) — 400K+ donor DB, OTP-verified registration, stale-donor reporting flag.
- **eRaktKosh** (India govt) — enforces 90-day (male) / 120-day (female) donation interval; donor-controlled contact permissions.
- **BloodConnect** — open-source, smart matching by blood type + geo-proximity + urgency.
- **Facebook Blood Donation Tool** (2017–19) — opt-in donor flag, drive/shortage push notifications, 35M+ registrations globally; centered on blood-bank/drive matching rather than peer-to-peer direct contact.
- **Common pitfalls observed:** stale/disconnected donor numbers causing no-shows; donor privacy anxiety (67% in one study worried about contact info misuse); commercialization skepticism toward donor-directory apps; fake/duplicate registrations.
- **Usage pattern:** emergency-driven and spiky, not daily-active — relevant to how success should be measured (time-to-match during a crisis, not engagement frequency).
