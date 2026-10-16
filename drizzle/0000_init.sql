CREATE TYPE "public"."extraction_result" AS ENUM('succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."extraction_state" AS ENUM('pending', 'extracted', 'extraction_failed');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('new', 'in_progress', 'done');--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" varchar(32) NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"result" "extraction_result" NOT NULL,
	"model" text NOT NULL,
	"raw_response" text,
	"parsed" jsonb,
	"error" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(21) NOT NULL,
	"owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"client_sentence" text NOT NULL,
	"language" varchar(8),
	"reporter_ip_hash" varchar(64) NOT NULL,
	"status" "ticket_status" DEFAULT 'new' NOT NULL,
	"extraction_state" "extraction_state" DEFAULT 'pending' NOT NULL,
	"extraction_error" text,
	"confidence" real,
	"title" text,
	"location" text,
	"actual_result" text,
	"priority" "priority",
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"expected_result" text,
	"expected_result_evidence" text,
	"steps_to_reproduce" text[],
	"steps_to_reproduce_evidence" text,
	"ask_client" boolean GENERATED ALWAYS AS (
    extraction_state = 'extracted' AND (
      confidence < 0.6
      OR actual_result IS NULL
      OR (location = 'unknown' AND client_sentence = '')
    )) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_ticket_idx" ON "attachments" USING btree ("ticket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "extractions_ticket_attempt_idx" ON "extractions" USING btree ("ticket_id","attempt");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_slug_idx" ON "projects" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tickets_project_created_idx" ON "tickets" USING btree ("project_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tickets_ip_hash_created_idx" ON "tickets" USING btree ("reporter_ip_hash","created_at");