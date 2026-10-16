---
doc: checklist
status: approved
---

# Build Checklist

Build mode: learn — Filip's instruction for this build: one slice at a time, explain what changed and how to try it, then stop and wait for his OK. Filip runs all git himself (staging, commits, push); after each slice the agent lists the files that belong in the commit and suggests the message (his standing rule overrides the skill's automatic commit).

## Slices

- [x] **1. One screenshot becomes a structured ticket in the terminal**
  Becomes usable: `npm run eval -- --only 001` sends one local screenshot and sentence to Claude and prints the validated ticket: observed fields, inferred fields with evidence or `null`, confidence, language, and every attempt with its token usage.
  Why now: This is the unique kernel and the largest unknown (`zodOutputFormat` with Zod 4, adaptive thinking on `claude-sonnet-5-5`, `parsed_output`, `sharp` downscale). If the observed/inferred split doesn't hold up, everything after it changes, so we find out before writing any UI. The project scaffold goes here because this slice is the first thing that needs it.
  PRD ref: `prd.md > Features and Behavior` (Reading the screenshot)
  Spec ref: `spec.md > Structured Output Strategy`, `spec.md > Modules and Seams` (`lib/extraction`), `spec.md > Install Steps` (1, 4), `spec.md > File Structure`, `spec.md > Decisions and Open Issues` (Verify early in the build)
  Build: Scaffold Next 16 + TypeScript + Tailwind v4 (in a scratch folder, then moved into the repo root). Install the step-4 dependencies and Vitest. Add `.env.example` and `lib/env.ts` (only the extraction variables in this slice). TDD: the `ExtractionOutput` schema and normalization, then the retry policy against `FakeProvider` (Zod retry with the issues fed back, a delayed retry on timeout/429/5xx, no retry on refusal/max_tokens/400). Then write `image.ts` (downscale), `prompt.ts`, `claude.ts` (`maxRetries: 0`, `server-only`) and `extractTicket`. Add a minimal `eval/run.ts` that loads `eval/cases.json`, runs the selected cases and prints the full `ExtractionOutcome` (scoring comes in slice 2). Add `.gitignore` entries for `eval/images/`, `eval/results/` and `.uploads/`.
  Verify (mechanical): `npm test` passes, covering schema normalization and every branch of the retry diagram. `npx tsc --noEmit` is clean. `npm run eval -- --only 001` with a real key returns `ok: true`, `parsed_output` is non-null, thinking blocks don't leak into the JSON, and `outputTokens` is recorded. `git check-ignore eval/images/001.png .env` confirms both are ignored.
  Learner check: Put one test-environment screenshot (no real client data) in `eval/images/`, write case `001` with a sentence in `eval/cases.json`, run `npm run eval -- --only 001`, and read the output. Do the observed fields describe what's visible? Are the inferred fields null where the screenshot can't support them?
  Commit: `Add extraction module and single-case eval run`

- [ ] **2. The eval runner scores extractions against reference tickets**
  Becomes usable: `npm run eval` prints the per-field match table, accepted/invented counts, Zod retries used, mean confidence and the confidence check. It writes `eval/results/<timestamp>.json` and supports `--review`, `--runs N` and manual overrides in `eval/verdicts.json`.
  Why now: Scope's success bar ("below 50% means the prompt strategy or the product needs to change, and we want to know that on day one") makes this the second risk. With the runner in place, Filip can collect real-style cases while the app gets built.
  PRD ref: `prd.md > What We're Building` (Eval runner and README numbers)
  Spec ref: `spec.md > Eval Runner`
  Build: TDD the matching rules for each field (including INVENTED detection and overrides counted separately). Then add the accepted/invented verdicts, the summary line, the five-versus-five confidence check, the results JSON, `--only`, `--review` and `--runs`. Write `eval/README.md` with the "synthetic" label and the honest-limits note.
  Verify (mechanical): `npm test` passes, with the matching rules covered for every field, including null references and INVENTED. `npm run eval` on the available cases prints the table and writes a results file that contains the raw attempts.
  Learner check: Write reference tickets for 2–3 cases, run `npm run eval`, then `npm run eval -- --review`. Does each ✓/✗ match your own judgement of "I would or wouldn't edit this"?
  Commit: `Score eval cases against reference tickets`

