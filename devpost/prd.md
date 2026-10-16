---
doc: prd
status: approved
updated: 2026-10-16
approved: 2026-10-16
---

# Snag — Product Requirements

Screenshot in, ticket out. A public link where a non-technical client drops a screenshot and one sentence, and the developer who maintains their app gets a reviewed, structured ticket. For Filip and other freelancers maintaining several small-business apps; secondarily for their clients on a phone.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

Design passes applied before drafting: visual direction via `frontend-design`, component selection against the current shadcn/ui catalog, and a paper review of the four surfaces via `apple-design` (foundations only: accessibility, color, typography, writing, feedback, generative AI; no native platform conventions). Findings from the review are folded into the states and copy below and summarized under **Design Review Findings**.

## The Core Journey

Source: `scope.md > The Core Loop`, `scope.md > What "Working" Looks Like`.

1. Filip runs the seed script once. It creates the project "Clinic booking" with an unguessable report slug, plus seed tickets including one already extracted. He opens `/login`, enters the access code, and lands on the ticket list.
2. In the ticket list he picks the project and taps **Copy report link**. He pastes the link to the client on WhatsApp. This is the last time he does anything before a report arrives.
3. The client opens `/r/<slug>` on her phone. She sees the project name, "Report a problem", one large area that says "Add a screenshot", one text field "What happened?", and one button "Send report".
4. She taps the area. The phone's native picker opens with Photo Library and Camera. She picks the screenshot. It appears in the area as a preview, shaped like a photo in a chat.
5. She types "Kliknula sam Sačuvaj na terminu i ništa se nije desilo." and taps **Send report**. The button reads "Sending…" for a moment.
6. The screen settles into the confirmation: her screenshot and sentence shown as a sent message with a check mark, "Received. Your developer will take a look." and "You can close this page." Nothing else is asked of her, and nothing about AI is mentioned.
7. In the dashboard the ticket appears at the top of the list within seconds, with a neutral "Reading screenshot…" state and a spinner. A few seconds later the row fills with a title, priority, and the green "Extracted" state.
8. Filip opens the ticket. Left: the screenshot and her sentence, verbatim. Right: Title, Where it happened, What's wrong, Priority, Tags. Below, under "Suggested by AI": Expected result and Steps to reproduce, each with a "Based on:" evidence line. Where the model couldn't support a field it reads "Not enough in the screenshot to tell." and shows an **Add** affordance.
9. He fixes one field by clicking into it and typing; it saves when he leaves the field and shows "Saved" inline. He sets Status to "In progress". He taps **Copy as Markdown**, sees the toast "Copied as Markdown", and pastes into a GitHub issue.
10. Success: the ticket in GitHub is faster to read than the WhatsApp message it came from, and the client never saw anything but a calm confirmation.

Branches: if extraction fails, step 7 ends in the red "Couldn't read screenshot" state with a **Retry extraction** button; the screenshot and sentence are still there. If the result is thin, the ticket carries the amber **Ask client** badge, meaning Filip opens WhatsApp and asks one question.

## Screens and Layout

Source: `scope.md > The POC Boundary` (four finished surfaces).

### `/login`
Single centered column, max width 360px. Wordmark "Snag", a label "Access code", one secure input, one prominent button "Open dashboard". Nothing else on the page. Successful login goes to the ticket list; the session lasts 30 days.

### Client report page `/r/<slug>`
Phone-first single column, 16px side gutters, max width 480px on larger screens, generous vertical rhythm. Top: project name as the page title, "Report a problem" as the subtitle. Then, in order: the screenshot area (the hero of the page, at least 240px tall), the "What happened?" field, the "Send report" button pinned to the bottom of the viewport on phones with a safe-area margin. Every tap target at least 44px tall. No navigation, no footer, no branding beyond the small "Sent with Snag" line under the confirmation.

### Ticket list `/dashboard`
Dashboard shell: a slim top bar (wordmark, project switcher, **Copy report link**, sign out), then a filter row (Extraction: All / Ask client / Failed; Status: All / New / In progress / Done), then a dense row list. This is the only dense surface in the product. Rows are 48px tall, divided by 1px lines, no cards. Each row: extraction state as a small colored dot with text, title (or state text while pending or failed), priority as text, status as text, time since received. Row click or Enter opens the ticket. Arrow keys move between rows.

