---
name: Lifeline Lahore
description: Emergency blood-donor matching for Lahore. Calm competence under pressure — a form, not a siren.
status: draft
updated: 2026-07-06
sources:
  - "{planning_artifacts}/prds/prd-BloodDonorApp-2026-07-06/prd.md"
colors:
  surface-base: '#F7F7F6'
  surface-raised: '#FFFFFF'
  ink-primary: '#1B1D1F'
  ink-secondary: '#5D6167'
  ink-disabled: '#A6ABB1'
  border-hairline: '#E2E4E7'
  accent: '#0B5D67'
  accent-hover: '#08454C'
  accent-on: '#FFFFFF'
  status-success: '#1E7A4C'
  status-success-bg: '#E6F4EC'
  status-caution: '#9A6400'
  status-caution-bg: '#FBF0DA'
  status-error: '#B3261E'
  status-error-bg: '#FBEAE9'
typography:
  fontFamily:
    note: 'System font stack (system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif) — no webfont download, fastest first paint on variable-quality mobile networks. [ASSUMPTION: no brand typeface specified in PRD.]'
  display:
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.2
  heading:
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-large:
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0.02em
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  '7': 48px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
components:
  button-primary:
    background: '{colors.accent}'
    background-hover: '{colors.accent-hover}'
    text: '{colors.accent-on}'
    rounded: '{rounded.md}'
    fontSize: '{typography.body.fontSize}'
    fontWeight: 600
    minHeight: 48px
  input-field:
    background: '{colors.surface-raised}'
    border: '{colors.border-hairline}'
    borderFocus: '{colors.accent}'
    text: '{colors.ink-primary}'
    rounded: '{rounded.sm}'
    minHeight: 48px
  otp-input:
    background: '{colors.surface-raised}'
    border: '{colors.border-hairline}'
    borderFocus: '{colors.accent}'
    text: '{typography.heading}'
    rounded: '{rounded.sm}'
    digitBoxSize: 48px
  donor-match-card:
    background: '{colors.surface-raised}'
    border: '{colors.border-hairline}'
    rounded: '{rounded.md}'
    nameText: '{typography.body-large}'
    phoneText: '{typography.body-large}'
    areaText: '{typography.meta}'
  status-badge-eligible:
    background: '{colors.status-success-bg}'
    text: '{colors.status-success}'
    rounded: '{rounded.full}'
  status-badge-cooldown:
    background: '{colors.status-caution-bg}'
    text: '{colors.status-caution}'
    rounded: '{rounded.full}'
  area-chip:
    background: '{colors.surface-raised}'
    border: '{colors.border-hairline}'
    backgroundSelected: '{colors.accent}'
    textSelected: '{colors.accent-on}'
    rounded: '{rounded.full}'
  empty-state:
    background: '{colors.surface-base}'
    icon: 'none — text-led, not illustration-led'
    text: '{typography.body}'
  resend-otp-link:
    textInactive: '{colors.ink-disabled}'
    textActive: '{colors.accent}'
    fontSize: '{typography.meta.fontSize}'
    underline: false
---

## Brand & Style

`[ASSUMPTION: no brand identity was specified in the PRD or by stakeholders — this is a first proposal, open to revision in a later Update pass.]`

Lifeline Lahore is designed for one emotional state: a person under real stress, on a phone, who needs an answer in seconds — and a donor who might be interrupted by a notification at any moment. The posture is **calm competence**, not alarm. This is deliberately *not* red-siren, hospital-clinical, or startup-playful. It looks like a well-run desk, not a klaxon.

Two colors carry almost the entire interface: a warm, quiet neutral surface, and a single deep teal accent reserved for the moments that matter — submitting a search, confirming a registration, calling a donor. Status (eligible, cooling down, error) is carried by a small, consistent semantic palette so a stressed user never has to interpret ambiguous color — text always accompanies color, never stands alone.

Legibility beats decoration everywhere. Phone numbers and names — the two facts a Searcher is scanning for — are set slightly larger than standard body text, because they're the reason the user opened the app.

## Colors