- [ ] **3. A client can send a report from a phone and it is saved**
  Becomes usable: The seeded project's link `/r/<slug>` opens the finished client page. A screenshot plus a sentence is validated, saved to Postgres and to disk, and answered with the calm confirmation. Rate limit, size, type and dimension rejections show the PRD copy.
  Why now: Save-first is a never-cut rule and the start of the core journey. It is also the first UI, so the design system (tokens, Plex fonts, shadcn Base UI, Kibo Dropzone) is set up here and then reused by the three later surfaces.
  PRD ref: `prd.md > The Core Journey` (steps 3–6), `prd.md > Features and Behavior` (Reporting a problem), `prd.md > Look and Feel`, `prd.md > Components`
  Spec ref: `spec.md > Data Model`, `spec.md > Build-time Audits`, `spec.md > Modules and Seams` (`lib/storage`, `lib/auth` rate-limit), `spec.md > Security Checklist` (Public report route, Secrets), `spec.md > Look and Feel`, `spec.md > Install Steps` (2, 3, 5)
  Build: `docker-compose.yml` with `db` only. Write `lib/db/schema.ts` and `drizzle.config.ts`, run `db:generate` and `db:check`. **Mid-slice pause:** write the `migration-auditor` report for `0000`; Filip reads it and applies the migration himself. Then the seed script (project only). TDD the storage path guard, `hashIp` and `reportLimitHit`, and `submitReportAction`. Set up shadcn init (Base UI), the components, the Kibo Dropzone and the `@theme` tokens/fonts. Build `/r/[slug]` with every state. Set `bodySizeLimit` and the app-wide security headers in `next.config.ts`. `after()` is not called yet.
  Verify (mechanical): `npm test` passes. The migration SQL shows four `CREATE TYPE`, the three indexes, and `ask_client … GENERATED ALWAYS AS (…) STORED`. The seed is idempotent (running it twice leaves one project). A browser submit creates one `tickets` row with `pending` status, one `attachments` row, and a file under `.uploads/<projectId>/`. An SVG renamed to `.png`, a file over 5 MB, an unknown slug and an 11th report in an hour are each rejected with the PRD copy. `vibesec-skill` checklist for the public route passes on the diff.
  Learner check: Open `http://<laptop-lan-ip>:3000/r/<slug>` on your phone, pick a screenshot, type a sentence in Bosnian, send. You should see the "sent message" confirmation. Then run `docker compose exec db psql -U snag -d snag -c "select client_sentence, extraction_state from tickets;"` and find your ticket.
  Commit: `Add client report page with save-first persistence`

- [ ] **4. A saved report gets read in the background**
  Becomes usable: After the client's confirmation, the ticket fills itself. `extractions` gets one row per attempt, the ticket columns are filled, `ask_client` is computed by Postgres, and failures end in `extraction_failed` with the error kept. A server restart marks stuck `pending` tickets as interrupted.
  Why now: This connects the kernel (slice 1) to save-first (slice 3). Together they are the product's core loop, minus the dashboard.
  PRD ref: `prd.md > The Core Journey` (step 7), `prd.md > Features and Behavior` (Reading the screenshot)
  Spec ref: `spec.md > Modules and Seams` (`lib/extraction/run.ts`), `spec.md > Save-Then-Extract: the Decision`, `spec.md > Data Model` (`askClient`: derived or stored?)
  Build: TDD `runExtraction`: fills only `NULL` columns, copies confidence and language, refuses non-`pending` tickets, and records every attempt. Add the generated-column test (confidence 0.5 → flagged, then updating `actual_result`/`confidence` makes the flag follow). Call `after(() => runExtraction(id))` from `submitReportAction`. Add the stale-pending sweep in `instrumentation.ts` `register()`.
  Verify (mechanical): `npm test` passes, including the DB-backed `runExtraction` and generated-column tests. After a real submit, the action responds before any `extractions` row exists, then the row appears and the ticket is `extracted`. A ticket manually set to `pending` with an old `updated_at` turns `extraction_failed` with the interrupted message after `npm run dev` restarts.
  Learner check: Send a report from your phone, then run `docker compose exec db psql -U snag -d snag -c "select attempt, result, input_tokens, output_tokens from extractions;"` and the ticket query from slice 3. You should see the English title, `ask_client`, and your sentence still verbatim.
  Commit: `Run extraction in the background after save`

