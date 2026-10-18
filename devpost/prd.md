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

1. Filip runs the seed script once. It creates the project "Clinic booking" with an unguessable report slug, plus seed tickets including one already extracted. He opens `/login`, enters the access code, and lands on the chats: one per client project.
2. He opens the "Clinic booking" chat and taps **Copy report link** in its header. He pastes the link to the client on WhatsApp. This is the last time he does anything before a report arrives.
3. The client opens `/r/<slug>` on her phone. A graphite bar holds the Snag mark, the project name, Filip's name and "Usually replies the same day". Below it, on a light workspace, a first visit shows the **New report** form, with short notes (How it works, What happens next, Contact) under it on a phone and beside it on a laptop. The form has a large "Add a screenshot" area, the field "What happened?" and **Send report**.
4. She taps "Add a screenshot". The phone's native picker opens with Photo Library and Camera. She picks the screenshot; it fills the area with **Replace** and **Remove** underneath.
5. She types "Kliknula sam Sačuvaj na terminu i ništa se nije desilo." (her own words stay as she wrote them; the page around them is English) and taps **Send report**. The button shows "Sending…" for a moment.
6. The page switches to her report: the headline "Report received", her screenshot and sentence as a sent message, and the path Received → In progress → Done with the first step checked. Nothing else is asked of her, and nothing about AI is mentioned. When she opens the link again from the same phone, it opens on "Your reports": her earlier reports under **In progress** and **Done**, each with a date tile and its status.
7. In the dashboard her report appears at the bottom of the "Clinic booking" chat within seconds, as her message followed by a ticket card in a neutral "Reading screenshot…" state with a spinner; the chat moves to the top of the chat list. A few seconds later the card fills with a title, priority, and the "Extracted" state.
8. Filip clicks the ticket card and the ticket detail opens. Left: the screenshot and her sentence, verbatim. Right: Title, Where it happened, What's wrong, Priority, Tags. Below, under "Suggested by AI": Expected result and Steps to reproduce, each with a "Based on:" evidence line. Where the model couldn't support a field it reads "Not enough in the screenshot to tell." and shows an **Add** affordance.
9. He fixes one field by clicking into it and typing; it saves when he leaves the field and shows "Saved" inline. He sets Status to "In progress". He taps **Copy as Markdown**, sees the toast "Copied as Markdown", and pastes into a GitHub issue.
10. Success: the ticket in GitHub is faster to read than the WhatsApp message it came from, and the client never saw anything but a calm confirmation.

Branches: if extraction fails, the card in step 7 ends in the red "Couldn't read screenshot" state with a **Retry extraction** button; the screenshot and sentence are still there. If the result is thin, the ticket carries the **Ask client** pill (outlined, with an icon), meaning Filip opens WhatsApp and asks one question.

## Screens and Layout

Source: `scope.md > The POC Boundary` (four finished surfaces).

### `/login`
Single centered column, max width 360px. Wordmark "Snag", a label "Access code", one secure input, one prominent button "Open dashboard". Nothing else on the page. Successful login goes to the ticket list; the session lasts 30 days.

