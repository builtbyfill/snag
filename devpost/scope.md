---
doc: scope
status: approved
updated: 2026-10-16
approved: 2026-10-16
deadline: 2026-10-26 17:00 EDT
---

# Snag

**Screenshot in, ticket out.**

A public link where a non-technical client drops a screenshot and one sentence, and the developer gets a reviewed, structured ticket instead of "it doesn't work" on WhatsApp.

## The Unique Kernel

The reporter is the **client**, not a user or a developer, and the input is deliberately tiny: one screenshot, one sentence. The AI output is split into **observed** fields (what the image and sentence actually show) and **inferred** fields (what the model guesses), with evidence attached to every inference and an honest `null` plus an `ask client` badge instead of confident fiction. The ticket is written in English for the developer while the client's sentence stays verbatim in their language.

Delete the observed/inferred split and this is a feedback widget with an LLM bolted on. Keep it, and it's a tool a freelancer can trust enough to paste into GitHub Issues.

## Who It's For

**Primary:** Filip, a freelance developer maintaining several small-business apps (a dental clinic's booking system and internal dashboard, a barber shop's booking, a company website). Today a bug report is a WhatsApp message saying "ne radi" with a screenshot. He reconstructs what happened, on which screen, and how to reproduce it, then writes the ticket himself. Every report costs him time before any fixing starts. Other freelancers and small teams who maintain client apps have the same problem.

**Secondary:** the client who reports the bug: a receptionist or shop owner, non-technical, usually on a phone. They want to send one message and be done.

## The Core Loop

The client opens the project's report link on their phone, drops in a screenshot, writes one sentence about what happened, taps Send, and sees "Received. Your developer will take a look." Nothing else is asked of them.