### Ticket detail `/dashboard/tickets/<id>`
Two columns at 1024px and wider, stacked below. **Left, the source** (sticky on desktop): the screenshot, click to view full size in a dialog; "Client wrote" with the verbatim sentence; received time; the project. **Right, the ticket**: Title as the page heading, then Where it happened, What's wrong, Priority, Tags. A visible divider, then the "Suggested by AI" group: Expected result, Steps to reproduce, each with its evidence line. Top-right actions: Status select, **Copy as Markdown**, and **Retry extraction** when the ticket is in the failed state. Small meta line under the title: extraction state, confidence as a number, and the Ask client badge when it applies. Back link "All tickets" top-left.

## Look and Feel

Source: `scope.md > Inspiration & Identity`. Established with Filip in scope; the token values below are the `frontend-design` proposal and are a learner decision at this review.

**Thesis.** Snag turns a messy message into a clean record. The client side should feel like sending a photo in a chat (WhatsApp). The developer side should feel like Linear's list and Sentry's issue page: fast, quiet, source material always beside the structured fields. One visual system, light theme only.

**The one bold element.** On the client page, the screenshot area is the whole composition: a large rounded area that becomes the photo, then becomes a "sent" message with a check mark on confirmation. Everything else on that page is quiet. On the dashboard the signature is the two-column detail where every suggested field points back at the source with a "Based on:" line. Nothing else is decorated.

**Typeface.** IBM Plex Sans, variable (100–700), one family for everything. Verified: Latin Extended subset present (č ć đ š ž render correctly), also Cyrillic if ever needed. Chosen because it was designed for technical documentation, reads as precise without being cold, and is not the default sans of current AI-generated apps (Inter, Geist). IBM Plex Mono only for the copyable report URL, because it is a literal string the user copies; no monospace for labels or metadata.

**Type scale, three levels.**

| Token | Dashboard | Client page | Weight | Use |
| --- | --- | --- | --- | --- |
| `title` | 24 / 32 | 24 / 32 | 600 | Page heading, ticket title |
| `body` | 15 / 24 | 17 / 26 | 400 | Fields, sentences, rows |
| `meta` | 13 / 20 | 14 / 20 | 500 | Labels, badges, times, evidence lines |

Sentence case everywhere, including buttons. No all-caps labels, no eyebrows, no numbered markers. Line length under 70 characters in reading columns.

**Spacing scale.** 8, 16, 24, 32. Inside controls 8; between related elements 16; between groups 24; between sections and page gutters 32. Dense list rows are the exception: 12px vertical padding to hit 48px rows.

**Color tokens and the meaning map.** Cool neutrals, one accent, four semantic states. Every color means one thing. Contrast figures are against the surface they sit on.

| Token | Hex | Role | Contrast |
| --- | --- | --- | --- |
| `canvas` | `#F6F7F9` | Page background | |
| `surface` | `#FFFFFF` | Panels, inputs, rows | |
| `ink` | `#1C2024` | Primary text | 15.6:1 on surface |
| `ink-muted` | `#5B6470` | Secondary text, labels | 5.6:1 on surface |
| `line` | `#E3E6EA` | Borders, dividers | |
| `accent` | `#1E4FD8` | The primary action only: Send report, Open dashboard, Copy report link, focus rings, links | 6.6:1 with white text |
| `ok` | fill `#E3F3EA`, text `#166534`, dot `#16A34A` | Extraction state **Extracted** | text 7.4:1 on fill |
| `attention` | fill `#FDF1D6`, text `#854D0E`, dot `#D97706` | **Ask client** badge | text 6.8:1 on fill |
| `danger` | fill `#FDE8E8`, text `#991B1B`, dot `#DC2626` | Extraction state **Failed** | text 7.9:1 on fill |
| `pending` | fill `#EEF0F3`, text `#4B5563`, dot `#9CA3AF` | Extraction state **Reading screenshot…** | text 7.0:1 on fill |

