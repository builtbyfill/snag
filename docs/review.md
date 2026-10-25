# Final review, 2026-10-25

What the final review found and what happened to it. Everything under **Fixed** is in the working tree with a test where it is logic. Everything under **Open** is a one-line fix or a decision for later, highest severity first.

Checks run: security review (auth on every admin route, action and the image route; tenant isolation; rate limits; secrets; upload validation; headers; what a judge holding the demo access code could do), code-quality review, migration audit of `drizzle/0000`–`0004`, `.env.example` against `lib/env.ts`, architecture survey, UI audit of the client page, dashboard and ticket detail, animation review, and a copy pass.

## Fixed

| Severity | Area | What was wrong | Fix |
| --- | --- | --- | --- |
| High | Demo data | A real guesthouse logo was in demo screenshot 004 and the business name in `seed/demo/results.json`. The scrub matched image URLs before decoding them and missed logos drawn with CSS masks. | The scrub now decodes URLs, hides anything drawn with a background or mask, and hides every image in headers and navs. 004 recaptured and re-extracted; results.json scanned clean. |
| High | Demo data | Case 021 showed a staff photo and the clinic's brand mark behind the booking panel. | 021 now shows only the panel. |
| High | Repo | The scrub rules listed the real names they replace, in a file that would be committed. | Rules moved to `eval/capture/rules.local.mjs` (git-ignored); `rules.example.mjs` shows the format. |
| Medium | Cost | `x-forwarded-for` is trusted for the per-address limit, so without the reverse proxy a client can change it on every request and spend API credits without limit. | Global cap of 60 reports an hour across all links (`lib/auth/rate-limit.ts`), with a test. README says the app must sit behind a proxy that sets the header. |
| Medium | Demo | Demo report links were fixed strings in the repo, so anyone reading it could submit reports. | Slugs are random at seed time and printed once. An existing demo project with an old slug gets a new one on the next seed (done on the dev database). |
| Medium | Logs | Database errors were logged whole, and Drizzle's message includes the query parameters (a client's sentence, a report link). | `lib/log.ts` logs the error name, code and first line only. Used in every action and the start-up sweep. |
| Medium | Client page | When the browser refuses to store history (private mode, full storage), a second report replaced the first in memory, and a follow-up made the open chat disappear. | The history helpers build on the list the page is showing. Tests for both cases. |
| Medium | Extraction | A database error while saving the model's result left the ticket `pending`: endless spinner, no Retry. Retry also read its config after flipping the ticket to pending. | The ticket is marked failed (Retry shows) if that smaller write succeeds; config is read first. Test with a failing transaction. |
| Medium | Dashboard | A database error in New project, or on any dashboard page, replaced the whole dashboard with the framework's error page. | New project returns "Could not save the project. Try again."; `dashboard/error.tsx` shows a message and Try again inside the shell. |
| Low | Ticket detail | Esc while the Status or Priority menu was open could leave the page; typing `c` in the menu copied the Markdown. | Both key handlers ignore open menus, options and editable content. |
| Low | Markdown | A title with a line break split the GitHub heading. | Whitespace in the title collapses to one line. Test. |
| Low | Config | `APP_URL` ending in `/` produced report links with `//r/`. | The trailing slash is dropped when the env is read. Test. |
| Low | Eval tooling | One address rule had unescaped `\s` and never matched, so part of a real address survived the scrub. | Escaped; the six affected captures were retaken. |
| Medium | Demo data | The eval captures were retaken after the demo was extracted, so some stored tickets quoted text the current screenshots no longer show (017 cited a different phone example). | All 15 demo tickets re-extracted once from the final images; results.json scanned clean again. |
| High | Ticket detail (a11y) | Each field's button had an `aria-label` of just the field name, so screen readers never heard the value ("Location, button"). | Named by its label plus its value (`aria-labelledby`); the Edited note is the description. |
| Medium | Ticket detail (a11y) | Esc or Enter in a field dropped keyboard focus to the page. | Focus returns to the field. |
| Medium | Dashboard (a11y) | The open client was marked only by a background at 1.44:1 against the column. | A bar on the left edge, as in the client's report list. |
| Medium | Dashboard | Retry that the server refused (already retried, ticket gone) did nothing visible. | Shows "Couldn't start the retry. Try again." |
| Medium | Dashboard | Reopening New project after an error showed the old error on an empty field. | The error clears when the dialog closes. |
| Medium | Copy | The client's limit message blamed "this device" also when the global cap was hit; "Copy link to this report" and "Keep this link to check" promised a link that works only on the sending device; "Need to add something? Email" sat next to the in-page Add box; the empty dashboard said reports show up "the moment they're sent" (it polls). | Rewritten: "We can't take more reports right now…", "Copy link (works on this device)", "Check back here on this device.", "Questions about this report? Email…", "within a few seconds". Also "Check them before you use them." and "Too long to save. Shorten it and try again." |
| Low | Docs | README called the empty-field text "honest" and said the eval sentences "are written" (only 001 has one); the eval README counted 3 error states (there are 4). | Corrected. |

