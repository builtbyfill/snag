---
doc: spec
status: approved
updated: 2026-10-16
approved: 2026-10-16
---

# Snag — Technical Spec

Blueprint for building what `prd.md` describes. Written after eight ordered passes requested by Filip: `domain-modeling` (data model + ADR), `codebase-design` (modules and seams), the save-then-extract decision, the structured-output strategy, Postgres and Drizzle explained, `vibesec-skill` as a checklist, Docker Compose, and the eval runner. Facts marked **verified** were checked against the linked documentation on 2026-10-16; anything marked **verify in build** was not.

Filip reviewed seven recommendations on 2026-10-16. Five were approved as drafted, one was replaced (a separate `SESSION_SECRET`), and one was changed (default model `claude-sonnet-5-5`). The outcome is under **Decisions and Open Issues**. Everything else follows from scope, the PRD, or his instructions for this pass.

## How This Works, In Plain Language

Snag is one Next.js application and one Postgres database, running as two containers next to each other.

When a client taps **Send report**, the browser posts the screenshot and the sentence to a server action. The action checks the image (type, size, that it really is an image), writes the file to a folder on disk that the web server never exposes, writes a ticket row and an attachment row to Postgres, and answers "received". That answer is the client's confirmation; the AI has not been called yet.

The same action then schedules the extraction to run *after* the response has gone out, using Next.js's `after()`. In that background step the app downsizes the screenshot, sends it with the sentence to Claude, asks for a strict JSON answer that matches a schema, validates the answer, records the attempt in an `extractions` table, and copies the result into the ticket's columns. If the model's answer is invalid or the API times out, the same step retries once, then marks the ticket `extraction_failed` with the error kept.

The dashboard reads tickets straight from Postgres. Rows that are still `pending` ask the server again every few seconds until they resolve. Edits in the detail page are server actions that update one column each. The Markdown export is a pure function of the ticket row. Screenshots are served by one authenticated route that reads the file path from the database, never from the URL.

The eval runner is a script that calls the exact same `extractTicket` function the server action calls, on a folder of local images with a JSON file of reference tickets, and prints a table.

Why this shape and not something bigger: one process, one database, no queue, no object storage, no accounts. Every piece can be explained in a sentence, and every piece is needed to prove the kernel in `scope.md > The Unique Kernel`.

## The Core Journey Through the System

PRD ref: `prd.md > The Core Journey`.

1. **Seed.** `npm run seed` inserts the project "Clinic booking" with a fixed 21-character slug, three seed tickets (one `extracted` with evidence, one `extracted` that triggers **Ask client**, one `extraction_failed` with a stored error) and their fake screenshots copied from `seed/images/` into the uploads folder. Idempotent: re-running updates by slug.
2. **Login.** `/login` posts the access code to `loginAction`. It compares against `ADMIN_SECRET` in constant time, counts failures per IP in memory, and on success sets the `snag_session` cookie (30 days, signed with `SESSION_SECRET`) and redirects to `/dashboard`.
3. **Copy report link.** The dashboard shell lists projects; the client component copies `${APP_URL}/r/${slug}` to the clipboard. No server call.
4. **Client opens `/r/<slug>`.** A server component looks up the project by slug (404 if none) and renders the form. The Dropzone validates type and size in the browser first; the sentence validates on blur.
5. **Send.** `submitReportAction(formData)` runs on the server: Zod-validates the sentence, sniffs the image with `sharp` (format must be png/jpeg/webp, reads width/height), checks the per-IP hourly count in `tickets`, writes the file through the storage module, inserts `tickets` + `attachments` in one transaction, and returns `{ ok: true }`. Then it calls `after(() => runExtraction(ticketId))`.
6. **Confirmation.** The client component swaps the form for the "sent message" state using the preview it already has. Nothing waits on AI.
7. **Extraction in the background.** `runExtraction` loads the ticket and the file, calls `extractTicket({ image, mimeType, sentence })`, which downsizes, prompts, parses, validates and retries per policy. Each attempt becomes an `extractions` row. On success the ticket's empty columns are filled, `extraction_state` becomes `extracted`; on final failure it becomes `extraction_failed` with `extraction_error`.
8. **Dashboard list.** `/dashboard?project=…&extraction=…&status=…` is a server component querying `tickets` with the filters. A small client component calls `router.refresh()` every 3 seconds while any visible row is `pending`.
9. **Detail.** `/dashboard/tickets/<id>` renders the source column (image via `/dashboard/images/<ticketId>`) and the field column. Each field saves on blur through `updateTicketFieldAction(id, field, value)`, which whitelists the field name. Status and Priority use the same action. **Retry extraction** calls `retryExtractionAction(id)`, which sets `pending` and schedules `runExtraction` with `after()` again.
10. **Copy as Markdown.** `ticketToMarkdown(ticket)` runs on the server during render and is passed to the client button, which writes it to the clipboard. The `c` key triggers the same button.

```
Client phone                 Next.js (one Node process)                      Postgres
────────────                 ──────────────────────────                      ────────
POST form ──────────────▶ submitReportAction
                            ├─ validate sentence (Zod)
                            ├─ sniff + measure image (sharp)
                            ├─ rate limit: count tickets by ip_hash/1h ─────▶ SELECT
                            ├─ storage.put(key, bytes) → /data/uploads/…
                            ├─ INSERT tickets, attachments (tx) ───────────▶ INSERT
◀── { ok } ─────────────────┤
                            └─ after(): runExtraction(ticketId)
                                 ├─ downscale → Claude (output_config json_schema)
                                 ├─ Zod validate · retry policy
                                 ├─ INSERT extractions (every attempt) ─────▶ INSERT
                                 └─ UPDATE tickets (fields, state) ────────▶ UPDATE
Dashboard ◀── poll 3 s ──── /dashboard (server component) ◀──────────────── SELECT
```

## Stack

All of these are Filip's decisions from the brief and scope; versions and facts verified today unless noted.