Strict rules that follow from the map:
- Workflow status (New / In progress / Done) is **monochrome**: text plus a small glyph (empty circle, half circle, check). It never borrows a state color.
- Priority (Low / Medium / High) is **monochrome** text with one, two, or three short bars. High is never red; red means "extraction failed" and nothing else.
- Every colored state also carries its text and a dot shape, so nothing is conveyed by color alone.
- The accent appears on at most one prominent button per view.

**Surfaces, cards, borders.** No drop shadows except the dialog. Dashboard panels: `surface` on `canvas`, 1px `line` border, 8px radius. Controls: 6px radius. The ticket list is a bordered list of rows, not cards. The client screenshot area: 16px radius, 2px dashed `line` border while empty, solid `line` border with the photo inside once chosen. Inputs: 1px `line` border, 2px `accent` focus ring, always visible on keyboard focus.

**Motion.** None on load. Only responses to the user's action: the screenshot area settling into the "sent" message on confirmation (one transition, under 300ms), toasts, dialog open. `prefers-reduced-motion` disables the confirmation transition and the spinner becomes a static dot.

**Copy voice.** Plain verbs, sentence case, no "we", no apologies, no exclamation marks, no interjections. Button labels say what happens and keep their name through the flow ("Copy as Markdown" produces "Copied as Markdown"). Errors say what went wrong and what to do.

## Components

Source: scope's stack decision (shadcn/ui on Tailwind v4). Component choices verified against the shadcn/ui catalog on 2026-10-16. `pick-ui-library` could not be run by the agent (it is reserved for the learner to invoke); Filip can run `/pick-ui-library` to confirm or override the table below.

| Need | Component | Notes |
| --- | --- | --- |
| Primitive variant | shadcn/ui components on the **Base UI** variant (shadcn now ships Base UI, React Aria and Radix variants per component) | Approved 2026-10-16 as a spec decision: Base UI first; Radix is the fallback if any component in this table is missing from the Base UI variant when `4-spec` checks the catalog. |
| Buttons, inputs, textarea, labels, errors | `Button`, `Input`, `Textarea`, `Field` (`FieldLabel`, `FieldDescription`, `FieldError`) | `FieldError` accepts Zod issues directly. Sentence-case labels. |
| Screenshot upload with drag-and-drop | Kibo UI **Dropzone** (react-dropzone under the hood), installed through the shadcn registry | Not hand-rolled. Configured: one file, `image/png, image/jpeg, image/webp`, max 5 MB. Do **not** set the `capture` attribute: the native picker already offers Camera and Photo Library, and forcing the camera would skip the gallery where screenshots live. |
| Chosen-image preview | shadcn `Attachment` (`AttachmentMedia variant="image"`, states `idle` / `uploading` / `done`) | Built for chat composers, which is the client page's metaphor. |
| Toast | shadcn `Toast` (`Toaster`, `toast()`), Base UI toast underneath on the Base variant | Used for: Copied as Markdown, Report link copied, Couldn't save, Extraction finished / failed again. Never for routine saves. |
| Dialog | shadcn `Dialog` | One use in the PoC: screenshot full-size view in ticket detail. Escape and close button both work. |
| Badges and states | shadcn `Badge` | Variants mapped one-to-one to the color tokens: `extracted`, `pending`, `failed`, `ask-client`. Each renders dot + text. |
| Status and priority | shadcn `Select` (Base UI select) | Status and Priority in ticket detail; filters in the list. Monochrome. |
| Empty states | shadcn `Empty` | Project with no tickets; filtered list with no matches. |
| Pending indicator | shadcn `Spinner` | Inside list rows and the Retry button while extraction runs. |
| Dense list | shadcn `Table` | Ticket list rows; full-row link; keyboard focusable rows. |
| Keyboard hint | shadcn `Kbd` | Shows `c` next to Copy as Markdown in detail. |
| Editable field pattern | `Field` + `Input` / `Textarea` rendered borderless until focus (one `cva` variant on the shadcn Input), save on blur through a server action, inline "Saved" text in `meta` size | No separate edit mode and no custom component. Null inferred fields render the "Not enough in the screenshot to tell." text with an **Add** button that focuses the same input. |

## Features and Behavior

### Getting in (`/login`)
Source: `scope.md > The POC Boundary` (admin access).