The developer opens the dashboard, sees the new ticket already structured (title, where, what's wrong, suggested steps and expected result with evidence, priority, tags), checks any field against the screenshot and sentence shown right beside it, fixes what needs fixing, sets the status, and copies the ticket as Markdown into a GitHub Issue. If the model couldn't support a field, the field is empty and the ticket may carry an `ask client` badge, which means: open WhatsApp and ask one question.

The developer comes back because every ticket is faster to read than the message it came from, and nothing the client sent ever gets lost.

## Inspiration & Identity

- **Linear** ([linear.app](https://linear.app)): clean, fast, keyboard-friendly ticket UI. The dashboard should feel like this, not like an admin template.
- **WhatsApp** ([whatsapp.com](https://www.whatsapp.com)): the client side should be as simple as sending a message. One field, one button, one calm confirmation.
- **Sentry** ([sentry.io](https://sentry.io), the issue detail page): evidence shown next to the fields, what happened, where, how to reproduce. The ticket detail borrows this: source material beside the structured fields, never hidden behind a tab.
- **Rule from the learner:** no generic AI-template look. Design references are these three real products combined, nothing else.
- **Tone:** light theme, airy but not sparse; dense only in the ticket list. Client page thumb-friendly, dashboard tighter. One visual system end to end. Product copy, not placeholders.

## Why This Matters to the Learner

In Filip's words: "Getting reliable structured output from a vision model, keeping scope small, and shipping a polished product with planning docs instead of jumping straight into code." And the piece to practice: writing the requirements and the technical plan first, building against them, and "noticing where the plan was wrong." Snag also solves his own recurring friction; he plans to keep using it with his clients after the hackathon.

## What "Working" Looks Like

On one screen, in under a minute: open the report link on a phone, drop a screenshot of a real bug in the booking system, type one sentence in Bosnian, send, see the confirmation. Switch to the dashboard: the ticket is there, in English, with the client's sentence beside it verbatim, inferred fields marked "suggested" with their evidence, and a field left empty where the image didn't support an answer. Edit one field, set status, copy as Markdown, paste into a GitHub Issue.

The "oh, that's cool" beat: the model saying what it **can't** tell from the screenshot, next to what it can.

Proof, from the eval runner in the README: N real-style screenshots with sentences written by real non-technical people, X% accepted with at most one field edit, zero invented steps or expected results.

**The PoC is done** when the eval runs, the four surfaces are finished, and everything works locally in Docker Compose (app + Postgres, persistent volume for images and DB). Deployment is not part of "done".

## The POC Boundary

**In:**

- Four finished surfaces: `/login` (shared admin secret), client report page, ticket list, ticket detail. Every state designed: empty project, extraction pending, extraction failed, `ask client` badge, client confirmation. Nothing half-built.
- Projects come from a **seed script** with a fixed unguessable slug (nanoid, 21 chars, `/r/<slug>`). The dashboard lists them; no creation form.
- Client report: screenshot (png/jpg/webp, max 5 MB) plus a required sentence of at least 10 characters. Placeholder in the client's language. Rate limit per IP on the public link.
- **Save first, extract second.** Image to disk outside the public folder, sentence and metadata to Postgres, status `new`, extraction `pending`, before any API call. The client never sees an AI error or a spinner.
- Extraction with Claude (`claude-sonnet-5-5` (changed from claude-sonnet-4-6, see spec decision 7), vision, strict JSON validated with Zod) from a server action, never from the browser. Two-tier output: observed fields (title, location, actualResult, priority, tags) and inferred fields (expectedResult, stepsToReproduce) each with an `evidence` string or `null`. Plus per-ticket `confidence` (0–1) and detected `language` (ISO code, stored only). Ticket fields in English; client sentence verbatim.
- Retry policy: one automatic retry on Zod failure with the error fed back; one retry after a short delay on timeout or rate limit; then stop. Failed extractions become `extraction_failed` tickets with the raw error kept, visible in the dashboard with a **Retry extraction** button (stays in scope if it costs under an hour).
- `ask client` badge, deterministic: confidence < 0.6, **or** actualResult is null, **or** location is "unknown" and the sentence is empty. Filterable in the list.
- Ticket detail: inline edit of every field, status new / in progress / done, copy as Markdown, screenshot and sentence always visible, inferred fields visually marked "suggested".
- Images served through an authenticated route; a leaked URL exposes nothing.
- Admin access: one shared secret from an env var, entered once on `/login`, signed HTTP-only cookie, middleware on `/dashboard` and admin actions. Login rate-limited. No users table.
- **Eval runner** in `eval/`: images, one JSON of reference tickets, a script calling the same extraction function as the app, printing per-field matches and confidence next to the verdict. Eval set is synthetic and labeled so in the README: real bugs triggered in Filip's own apps, captured like a client would (phone screenshots, photos of monitors, a few blurry), with sentences written by 2–3 real non-technical people in Bosnian/Serbian/Croatian or English. Reference tickets written after the sentences exist. Target 10–15, goal 20, floor 10. Eval images stay local and git-ignored.
- Seed data for the repo and the video: test-environment screenshots with fake names or blurred real ones, including one pre-extracted ticket so the video doesn't depend on a live call.
- Docker Compose for local run, written once so the server deploy is a copy and two env vars.

**Success bar (decided in grilling):** at least 70% of eval tickets "accept with at most one field edit", zero invented steps or expected results. Below 50% means the prompt strategy or the product needs to change, and we want to know that on day one.

**Decision rule for confidence (decided in grilling):** if the five lowest-confidence tickets share at most one with the five worst tickets, the number is dropped from the badge rule and only the field rules stay. If they overlap, the 0.6 threshold is tuned to the point that separates them best.

## What Judges Score and How We Answer It

Verified on the official page ([learn-ai-basics.devpost.com](https://learn-ai-basics.devpost.com/)): three criteria, no published weights. Video 1–3 minutes, reviewers do not run code, live URL not required.

**1. Design: a complete, coherent product, not a technical PoC.**
Four surfaces, each finished, every state designed. One visual system (type scale, spacing, color), light theme, phone-first on the client page. Copy written like a product: button labels, confirmation, error messages. Build rule: a feature that can't be finished and polished is cut, not shipped half-done.

**2. Innovation / Idea: novel, different from existing concepts.**
Not a bug tracker, not a feedback widget. The reporter is the non-technical client; the input is one screenshot and one sentence. The output separates observed from inferred, attaches evidence, and admits what it can't tell with an honest `ask client` state. English ticket, verbatim client sentence. This framing goes into the README and the pitch.

**3. Presentation: end to end, clear problem, audience, value.**
Two-minute video, seed data only: 0:00–0:15 the WhatsApp "ne radi" with a screenshot; 0:15–1:10 client sends from a phone, ticket appears with fields, evidence, sentence; 1:10–1:35 edit a field, copy Markdown, paste into GitHub; 1:35–1:50 the eval numbers; 1:50–2:00 who it's for, what was learned. Script drafted in `6-ship`, in English.

**Build order follows this:** finished surfaces before extra features.

## If We Lose Two Days

Agreed in advance, first cut first. Nothing below ships half-done; it is removed.

1. Deployment (already a stretch item).
2. **Retry extraction** button. Stays in scope with a one-hour cap; if it exceeds the cap it is cut, and failed tickets are re-run through the eval runner by ticket ID instead.
3. Client chat extras (added 2026-10-17 with the chat direction): thumbnails in the client's history and the reply message after sending. The composer, the history's sentences and their statuses stay.
4. Dashboard chat extras (added 2026-10-17): last-message preview and open counts in the chat list, and j/k keyboard navigation. Click and Enter stay.
5. Confidence correlation analysis: still log confidence, skip the five-versus-five check, keep 0.6 untuned.
6. Login rate limit. The admin secret stays. The **report-link rate limit never goes**; it protects the credits.
7. If a third day goes: tags out of the UI (stay in the schema); eval to the ten-image floor.

**Never cut:** client report page with its states, save-first persistence, two-tier extraction with evidence and `null` honesty, `ask client` badge, ticket list and detail with edit / status / Markdown, eval runner and README numbers, seed data with one pre-extracted ticket.

## Later

- **Deployment** to Filip's Hetzner box behind the existing Caddy. Hard time box of half a day, attempted only after eval numbers exist, nothing new learned under pressure. If it works, the URL goes in the submission; if not, the video is local and the README has the Compose command.
- **Project creation form and "Regenerate link"** in the UI. Same stretch slot as deployment.
- Real auth with multiple users (Better Auth). The data model keeps a nullable owner column on Project so this lands without migration pain.
- Using the stored `language` to render the client confirmation or a reply draft in their language.
- Jira / GitHub integration, comments, email notifications, multi-language UI. The learner's answer to all of these: "later, after the hackathon".
- S3-compatible image storage, only if it turns out trivial.

## Explicitly Cut

- **Accounts and sign-up.** Replaced by one shared admin secret. Reason: the proof is extraction quality and the client flow, not identity.
- **A second form field ("What did you expect?").** Reason: it would help the model but costs the WhatsApp-simplicity that makes clients use the link. Missing intent is handled by the `ask client` badge.
- **Ticket text in the client's language.** Reason: Filip is the reader and GitHub Issues is the destination; English keeps the eval comparable. The client's sentence is kept verbatim.
- **Per-field confidence.** Reason: one number per ticket is enough to learn whether self-reported confidence means anything, and the badge is driven by deterministic field rules.
- **Self-captioned eval screenshots.** Reason: they would measure the model's ability to read Filip's writing, not his clients'.
- **Real client data anywhere in the repo or the video.** Reason: screenshots of a booking system contain patient names and phone numbers.
- **A spinner while the model works, or any AI error shown to the client.** Reason: the client's job ended at Send.