### Client report page `/r/<slug>`: a small portal
Redesign, 2026-10-17 (Filip; references: his piz-erp for the shell and type scale, Plain's customer portal for the grouping). Full height. Two parts:
- **Graphite bar** (`chrome`, 56px): the Snag mark, the project name, the developer's name (`DEVELOPER_NAME`) and "Usually replies the same day".
- **Light workspace**, inset into the graphite frame on wide screens (an inverted L, as in piz-erp). At 1024px and wider a 320px left column holds the list; on a first visit it holds the notes instead. The main area is one centered column (max 560px) showing either the **New report** form or one report's timeline.
- **Your reports:** a pinned "New report" button, then two groups, **In progress** (everything not done, newest first) and **Done**, each with an uppercase label and a count. A row is a date tile (day + month), the sentence on up to two lines, and the status glyph with its word. Done rows are muted. The open report is marked with a sunken row and a 2px ink bar on its left edge.
- **On phones** a first visit opens on the form with the notes under it. Once reports exist the page opens on "Your reports" (heading, a black "New report" button, the groups); the form and each report have a "Your reports" back button. The form's Send row is pinned to the bottom with a safe-area margin.

Every tap target at least 44px. No navigation, no footer.

### Chats `/dashboard`
**Redesign note (2026-10-17):** the dashboard moves into the same graphite-and-light shell and monochrome palette as the client page (see Look and Feel). Its layout (approved proposal: graphite sidebar, report list, per-report conversation, ticket fields) is settled with Filip before slice 7; the description below is the earlier chat version.

Dashboard shell with the wordmark and sign out. Two panes at 1024px and wider (Filip, 2026-10-17):
- **Left, the chat list:** one row per project, latest report first: avatar with the project's initials, project name, the latest client sentence on one line, its time, and a neutral count of open tickets (not Done).
- **Right, the chat with the selected client:** a header (project name, **Copy report link**, Extraction and Status filters), then the thread, oldest at the top and scrolled to the newest. Each report is the client's message (screenshot thumbnail, sentence, time) followed by its compact ticket card: state dot with text, title (or state text while pending or failed), **Ask client** badge, priority bars, status glyph. Done tickets stay in the thread, muted. Click or Enter on a card opens the ticket detail.

Below 1024px the chat list is the page; choosing a chat opens its thread with a back link.

### Ticket detail `/dashboard/tickets/<id>`
Two columns at 1024px and wider, stacked below. **Left, the source** (sticky on desktop): the screenshot, click to view full size in a dialog; "Client wrote" with the verbatim sentence; received time; the project. **Right, the ticket**: Title as the page heading, then Where it happened, What's wrong, Priority, Tags. A visible divider, then the "Suggested by AI" group: Expected result, Steps to reproduce, each with its evidence line. Top-right actions: Status select, **Copy as Markdown**, and **Retry extraction** when the ticket is in the failed state. Small meta line under the title: extraction state, confidence as a number, and the Ask client badge when it applies. Back link "Back to chat" top-left, returning to the same chat and filters.

## Look and Feel

Source: `scope.md > Inspiration & Identity`. Redesigned with Filip on 2026-10-17: the shell and type scale follow his own piz-erp (dark chrome around a light workspace, thin borders, date tiles, stat strips without cards); Snag keeps its own mark, IBM Plex and a stricter, monochrome palette.

**Thesis.** Snag turns a messy message into a clean record. A graphite frame holds a light workspace, like a desk under a lamp: the frame is quiet and constant, the work sits in the light. The client sends a photo and a sentence and later sees how far the work is; the developer works through an inbox where every suggested field points back at its source. One visual system, light workspace only.

**The one bold element.** The graphite chrome as an inverted L around the workspace (a bar on phones). Everything inside the workspace is told apart by surface, border, weight, size and icons, never by hue. The only color in the product is the failure red.

**Typeface.** IBM Plex Sans, variable (100–700), one family for everything. Latin Extended is loaded so the client's own sentence (č ć đ š ž) renders correctly wherever it is shown. Chosen because it was designed for technical documentation, reads as precise without being cold, and is not the default sans of current AI-generated apps (Inter, Geist). IBM Plex Mono only for the copyable report URL. Numbers are tabular everywhere.

**Type scale, five levels** (the piz-erp scale, Filip 2026-10-17). Utilities `text-display`, `text-title`, `text-label`, `text-body`, `text-meta`.

| Token | Size / line | Weight | Use |
| --- | --- | --- | --- |
| `display` | 24 / 28, −0.02em | 600 | Page heading ("New report") |
| `title` | 20 / 24, −0.02em | 600 | Section and ticket titles |
| `label` | 11 / 13, +0.08em, uppercase | 500 | Group labels ("IN PROGRESS"), date-tile months, column heads |
| `body` | 14 / 22 (client page 16 / 24) | 400 | Fields, sentences, rows |
| `meta` | 12 / 16 (client page 13 / 18) | 400–500 | Times, hints, status words |

Sentence case everywhere else, including buttons. Uppercase only in `label`. Line length under 70 characters in reading columns.

**Spacing scale.** 8, 16, 24, 32. Inside controls 8; between related elements 16; between groups 24; between sections and page gutters 32. Dense list rows: 12px vertical padding.

**Color tokens (strict monochrome, Filip 2026-10-17).** Contrast is against the surface named; every text pair is at least 4.5:1.

| Token | Hex | Role | Contrast |
| --- | --- | --- | --- |
| `chrome` | `#111214` | Graphite bar, sidebar, frame | |
| `chrome-hover` / `chrome-selected` | `#1C1D20` / `#27292D` | Rows in the chrome | |
| `chrome-fg` | `#EDEDEE` | Text in the chrome, focus ring on dark | 16.0 / 14.4 / 12.5 |
| `chrome-fg-muted` | `#8F9297` | Secondary text in the chrome | 6.0 / 5.4 / 4.7 |
| `canvas` | `#F4F4F5` | Workspace | |
| `surface` | `#FFFFFF` | Panels, inputs, cards | |
| `sunken` | `#ECECEE` | The client's message bubble, date tiles, hover | |
| `ink` | `#121316` | Primary text, primary button, focus ring | 18.6 / 16.9 / 15.8 (surface / canvas / sunken) |
| `ink-secondary` | `#4A4D53` | Secondary text | 8.5 / 7.7 / 7.2 |
| `ink-muted` | `#686B71` | Hints, times, placeholders, done rows | 5.3 / 4.9 / 4.5 |
| `line` / `line-medium` | `#E1E2E5` / `#C7C9CE` | Dividers / card borders | |
| `line-strong` | `#85888E` | Control edges (fields, the screenshot area) | 3.6 / 3.2 (WCAG 1.4.11) |
| `danger` | `#B42318` | **Extraction failed**, nothing else | 6.6 / 6.0 / 5.6; white on it 6.6 |

Filip's original muted grey `#6F7278` was 4.39:1 on canvas and 4.09:1 on sunken, so it was darkened to `#686B71`; the 1px borders he named are kept for dividers and cards, and `line-strong` is added for control edges, which need 3:1.

Strict rules that follow from the map:
- Primary button: `ink` with white text, at most one per view. Focus ring: 2px `ink` (2px `chrome-fg` on the chrome).
- Workflow status (New / In progress / Done) is text plus a glyph (empty circle, half circle, check). Done is the check plus muted text.
- Extraction states without color: **Reading screenshot…** is a dashed border with a spinner, **Extracted** is the plain card, **Couldn't read screenshot** is the one red state, always with text.
- **Ask client** is an outlined pill with an icon. Priority is text with one, two or three short bars.
- The client's report is a `sunken` bubble; Snag's ticket card is `surface` with a border.

**Surfaces, cards, borders.** No drop shadows except the dialog and the sheet. Radii: controls 8px, cards 12px, panels and the workspace frame 16px. Lists are rows with dividers, not cards; stat strips sit on the surface without cards. The client's screenshot area is a 1px `line-strong` border on `surface` while empty and the photo on `sunken` once chosen.

**Motion.** None on load. Only responses to the user's action, 120–180ms with `cubic-bezier(0.2, 0, 0, 1)`: hover and press on controls, the sent report settling in (opacity and 4px rise, 160ms), the sheet. `prefers-reduced-motion` turns transitions off and the spinner becomes a static dot.

**Copy voice.** Plain verbs, sentence case, no "we", no apologies, no exclamation marks, no interjections. Button labels say what happens and keep their name through the flow ("Copy as Markdown" produces "Copied as Markdown"). Errors say what went wrong and what to do.

## Components

Source: scope's stack decision (shadcn/ui on Tailwind v4). Component choices verified against the shadcn/ui catalog on 2026-10-16. `pick-ui-library` could not be run by the agent (it is reserved for the learner to invoke); Filip can run `/pick-ui-library` to confirm or override the table below.

| Need | Component | Notes |
| --- | --- | --- |
| Primitive variant | shadcn/ui components on the **Base UI** variant (shadcn now ships Base UI, React Aria and Radix variants per component) | Approved 2026-10-16 as a spec decision: Base UI first; Radix is the fallback if any component in this table is missing from the Base UI variant when `4-spec` checks the catalog. |
| Buttons, inputs, textarea, labels, errors | `Button`, `Input`, `Textarea`, `Field` (`FieldLabel`, `FieldDescription`, `FieldError`) | `FieldError` accepts Zod issues directly. Sentence-case labels. |
| Screenshot picking, drag-and-drop, paste | `react-dropzone` (`useDropzone` with `noClick`; the "Add a screenshot" area calls `open()`; the whole page is the drop target on desktop) | Not hand-rolled. One file, `image/*`, shrunk in the browser when large. Do **not** set the `capture` attribute: the native picker already offers Camera and Photo Library. The Kibo UI Dropzone used until slice 3 is removed. |
| Chosen-image preview (client) | The screenshot fills the area in place, with **Replace** and **Remove** (44px) on top | Plain `<figure>`; no chip. |
| Report list, date tiles (client) | Own `report-list.tsx` rows with `components/date-tile.tsx` and `components/status-glyph.tsx` | Grouped In progress / Done; `aria-current` on the open report. |
| Chat thread (dashboard) | shadcn `Message`, `Bubble`, `MessageScroller` | Revisited with the dashboard layout before slice 7. |
| Chat list rows, avatars | shadcn `Item`, `Avatar` | Dashboard left column. |
| Toast | shadcn `Toast` (`Toaster`, `toast()`), Base UI toast underneath on the Base variant | Used for: Copied as Markdown, Report link copied, Couldn't save, Extraction finished / failed again. Never for routine saves. |
| Dialog | shadcn `Dialog` | One use in the PoC: screenshot full-size view in ticket detail. Escape and close button both work. |
| Badges and states | shadcn `Badge` | Variants `extracted`, `pending` (dashed border, spinner), `failed` (the one red), `ask-client` (outlined pill with icon). Each renders text; none relies on color alone. |
| Status and priority | shadcn `Select` (Base UI select) | Status and Priority in ticket detail; filters in the list. Monochrome. |
| Empty states | shadcn `Empty` | Project with no tickets; filtered list with no matches. |
| Pending indicator | shadcn `Spinner` | Inside list rows and the Retry button while extraction runs. |
| Ticket card in a chat | shadcn `Item` (compact) | One per report, under the client's message; the whole card links to the detail; keyboard focusable. |
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

### Sharing the report link (chat header)
Source: `scope.md > The POC Boundary` (seed-created projects, slug).

- The chat list shows seeded projects by name. Opening a chat sets the link in its header.
- **Copy report link** copies `https://<host>/r/<slug>` and shows the toast "Report link copied". The URL is shown in the chat header in IBM Plex Mono so it can be read before copying.
- No create, rename, or regenerate in the PoC (deferred).

### Reporting a problem (client page)

Source: `scope.md > The Core Loop`, `scope.md > The POC Boundary` (client report, save first). Portal form decided by Filip, 2026-10-17. Every word is English and lives in `lib/copy/client.ts`; the client's sentence is kept in whatever language she writes it.

- **Header (graphite bar):** Snag mark, project name, developer's name, "Usually replies the same day". Page title "Report a problem: <project>".
- **First visit** (no reports from this device): short notes divided by rules, not cards. "How it works": take a screenshot where it went wrong, then one sentence on what you did and what happened. "What happens next": the status moves from Received to In progress to Done on this page, so keep the link. "Contact" only when `DEVELOPER_NAME` or `DEVELOPER_EMAIL` is set: "<name> looks after <project>." with a mail link. On wide screens the notes fill the left column; on phones they sit under the form, so the task comes first.
- **New report form:** heading "New report", one line "One screenshot and one sentence is enough.", the "Add a screenshot" area (opens the native picker, no `capture`; drop anywhere and paste work on desktop), the field "What happened?" with the placeholder "e.g. I tapped Save on the appointment and nothing happened." in a lighter grey, and while the field is empty three chips under it ("A button doesn't work", "A page won't load", "Wrong information shown") that start the sentence with a colon and put the caret after it. A chip alone is not a report: the words after it must pass the length rule on their own. **Send report** (black, 44px) always looks active.
- **This device's reports:** the browser keeps up to 20 of its own reports for this link (ticket id, sentence, a small thumbnail, time). On load and when the page becomes visible again, the page asks the server for the status of those ids only; the server answers with `{id, status}` for ids that belong to this project and nothing else. The list groups them **In progress** (Received and In progress) and **Done**. A forwarded link shows the next person a first visit; nobody can list the project's reports.
- **One report:** a headline in `title` size with the status glyph that says where it stands ("Report received" / "The team is working on it" / "The team has finished this") and one line on what it means for her ("If it still isn't working, send a new report." when done), her screenshot and sentence as a sent message (`sunken`) with "Sent 16 Oct, 14:32" under it, then the whole path Received → In progress → Done: passed steps checked, the current one bold, future ones hollow and muted. There is no reply box: a report is one screenshot and one sentence, and follow-up happens outside Snag.
- **Validation:** sentence required, at least 10 characters, checked on send. One message at a time, in ink with an icon (red is reserved for extraction failures), right under the thing it is about: under the screenshot area (which also gets a 2px ink border and an alert icon) or under the field (2px ink border, its own look, not the focus look). Server and network messages sit above Send. The words never make her count: "Add a few words about what you tapped and what happened.", "Add a screenshot before sending." (focus moves to the screenshot area), "This isn't an image. Choose a screenshot or a photo.", "This image can't be opened. Try another one." On phones the message is scrolled into view above the pinned Send row.
- **Sending:** Send shows "Sending…" with a spinner and the form is marked busy; after three seconds the line under it reads "Still sending. Your screenshot and text stay here." The request is complete when the image and sentence are saved; it does not wait for AI. On success the page opens the new report (it settles in with a short rise), focus moves to its headline, a screen reader hears "Report sent.", and the form is empty for the next one.
- **Under Send**, one reassuring line: "No sign-up needed. The team will get back to you if they need more details." The client page never mentions WhatsApp; WhatsApp stays in the problem story only (pitch, README).
- **Large photos** (a phone photo of a monitor can be 8–50 MB) are shrunk in the browser before sending (long edge 2560 px, JPEG); only an image that cannot be read at all is refused.
- **Rate limit** (more than 10 reports from one address in an hour): the form keeps its content; message "Too many reports from this device in the last hour. Try again in an hour."
- **Network or server failure:** the form keeps everything; message "Couldn't send the report. Check your connection and try again."
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

### Working the chats (`/dashboard`)
Source: `scope.md > The Core Loop`, `scope.md > Inspiration & Identity`. Chat form decided by Filip, 2026-10-17.

- **Chat list:** one row per project, ordered by latest report: initials avatar, name, latest client sentence (one line), its time ("4 min ago", then date after 24 h), neutral count of open tickets. The selected chat is highlighted.
- **Thread:** the selected project's reports, oldest at the top, opened scrolled to the newest. Each report: the client's message (thumbnail, verbatim sentence, time), then its ticket card: state dot and text ("Extracted", "Reading screenshot…", "Couldn't read screenshot"), title (for pending: "Reading screenshot…" in `ink-muted`; for failed: the first 60 characters of the sentence in `ink-muted`), **Ask client** badge when applicable, priority (bars + text), status (glyph + text). Done tickets stay in the thread, muted.
- **Filters** in the chat header: Extraction (All / Ask client / Failed) and Status (All / New / In progress / Done). They narrow the thread; active filter shown in the control, not as chips.
- Pending cards refresh themselves until they resolve; no manual reload needed for the demo.
- **Keyboard:** Up/Down or j/k move focus between ticket cards, Enter opens the focused ticket. Focus ring always visible.
- **Empty chat:** `Empty` with "No reports yet", "Share the report link with your client. Reports appear here the moment they're sent.", and **Copy report link**.
- **Filtered to nothing:** "Nothing to ask the client about" / "No failed extractions" / "No tickets match these filters" with **Clear filters**.

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

- **First visit (client)** — the New report form with short notes (How it works, What happens next, Contact when set). Nothing to learn, nothing to sign into.
- **First visit (developer)** — `/login`, then the chats with the seeded project and its seed tickets, one of them already extracted so the detail page has content on day one.
- **Empty project** — see Working the chats. Invitation to copy the link, not a dead end.
- **Pending extraction** — neutral, with a specific message ("Reading screenshot…"), never "Processing". The client never sees this state.
- **Extraction failed** — red state, source intact, error kept behind a disclosure, Retry available, fields editable.
- **Ask client** — outlined pill with an icon in list and detail, with its hint. It is advice to Filip, not an error.
- **Validation errors (client)** — inline, next to the thing that is wrong, in the interface's voice, never an alert.
- **Rate limited (client, login)** — inline message, the form stays, nothing lost.
- **Offline or server error (client)** — inline message, typed content preserved, retry by tapping Send again.
- **Persistence** — every report is saved before extraction; edits save per field; status persists; sessions last 30 days. Nothing lives only in the browser.
- **Who sees what** — anyone with a report link can submit to that project and sees only the reports sent from their own device, with their status only. Only a holder of the access code sees tickets, images, or any other project. Image URLs are not public; a leaked image URL shows nothing without the session.
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
- **Five type levels, four spacing steps** (2026-10-17, replaces three levels) — the piz-erp scale 24/20/11/14/12; the client page bumps body to 16px and meta to 13px for thumbs and distance.
- **Strict monochrome** (2026-10-17, replaces one accent and four state colors) — graphite chrome, light workspace, black primary button; the only color is the failure red. States are told apart by surface, border, weight, size and icons.
- **Client page shows no AI, no spinner, no ticket** — the client's job ends at Send (`scope.md > Explicitly Cut`). Conscious decision: the "Suggested by AI · Check before you trust" disclosure lives on the dashboard only, where the AI output is actually read.
- **Sentence required, 10 characters, one field** — `scope.md > The POC Boundary`.
- **Save on blur, inline "Saved"** — Linear-like speed without an edit mode or a custom component; toasts only for failures and copies.
- **Markdown export: GitHub-Issues compatible, empty fields omitted, inferred fields marked `_(suggested)_`** — the marker carries the observed/inferred honesty into GitHub without padding the issue with placeholders.
- **Keyboard: arrows or j/k, Enter, Esc, c** — Linear's speed at the smallest possible cost; nothing else for the hackathon.
- **Native picker instead of forced camera** — screenshots live in the gallery; `capture` would hide it.
- **Base UI variant of shadcn/ui, Radix fallback** — approved; recorded as a spec decision so `4-spec` verifies the catalog before writing install steps.
- **`react-dropzone` directly** (slice 3a, replaces the Kibo UI Dropzone + shadcn Attachment) — the hook gives the page-wide drop target and `open()` without an extra component layer.
- **Chat on both sides** (2026-10-17) — client page as a messaging thread with this device's reports and their status; dashboard as one chat per client with a ticket card under each report. Detail view unchanged. Accepted at about +1.5 days with an extended cut order (`scope.md > If We Lose Two Days`). The client half was replaced the same day by the portal below; the dashboard layout is settled before slice 7.
- **English only, everywhere** (2026-10-17, reverses the earlier Bosnian default) — client page, dashboard, errors, empty states and placeholders. No locale layer and no second copy set. The eval sentences in `eval/cases.json` stay as their authors wrote them: they are data, not UI.
- **Client page as a portal, not a chat** (2026-10-17) — New report form, this device's reports grouped In progress / Done, a quiet timeline per report, no reply box (Plain's customer portal as the reference).
- **Confidence shown as a number in detail** — Filip wants to learn how self-reported confidence behaves; showing it costs nothing and feeds the eval decision rule.

