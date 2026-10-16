// The data model from spec.md > Data Model. Vocabulary in CONTEXT.md; the tickets/extractions
// split is ADR 0001. Every migration is generated from this file (`npm run db:generate`), read,
// then applied with `npm run db:migrate`. `drizzle-kit push` is never used.
import { sql } from 'drizzle-orm';
import {
  boolean, index, integer, jsonb, pgEnum, pgTable, real, text, timestamp, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core';

export const ticketStatus = pgEnum('ticket_status', ['new', 'in_progress', 'done']);
export const extractionState = pgEnum('extraction_state', ['pending', 'extracted', 'extraction_failed']);
export const priority = pgEnum('priority', ['low', 'medium', 'high']);
export const extractionResult = pgEnum('extraction_result', ['succeeded', 'failed']);

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: varchar('slug', { length: 21 }).notNull(),
  ownerId: uuid('owner_id'), // nullable, no FK yet (Later: real auth fills it with an UPDATE)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('projects_slug_idx').on(t.slug),
]);

export const tickets = pgTable('tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  // source material
  clientSentence: text('client_sentence').notNull(),
  language: varchar('language', { length: 8 }), // ISO 639-1, from extraction
  reporterIpHash: varchar('reporter_ip_hash', { length: 64 }).notNull(),
  // workflow + extraction bookkeeping
  status: ticketStatus('status').notNull().default('new'),
  extractionState: extractionState('extraction_state').notNull().default('pending'),
  extractionError: text('extraction_error'),
  confidence: real('confidence'),
  // observed fields (working copy)
  title: text('title'),
  location: text('location'), // 'unknown' is a valid value
  actualResult: text('actual_result'),
  priority: priority('priority'),
  tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
  // inferred fields (working copy): value + evidence, both null or both set
  expectedResult: text('expected_result'),
  expectedResultEvidence: text('expected_result_evidence'),
  stepsToReproduce: text('steps_to_reproduce').array(),
  stepsToReproduceEvidence: text('steps_to_reproduce_evidence'),
  // derived: Postgres recomputes it on every INSERT/UPDATE. Every input is a column of this row.
  askClient: boolean('ask_client').generatedAlwaysAs(sql`
    extraction_state = 'extracted' AND (
      confidence < 0.6
      OR actual_result IS NULL
      OR (location = 'unknown' AND client_sentence = '')
    )`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('tickets_project_created_idx').on(t.projectId, t.createdAt.desc()),
  index('tickets_ip_hash_created_idx').on(t.reporterIpHash, t.createdAt),
]);

export const attachments = pgTable('attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull(), // "<projectId>/<ticketId>.<ext>", never a client-provided name
  mimeType: varchar('mime_type', { length: 32 }).notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  bytes: integer('bytes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('attachments_ticket_idx').on(t.ticketId),
]);

export const extractions = pgTable('extractions', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  attempt: integer('attempt').notNull(), // 1, 2, 3… across automatic and manual retries
  result: extractionResult('result').notNull(),
  model: text('model').notNull(),
  rawResponse: text('raw_response'), // exact text the model returned, if any
  parsed: jsonb('parsed'), // the validated ExtractionOutput, on success
  error: text('error'), // Zod issues / API error / refusal, on failure
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('extractions_ticket_attempt_idx').on(t.ticketId, t.attempt),
]);
