// The data model from spec.md > Data Model. Vocabulary in CONTEXT.md; the tickets/extractions
// split is ADR 0001. Every migration is generated from this file (`npm run db:generate`), read,
// then applied with `npm run db:migrate`. `drizzle-kit push` is never used.
import { sql } from 'drizzle-orm';
import type { OfficeHours } from '@/lib/office-hours';
import {
  boolean, index, integer, jsonb, pgEnum, pgTable, real, text, timestamp, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core';

export const ticketStatus = pgEnum('ticket_status', ['new', 'in_progress', 'done']);
export const extractionState = pgEnum('extraction_state', ['pending', 'extracted', 'extraction_failed']);
export const priority = pgEnum('priority', ['low', 'medium', 'high']);
export const extractionResult = pgEnum('extraction_result', ['succeeded', 'failed']);
// Why a ticket is extraction_failed: the model, API or file (extraction_error), or the server
// restarting while it ran (interrupted_by_restart). Lets the dashboard tell the two apart.
export const failedReason = pgEnum('failed_reason', ['extraction_error', 'interrupted_by_restart']);

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: varchar('slug', { length: 21 }).notNull(),
  ownerId: uuid('owner_id'), // nullable, no FK yet (Later: real auth fills it with an UPDATE)
  // Demo projects (the seed for judges, Filip 2026-10-25): their client page shows every report of
  // the project, not only this device's. Never set for a real project.
  demo: boolean('demo').notNull().default(false),
  // When the developer replies, for the client page's header; null means the default (Mon–Fri
  // 9–17, lib/office-hours.ts). The demo seed sets every day, all day.
  officeHours: jsonb('office_hours').$type<OfficeHours>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('projects_slug_idx').on(t.slug),
]);

export const tickets = pgTable('tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Shown as SN-<number> on cards, in the detail and in Markdown. One global sequence, so two
  // reports at once can't get the same number (migration 0003).
  number: integer('number').generatedAlwaysAsIdentity(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  // source material
  clientSentence: text('client_sentence').notNull(),
  language: varchar('language', { length: 8 }), // ISO 639-1, from extraction
  reporterIpHash: varchar('reporter_ip_hash', { length: 64 }).notNull(),
  // workflow + extraction bookkeeping
  status: ticketStatus('status').notNull().default('new'),
  extractionState: extractionState('extraction_state').notNull().default('pending'),
  extractionError: text('extraction_error'),
  failedReason: failedReason('failed_reason'), // set with extraction_failed, cleared on success
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
  uniqueIndex('tickets_number_idx').on(t.number),
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

// Text a client adds to their own report later, from the device that sent it (Filip, 2026-10-18).
// Text only: a new screenshot is a new report. Shown in the client's chat and on the dashboard.
export const followUps = pgTable('follow_ups', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  reporterIpHash: varchar('reporter_ip_hash', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('follow_ups_ticket_created_idx').on(t.ticketId, t.createdAt),
  index('follow_ups_ip_hash_created_idx').on(t.reporterIpHash, t.createdAt),
]);

// A status or priority change on a ticket, for the thread's change rows (Filip, 2026-10-18).
// Written only by updateTicketField; replaces the deferred status-change-time columns.
export const ticketEventField = pgEnum('ticket_event_field', ['status', 'priority']);

export const ticketEvents = pgTable('ticket_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  field: ticketEventField('field').notNull(),
  fromValue: text('from_value'),
  toValue: text('to_value'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('ticket_events_ticket_created_idx').on(t.ticketId, t.createdAt),
]);
