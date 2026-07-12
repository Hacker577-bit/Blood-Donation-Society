# Deferred Work

## Deferred from: code review of 2-1-searcher-verifies-identity-via-otp (2026-07-11)

- Rate limiting is IP-only, not phone-based — a distributed-IP SMS-bomb against one victim phone isn't blocked (`app/actions/requestSearcherOtp.ts:47-65`). Pre-existing AD-3 design from Story 1.2; PRD §4.6 explicitly scopes IP-only rate limiting for MVP and flags phone-based throttling as a post-launch revisit.
- `ipAddress()` "unknown" fallback collapses all IP-less clients into one shared rate-limit bucket (`app/actions/requestSearcherOtp.ts:47`). Identical pattern present in `registerDonor.ts`/`requestDonorOtp.ts` since Stories 1.1/1.3.
- No rate-limiting or lockout on `verifySearcherOtp` itself — the 6-digit code is brute-forceable via repeated verify calls, even though `OtpChallenge.attempts` is tracked (`app/actions/verifySearcherOtp.ts`; `lib/domain/otp.ts`). Identical gap in `verifyDonorOtp.ts` since Story 1.3; no lockout enforcement exists anywhere in the shared `otp` service yet.
- Server Actions calling out to Redis/Twilio (`requestSearcherOtp`, and pre-existing `requestDonorOtp`/`registerDonor`) have no try/catch around those calls — an outage surfaces as an unstyled framework error rather than a graceful message (`app/actions/requestSearcherOtp.ts:56-65`). Identical pattern since Stories 1.1/1.3.
- `sessionStore.consume`'s get-then-decr has a small non-atomic race window (TTL could expire between the two calls) (`lib/infra/sessionStore.ts:8-16`). Already explicitly accepted as an MVP trade-off in Story 2.1's own Dev Notes ("acceptable here — single-user, budget-of-2 flows, not a high-concurrency resource").