- One secure field labeled "Access code", one prominent button "Open dashboard". The field is never prefilled.
- Correct code: redirect to the ticket list. Wrong code: inline error under the field, "That access code didn't match." Field keeps focus, value cleared.
- Sixth wrong attempt from the same address within 15 minutes: button disabled, inline message "Too many attempts. Try again in 15 minutes."
- Sign out from the dashboard top bar returns to `/login`.
- Visiting any `/dashboard` URL without a session redirects to `/login`.

### Sharing the report link (ticket list top bar)
Source: `scope.md > The POC Boundary` (seed-created projects, slug).

- Project switcher lists seeded projects by name. Selecting one filters the list and sets the link.
- **Copy report link** copies `https://<host>/r/<slug>` and shows the toast "Report link copied". The URL is shown in the project switcher in IBM Plex Mono so it can be read before copying.
- No create, rename, or regenerate in the PoC (deferred).

### Reporting a problem (client page)
Source: `scope.md > The Core Loop`, `scope.md > The POC Boundary` (client report, save first).

- Page heading is the project name; subheading "Report a problem".
- Screenshot area, empty: dashed border, image icon, "Add a screenshot", secondary line on phones "Tap to choose from your photos or take one", on desktop "Drop a screenshot here or click to choose". Tapping opens the native picker; the area also accepts drag and drop and paste from the clipboard on desktop.
- Screenshot area, chosen: the image preview fills the area at its aspect ratio, with a small **Replace** button in the corner. One image only; choosing another replaces it.
- Rejections appear inline under the area, immediately, before sending: "Choose a PNG, JPG or WebP image." or "Choose an image under 5 MB." The area stays empty.
- Field "What happened?" with description "One sentence is enough." and placeholder `Kliknula sam Sačuvaj na terminu i ništa se nije desilo.` Required, minimum 10 characters. Validation runs on blur and on send, never while typing the first characters: "Write at least 10 characters about what happened." shown under the field.
- Sending with no screenshot: "Add a screenshot before sending." under the area; focus moves there.
- **Send report**: disabled until both a valid image and a valid sentence exist. On tap it reads "Sending…" with a spinner and the form locks. The request is complete when the image and sentence are saved; it does not wait for AI.
- Confirmation state replaces the form: the screenshot and sentence shown as a sent message with a check mark, heading "Received. Your developer will take a look.", line "You can close this page.", a quiet link "Send another report", and the small line "Sent with Snag". No AI mention, no spinner, no ticket fields.
- Rate limit hit (more than 10 reports from one address in an hour): the form stays, inline message above the button "Too many reports from this device in the last hour. Try again later."
- Network or server failure: the form stays with everything the client typed; inline message "Couldn't send the report. Check your connection and try again." The button returns to "Send report".
- No text on this page mentions AI, tickets, extraction, or the dashboard.

### Reading the screenshot (extraction, as the product sees it)
Source: `scope.md > The Unique Kernel`, `scope.md > The POC Boundary` (two-tier output, retry policy, badge rule).

- Extraction starts after the report is saved and never blocks the client's confirmation.
- Output fields, in the order the detail page shows them:
  - **Observed:** Title; Where it happened (screen, URL or component, or "Unknown"); What's wrong; Priority (Low / Medium / High); Tags.
  - **Suggested (inferred):** Expected result; Steps to reproduce. Each carries an evidence line or is empty.
  - **Meta:** confidence (0–1); detected language of the sentence (stored, shown as a two-letter code in the detail meta line).
- Ticket fields are written in English regardless of the client's language. The client's sentence is never translated or edited.
- An inferred field with no supporting evidence is empty, never guessed. The product shows "Not enough in the screenshot to tell." in its place.
- Automatic retries: one on invalid output (the validation error is fed back), one after a short delay on timeout or API rate limit. Then the ticket enters the failed state and no more credits are spent until Filip presses Retry.
- **Ask client** rule, deterministic: confidence below 0.6, **or** What's wrong is empty, **or** Where it happened is "Unknown" and the sentence is empty. (The last clause can't trigger in the PoC because the sentence is required; it stays so the rule matches scope and survives a future optional sentence.)

### Working the list (ticket list)
Source: `scope.md > The Core Loop`, `scope.md > Inspiration & Identity` (Linear).

