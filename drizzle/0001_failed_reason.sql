CREATE TYPE "public"."failed_reason" AS ENUM('extraction_error', 'interrupted_by_restart');--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "failed_reason" "failed_reason";--> statement-breakpoint
-- Backfill (hand-written): tickets that already failed get a reason, so failed_reason is set
-- whenever extraction_state is extraction_failed. The interrupted ones carry the sweep's message.
UPDATE "tickets" SET "failed_reason" = CASE
  WHEN "extraction_error" = 'Extraction interrupted by a restart. Retry when ready.' THEN 'interrupted_by_restart'::"failed_reason"
  ELSE 'extraction_error'::"failed_reason"
END WHERE "extraction_state" = 'extraction_failed';