| Medium | Demo (Filip, 2026-10-25) | Demo screenshots showed only their alt text on the container: the seed had run on the host and written to `./.uploads`, which the container's volume never sees, and the image was a week old. | Rebuilt, and the seed runs through Compose; all 16 images verified through the image route. The screenshots stay local (`seed/demo/images/` is git-ignored). |
| Medium | Keyboard (Filip, 2026-10-25) | j, k, c, Enter and Esc worked anywhere on the page (WCAG 2.1.4). | They act only while focus is inside the thread or the ticket, never in a field, menu or dialog; a click into the thread gives it focus. |
| Medium | Ticket detail (Filip, 2026-10-25) | An edited AI field kept its "Based on" line and stayed "suggested" in the Markdown. | Editing an inferred value drops its evidence; the field shows "Edited by you"; the model's original stays in the extractions table. |
| Low | Confidence | The 0.6 threshold lived in three places, and the detail showed "Confidence 0.70" while cards showed "0.70". | One `lib/tickets/confidence.ts`; shown once as "0.70 · high" / "0.41 · low", the full wording for screen readers. |

| Medium | Client page (Filip, 2026-10-25) | A sent report survived a reload in storage, but the page opened an empty new chat, so it was only reachable through the list (hidden behind the icon on a phone). | The page is one feed: welcome card, every report as a chat, the composer at the bottom; three panes from 1024px. Storage key is `snag:<slug>`, moved once from the old key. Demo projects show all their reports; real ones only this device's. |

Verification after the fixes: 348 tests, typecheck, lint and the production build pass. A report sent from a 390-wide client page was saved, extracted, and appeared in an open dashboard within one refresh, without reloading (`docs/review-shots/live-*`, git-ignored). That test report was removed afterwards.

Security checks that passed with nothing to fix: every admin page, action and the image route call `requireSession()` or `isSignedIn()` themselves (the proxy is only a convenience, and `tests/admin-gate.test.ts` checks this without it); the public actions only return tickets of the link's own project; uploads are typed from their bytes by sharp (the declared type and file name are ignored), with size and pixel limits; secrets live only in `.env` and are never logged; `nosniff`, `X-Frame-Options: DENY` and a referrer policy are set on every route. With the demo access code a judge can read and edit the demo tickets and create projects. That is the intended scope of the code.

Migrations: all five are additive. `0001` contains a backfill `UPDATE`, already applied on every database. Nothing drops or renames a column. `.env.example` lists every variable `lib/env.ts` reads, with placeholders only.

## Open

### Bugs and states

| Severity | File | Problem | One-line fix |
| --- | --- | --- | --- |
| Medium | `app/(admin)/dashboard/tickets/[id]/editable-field.tsx:54` | The field keeps its first value: a refresh after someone else edits doesn't show, and a slow save can overwrite text typed after it started. | Resync from the prop when not focused, and ignore a save result whose value is no longer the draft. |
| Low | `lib/auth/rate-limit.ts:34` | The limits count, then insert, without a lock, so a parallel burst can pass the global cap by a few. | Take `pg_advisory_xact_lock` around count and insert in `submitReport`. |
| Low | `lib/reports/follow-up.ts:39` | Same count-then-insert race for the follow-up limit. | Same lock. |
| Low | `lib/reports/screenshot-store.ts:31` | The local screenshot copy reports success when the request succeeds, before the transaction commits, so a quota abort looks saved. | Resolve on `tx.oncomplete`, reject on `tx.onabort`. |
| Low | `lib/tickets/image.ts:53` | Disk and sharp errors become a silent 404. | Log with `describeError` before returning 404. |
| Low | `scripts/seed-demo-data.ts:131` | A demo ticket whose stored result is missing is inserted pending; the next server start marks it interrupted, and later seeds skip it. `jpegSize` runs after the insert. | Insert the attachment first and skip tickets without a result unless `--extract`; read the size with `sharp().metadata()`. |
| Low | `app/(admin)/dashboard/tickets/[id]/refresh-while-pending.tsx` | Doesn't refresh at once when the tab becomes visible, unlike the thread. | Add the same `visibilitychange` listener. |
| Info | `instrumentation.ts` | Every server start marks all `pending` tickets interrupted. A second server against the same database (a dev server next to the container) ends the container's running extractions. | Don't run both during the demo; later, record which instance owns a pending ticket. |
| Info | `docker-compose.yml:50` | `APP_BIND` defaults to `0.0.0.0` for phone testing on the LAN. On a server without the proxy, `x-forwarded-for` is spoofable, which also weakens the login lockout. | Set `APP_BIND=127.0.0.1` on any server and keep Caddy in front. |
| Low | `next.config.ts:27` | No Content-Security-Policy. React escapes all output and there is no user HTML, so the gap is defence in depth only. | Add a CSP with `default-src 'self'`; `img-src 'self' data: blob:` for the client thumbnails. |
| Info | `scripts/seed-demo-data.ts:38` | Demo ticket ids are predictable. They are only readable together with a project's random slug or behind the access code. | None needed. |

### Accessibility and copy