- Default view: the selected project's tickets, newest first, all statuses except Done, all extraction states.
- Row content: state dot and text ("Extracted", "Reading screenshot…", "Couldn't read screenshot"), title (for pending rows: "Reading screenshot…" in `ink-muted`; for failed rows: the first 60 characters of the client's sentence in `ink-muted`), **Ask client** badge when applicable, priority (bars + text), status (glyph + text), received time ("4 min ago", then date after 24 h).
- Filters: Extraction (All / Ask client / Failed) and Status (All / New / In progress / Done). Filters combine. Active filter shown in the control, not as removable chips.
- Pending rows refresh themselves until they resolve; no manual reload needed for the demo.
- Keyboard: Up/Down or j/k move focus between rows, Enter opens the focused ticket. Focus ring is always visible. Nothing else for the hackathon.
- Empty project: `Empty` component with "No reports yet", "Share the report link with your client. Reports appear here the moment they're sent.", and the **Copy report link** button.
- Filtered to nothing: "Nothing to ask the client about" (Ask client filter) or "No failed extractions" (Failed filter) or "No tickets match these filters" with a **Clear filters** button.

### Reviewing a ticket (ticket detail)
Source: `scope.md > The Unique Kernel`, `scope.md > Inspiration & Identity` (Sentry).

- Left column shows the source: screenshot (click opens the full-size dialog, Escape closes), "Client wrote" heading, the sentence verbatim in `body` size, received time and project in `meta`.
- Right column, observed fields: each is a `Field` with label, borderless until focus, editable in place. Tags is a comma-separated input in the PoC.
- "Suggested by AI" group header with the line "Based on the screenshot and the client's sentence. Check before you trust." Each inferred field shows its evidence as "Based on: …" in `meta`, or the empty text "Not enough in the screenshot to tell." with an **Add** button.
- Saving: leaving an edited field saves it. "Saved" appears in `meta` next to the label for two seconds. On failure: toast "Couldn't save. Try again." and the field keeps the edited value.
- Status select: New / In progress / Done. Changing it saves immediately with the same inline confirmation. Done tickets leave the default list view.
- Priority select: Low / Medium / High, monochrome.
- **Copy as Markdown** (with `Kbd` c): copies the ticket; toast "Copied as Markdown". Format, GitHub-Issues compatible, decided by Filip:

  ```markdown
  ## <title>
  **Where:** <location>
  **What happened:** <actualResult>
  **Expected:** <expectedResult> _(suggested)_
  **Steps to reproduce:** _(suggested)_
  1. <step>
  2. <step>
  **Priority:** <priority> · **Tags:** <tag, tag>
  > Client: "<verbatim sentence>"
  ```

  Empty fields are omitted entirely, never written as "null" or as a placeholder. Inferred fields carry the `_(suggested)_` marker. Evidence lines, confidence, status, and language are not included.
- Keyboard in detail: `c` copies Markdown, Esc returns to the list. Nothing else for the hackathon.
- Meta line under the title: extraction state badge, "Confidence 0.72", language code, and **Ask client** badge when applicable with the hint on hover or focus: "Not enough detail to act on. Ask the client one question."
- **Pending state:** right column shows field labels with skeleton bars and the line "Reading screenshot…" with a spinner. Left column is complete. Actions available: Status and Copy as Markdown (Markdown then contains only the heading, with the client's sentence as the title, and the `> Client:` line).
- **Failed state:** right column shows a `danger` panel "Couldn't read this screenshot" with a collapsed "Details" disclosure holding the raw error, and the **Retry extraction** button. All fields are editable so Filip can write the ticket by hand if he prefers. Pressing Retry: button reads "Retrying…" with a spinner, the ticket returns to the pending state, then resolves to extracted (toast "Extraction finished") or failed again (toast "Extraction failed again"). Retry is in scope with the one-hour build cap recorded in `scope.md > If We Lose Two Days`.

## States and Boundaries

- **First visit (client)** — the form, empty, with the dashed screenshot area and placeholder sentence. Nothing to learn, nothing to sign into.
- **First visit (developer)** — `/login`, then the seeded project with seed tickets, one of them already extracted so the detail page has content on day one.
- **Empty project** — see Working the list. Invitation to copy the link, not a dead end.
- **Pending extraction** — neutral, with a specific message ("Reading screenshot…"), never "Processing". The client never sees this state.
- **Extraction failed** — red state, source intact, error kept behind a disclosure, Retry available, fields editable.
- **Ask client** — amber badge in list and detail with its hint. It is advice to Filip, not an error.
- **Validation errors (client)** — inline, next to the thing that is wrong, in the interface's voice, never an alert.
- **Rate limited (client, login)** — inline message, the form stays, nothing lost.
- **Offline or server error (client)** — inline message, typed content preserved, retry by tapping Send again.
- **Persistence** — every report is saved before extraction; edits save per field; status persists; sessions last 30 days. Nothing lives only in the browser.
- **Who sees what** — anyone with a report link can submit to that project and sees only the form and their own confirmation. Only a holder of the access code sees tickets, images, or any other project. Image URLs are not public; a leaked image URL shows nothing without the session.
- **Personal data** — seed and demo data are fake or blurred; real client screenshots never enter the repo or the video (`scope.md > Explicitly Cut`).

## Design Review Findings

From the `apple-design` paper review of the four surfaces, applied to a web app using the foundations only. Overall: no Critical findings once the token table holds; the design has a point of view (source beside fields, the chat-photo client page). Items below changed the requirements above.

- **High, color alone** — `accessibility.md › Vision`: "Convey information with more than color alone." Every state badge renders dot + text; status and priority are monochrome with glyphs. Applied in Look and Feel.
- **High, one color one meaning** — `color.md`: "Avoid using the same color to mean different things." Red is reserved for extraction failure; High priority is not red; the accent is never used for non-interactive text. Applied as strict rules.
- **Medium, contrast** — `accessibility.md › Vision`, WCAG table: up to 17pt needs 4.5:1. Amber text on amber fill was the risk; fixed with `#854D0E` on `#FDF1D6` (6.8:1). All token pairs listed with figures.
- **Medium, specific loading feedback** — `generative-ai.md › Outputs`: "instead of 'Processing…', say" what is happening. Pending state reads "Reading screenshot…".
- **Medium, agency over AI output** — `generative-ai.md › Outputs`: surface Edit, Retry near generated content; `generative-ai.md › Transparency`: communicate where AI is used. The "Suggested by AI" group header, inline editing, Add on empty fields, and Retry on failure answer this. The client page intentionally does not disclose AI because the client receives no AI output; the developer page does.
- **Medium, hallucination awareness** — `generative-ai.md › Inputs`: "clearly communicate that AI-generated content may contain errors." The group line "Check before you trust." plus evidence lines.
- **Medium, confirmations** — `feedback.md › Best practices`: confirm significant actions, don't confirm the routine. Toasts only for copy, link copy, and failures; routine field saves get the inline "Saved".
- **Medium, dynamic validation and hints** — `entering-data.md`, `text-fields.md`, `writing.md`: validate on blur, hint in the field, errors next to the field, "instruct people how to enter the information correctly, rather than scolding." All client errors rewritten as instructions.
- **Medium, empty states** — `writing.md`: "Provide clear next steps on any blank screens." Empty project offers the link copy.
- **Medium, no "we"** — `writing.md`: avoid "we" in errors. All copy uses "Couldn't…" forms.
- **Low, touch targets** — `accessibility.md` table: 44pt default on touch. Client page controls are 44px minimum; Send is pinned within thumb reach.
- **Low, modality** — the only dialog (screenshot zoom) has a visible close and Escape.
- **Craft note** — remove one accessory: the review dropped a planned per-row avatar/initial for the client and the planned colored priority. Both were decoration. The design is now lean enough that nothing else should be removed without losing information.

## Product Decisions

Decisions carried from `scope.md` (grilling, 2026-10-15) and approved by Filip at this review (2026-10-16):

- **IBM Plex Sans, one family** — latin-ext verified; distinctive without decoration; Plex Mono only for the copyable URL.
- **Three type levels, four spacing steps** — as Filip specified; the client page bumps body to 17px for thumbs and distance.
- **Strict color meaning map** — one accent, four states; status and priority monochrome so the map cannot be broken by a tempting red.
- **Client page shows no AI, no spinner, no ticket** — the client's job ends at Send (`scope.md > Explicitly Cut`). Conscious decision: the "Suggested by AI · Check before you trust" disclosure lives on the dashboard only, where the AI output is actually read.
- **Sentence required, 10 characters, one field** — `scope.md > The POC Boundary`.
- **Save on blur, inline "Saved"** — Linear-like speed without an edit mode or a custom component; toasts only for failures and copies.
- **Markdown export: GitHub-Issues compatible, empty fields omitted, inferred fields marked `_(suggested)_`** — the marker carries the observed/inferred honesty into GitHub without padding the issue with placeholders.
- **Keyboard: arrows or j/k, Enter, Esc, c** — Linear's speed at the smallest possible cost; nothing else for the hackathon.
- **Native picker instead of forced camera** — screenshots live in the gallery; `capture` would hide it.
- **Base UI variant of shadcn/ui, Radix fallback** — approved; recorded as a spec decision so `4-spec` verifies the catalog before writing install steps.
- **Kibo UI Dropzone via the shadcn registry + shadcn Attachment** — approved; the one component outside shadcn core, because core has no upload component.
- **Confidence shown as a number in detail** — Filip wants to learn how self-reported confidence behaves; showing it costs nothing and feeds the eval decision rule.

## What We're Building

Source: `scope.md > The POC Boundary`.

- `/login` with access code, 30-day session, login rate limit, sign out.
- Client report page with the states above, native picker upload, inline validation, save-first submission, calm confirmation, report-link rate limit.
- Extraction with two-tier output, evidence lines, empty-not-guessed inferred fields, English fields, verbatim sentence, confidence and language meta, automatic retry policy, failed state with Retry.
- Ticket list with project switcher, Copy report link, filters, dense keyboard-navigable rows, self-refreshing pending rows, empty states.
- Ticket detail with source column, inline editing with save on blur, status and priority, Copy as Markdown with the defined format, pending and failed states, screenshot dialog.
- Seed script: one project with slug, seed tickets including one pre-extracted, fake data only.
- Eval runner and README numbers (defined in scope; specified in `4-spec`).
- Design system as specified under Look and Feel, applied to all four surfaces, every state finished.

## Deferred From the POC

Source: `scope.md > Later`.

- **Project creation form and Regenerate link** — seed script covers the PoC; same stretch slot as deployment.
- **Deployment** to the Hetzner box — half-day time box after eval numbers exist.
- **Real multi-user auth** — nullable owner column on Project keeps the door open.
- **Using the stored language** for a client-facing confirmation or reply draft.
- **Per-field evidence on observed fields** — only inferred fields carry evidence in the PoC; observed fields are checked against the source shown beside them.
- **Tags as a proper token input** — comma-separated text in the PoC.
- **S3-compatible image storage** — only if trivial at spec time.

## Possible Later Enhancements

- Second filter dimension for priority and a saved default view.
- Thumbs up/down on an extraction to collect feedback for prompt tuning (`generative-ai.md › Continuous improvement`).
- Row-level quick actions (status change from the list).
- Dark theme from the same tokens.

## Non-Goals

Source: `scope.md > Explicitly Cut`, `scope.md > Later`.

- Accounts, sign-up, password reset. One shared access code is the whole identity layer.
- A second client question or any form longer than one screenshot and one sentence.
- Ticket text in the client's language. English fields, verbatim sentence.
- Per-field confidence.
- Any AI wording, spinner, or error on the client page.
- Jira or GitHub integration, comments, email notifications, multi-language UI.
- Colored priority or status. The color map is reserved.
- Page-load animations, hover effects on every row, decorative gradients or shadows.

## Open Questions

- **Base UI catalog check** — decided Base UI with Radix fallback; `4-spec` must verify that Attachment, Toast, Select, Dialog, Field, Empty, Spinner, Table, Kbd exist on the Base UI variant and that Kibo UI Dropzone installs alongside it before writing install steps. Blocks spec, not PRD.
- **Where the client-page confirmation animation lives** — one transition, CSS only, decided during build; respects reduced motion. Does not block.
- **Exact "Reading screenshot…" refresh mechanism** for list rows and detail — `4-spec` (polling vs. streaming). Does not block.
- **Filip to run `/pick-ui-library`** if he wants that skill's own verdict on the component table. Optional.