- **Surface Base (`#F7F7F6`)** — the page background. Quiet, slightly warm, never stark white-on-white with cards.
- **Surface Raised (`#FFFFFF`)** — cards, inputs, the donor match list. One step up from base, no shadow needed to read as "above."
- **Ink Primary (`#1B1D1F`)** — primary text. Near-black, not pure black, for reduced glare in bright outdoor light (a Searcher may well be outside a hospital).
- **Ink Secondary (`#5D6167`)** — supporting text: area labels, timestamps, helper copy.
- **Accent — "Lifeline Teal" (`#0B5D67`)** — the *only* chromatic color used for action: primary buttons, links, the OTP field focus ring, selected area chips. `[ASSUMPTION: deliberately not blood-red — red is reserved entirely for error/ineligible states below, so a stressed user is never asked to distinguish "the button to press" from "something is wrong."]`
- **Status Success (`#1E7A4C`)** — "Eligible now" badge, OTP-verified confirmation.
- **Status Caution (`#9A6400`)** — "Eligible again on [date]" cooldown badge, OTP resend countdown.
- **Status Error (`#B3261E`)** — validation errors, rate-limit messages, failed OTP.

Avoid: red or amber as a call-to-action fill (reserved for status only), gradients, decorative illustration in place of real information, any color-only status signal without accompanying text.

## Typography

System font stack — no webfont fetch, since first-paint speed matters on variable mobile networks in Lahore and this app has no persistent session to amortize a font download across visits. `[ASSUMPTION: no brand typeface given.]`

`display` is reserved for the single confirmation/climax moment on each flow (e.g. the eligibility confirmation after registration). `heading` labels each screen. `body-large` is reserved specifically for donor names and phone numbers in match results — the two pieces of information a Searcher came for. Standard `body` for everything else; `meta` for area tags and timestamps; `label` for form field labels (uppercase-adjacent weight, not literal caps — see Do's and Don'ts).

## Layout & Spacing

Scale: 4 / 8 / 12 / 16 / 24 / 32 / 48px. Mobile margin 16px; desktop content column capped and centered with 32px margin — this is a form-and-list app, not a dashboard, so no multi-column desktop layout is needed. `[ASSUMPTION: desktop is "the same single-column flow, wider margins" — not a distinct desktop IA, since the underlying task (fill a form, scan a list) doesn't benefit from extra columns.]`

Vertical rhythm: generous spacing (24px+) between form sections so a stressed user can visually parse "what step am I on," tighter spacing (8–12px) within a single donor-match-card so name/phone/area read as one unit.

## Elevation & Depth

Minimal. Cards are distinguished from the base surface by the base/raised color step, not by shadow — a single, very soft `0 1px 3px rgba(0,0,0,0.06)` may be used on the donor-match-card only, to help it read as tappable/scannable in a list. No shadow elsewhere. No modals stacked more than one level deep.

## Shapes

`rounded/sm` (8px) for inputs and the OTP digit boxes. `rounded/md` (12px) for cards and buttons. `rounded/full` for status badges and area-selection chips — pill shapes read clearly as "selectable/tag-like" versus the rectangular cards holding factual content.

## Components

- **Button (primary)** — Full-width on mobile, min-height 48px (comfortable tap target under stress, works one-handed). One primary button visible per screen; never two competing primary actions.
- **Input field** — Label above field (not placeholder-only — placeholder-as-label disappears exactly when a stressed user needs it most). Inline error below field, in `status-error`, with an icon-free plain-text message.
- **OTP input** — Six discrete digit boxes, large touch targets, numeric keyboard auto-invoked on mobile. Resend link appears as plain text after a visible countdown, not disabled-then-mysteriously-enabled.
- **Donor match card** — Name and phone in `body-large`, area as a small `meta`-styled tag. Phone number is a tap-to-call link, styled to look tappable but not like a generic hyperlink (no underline; subtle accent-tinted background chip instead).
- **Status badge** — Pill, always paired with explicit text ("Eligible now" / "Eligible again on 4 Oct"), never color alone.
- **Area chip** — Multi-select (registration) or single-select (search), pill-shaped, clear selected/unselected contrast.
- **Empty state** — Text-led. No decorative illustration — a plain, clearly worded message and a next-step action (expand area / contact a blood bank), because an illustrated "sad face" register as flippant against a real blood shortage.
- **Resend OTP link** — Plain text, no button chrome, no underline. `ink-disabled` while counting down (paired with visible countdown text), switches to `accent` and becomes tappable at zero — the color change alone is reinforced by the text changing from "Resend in 0:45" to "Resend code," never color-only.

## Do's and Don'ts

| Do | Don't |
|---|---|
| One accent color, reserved for action | Use accent color for status or vice versa |
| Text-paired status badges | Color-only status indicators |
| Large, legible phone numbers and names | Truncate the two facts a Searcher came for |
| Plain-language inline errors | Technical error codes or jargon |
| Single primary action per screen | Competing CTAs of equal visual weight |
| System fonts for fast first paint | Custom webfonts that delay legibility |
| Soft, minimal elevation | Heavy shadows, glassmorphism, gradients |