- [ ] **5. The whole thing runs in Docker Compose**
  Becomes usable: `docker compose up --build` starts db → migrate → app on `http://localhost:3000`, the seed runs through the migrate service, data and screenshots survive `docker compose down` / `up`, and `/api/health` answers.
  Why now: Scope's definition of done requires Compose, and it holds three unknowns better found now than on the last day: `sharp` on `node:24-alpine`, `instrumentation.ts` under the standalone build, and the agreed `after()` kill/stop investigation.
  PRD ref: `prd.md > States and Boundaries` (Persistence)
  Spec ref: `spec.md > Docker Compose`, `spec.md > Where It Runs and How Someone Tries It`, `spec.md > Decisions and Open Issues` (The useful unknown)
  Build: Three-stage `Dockerfile` (deps, builder, migrate, runner) with standalone output and a non-root runner. Add the `migrate` and `app` services, `/api/health`, `.dockerignore` (excludes `.env`), and `stop_grace_period: 30s`.
  Verify (mechanical): `docker compose up --build` reaches a healthy app. The seed command from the spec works. `docker image inspect` / a file listing shows no `.env` in the image. Evidence 1–3 from "The useful unknown": the extraction row appears after the confirmation; `docker compose kill app` mid-extraction followed by `up` shows the interrupted error; `docker compose stop app` mid-extraction lets the attempt finish.
  Learner check: Run `docker compose up --build`, send a report from your phone, run `docker compose down` and then `docker compose up`, and confirm the ticket and its screenshot file are still there.
  Commit: `Run app, migrations and seed in Docker Compose`

- [ ] **6. The developer can log in, and the dashboard is locked**
  Becomes usable: `/login` with the access code opens a placeholder dashboard for 30 days. A wrong code, the sixth failure and sign-out behave as in the PRD. `/dashboard/*` without a session redirects to login.
  Why now: Every dashboard surface after this sits behind it, and the image route needs `requireSession()`.
  PRD ref: `prd.md > Features and Behavior` (Getting in), `prd.md > Screens and Layout` (`/login`)
  Spec ref: `spec.md > Modules and Seams` (`lib/auth`), `spec.md > Security Checklist` (Admin secret and session cookie)
  Build: Extend `lib/env.ts` to require the three secrets and reject equal ones. TDD `session.ts` (sign/verify, expiry, rotating `ADMIN_SECRET` keeps sessions valid), the login rate limit, `loginAction` and `signOutAction`. Add `proxy.ts` (confirm the convention on the installed Next), the `/login` page in the design system, and a minimal dashboard shell with sign-out.
  Verify (mechanical): `npm test` passes. Startup fails, naming the variable, when two secrets are equal. `curl -I /dashboard` without a cookie returns a redirect to `/login`. The cookie flags are `HttpOnly; SameSite=Strict`. `vibesec-skill` auth checklist passes on the diff.
  Learner check: Open `/login`, enter a wrong code (inline error, field cleared), then the right one (dashboard). Sign out, then open `/dashboard` directly: you should land on `/login`.
  Commit: `Add access-code login and dashboard gate`

- [ ] **7. The developer sees and works the ticket list**
  Becomes usable: The dashboard has the project switcher, Copy report link with a toast, and dense rows with state badges, priority bars and status glyphs. Pending rows refresh themselves. Extraction and status filters, j/k/arrow/Enter navigation and all empty states work. The seed adds three tickets: one extracted with evidence, one Ask client, one failed.
  Why now: This is where the developer first meets a ticket. The seed tickets make every list state visible without spending credits.
  PRD ref: `prd.md > The Core Journey` (steps 1–2, 7), `prd.md > Features and Behavior` (Sharing the report link, Working the list)
  Spec ref: `spec.md > Modules and Seams` (`lib/tickets` queries), `spec.md > Look and Feel` (Badges, Density), `spec.md > What Was Simplified and Why` (polling), `spec.md > The Core Journey Through the System` (1, 3, 8)
  Build: TDD `listTickets` filters. Build a small fake demo page (fictional company, invented names, three deliberate visible bugs), capture it with Playwright into `seed/images/` marked as synthetic (file names and `seed/images/README.md`), then build the seed tickets from those images, the dashboard shell (switcher, Copy report link), the list page reading `searchParams`, `state-badge`, `status-glyph`, `priority-bars`, the `ticket-list` client component (keyboard nav, 3-second `router.refresh()` only while a row is pending), and the empty/filtered states.
  Verify (mechanical): `npm test` passes. Every filter combination returns the expected seed rows. With no pending rows, polling stops (no repeated requests in the network log). A new phone report appears as "Reading screenshot…" and turns "Extracted" without a reload.
  Learner check: Log in, copy the report link and open it on your phone, send a report, and watch the row appear and resolve on the laptop. Try the Ask client and Failed filters and move through the rows with j/k and Enter.
  Commit: `Add ticket list with filters and live pending rows`

