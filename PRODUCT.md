# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **The developer (primary, one admin):** Filip, a freelance developer who maintains apps for several small local businesses (a dental clinic's booking system and internal dashboard, a barber shop's booking, a company website). Job: turn a client's "it doesn't work" into a ticket he can act on or paste into GitHub Issues, without reconstructing the story himself.
- **The client (secondary):** non-technical staff or owners of small businesses in Bosnia (receptionist, shop owner), almost always on a phone. Job: send one screenshot and one sentence, feel heard, and be done. They never see tickets, AI output or the dashboard.

## Product Purpose

Screenshot in, ticket out. A private report link per client project collects one screenshot and one sentence; Snag saves it first, then a vision model turns it into a structured ticket for the developer. Success: every ticket is faster to read than the WhatsApp message it replaces, nothing the client sends is lost, and the client only ever sees a calm "we got it" and later how far the work is.

## Positioning

The reporter is the non-technical client, and the input is deliberately tiny. The output separates **observed** fields (what the screenshot and sentence actually show) from **inferred** fields (suggestions, each with an evidence line or left empty), and admits what it can't tell with a deterministic **Ask client** flag instead of confident fiction. The ticket is in English for the developer; the client's sentence stays verbatim in their language.

## Operating Context

- A closed tool today: one admin (Filip) and a private, unguessable report link per client project. Not a public product yet; long term it may grow into a SaaS for freelancers and small dev agencies, so it should feel like a real product, not a side project.
- Clients are local, non-technical small businesses in Bosnia. Every screen is in English, client page included (Filip, 2026-10-17); the client may still write their sentence in their own language, and it is kept verbatim.
- Follow-up with clients happens on WhatsApp, outside Snag. The developer pastes finished tickets into GitHub Issues.
- The client page is a small support portal: a New report form, this device's reports grouped In progress / Done, and a quiet timeline per report. The developer side is an inbox in the same graphite-and-light shell (slices 6–8).
- Built for the Devpost "Build With AI: Basics" hackathon (deadline 2026-10-26); judged on design, idea and presentation from a short video.

## Capabilities and Constraints

- Report: one screenshot (PNG, JPG or WebP, under 5 MB) plus one sentence of at least 10 characters. No account, no sign-up. Rate-limited per device.
- Save first, extract second: the client's confirmation never waits on AI, and the client never sees an AI error or spinner.
- The client sees only reports sent from their own device, with status only (received, in progress, done).
- Developer: one shared access code, no user accounts. Edits every field, sets status, copies a ticket as GitHub-flavoured Markdown, retries a failed extraction.
- Terminology is fixed in `CONTEXT.md` (client, developer, report, ticket, extraction, observed, inferred, evidence, Ask client).
- Out of scope for the hackathon: accounts, integrations (Jira/GitHub), comments, notifications, a language switcher.

## Brand Commitments

- Name **Snag**, tagline "Screenshot in, ticket out."
- Tone: calm, trustworthy, simple. The client should feel heard ("we got it, we're on it"); the developer should feel in control (what the AI saw versus what it guessed).
- All UI copy is English; no mention of AI, tickets, extraction or WhatsApp on the client side.
- Monochrome, told apart by surface, border, weight, size and icons. The client page is dark (a ChatGPT-style neutral dark palette, 2026-10-18); the dashboard will use the same dark set. No pure black, no pure white text, no shadows, no gradients.
- Red means "extraction failed" and nothing else.

## Evidence on Hand

None yet: no testimonials, client logos or usage numbers. Eval numbers (role-played reports by real non-technical people, see `eval/README.md`) come later. Design and copy must not invent proof.

## Product Principles

1. The client's job ends at Send. Nothing is asked of them after that, and nothing about the machinery is shown.
2. A wrong field is worse than an empty one. Honest gaps (empty inferred fields, Ask client) beat confident guesses.
3. Source beside structure: the developer always sees the screenshot and sentence next to what was made of them.
4. Nothing is lost: every report is saved before anything can fail.
5. Small and finished beats big and half-done.

## Accessibility & Inclusion

WCAG 2.2 AA: 4.5:1 text contrast, 44px touch targets on the client page, visible keyboard focus, no meaning by color alone, `prefers-reduced-motion` respected, `lang="en"` on every page.
