ALTER TABLE "quotes" ADD COLUMN "expected_credits" integer;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "message" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "billing_cycle" text DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "config" jsonb;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "kind" text DEFAULT 'quote' NOT NULL;