## What We're Building

Source: `scope.md > The POC Boundary`.

- `/login` with access code, 30-day session, login rate limit, sign out.
- Client report page as a small portal: New report form with native picker upload, this device's reports grouped In progress / Done with a timeline each, inline validation, save-first submission, report-link rate limit.
- Extraction with two-tier output, evidence lines, empty-not-guessed inferred fields, English fields, verbatim sentence, confidence and language meta, automatic retry policy, failed state with Retry.
- Chats: chat list per project, thread with message and ticket card per report, Copy report link, filters, keyboard-navigable cards, self-refreshing pending cards, empty states.
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
- Jira or GitHub integration, comments, email notifications, a multi-language UI or a language switcher.
- Colored priority or status. The color map is reserved.
- Page-load animations, hover effects on every row, decorative gradients or shadows.

## Open Questions

- **Base UI catalog check** — decided Base UI with Radix fallback; `4-spec` must verify that Attachment, Toast, Select, Dialog, Field, Empty, Spinner, Table, Kbd exist on the Base UI variant and that Kibo UI Dropzone installs alongside it before writing install steps. Blocks spec, not PRD.
- **Where the client-page confirmation animation lives** — one transition, CSS only, decided during build; respects reduced motion. Does not block.
- **Exact "Reading screenshot…" refresh mechanism** for list rows and detail — `4-spec` (polling vs. streaming). Does not block.
- **Filip to run `/pick-ui-library`** if he wants that skill's own verdict on the component table. Optional.
