CREATE TABLE "follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"body" text NOT NULL,
	"reporter_ip_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "follow_ups_ticket_created_idx" ON "follow_ups" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "follow_ups_ip_hash_created_idx" ON "follow_ups" USING btree ("reporter_ip_hash","created_at");