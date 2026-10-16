---
status: accepted
date: 2026-10-16
---

# Ticket fields live on the ticket; every extraction attempt is a row in its own table

The model's output and the developer's edited ticket are two different things that start out identical. We keep the **working copy** of every ticket field (title, location, actualResult, priority, tags, expectedResult + evidence, stepsToReproduce + evidence, confidence, language) as columns on `tickets`, and record **every extraction attempt** (automatic retries and manual Retry alike) as an append-only row in `extractions` with the raw model JSON, the parsed output, the error, token usage and duration. A successful extraction copies its parsed output into the ticket columns that are still empty; the developer edits the ticket columns and never the extraction rows.

## Considered options

**Columns on `tickets` only.** Simplest to query and render. Rejected because the first edit destroys the model's original, which is the one thing the eval decision rule, the Retry button and "where was the model wrong" all need, and because retries would overwrite the only record of the previous failure.

**Separate `extraction_results` table only, no ticket columns.** Keeps model output pristine. Rejected because the developer's edits then either mutate model output (same loss) or need a third place to live; every list and detail render joins; the Markdown export reads from two tables; and the "Ask client" flag would depend on a row that may not exist yet.

**Both (chosen).** One extra table, one copy step. The ticket is the thing the product works with; the extractions table is the evidence log.

## Consequences

- `extractions` grows by one row per attempt (expected: 1–3 rows per ticket). It is never updated, only inserted.
- Retry on a `extraction_failed` ticket fills only columns that are still `NULL`, so anything the developer typed by hand in the failed state survives.
- The eval runner and the "five lowest-confidence versus five worst" check read model output from `extractions`, never from the edited ticket.
- A future "show what the model originally said" diff view needs no schema change.
- Changing this later means a data migration that splits or merges columns; hence this record.