| Piece | Choice | Notes and docs |
| --- | --- | --- |
| Framework | Next.js 16 (App Router, TypeScript, Node runtime) | `after()` stable since 15.1 and "fully supported when self-hosting with `next start`" (**verified**, [after](https://nextjs.org/docs/app/api-reference/functions/after), [self-hosting › after](https://nextjs.org/docs/app/guides/self-hosting#after)). Next 16 renamed `middleware.ts` to `proxy.ts` (**verify in build** on the installed version). |
| Styling | Tailwind v4 | Default in `create-next-app`. Tokens from `prd.md > Look and Feel` become CSS variables in `app/globals.css` via `@theme`. |
| Components | shadcn/ui, **Base UI** variant | Catalog check done, see **Install Steps**. [shadcn CLI](https://ui.shadcn.com/docs/cli). |
| Upload UI | Kibo UI Dropzone via shadcn registry | Registry item depends only on `react-dropzone`, `lucide-react` and shadcn `button`; no Radix or Base UI import, so it is variant-agnostic (**verified**, [registry JSON](https://www.kibo-ui.com/r/dropzone.json)). |
| Database | Postgres 18 (`postgres:18-alpine`) + Drizzle ORM + `drizzle-kit` + `pg` | Postgres 18 is the current `latest` tag; its data directory moved to `/var/lib/postgresql/18/docker` and the volume mounts at `/var/lib/postgresql` (**verified**, [Docker Hub](https://hub.docker.com/_/postgres)). [Drizzle migrations](https://orm.drizzle.team/docs/migrations), [drizzle-kit check](https://orm.drizzle.team/docs/drizzle-kit-check). |
| AI | `@anthropic-ai/sdk`, model `claude-sonnet-5-5` (env `EXTRACTION_MODEL`) | Structured outputs are GA through `output_config.format` with the `zodOutputFormat` helper and `client.messages.parse()` (**verified**, [structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [TS SDK](https://platform.claude.com/docs/en/api/sdks/typescript)). See **Model note** below. |
| Validation | Zod 4 | Same schema drives the API request format and the local parse. |
| Images | `sharp` | Sniffs the real format, reads dimensions, downsizes for the model. Already a Next.js dependency for `next/image`. |
| IDs | `gen_random_uuid()` for rows, `nanoid` (21) for slugs | UUIDs so ticket URLs are not enumerable (`vibesec-skill` › Access Control). |
| Tests | Vitest | Unit tests on `lib/` through module interfaces; no browser test suite in the PoC. |
| Containers | Docker Compose (app + db + one-shot migrate) | See **Docker Compose**. |

**Model (Filip's decision, 2026-10-16).** Default `claude-sonnet-5-5`, the current Sonnet: $2 / $10 per MTok, released 2026-09-28, retirement not before 2027-09-28 (**verified**, [Sonnet 5.5](https://platform.claude.com/docs/en/models/sonnet-5-5/overview)). The ID lives in `EXTRACTION_MODEL` so `claude-sonnet-4-6` can be compared later by changing one env value and re-running the eval. Three facts about 5.5 shape the code (**verified** on the model page):

- **Adaptive thinking is on by default** and its tokens count against `max_tokens`. The call below budgets for that.
- **A non-default `temperature`, `top_p` or `top_k` returns a 400.** None of them is set.
- **It is in the high-resolution vision tier** (Claude 4.7 and later: 2576 px long edge, up to 4784 visual tokens). See **Image downscale** for what that means for the approved 1568 px limit.

**Rough cost per extraction on 5.5.** A screenshot downsized to 1568 px is about 1,560 input tokens and the prompt about 700. Output is under 400 tokens of JSON plus adaptive thinking, call it 1,000–2,500 tokens. That comes to about one to three cents per ticket. A 20-case eval run three times stays around two dollars. The $5 Console limit stays.

## Where It Runs and How Someone Tries It

**Requirements.** Node 24 (installed), Docker Desktop (installed), an Anthropic API key in `.env`. Windows host; everything runs in WSL2-backed containers or in Node on the host.

**Local development (hot reload).**

```bash
cp .env.example .env            # fill ANTHROPIC_API_KEY, ADMIN_SECRET, SESSION_SECRET, IP_HASH_SECRET, POSTGRES_PASSWORD
docker compose up -d db         # Postgres only
npm install
npm run db:migrate              # drizzle-kit migrate against localhost:5432
npm run seed
npm run dev                     # http://localhost:3000
```

**The "PoC is done" check (`scope.md > What "Working" Looks Like`).**

```bash
docker compose up --build                       # db → migrate → app, on http://localhost:3000
docker compose run --rm migrate npx tsx scripts/seed.ts   # seed runs from the full-dependency stage
```

**Environment (`.env.example`, every value empty in the repo):**

```bash
ANTHROPIC_API_KEY=            # Console key; never committed
ADMIN_SECRET=                 # the dashboard access code, 16+ chars; used for nothing else
SESSION_SECRET=               # 32+ random bytes (openssl rand -base64 32); signs the session cookie only
IP_HASH_SECRET=               # 32+ random bytes; HMAC key for reporter IP hashes only
POSTGRES_PASSWORD=            # used by db, migrate and app
APP_URL=http://localhost:3000 # what Copy report link copies; https:// turns on the secure cookie
APP_BIND=0.0.0.0              # 127.0.0.1 on the server (Caddy in front)
DATABASE_URL=postgres://snag:<password>@localhost:5432/snag   # host dev only; Compose overrides with host "db"
UPLOAD_DIR=./.uploads         # host dev only; Compose sets /data/uploads
EXTRACTION_MODEL=claude-sonnet-5-5
EXTRACTION_MAX_EDGE=1568
```

**What to open for the demo video.** `http://localhost:3000/login` on the laptop, `http://<laptop-lan-ip>:3000/r/<slug>` on the phone (same Wi-Fi). Both URLs come from `APP_URL`; set it to the LAN address for the recording so **Copy report link** produces a URL the phone can open.

**Eval.** `npm run eval` (all cases) or `npm run eval -- --only 007`. Reads `eval/cases.json` and `eval/images/`, writes `eval/results/<timestamp>.json` (git-ignored), prints the table.

**Deployment (optional stretch, `scope.md > Later`).** Same `docker-compose.yml` on the Hetzner CPX12; Caddy on the host already terminates TLS and reverse-proxies to `127.0.0.1:3000`. See **Docker Compose › What differs on the server**. Submission needs the video and the public repo; the URL is a bonus.

## Look and Feel

Carried from `prd.md > Look and Feel` with no re-interview. Implementation notes for the build:

- **Fonts.** `next/font/google` for IBM Plex Sans (variable, `latin-ext` subset) and IBM Plex Mono (400 only). Exposed as `--font-sans` and `--font-mono`.
- **Tokens.** Every hex in the PRD table becomes a CSS variable under `@theme` in `globals.css` (`--color-canvas`, `--color-ink`, `--color-ok-fill`, …) so Tailwind utilities like `bg-ok-fill text-ok-text` exist. shadcn's own `--primary`, `--border`, `--ring` etc. are mapped onto these; nothing in the PRD palette is left to shadcn defaults.
- **Type scale.** Three utilities only: `text-title`, `text-body`, `text-meta`, defined once with the dashboard sizes; the client route's layout sets `data-surface="client"` on `<body>` and the two bumps (17/26, 14/20) are keyed off it.
- **Badges.** `Badge` variants `extracted | pending | failed | ask-client`, each rendering a dot span + text. Status and priority render glyph + text with no color class.
- **Motion.** One CSS transition on the client confirmation, wrapped in `@media (prefers-reduced-motion: no-preference)`. `Spinner` falls back to a static dot under reduced motion.
- **Density.** List rows are `h-12` (48px) with 12px vertical padding; everything else uses the 8/16/24/32 scale as Tailwind spacing 2/4/6/8.

## Data Model

Pass 1, `domain-modeling`. Vocabulary in `CONTEXT.md`. The consequential choice is recorded in `docs/adr/0001-ticket-holds-working-copy-extractions-table-holds-attempts.md`.

### Entities and why they are shaped this way

**`projects`** — one per client app. `owner_id` is a nullable `uuid` column with **no foreign key** (there is no users table to point at). It costs nothing today and lets Better Auth land later with an `UPDATE`, not a schema redesign (`scope.md > Later`).

**`tickets`** — the developer's working record. Holds the client's source material (sentence, language, reporter IP hash), workflow (`status`), extraction bookkeeping (`extraction_state`, `extraction_error`, `confidence`), and the **working copy of every ticket field**. Inferred fields are two columns each: the value and its evidence.

**`attachments`** — one row per ticket (unique on `ticket_id`). Kept as its own table rather than columns because Filip listed it as an entity and because "one screenshot" is a hackathon limit, not a domain truth. Stores the storage key, sniffed MIME type, pixel size and byte size. The original file name from the client is **not stored** (it is untrusted and unneeded).

**`extractions`** — append-only log of attempts. **Approved** (ADR 0001): separate table, not columns on the ticket. Each row: which attempt it was, whether it succeeded, the raw response text, the parsed JSON, the error, the model ID, token usage, duration. Nothing in the UI edits these rows.

### `askClient`: derived or stored?

**Approved:** a **Postgres generated column** on `tickets`, `GENERATED ALWAYS AS (…) STORED`.

**Every input to the rule lives on the `tickets` row.** A generated column can only read columns of its own row, never another table. The inputs are `confidence`, `actual_result`, `location`, `client_sentence` and `extraction_state`, and all five are `tickets` columns. `runExtraction` copies `confidence` from the successful attempt onto the ticket in the same `UPDATE` that sets `extracted`, so the flag is computed from the ticket's own copy and never from `extractions`. Any future input to the rule has to become a `tickets` column first. A build-time test asserts this: it inserts an extracted ticket with `confidence = 0.5` and expects `ask_client = true`, then updates `actual_result` and `confidence` and expects the flag to follow.

The rule from `scope.md > The POC Boundary` depends only on columns of the same row: `confidence`, `actual_result`, `location`, `client_sentence`, plus `extraction_state` (added so a `pending` ticket, whose fields are all `NULL`, is not flagged). A generated column means:

- one definition of the rule, in SQL, read by Drizzle like any other column;
- the badge disappears automatically when Filip fills in "What's wrong", because Postgres recomputes it on every `UPDATE`;
- the list filter is `WHERE ask_client` with no duplicated TypeScript rule;
- changing the threshold after the eval decision rule is one small migration (drop and re-add the generated column), audited like any other.

The alternative, a TypeScript `isAskClient(ticket)` plus a matching SQL fragment for the filter, keeps the rule in code but is two implementations of one rule that must be kept in sync. A plain stored boolean maintained by the app is the worst of both: it needs recomputation on every edit path. Drizzle supports `.generatedAlwaysAs(sql\`…\`)` on `pg-core` columns (**verify in build**: the generated-column SQL must appear in the generated migration).

### Schema (Drizzle, `lib/db/schema.ts`)

```ts
import { pgTable, pgEnum, uuid, text, varchar, integer, real, boolean,
         timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const ticketStatus     = pgEnum('ticket_status', ['new', 'in_progress', 'done']);
export const extractionState  = pgEnum('extraction_state', ['pending', 'extracted', 'extraction_failed']);
export const priority         = pgEnum('priority', ['low', 'medium', 'high']);
export const extractionResult = pgEnum('extraction_result', ['succeeded', 'failed']);

export const projects = pgTable('projects', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      text('name').notNull(),
  slug:      varchar('slug', { length: 21 }).notNull(),
  ownerId:   uuid('owner_id'),                       // nullable, no FK yet (Later: Better Auth)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('projects_slug_idx').on(t.slug),
]);

export const tickets = pgTable('tickets', {
  id:              uuid('id').primaryKey().defaultRandom(),
  projectId:       uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  // source material
  clientSentence:  text('client_sentence').notNull(),
  language:        varchar('language', { length: 8 }),           // ISO 639-1, from extraction
  reporterIpHash:  varchar('reporter_ip_hash', { length: 64 }).notNull(),
  // workflow + extraction bookkeeping
  status:          ticketStatus('status').notNull().default('new'),
  extractionState: extractionState('extraction_state').notNull().default('pending'),
  extractionError: text('extraction_error'),
  confidence:      real('confidence'),
  // observed fields (working copy)
  title:           text('title'),
  location:        text('location'),                              // 'unknown' is a valid value
  actualResult:    text('actual_result'),
  priority:        priority('priority'),
  tags:            text('tags').array().notNull().default(sql`'{}'::text[]`),
  // inferred fields (working copy): value + evidence, both null or both set
  expectedResult:          text('expected_result'),
  expectedResultEvidence:  text('expected_result_evidence'),
  stepsToReproduce:        text('steps_to_reproduce').array(),
  stepsToReproduceEvidence:text('steps_to_reproduce_evidence'),
  // derived
  askClient: boolean('ask_client').generatedAlwaysAs(sql`
    extraction_state = 'extracted' AND (
      confidence < 0.6
      OR actual_result IS NULL
      OR (location = 'unknown' AND client_sentence = '')
    )`),                                                            // pg-core generated columns are always STORED
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('tickets_project_created_idx').on(t.projectId, t.createdAt.desc()),
  index('tickets_ip_hash_created_idx').on(t.reporterIpHash, t.createdAt),
]);

export const attachments = pgTable('attachments', {
  id:          uuid('id').primaryKey().defaultRandom(),
  ticketId:    uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  storageKey:  text('storage_key').notNull(),      // e.g. "<projectId>/<ticketId>.png", never a client-provided name
  mimeType:    varchar('mime_type', { length: 32 }).notNull(),
  width:       integer('width').notNull(),
  height:      integer('height').notNull(),
  bytes:       integer('bytes').notNull(),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('attachments_ticket_idx').on(t.ticketId),
]);

export const extractions = pgTable('extractions', {
  id:           uuid('id').primaryKey().defaultRandom(),
  ticketId:     uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  attempt:      integer('attempt').notNull(),              // 1, 2, 3… across automatic and manual retries
  result:       extractionResult('result').notNull(),
  model:        text('model').notNull(),
  rawResponse:  text('raw_response'),                      // exact text the model returned, if any
  parsed:       jsonb('parsed'),                           // the validated ExtractionOutput, on success
  error:        text('error'),                             // Zod issues / API error / refusal, on failure
  inputTokens:  integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  durationMs:   integer('duration_ms'),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('extractions_ticket_attempt_idx').on(t.ticketId, t.attempt),
]);
```

### Postgres, explained (Filip's request)

**Enums versus text + CHECK.** `pgEnum` creates a real Postgres type. Reads are compact and Drizzle gives you the TypeScript union for free. The cost: adding a value later is `ALTER TYPE … ADD VALUE`, which Postgres allows but will not let you *use* in the same transaction, and removing a value is not supported at all. For four small, stable sets that is fine. If a set were expected to churn (tags would be), `text` with a `CHECK` constraint is easier to change. Tags are therefore a plain `text[]`.

**Arrays.** `text[]` for tags and steps keeps them on the row. Postgres can index arrays (GIN) and query them (`@>`), but we need neither in the PoC; a separate `tags` table would be the answer the day tags need to be filtered or renamed globally.

**Why these indexes and not more.**
- `tickets (project_id, created_at DESC)`: the list's one access path is "this project, newest first". A composite index in that order answers it with one range scan. Status and extraction filters narrow a set that is already small; at hundreds of rows per project the planner will use this index and filter the rest in memory. Adding `(project_id, status, created_at)` would only pay off at tens of thousands of tickets.
- `tickets (reporter_ip_hash, created_at)`: the public rate-limit query runs on **every** report submission and must not scan the table. This is the one index that protects the API budget.
- `projects.slug` unique: the lookup on every public page load, and uniqueness is a correctness rule.
- `attachments.ticket_id` unique and `extractions (ticket_id, attempt)` unique: both encode a rule and double as the lookup index.
- **Postgres does not index foreign-key columns automatically** (MySQL does). Every FK above is covered by one of the indexes listed, so deletes and joins stay cheap.
- `ask_client` has no index on purpose. The filter runs over the project's tickets, which the composite index already narrowed.

**Generated columns.** `STORED` means Postgres computes the value on `INSERT`/`UPDATE` and keeps it on disk; reads are as cheap as a normal column. `VIRTUAL` (computed on read) only arrived in Postgres 18 and Drizzle's support is newer; `STORED` is the safe choice.

**Timestamps.** `timestamp with time zone` everywhere. Postgres stores it as UTC and converts on the way out; the "4 min ago" label is computed in the UI from an ISO string.

**Cascades.** Deleting a project deletes its tickets, attachments and extractions. There is no delete UI in the PoC, but the rule is in the schema so a future delete cannot orphan rows. Files on disk are *not* cascaded by Postgres; a future delete action must call `storage.delete` itself.

### Migrations workflow (Drizzle, in Compose)

1. Edit `lib/db/schema.ts`.
2. `npm run db:generate` → `drizzle-kit generate` diffs the schema against `drizzle/meta/` and writes `drizzle/000N_<name>.sql` + a snapshot. **Read the SQL.**
3. `npm run db:check` → `drizzle-kit check` verifies the migration history is consistent (**verified** command).
4. **First migration only, before it is applied:** `migration-auditor` pass, see **Build-time Audits**.
5. `npm run db:migrate` → `drizzle-kit migrate` applies pending files and records them in `drizzle.__drizzle_migrations`. In Compose the one-shot `migrate` service runs this before the app starts.

`drizzle-kit push` (schema sync without files) is **not used**: it has no history and cannot be audited.

```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL! },
  verbose: true,
  strict: true,
});
```

### Where every piece of data lives

| Data | Lives in | Updated by | After navigating away |
| --- | --- | --- | --- |
| Screenshot bytes | `UPLOAD_DIR/<projectId>/<ticketId>.<ext>` on the `uploads` volume | written once at submit | persists; served only through the authenticated route |
| Ticket fields, status, state | `tickets` | extraction (fills `NULL`s) and per-field server actions | persists |
| Model attempts | `extractions` | inserted by `runExtraction`, never updated | persists |
| Session | signed cookie in the browser; nothing server-side | login / sign out | persists 30 days |
| Login failure counts | in-memory `Map` in the Node process | login attempts | lost on restart (accepted; first security cut) |
| Report rate limit | counted from `tickets.reporter_ip_hash` | implicit | persists |
| Client form state | React state in the browser | typing | lost on reload (by design; the client never comes back to edit) |
| List filters | URL search params | filter controls | persists in the URL |

## Modules and Seams

Pass 2, `codebase-design`. Three deep modules carry the complexity; everything else is thin and lives in the route that uses it.

### `lib/extraction` — `extractTicket`

The one function both the server action path and the eval runner call. Its interface is small; its implementation holds the downscale, the prompt, the schema, the parse, the retry policy and the attempt log.

```ts
export type ExtractionInput  = { image: Buffer; mimeType: 'image/png' | 'image/jpeg' | 'image/webp'; sentence: string };
export type ExtractionAttempt = {
  attempt: number; result: 'succeeded' | 'failed'; model: string;
  rawResponse: string | null; parsed: ExtractionOutput | null; error: string | null;
  inputTokens: number | null; outputTokens: number | null; durationMs: number;
};
export type ExtractionOutcome =
  | { ok: true;  output: ExtractionOutput; attempts: ExtractionAttempt[] }
  | { ok: false; error: string;            attempts: ExtractionAttempt[] };

export async function extractTicket(input: ExtractionInput, deps?: { provider?: VisionProvider; now?: () => number }): Promise<ExtractionOutcome>;
```

Invariants callers can rely on: never throws for model or network problems (they come back as `ok: false`); every attempt made is in `attempts`, in order; `output` has already been normalized (lowercased enums, trimmed strings) and validated; the function never touches the database or the file system. Those two facts are what make the eval runner and the unit tests possible without mocks of Next or Postgres.

**`VisionProvider`** is the one internal seam, one method:

```ts
export interface VisionProvider {
  complete(req: { system: string; messages: ProviderMessage[]; schema: JSONSchema; maxTokens: number; timeoutMs: number })
    : Promise<{ text: string | null; stopReason: 'end_turn' | 'max_tokens' | 'refusal' | 'other'; inputTokens: number; outputTokens: number }>;
}
```

`ClaudeProvider` is the only production adapter. A `FakeProvider` in tests, scripted with a list of responses, is the second adapter that makes this a real seam rather than a hypothetical one: the retry policy, the error-feedback turn, the refusal path and the timeout path are all unit-tested against it without spending credits.

Internal files: `schema.ts` (Zod + the derived JSON schema), `prompt.ts` (system prompt and the user turn builder), `image.ts` (downscale), `provider.ts` + `claude.ts`, `policy.ts` (the attempt loop), `index.ts` (exports `extractTicket`).

### `lib/extraction/run.ts` — `runExtraction(ticketId)`

The glue between the pure function and the database. Loads ticket + attachment, reads the file through storage, calls `extractTicket`, inserts one `extractions` row per attempt, and updates the ticket: on success fills columns that are `NULL`, copies `confidence` and `language`, sets `extracted`; on failure sets `extraction_failed` and `extraction_error`. Also the only place that knows the `pending`→`extracted|failed` transition, so **Retry** reuses it unchanged. Idempotent guard: it refuses to run if the ticket is not `pending` (protects against a double `after()`).

### `lib/storage` — files behind two methods

```ts
export interface Storage {
  put(key: string, bytes: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
}
export const storage: Storage = createLocalStorage(env.UPLOAD_DIR);
```

`LocalDiskStorage` joins `UPLOAD_DIR` with the key, creates the project subfolder, writes atomically (temp file + rename). Keys are built by the app (`${projectId}/${ticketId}.${ext}`) and never contain client input, so the path-traversal guard is a `path.resolve` check that the final path is inside `UPLOAD_DIR`, kept as a belt-and-braces assertion. S3 later means one new adapter and one env switch (`scope.md > Later`). An in-memory `MapStorage` serves tests.

### `lib/auth` — session and limits

- `session.ts`: `createSessionToken()`, `verifySessionToken(token)`. HMAC-SHA256 over `base64url({ iat, exp })` keyed with `SESSION_SECRET`. `requireSession()` is called at the top of every dashboard server action and the image route, independently of `proxy.ts`.
- `rate-limit.ts`: `checkLoginAttempts(ip)` / `recordLoginFailure(ip)` over an in-memory `Map<ip, timestamps[]>` (5 per 15 min). `reportLimitHit(ipHash)` runs the `tickets` count query (10 per hour). `hashIp(ip)` is HMAC-SHA256 keyed with `IP_HASH_SECRET`, so stored hashes cannot be reversed with a rainbow table of IPv4 addresses.

**Filip's decision (2026-10-16): one key, one purpose.** `ADMIN_SECRET` is only the access code. `SESSION_SECRET` only signs sessions. Rotating the access code therefore logs nobody out and leaves rate-limit hashes intact. Applying the same rule to the IP hash gives it its own `IP_HASH_SECRET`. Otherwise rotating `SESSION_SECRET` to force a logout would also reset every client's hourly report count. `lib/env.ts` requires all three secrets and rejects the app at startup if any two are equal.

### `lib/tickets` — queries and Markdown

- `queries.ts`: `listTickets({ projectId, extraction, status })`, `getTicket(id)`, `updateTicketField(id, field, value)` with a hard whitelist of editable columns (`title, location, actualResult, priority, tags, expectedResult, stepsToReproduce, status`). Evidence columns are not editable in the PoC; filling an empty inferred field by hand leaves its evidence `NULL`, which the UI renders as "Added by you".
- `markdown.ts`: `ticketToMarkdown(ticket)`, pure. Implements the format in `prd.md > Reviewing a ticket` exactly: empty fields omitted, `_(suggested)_` markers only on inferred fields that were filled by extraction (evidence present), pending tickets reduce to the heading with the sentence as title plus the `> Client:` line.

### Thin layers

Server actions in `app/actions/*.ts` validate input with Zod, call one module function, and return `{ ok } | { ok: false, message }` shaped for the UI copy in the PRD. Pages are server components that call `lib/tickets/queries`. Client components hold only form and polling state.

## Save-Then-Extract: the Decision

Pass 3. Flagged as promised. Criteria from Filip: works in Compose on a 2 GB box, survives a request timeout, carries the retry policy from `scope.md`, finishable in a day.

| Option | 2 GB Compose | Survives request timeout | Retry policy | Day-sized | Verdict |
| --- | --- | --- | --- | --- | --- |
| **(a) `after()` in the server action** | Yes: same process, no extra memory | Yes: the response is already sent; the work runs on in the Node process. Docs: "fully supported when self-hosting with `next start`"; on `SIGTERM` the server "will finish in-flight requests and execute any pending `after()` callbacks before exiting" (**verified**) | Yes: the loop lives in `extractTicket` | Hours | **Recommended** |
| (b) Internal route called after save | Yes | Yes, but it is the same process calling itself over HTTP | Yes | Hours | No benefit over (a) on one container; adds an internal secret and a network hop |
| (c) `extraction_jobs` table + polling worker in the same container | Yes | Yes, and survives a crash | Yes | Half a day to a day: a worker loop in `instrumentation.ts`, locking (`FOR UPDATE SKIP LOCKED`), double-start in dev | Right answer the day there are two app instances; not now |
| (d) pg-boss | Yes (own schema in the same Postgres; needs Node ≥ 22.12, fine) | Yes, crash-safe, retries built in | Yes, but its retry settings would replace ours | A day plus learning under deadline; a long-lived worker inside Next | Over budget for the PoC |

**Approved for the hackathon: (a).**

**Timeouts and redeploys.** A Caddy or Next request timeout does not cancel `after()` work. The callback runs only after the response is finished, and the docs say it runs "even if the response didn't complete successfully" (**verified**). Its lifetime is the Node process, not the HTTP request. A redeploy in the middle of a call is covered twice. A graceful stop with `SIGTERM` lets the callback finish within `stop_grace_period`. A hard kill is caught by the startup check below, which marks the stuck ticket failed so Retry can run it again.

Two cheap guards close the one gap (a) has, a process crash or redeploy in the middle of an extraction:

1. **Stale-pending recovery on boot.** `instrumentation.ts` `register()` runs once when the server starts (**verified**: Next.js runs code on server startup via `register`). It marks tickets `pending` for more than 10 minutes as `extraction_failed` with the error "Extraction interrupted by a restart. Retry when ready." Filip then uses the normal **Retry** button.
2. **The `extractions` log.** Even if a crash happens after an attempt was recorded, the evidence of what happened is in the table.

What (a) does *not* give us and we accept: no concurrency control across instances (there is one), no retry after the process dies (the Retry button is the retry). The one-line upgrade path is `runExtraction` becoming a job handler; nothing in `extractTicket` changes.

**Build-time check for this decision (the agreed investigation, see Decisions):** submit a report, `docker compose kill app` during the extraction, `docker compose up app`, and confirm the ticket shows the interrupted error and Retry works.

## Structured Output Strategy

Pass 4. Flagged as promised; this is the heart of Filip's learning goal.

### Three options, one recommendation

| Approach | What enforces the shape | Trade-off |
| --- | --- | --- |
| Prompt "reply with JSON" + Zod parse | Nothing on the server; Zod rejects after the fact | Highest invalid-JSON rate; retries cost credits |
| Tool use with `strict: true` and the schema as tool input | API validates tool input against the schema | Works, but the "tool" is a fiction; response arrives as a `tool_use` block |
| **`output_config.format` (`json_schema`) + `zodOutputFormat` + `messages.parse()`** | API constrains generation to the schema; SDK validates again with Zod locally | GA, no beta header, one code path, `parsed_output` typed from the schema (**verified**) |

**Approved:** the third, with SDK retries off. The server guarantees the *shape*; Zod guarantees the *constraints the API cannot express* (numeric ranges, string lengths, patterns, `minItems > 1`), which the docs list as unsupported in the request schema. The one Zod-failure retry therefore only ever fires on those local constraints or on an enum-casing mismatch, which the docs warn about.

### The Zod schema (`lib/extraction/schema.ts`)

```ts
import { z } from 'zod';

const Priority = z.enum(['low', 'medium', 'high']);

const Inferred = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value,
    evidence: z.string().min(8).max(300)
      .describe('What in the screenshot or sentence supports this. Quote visible text or name the UI element. Required.'),
  }).nullable();

export const ExtractionOutput = z.object({
  observed: z.object({
    title: z.string().min(3).max(90)
      .describe('Short imperative English summary of the problem, e.g. "Save button does nothing on appointment form".'),
    location: z.string().min(1).max(120)
      .describe('Screen, page, URL path or component where it happened, as visible. Exactly "unknown" if not visible.'),
    actualResult: z.string().min(3).max(400).nullable()
      .describe('What actually happened, from the screenshot and sentence only. null if neither shows it.'),
    priority: Priority
      .describe('low: cosmetic; medium: a task is harder; high: a task is blocked or data is at risk.'),
    tags: z.array(z.string().min(2).max(24)).max(5)
      .describe('0–5 lowercase tags such as "form", "booking", "validation", "layout", "auth".'),
  }),
  inferred: z.object({
    expectedResult: Inferred(z.string().min(3).max(400))
      .describe('What should have happened instead. null unless the screenshot or sentence makes it clear.'),
    stepsToReproduce: Inferred(z.array(z.string().min(3).max(200)).min(1).max(8))
      .describe('Steps a developer can follow. null unless the screenshot shows the path the client took.'),
  }),
  confidence: z.number().min(0).max(1)
    .describe('How sure you are the observed fields are right, 0 to 1.'),
  language: z.string().regex(/^[a-z]{2}$/)
    .describe('ISO 639-1 code of the client sentence, e.g. "bs", "hr", "sr", "en".'),
});
export type ExtractionOutput = z.infer<typeof ExtractionOutput>;
```

Shape decisions worth noticing:

- **Inferred field = `null` or `{ value, evidence }`.** The scope's "evidence string or null" is encoded structurally: a filled inferred field *cannot* arrive without evidence. This is the schema doing the honesty work.
- **Only three nullable unions** (`actualResult`, `expectedResult`, `stepsToReproduce`), well under the API's limit of 16 union-typed properties. No optional properties, so the "optional count" limit does not apply.
- **No "reasoning" field.** The docs say a property that asks for step-by-step reasoning can trigger a `reasoning_extraction` refusal. Evidence is a pointer, not a chain of thought.
- **Before parsing:** `priority` and `language` are lowercased; strings trimmed; empty strings in `tags` dropped; a `location` that equals "unknown" in any casing is stored as the lowercase literal so the generated column and the UI ("Unknown") agree. The docs state enum capitalization is not guaranteed.
- `maxItems`, `min`/`max` on numbers and strings, and the regex are enforced **locally** by Zod; `zodOutputFormat` moves them into descriptions for the API. That is exactly why the Zod retry exists.

### The call (`lib/extraction/claude.ts` + `policy.ts`)

```ts
const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 0 });
//                                                         ^ we own the retry policy; the SDK's default of 2 would silently exceed scope.md

const msg = await client.messages.parse({
  model: env.EXTRACTION_MODEL,                 // default 'claude-sonnet-5-5'
  max_tokens: 8192,                            // covers adaptive thinking + ~500 tokens of JSON
  system: SYSTEM_PROMPT,
  messages: [{ role: 'user', content: [
    { type: 'image', source: { type: 'base64', media_type: mimeType, data: image.toString('base64') } },
    { type: 'text',  text: userTurn(sentence) },
  ]}],
  output_config: { format: zodOutputFormat(ExtractionOutput) },
}, { timeout: 60_000 });
```

- **Image first, text second**: the vision docs say Claude "works best when images come before text" (**verified**).
- **`max_tokens: 8192`.** The largest valid JSON (8 steps, long evidence) is about 500 tokens. On Sonnet 5.5 adaptive thinking is on by default and its tokens count against `max_tokens`. 1024 would risk cutting the answer off mid-thought, and 8192 leaves room. Thinking is kept on because it may help visual grounding, and the eval will show whether it does. `stop_reason: 'max_tokens'` is treated as a failure and is not retried with a bigger budget. Every attempt records `outputTokens`, so the eval reports the real thinking cost. If thinking turns out to be costly without improving accuracy, the cheaper setting is the `between_tools` thinking mode, which turns off up-front thinking. Its exact request shape is **verify in build** against the [effort](https://platform.claude.com/docs/en/build-with-claude/effort) and [thinking](https://platform.claude.com/docs/en/build-with-claude/thinking) docs.
- **`timeout: 60_000` per attempt.** Typical vision calls return in 5–15 seconds; a minute is generous without holding a `pending` row for long. The SDK throws `APIConnectionTimeoutError`.
- **Refusal.** `stop_reason: 'refusal'` arrives as HTTP 200 and is billed; treated as a final failure with the error "Model declined to describe this image" and no retry.

### Retry policy, as code paths (`scope.md > The POC Boundary`)

```
attempt 1 ─┬─ parsed OK ───────────────────────────────▶ succeeded
           ├─ Zod issues ──▶ attempt 2 with the issues fed back ─┬─ OK ──▶ succeeded
           │                                                      └─ any failure ─▶ failed
           ├─ timeout / 429 / 5xx / connection ──▶ wait 4 s ──▶ attempt 2 (same request) ─┬─ OK ──▶ succeeded
           │                                                                               └─ any failure ─▶ failed
           └─ refusal / max_tokens / 400 ───────────────────────────────────────────────────▶ failed (no retry)
```

**Feeding the Zod error back.** The second request is again a single `user` turn: the image, the original text, then one more text block. That block quotes the previous answer in a fenced block and says: "That answer did not pass validation: `<path>: <message>` (one line per issue). Return the corrected JSON only. Do not add fields you cannot support; use null." The previous answer is quoted inside the user turn rather than replayed as an `assistant` turn. Sonnet 5.5 ties thinking blocks to the model and conversation that produced them, and a replayed assistant turn without its thinking block is a known way to get a 400. Both attempts are recorded in `extractions`, so the eval can later count how often the retry was needed and whether it helped.

### Image downscale (`lib/extraction/image.ts`)

`sharp(buffer).rotate().resize({ width: LIMIT, height: LIMIT, fit: 'inside', withoutEnlargement: true })`, then re-encode: PNG stays PNG (lossless; screenshots are mostly text), JPEG and WebP become JPEG at quality 90. `rotate()` honors phone EXIF orientation so a photo of a monitor is upright.

**Approved: `EXTRACTION_MAX_EDGE=1568`, env-configurable.** The approval rested on Sonnet 4.6's standard-tier limit of 1568 px, which avoided double resampling. With the default now `claude-sonnet-5-5`, that premise changed. 5.5 is in the high-resolution tier with a 2576 px long edge and up to 4784 visual tokens (**verified**, [vision](https://platform.claude.com/docs/en/build-with-claude/vision)). At 1568 the API does not resize again; it just sees fewer pixels than it could. A tall phone screenshot, for example 1170×2532, arrives about 725 px wide at 1568 and about 1190 px wide at 2576. Small UI text may be harder to read at the narrower size. The cost of the larger size is about 2.5× the image tokens, roughly half a cent more per ticket on 5.5. The 1568 default stays as approved. The first eval run uses it, and a second run at `EXTRACTION_MAX_EDGE=2576` costs about a dollar and answers the question with data. Recorded under **Open Issues**.

### The prompt (`lib/extraction/prompt.ts`, skeleton)

System: you are turning a client's bug report into a developer ticket; the client is non-technical and may write in Bosnian, Croatian, Serbian or English; write every field in English; the observed fields describe only what is visible in the screenshot or stated in the sentence; `location` is exactly "unknown" when no screen name, URL or heading is visible; `actualResult` is null if neither source shows what went wrong; inferred fields are null unless you can point at specific visible evidence, and evidence must quote or name something in the image or sentence; never invent steps the screenshot does not show; priority rubric; tags are lowercase nouns; confidence is about the observed fields; detect the sentence's language.

User turn: the image, then "Client wrote: «<sentence>»". The sentence is passed as data inside guillemets; the system prompt tells the model to treat it as the client's words, not instructions (a client could paste anything).

The prompt text is versioned in the file with a `PROMPT_VERSION` constant that `extractions.model` includes (e.g. `claude-sonnet-5-5@p1`; the eval also records `EXTRACTION_MAX_EDGE` per run) so eval runs are comparable across prompt edits.

## Security Checklist

Pass 6, `vibesec-skill`, applied to the four areas Filip named. Each line is a build requirement a slice can be checked against.

**Public report route (`/r/<slug>`, `submitReportAction`)**
- [ ] Slug lookup only; unknown slug → `notFound()`. No listing of projects anywhere public.
- [ ] Rate limit: count of `tickets` with this `reporter_ip_hash` in the last hour ≥ 10 → reject with the PRD message. Checked **before** writing the file.
- [ ] Client IP: first value of `x-forwarded-for`. Behind Caddy, Caddy overwrites the header with the real client address. Locally Next fills it from the socket only when the client sent none, so a client on the same network could spoof it; accepted for local use (Filip, 2026-10-16), since a server action cannot read the socket and deploys always sit behind Caddy.
- [ ] Size: reject > 5 MB server-side regardless of the browser check. `experimental.serverActions.bodySizeLimit: '6mb'` in `next.config.ts` (**verified** on Next 16.4). Caddy on the server gets `request_body { max_size 6MB }`.
- [ ] Type: MIME from the browser is ignored; `sharp(buffer).metadata().format` must be `png | jpeg | webp`, else reject with the PRD message. SVG and GIF are therefore impossible to store.
- [ ] Dimensions: reject > 8000 px on either edge (API hard limit) with the "under 5 MB" message's sibling: "Choose a smaller image."
- [ ] Path traversal: storage key is `${projectId}/${ticketId}.${ext}` built from UUIDs and the sniffed format; client file name never read. `LocalDiskStorage` asserts the resolved path starts with `UPLOAD_DIR`.
- [ ] Sentence: Zod `min(10).max(1000)`, stored as text, rendered by React (escaped). Shown in Markdown export inside a quote; no HTML rendering anywhere.
- [ ] No AI call in the request path, so a malicious image cannot run up the bill faster than the rate limit allows (10 extractions per IP per hour ≈ 10 cents).

**Admin secret and session cookie**
- [ ] `ADMIN_SECRET` ≥ 16 characters, compared with `crypto.timingSafeEqual` on equal-length buffers.
- [ ] Cookie `snag_session`: `httpOnly`, `secure` when `APP_URL` starts with `https`, `sameSite: 'strict'`, `path: '/'`, `maxAge: 30 days`. Value `base64url(payload).base64url(hmac)`; payload `{ iat, exp }` only.
- [ ] HMAC-SHA256 keyed with `SESSION_SECRET` (32+ random bytes, separate from the access code); verification checks signature **then** `exp`. Rotating `ADMIN_SECRET` must not invalidate sessions; a unit test asserts it.
- [ ] Reporter IP hashes keyed with `IP_HASH_SECRET`; `lib/env.ts` rejects startup if any two of the three secrets are equal.
- [ ] Login CSRF: `sameSite=strict` plus Next.js server actions' built-in Origin check. No extra token in the PoC.
- [ ] Login rate limit: 5 failures per IP per 15 minutes, in memory; message per PRD. Successful login does not reset other IPs.
- [ ] Sign out: cookie cleared with `maxAge: 0`.
- [ ] `proxy.ts` redirects unauthenticated `/dashboard/*` to `/login`; **and** every dashboard server action and the image route call `requireSession()` themselves (defense in depth; the proxy is a convenience, not the gate).

**Authenticated image route (`/dashboard/images/[ticketId]`)**
- [ ] `requireSession()` first; failure → 404, not 401, so the route reveals nothing.
- [ ] `ticketId` validated as UUID by Zod; attachment row looked up; file read via `storage.get(row.storageKey)`. The URL never carries a path.
- [ ] Headers: `Content-Type` from the row, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline; filename="screenshot.<ext>"`, `Cache-Control: private, no-store`.
- [ ] Uploads folder is outside `public/` and outside the Next build output; the app process is the only reader.

**Secrets**
- [ ] `.env` and `.env.*` ignored; `.env.example` committed with empty values and one comment per variable. `.dockerignore` excludes `.env` too (the image must never contain it; Compose injects at runtime).
- [ ] No `NEXT_PUBLIC_` variable holds anything secret. The only public value is `APP_URL`, read on the server and passed as a prop.
- [ ] `lib/env.ts` parses `process.env` with Zod at startup and fails fast with the variable name, never its value.
- [ ] Anthropic client constructed only in `lib/extraction/claude.ts`, imported only from server code; `import 'server-only'` at the top.
- [ ] Error messages to the client are the PRD strings; stack traces and SQL stay in server logs.

**Headers (app-wide, `next.config.ts`)**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`. A CSP is **deferred**: shadcn and Next inline styles make a strict CSP a half-day of its own, and the surface that would benefit (public page) renders no user HTML.

## Docker Compose

Pass 7. Written once; the server differs by values, not structure.

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:18-alpine
    environment:
      POSTGRES_USER: snag
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: snag
    volumes:
      - db_data:/var/lib/postgresql          # Postgres 18: PGDATA is /var/lib/postgresql/18/docker (verified)
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U snag -d snag"]
      interval: 5s
      timeout: 3s
      retries: 10
    restart: unless-stopped

  migrate:
    build:
      context: .
      target: migrate                        # stage with node_modules + drizzle/ + drizzle.config.ts
    environment:
      DATABASE_URL: postgres://snag:${POSTGRES_PASSWORD}@db:5432/snag
      UPLOAD_DIR: /data/uploads
    command: ["npx", "drizzle-kit", "migrate"]
    volumes:
      - uploads:/data/uploads                # so `docker compose run --rm migrate npx tsx scripts/seed.ts` can copy seed images
    depends_on:
      db: { condition: service_healthy }
    restart: "no"

  app:
    build:
      context: .
      target: runner                         # standalone Next output, ~150 MB
    env_file: .env                           # ANTHROPIC_API_KEY, ADMIN_SECRET, APP_URL, …
    environment:
      DATABASE_URL: postgres://snag:${POSTGRES_PASSWORD}@db:5432/snag
      UPLOAD_DIR: /data/uploads
      PORT: "3000"
    volumes:
      - uploads:/data/uploads
    ports:
      - "${APP_BIND:-0.0.0.0}:3000:3000"     # local: LAN-reachable for the phone; server: 127.0.0.1 behind Caddy
    depends_on:
      db:      { condition: service_healthy }
      migrate: { condition: service_completed_successfully }
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/api/health"]
      interval: 15s
      timeout: 3s
      retries: 5
    restart: unless-stopped

volumes:
  db_data:
  uploads:
```

**Dockerfile, three stages.** `deps` (`npm ci`), `builder` (`next build` with `output: 'standalone'`), `migrate` (from `deps`, copies `drizzle/`, `drizzle.config.ts`, `lib/`, `scripts/`, `seed/images/`; also runs the seed, which needs the uploads volume mounted on this service too), `runner` (`node:24-alpine`, copies `.next/standalone`, `.next/static`, `public/`; runs as non-root `node`; `CMD ["node", "server.js"]`). `sharp` needs no extra packages on Alpine with Node 24 (prebuilt binaries); **verify in build** on first `docker compose up`.

**Explained (Filip's request).**
- **Why a separate `migrate` service instead of migrating on app start.** The standalone output prunes `node_modules` to what the app imports, so `drizzle-kit` is not there. A one-shot service from the full-dependency stage runs the migration, exits 0, and `depends_on … service_completed_successfully` gates the app on it. Compose shows migration failures as their own log, not buried in the app's.
- **Named volumes.** `db_data` and `uploads` are directories Docker manages on the host (`/var/lib/docker/volumes/...` on Linux, inside the WSL2 VM on Windows). `docker compose down` keeps them; only `docker compose down -v` deletes them. Rebuilding the app image never touches them. The image is disposable; the volumes are the product's state.
- **Healthchecks.** `pg_isready` answers once Postgres accepts connections, which is later than "container started"; without the condition the migration would race the database and fail on first boot. The app's `/api/health` returns 200 after a `SELECT 1`; Caddy or a future monitor can use it.
- **Memory on a CPX12 (2 GB).** Postgres defaults to `shared_buffers = 128MB`; Next standalone idles around 150–250 MB; `sharp` spikes briefly per image. Leaves headroom. No tuning in the PoC.
- **What to back up.** The two volumes and `.env`. Database: `docker compose exec db pg_dump -U snag snag | gzip > snag-$(date +%F).sql.gz`. Uploads: `docker run --rm -v snag_uploads:/u -v $PWD:/b alpine tar czf /b/uploads-$(date +%F).tgz -C /u .`. Restore is `psql` + `tar xzf` into fresh volumes. For the hackathon a manual dump before the video is enough; a cron line is a post-hackathon item.
- **Graceful shutdown.** `docker compose stop` sends `SIGTERM` and waits 10 s by default; Next finishes in-flight requests and pending `after()` callbacks (**verified**). Set `stop_grace_period: 30s` on `app` so a 60 s extraction attempt is not cut off at 10 s.

**What differs on the server.** Same file. Values in `.env`: `APP_URL=https://snag.<domain>` (turns on the `secure` cookie), `APP_BIND=127.0.0.1` (Caddy is the only thing that reaches port 3000), and of course different secrets. Caddy gets one site block: `reverse_proxy 127.0.0.1:3000` plus the request body limit. That is the "copy and two env vars" promised in scope.

**Local development** keeps `docker compose up -d db` and `npm run dev` on the host (`DATABASE_URL=postgres://snag:…@localhost:5432/snag`, `UPLOAD_DIR=./.uploads`, git-ignored) so hot reload works.

## Eval Runner

Pass 8. Implements `scope.md > The POC Boundary` (Eval runner) and the two decision rules.

### Inputs

`eval/cases.json` (committed; images are not):

```jsonc
[
  {
    "id": "007",
    "image": "images/007-appointment-save.jpg",
    "sentence": "Kliknula sam Sačuvaj na terminu i ništa se nije desilo.",
    "author": "receptionist, Bosnian",
    "reference": {
      "title":        { "mustMention": ["save", "appointment"] },
      "location":     { "accept": ["Appointments", "/appointments/new", "New appointment"] },
      "actualResult": { "mustMention": ["save", "nothing"], "nullable": false },
      "priority":     "high",
      "tags":         { "anyOf": ["booking", "form", "appointment"] },
      "expectedResult":   { "mustMention": ["saved"], "orNull": false },
      "stepsToReproduce": null
    },
    "notes": "Screenshot shows the filled form and the Save button; no error toast. Steps are NOT inferable: we cannot see how she got there."
  }
]
```

`reference.stepsToReproduce: null` (or `expectedResult: null`) means "nothing in the material supports this field; the correct answer is null".

### Matching rules, per field

| Field | Match when | Edit counted when |
| --- | --- | --- |
| `title` | every `mustMention` keyword appears (case-insensitive, substring) | otherwise |
| `location` | normalized value is in `accept`, or both are `unknown` | otherwise |
| `actualResult` | `mustMention` satisfied; or reference `nullable: true` and model gave null | otherwise |
| `priority` | equal | otherwise |
| `tags` | at least one of `anyOf` present | otherwise |
| `expectedResult` | reference null and model null; or reference set and `mustMention` satisfied | mismatch; **and if reference is null and model is not → INVENTED** |
| `stepsToReproduce` | reference null and model null; or reference has `mustMention` groups, each satisfied by some step, and model step count ≤ reference `maxSteps` | mismatch; **and if reference is null and model is not → INVENTED** |

**Accepted** = edits ≤ 1 (seven fields, so an accepted ticket matches at least six). **Invented** = any inferred field filled where the reference says null. One invented field anywhere fails the run's second success criterion regardless of the acceptance rate (`scope.md > Success bar`).

Honest limits, written into `eval/README.md`: keyword matching is a proxy for "I would not edit this". It can pass a clumsy sentence that contains the right words and fail a good one phrased differently. For that reason the runner has `--review`, which prints model output beside the reference for each non-matching field, and `eval/verdicts.json` lets Filip override a field verdict by hand (`{ "007": { "title": "match" } }`); overrides are counted and reported separately so the README number states how many were manual.

### Output

```
id   conf  title where what prio tags expct steps  edits  verdict
007  0.72   ✓     ✓     ✓    ✓    ✓    ✓     ✓(null) 0     accepted
012  0.41   ✓     ✗     ✓    ✓    ✓    null  ✓       1     accepted      ask-client
015  0.88   ✓     ✓     ✓    ✗    ✓    ✓     INVENTED 1    FAIL: invented step

Accepted 11/14 (79%)   Invented fields: 1   Zod retries used: 2/14   Mean confidence accepted 0.74 / not accepted 0.52
Confidence check: 5 lowest-confidence = {012, 003, 009, 014, 006}; 5 most-edited = {015, 003, 009, 011, 002}; overlap 2 → keep confidence in badge rule, tune threshold (see table of thresholds 0.4–0.8 with resulting badge precision)
```

Every run also writes `eval/results/<timestamp>.json` with the full `ExtractionOutcome` per case (raw text, attempts, usage), so prompt changes can be compared offline. `--runs 3` repeats each case and reports per-field agreement, which is the cheapest way to see how much the model wobbles on the same input.

The runner imports `extractTicket` from `lib/extraction` and `ClaudeProvider` from `lib/extraction/claude.ts`; it does not touch the database. Run with `tsx` (`npm run eval`).

## Install Steps

In order, each a `5-build` slice boundary.

1. `npx create-next-app@latest snag --ts --tailwind --app --src-dir=false --import-alias "@/*"` (Next 16, Tailwind v4, Turbopack). Confirm `proxy.ts` is the convention on the installed version.
2. `npx shadcn@latest init -t next --base base` — the CLI's `-b, --base <base>` option accepts `base | radix | aria` (**verified**); `base` is the Base UI variant (**verify in build**: the init summary names `@base-ui/react`). Then `npx shadcn@latest add button input textarea field badge toast dialog select empty spinner table kbd attachment`. **Catalog check result:** all thirteen components exist under the Base UI namespace (`/docs/components/base/…`) as of 2026-10-16 (**verified**), so the Radix fallback from `prd.md > Components` is not needed. Toast on the Base variant wraps Base UI Toast (**verified**).
3. `npx shadcn@latest add https://www.kibo-ui.com/r/dropzone.json` — installs `react-dropzone` and `lucide-react`, depends on shadcn `button` only (**verified**).
4. `npm i drizzle-orm pg @anthropic-ai/sdk zod sharp nanoid` and `npm i -D drizzle-kit @types/pg vitest tsx`.
5. `docker compose up -d db`, write `lib/db/schema.ts`, `npm run db:generate`, **migration-auditor pass**, `npm run db:migrate`.

## Build-time Audits

**`migration-auditor` on the first migration.** The skill is written for Prisma; the checklist transfers to Drizzle one-to-one, the commands change:

| Skill step (Prisma) | Drizzle equivalent |
| --- | --- |
| `prisma migrate status` | `drizzle-kit check` + inspect `drizzle/meta/_journal.json` |
| `prisma migrate diff --script` | read `drizzle/0000_*.sql` directly (it *is* the script) |
| checksum drift | Drizzle records applied hashes in `drizzle.__drizzle_migrations`; never edit an applied file |
| destructive-op scan | same: `DROP`, `NOT NULL` without default, enum changes, `UNIQUE`/FK on existing data, index without `CONCURRENTLY` |

Expected result for migration 0000 on an empty database: all statements are `CREATE`, four `CREATE TYPE`, no `DROP`, no backfill; recommendation **go**. The one thing to confirm by eye: the `ask_client` generated column appears as `GENERATED ALWAYS AS (…) STORED` and the three indexes are present. Filip applies it himself after reading the report.

**`vibesec-skill`** checklist above is re-run against the diff of the slices that touch the public route, auth, the image route and env handling.

## File Structure

```
snag/
├── app/
│   ├── layout.tsx                     # fonts, <Toaster/>, data-surface switch
│   ├── globals.css                    # @theme tokens from prd.md > Look and Feel
│   ├── api/health/route.ts            # SELECT 1 → 200, for Compose healthcheck
│   ├── r/[slug]/
│   │   ├── page.tsx                   # server: project by slug, renders form   (prd: Reporting a problem)
│   │   └── report-form.tsx            # client: Dropzone, Attachment, validation, confirmation state
│   ├── login/
│   │   ├── page.tsx
│   │   └── login-form.tsx             # client: Field + error copy             (prd: Getting in)
│   ├── dashboard/
│   │   ├── layout.tsx                 # shell: wordmark, project switcher, Copy report link, sign out
│   │   ├── page.tsx                   # ticket list, reads searchParams        (prd: Working the list)
│   │   ├── ticket-list.tsx            # client: keyboard nav, poll while pending
│   │   ├── tickets/[id]/
│   │   │   ├── page.tsx               # two columns, server-rendered           (prd: Reviewing a ticket)
│   │   │   ├── ticket-fields.tsx      # client: editable fields, save on blur, status/priority selects
│   │   │   └── source-panel.tsx       # screenshot + dialog, client sentence, meta
│   │   └── images/[ticketId]/route.ts # authenticated image                    (prd: Who sees what)
│   └── actions/
│       ├── auth.ts                    # loginAction, signOutAction
│       ├── report.ts                  # submitReportAction (+ after → runExtraction)
│       ├── tickets.ts                 # updateTicketFieldAction, retryExtractionAction
├── proxy.ts                           # redirect /dashboard/* without a valid cookie
├── instrumentation.ts                 # register(): stale-pending recovery
├── lib/
│   ├── env.ts                         # Zod-parsed process.env, fail fast
│   ├── db/
│   │   ├── client.ts                  # pg.Pool singleton + drizzle()
│   │   └── schema.ts                  # the Data Model above
│   ├── extraction/
│   │   ├── index.ts                   # extractTicket (the one function)
│   │   ├── schema.ts                  # ExtractionOutput (Zod)
│   │   ├── prompt.ts                  # SYSTEM_PROMPT, userTurn(), PROMPT_VERSION
│   │   ├── image.ts                   # downscale with sharp
│   │   ├── provider.ts                # VisionProvider interface
│   │   ├── claude.ts                  # ClaudeProvider (server-only)
│   │   ├── policy.ts                  # attempt loop, retry rules, error feedback turn
│   │   └── run.ts                     # runExtraction(ticketId): DB + storage glue
│   ├── storage/
│   │   ├── index.ts                   # Storage interface + createLocalStorage
│   │   └── local.ts                   # LocalDiskStorage
│   ├── auth/
│   │   ├── session.ts                 # SESSION_SECRET sign/verify, requireSession
│   │   └── rate-limit.ts              # login Map, report count, hashIp
│   └── tickets/
│       ├── queries.ts                 # list/get/update with field whitelist
│       └── markdown.ts                # ticketToMarkdown
├── components/
│   ├── ui/                            # shadcn (Base UI) + kibo dropzone
│   ├── state-badge.tsx                # extracted/pending/failed/ask-client with dot
│   ├── status-glyph.tsx, priority-bars.tsx
│   └── copy-button.tsx                # clipboard + toast, used for link and Markdown
├── drizzle/                           # generated SQL + meta/ (committed)
├── drizzle.config.ts
├── scripts/
│   └── seed.ts                        # idempotent seed: project + 3 tickets + images (tsx, from the migrate stage in Compose)
├── seed/images/                       # fake screenshots for seed (committed, no real data)
├── eval/
│   ├── run.ts                         # the runner
│   ├── cases.json                     # references (committed)
│   ├── verdicts.json                  # manual overrides (committed, may be empty)
│   ├── images/                        # git-ignored
│   ├── results/                       # git-ignored
│   └── README.md                      # how the numbers are computed, "synthetic" label
├── tests/                             # vitest: extraction policy (FakeProvider), schema normalization,
│                                      #         markdown, session, rate-limit, storage path guard
├── Dockerfile, docker-compose.yml, .dockerignore
├── .env.example
├── CONTEXT.md                         # glossary (domain-modeling)
├── docs/adr/0001-….md                 # extraction table decision
└── devpost/                           # learner-profile (ignored), scope, prd, spec, checklist
```

## External Services and Dependencies

**Claude API.** `POST https://api.anthropic.com/v1/messages` via the SDK (`client.messages.parse`). Auth: `ANTHROPIC_API_KEY` from `.env`. Payload: see **The call**. Response: `parsed_output` typed as `ExtractionOutput`, plus `stop_reason`, `usage.input_tokens`, `usage.output_tokens`. Rate limits: Console tier dependent; 429 handled by the one delayed retry. Cost: about one to three cents per ticket on Sonnet 5.5 including adaptive thinking. Docs: [Messages](https://platform.claude.com/docs/en/api/messages/create), [Vision](https://platform.claude.com/docs/en/build-with-claude/vision), [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [TS SDK](https://platform.claude.com/docs/en/api/sdks/typescript).

**Postgres 18** in Compose. No external host. [Image docs](https://hub.docker.com/_/postgres).

**Fonts.** IBM Plex Sans and Mono through `next/font/google`, downloaded at build time and self-hosted by Next; no runtime call to Google.

Nothing else leaves the box.

## Important Failure Modes

- **Claude is slow or down** → the client already has the confirmation. The ticket sits in `pending` for up to ~2 minutes (two 60 s attempts plus the delay), then shows "Couldn't read screenshot" with **Retry extraction**. Filip can write the ticket by hand meanwhile.
- **The model returns a shape Zod rejects twice** → `extraction_failed`, the Zod issues stored in `extraction_error` and shown under "Details". The eval counts these so we learn whether the schema or the prompt is at fault.
- **The process restarts mid-extraction** → `instrumentation.ts` marks the stale `pending` ticket failed with "interrupted" on boot; Retry works.
- **Phone uploads a 12 MB photo of a monitor** → the Dropzone rejects it inline before upload with the PRD message; if the browser check is bypassed, the server rejects it too and the form shows the same message.
- **Disk full on the uploads volume** → `storage.put` throws before any DB write, the action returns the "Couldn't send the report" message, nothing is half-saved.
- **Wrong `ADMIN_SECRET` five times from one IP** → login locked for 15 minutes for that IP; the server log records it.

## What Was Simplified and Why

- **`after()` instead of a job queue** — one process, no polling loop, no new dependency. The fuller version (table + worker or pg-boss) would take a day and only pays off with multiple app instances.
- **Polling instead of streaming** for pending rows — `router.refresh()` every 3 s while a pending row is visible, stopped otherwise. Server-sent events would need a long-lived route, Caddy buffering config and reconnect logic for a state that lasts ten seconds. Resolves `prd.md > Open Questions`.
- **In-memory login rate limit** — resets on restart. It is the first security cut in `scope.md > If We Lose Two Days`; a Postgres-backed counter is a 30-minute upgrade.
- **No CSP header** — deferred; see **Security Checklist**.
- **Tags as `text[]`** and comma-separated input — a tags table and token input are post-hackathon.
- **Seed images from a `seed/images/` folder** — fake screenshots of a test environment, committed. The one pre-extracted ticket's fields are hard-coded in the seed script, so the video never depends on a live call.
- **Keyword-rubric eval with manual override** — an LLM judge would add cost and circularity; pure manual verdicts would not be repeatable. The rubric plus `--review` plus `verdicts.json` is repeatable and honest about its limits.

## Decisions and Open Issues

### Filip's decisions at review (2026-10-16)

1. **Separate `extractions` table, edits on `tickets` columns, attempts never edited** (ADR 0001). Approved.
2. **`ask_client` as a stored generated column.** Approved, with the condition that every input to the rule lives on the ticket row. Confirmed in **Data Model** and covered by a test.
3. **`after()` in the server action** plus the stale-pending recovery. Approved for the hackathon. Request timeouts do not cancel the work, and a redeploy mid-call is covered by the startup check. Written into **Save-Then-Extract**.
4. **`output_config.format` with `zodOutputFormat` + `messages.parse`**, SDK `maxRetries: 0`. Approved.
5. **Downscale limit 1568 px, env-configurable.** Approved. See the open issue below on how decision 7 changed its premise.
6. **Separate `SESSION_SECRET`** instead of keys derived from the access code. The derived-key recommendation was **not approved**. Filip's rule: "One key, one purpose; rotating the access code must not log everyone out or reset the rate-limit hashes." Applying the same rule, the IP hash gets its own `IP_HASH_SECRET` (agent's reading of the rule; see **lib/auth**).
7. **Default model `claude-sonnet-5-5`**, ID in `EXTRACTION_MODEL` so 4.6 can be compared later. The eval runs on 5.5 first. Consequences carried into the spec: `max_tokens` raised to 8192 for adaptive thinking, the retry feedback goes in a user turn, and no sampling parameters are set.

Also confirmed as drafted: Base UI only with no Radix fallback, the two indexes, the Postgres 18 volume path, the separate migrate step, and eval keyword matching with manual overrides counted separately.

### Build process (Filip's instructions for `5-build`)

- `superpowers:test-driven-development` for the Zod schema and normalization, extraction parsing and the retry policy (against `FakeProvider`), and every server action.
- `superpowers:systematic-debugging` whenever something fails, before changing code.
- `superpowers:verification-before-completion` before any step is marked done.
- `frontend-design` for UI. After the first working UI, `/impeccable critique`, then `/impeccable polish`.
- `migration-auditor` on the first migration, with a report to Filip **before** he applies it. No commits or deploys without Filip's approval.

### Decisions already made (from scope, PRD and this pass's instructions)

- Stack as in **Stack**; Base UI variant confirmed by catalog check; Kibo Dropzone compatible.
- Save-first persistence, two-tier output, retry policy, badge rule, success bar, eval decision rule: `scope.md`.
- Polling for pending rows; confirmation transition CSS-only; both from `prd.md > Open Questions`, resolved here.
- Enums as `pgEnum`, tags as `text[]`, UUID primary keys, cascades in schema, `drizzle-kit push` not used.
- Postgres 18 image with the new volume path; one-shot `migrate` service; standalone Next image; non-root runner.

### The useful unknown, and how it gets checked

Filip's criterion for pass 3, "survives a request timeout", raised the real question: can a multi-second AI call safely run after the server action has answered, on a self-hosted Node server rather than Vercel? Clarified by the Next.js docs: `after()` is "fully supported when self-hosting with `next start`", runs in the same long-lived process, and on `SIGTERM` the server executes pending `after()` callbacks before exiting; a Docker container is listed as supported. The residual risk is a hard crash or `docker kill` mid-call, covered by the stale-pending sweep in `instrumentation.ts`. **Evidence to collect in `5-build`:** (1) submit a report and watch the `extractions` row appear after the client already has the confirmation; (2) `docker compose kill app` during an extraction, restart, and confirm the ticket shows the interrupted error and Retry succeeds; (3) `docker compose stop app` during an extraction and confirm the attempt completes before exit with `stop_grace_period: 30s`.

### Verify early in the build

- Next 16: `proxy.ts` convention, exact `bodySizeLimit` config key, `instrumentation.ts` `register()` running under `next start` in the standalone image.
- shadcn `init --base base` produces Base UI components; `Attachment` and `Field` APIs match the usage planned in the PRD.
- Drizzle emits `GENERATED ALWAYS AS … STORED` for `askClient`.
- `sharp` prebuilt binary works on `node:24-alpine`.
- `zodOutputFormat` with Zod 4 and the installed `@anthropic-ai/sdk` version; `parsed_output` is `null` on parse failure (docs), so the policy checks it before trusting the message.
- Structured outputs combined with adaptive thinking on `claude-sonnet-5-5`: the response has `thinking` blocks before the JSON text, and `parsed_output` reads only the JSON. Typical `output_tokens` per call is measured on the first real extraction.
- Sonnet 4.6 accepts the same request (no sampling params, `max_tokens: 8192`) so the later comparison is an env change only.

### Open issues

- **Image size on Sonnet 5.5.** 1568 px is the approved default, but its original reason (4.6's standard tier) no longer applies on 5.5's high-resolution tier. Run the eval at 1568 and at 2576 and keep whichever gives more accepted tickets per cent. This is an env change, not a code change.
- **Thinking cost versus accuracy.** If adaptive thinking roughly doubles cost without improving the acceptance rate, the `between_tools` thinking mode is the cheaper setting. The eval decides.

### Open from the PRD

- `/pick-ui-library` remains Filip's to run if he wants the skill's own verdict; the component table is otherwise settled by the catalog check.