- [ ] **8. The developer reviews a ticket beside its source**
  Becomes usable: `/dashboard/tickets/<id>` shows the screenshot (authenticated route, full-size dialog), the verbatim sentence, the observed fields, and the "Suggested by AI" group with "Based on:" lines or "Not enough in the screenshot to tell.". It also shows the meta line (state, confidence, language, Ask client hint) and the finished pending and failed states.
  Why now: This is the "oh, that's cool" beat from scope: what the model can tell next to what it can't. It is read-only, so editing and export (slice 9) build on a stable page.
  PRD ref: `prd.md > The Core Journey` (step 8), `prd.md > Features and Behavior` (Reviewing a ticket), `prd.md > Screens and Layout` (Ticket detail)
  Spec ref: `spec.md > Security Checklist` (Authenticated image route), `spec.md > Modules and Seams` (`lib/tickets`), `spec.md > File Structure` (`tickets/[id]`, `images/[ticketId]`)
  Build: TDD the image route (no session → 404, non-UUID → 404, headers). Add `getTicket`, the two-column page, `source-panel` with the Dialog, the field column in read mode with evidence lines and empty text, the meta line, and the pending skeleton and failed panel with Details.
  Verify (mechanical): `npm test` passes. `curl` on the image URL without a cookie returns 404, and with a cookie returns 200 with `nosniff`, `private, no-store` and the stored `Content-Type`. All three seed tickets render their state correctly. `vibesec-skill` image-route checklist passes on the diff.
  Learner check: Open each seed ticket and your phone ticket. Click the screenshot (dialog, Esc closes). Check that every "Based on:" line points at something you can actually see. Copy an image URL into a private window: it should show nothing.
  Commit: `Add ticket detail with source panel and evidence`

- [ ] **9. The developer edits, exports and retries a ticket**
  Becomes usable: Fields save on blur with an inline "Saved". Status and Priority selects work, and Done leaves the default list. Empty inferred fields have Add. Copy as Markdown (button and `c`) produces the agreed GitHub format, and Esc returns to the list. Retry extraction on a failed ticket goes through Retrying… to Extracted or "failed again".
  Why now: This completes the core journey (steps 9–10). Retry is the second cut on the list, with a one-hour cap, so it comes last among features.
  PRD ref: `prd.md > The Core Journey` (steps 9–10), `prd.md > Features and Behavior` (Reviewing a ticket)
  Spec ref: `spec.md > Modules and Seams` (`lib/tickets` `updateTicketField`, `markdown.ts`), `spec.md > The Core Journey Through the System` (9–10)
  Build: TDD `ticketToMarkdown` (empty fields omitted, `_(suggested)_` only where evidence exists, pending variant), `updateTicketFieldAction` (whitelist, `requireSession`) and `retryExtractionAction`. Add the editable `ticket-fields` (borderless-until-focus Input variant), the selects, `copy-button`, and the keyboard shortcuts. Retry is time-boxed at one hour; if it overruns, stop and ask Filip whether to cut it per scope.
  Verify (mechanical): `npm test` passes, including a Markdown snapshot for each seed ticket and a rejected non-whitelisted field. An edit survives a reload. Retry on the seeded failed ticket adds a new `extractions` row with the next attempt number and keeps hand-typed fields.
  Learner check: Fix one field, set In progress, press `c`, and paste into a real GitHub issue preview. Then open the failed seed ticket, type a title by hand, and press Retry extraction. Your title should survive.
  Commit: `Add inline editing, Markdown export and retry`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 4. Filip sends real phone reports through the finished client page and sees them extracted in the DB. `/impeccable init`, then `/impeccable critique` and `/impeccable polish` on the client page (the first working UI, per the spec's build process), so design corrections carry into the three dashboard surfaces.
- [ ] Final kick-the-tires exploration and feedback completed — after slice 9, in Docker Compose: the full "What Working Looks Like" run on a phone and laptop, followed by `/impeccable critique` → `/impeccable polish` across all four surfaces.

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence:
Route and stops:
Edit outcome:
Reflection:
Activity mode:

## Revisions

- Scaffold in a scratch folder and move it into the repo root instead of `npx create-next-app@latest snag` — the spec's command would create a nested `snag/` folder, and create-next-app refuses to scaffold into a folder that already holds `devpost/`, `.agents/` and `CONTEXT.md`.
- `ClaudeProvider` sends `zodOutputFormat(ExtractionOutput)` through `messages.create()` and returns the raw text; `policy.ts` does JSON parse → normalize → `ExtractionOutput.safeParse` — in `@anthropic-ai/sdk` 0.135 `messages.parse()` throws an `AnthropicError` on Zod failure instead of returning `parsed_output: null`, and it validates before normalization, so enum casing ("High") would fail instead of being normalized.
- Slice 7 seed images come from a fictional demo page captured with Playwright (new dev dependency, Filip's decision) — Filip has no app screenshots that are free of client data, so the spec's "test-environment screenshots" are generated instead.
- `.env.example` uses obvious placeholders for secrets and working defaults for non-secret values; `lib/env.ts` refuses to start while a placeholder is left in — Filip's instruction for this build, replacing the spec's "every value empty".