| Severity | File | Problem | One-line fix |
| --- | --- | --- | --- |
| Medium | `app/(client)/r/[slug]/client-portal.tsx:113` | A failed status fetch falls back to "Received" for every report, so a Done report can read Received. | Store the last known status in the device history and show that. |
| Medium | `tickets/[id]/editable-field.tsx:77` | After a failed save the unsaved text shows at rest as if saved. | Keep the editor open on error. |
| Medium | `tickets/[id]/menu-select.tsx:35` | The Status and Priority triggers are named by the label only, not the current value (WCAG 2.5.3). | ``aria-label={`${label}: ${current.label}`}`` |
| Low | `tickets/[id]/menu-select.tsx:28` | While a change saves, the trigger shows the old value until the refresh. | Hold the new value with `useOptimistic`. |
| Low | `tickets/[id]/editable-field.tsx:131` | Esc saves instead of cancelling. | On Escape restore the saved text and skip the save. |
| Low | `new-project-dialog.tsx:63`, `source-panel.tsx:72`, `components/ui/sheet.tsx:31` | Pure-black dialog backdrops; the rest of the app uses the chrome tone. | `backdrop:bg-chrome/80`, as in `feed-item.tsx:134`. |
| Low | `app/(client)/r/[slug]/help-block.tsx:16` | Fixed ids are duplicated while the sheet and the aside are both mounted. | `useId()`. |
| Low | `tickets/[id]/page.tsx:153`, `ticket-fields.tsx:74` | Two different disclosures are both called "Details". | Rename the extraction one "Extraction details". |
| Low | `lib/copy/client.ts:15,18` | "This is your direct line to {name} for anything that doesn't work." reads like sales copy, and "We fix it, you follow the status here" promises a fix. The greeting is pinned in `tests/client-copy.test.ts` as approved copy, so both were left. | "Send {name} a screenshot of anything that doesn't work." and "Follow the status here". |

Animations: reduced motion is respected everywhere (settle, pop and the dialog zoom run only under `no-preference`, transitions drop to 0 ms, the spinner stops). The `review-animations` skill can only be started by you (`/review-animations`); it was not run.

### Code quality

| Severity | File | Problem | One-line fix |
| --- | --- | --- | --- |
| Low | `components/ui/*` | 11 of 15 files have no importers (attachment, avatar, bubble, field, input-group, item, message-scroller, message, and input, label, separator used only by those). | Delete them, then check whether `@shadcn/react` is still needed. |
| Low | about 10 files (`status-glyph.tsx:3`, `groups.ts:3`, `update.ts:9`, …) | Status, priority and extraction-state unions are typed by hand. | Derive them from the pgEnum `enumValues` in `lib/db/schema.ts`. |
| Low | `dashboard/page.tsx:17`, `tickets/[id]/page.tsx:23`, `prepare-image.ts:17` | Thumbnail size math and the `?w=320` srcSet are duplicated. | One helper next to `WIDTHS` in `lib/tickets/image.ts`. |
| Low | `feed-item.tsx:155` | A second clipboard helper. | Use `lib/clipboard.ts`. |
| Low | `recency.ts:9`, `sent-at.ts:4`, `groups.ts:15` | Three `MONTHS` arrays. | One shared constant. |
| Low | `composer.tsx:164`, `follow-up-composer.tsx:41,88,96`, `new-project-dialog.tsx:76` | Length limits hard-coded next to exported constants. | Import the constants. |
| Low | `queries.ts:59`, `update.ts:34`, `validate.ts:50`, `admin.ts:102,106` | Exports and copy keys used only by tests or nowhere. | Remove, or move to the tests. |
| Low | `starters.ts:1`, `feed-item.tsx:17` | Stale comments (chips while typing; status changes not recorded). | Update the comments. |
| Low | `seed-demo-data.ts:66` | A corrupt `results.json` is reported as missing. | Tell "missing" and "invalid" apart, and validate with Zod. |

### Architecture (after the hackathon)

1. **One module for the extraction lifecycle (M).** The pending → extracted/failed → pending machine and the `after()` wiring are spread over `submit.ts`, `retry.ts`, `run.ts` and two actions. One module with `schedule`, `retry` and `recoverOnBoot` behind a scheduler seam (after() in production, inline in tests) would make "retry, extract, check state" one test.
2. **One table of editable ticket fields (M).** `fillEmpty`, `aiOriginalFrom`, `EDITABLE` and the Markdown writer each list the seven fields and the value-plus-evidence rule. A `lib/tickets/fields.ts` table would let all four derive from it.
3. **Pure view mappers (S).** Card and detail mapping lives inside server components with no tests. Move it to `lib/tickets/views.ts` with `now` injected.
4. **One place that builds dependencies (S).** Three call sites build storage from env; a single `appDeps()` restores the spec's one-adapter switch for S3 later.
5. **Split `lib/` by runtime (S).** `lib/reports/` mixes server and browser code; nothing stops a client component importing the database client.
6. **A reducer for the client page (M).** `client-portal.tsx` holds about 14 pieces of state with no component tests; a pure reducer behind `useReportHistory(slug)` would make them testable.
