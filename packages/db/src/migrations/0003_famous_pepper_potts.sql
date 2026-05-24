CREATE TYPE "public"."signal_action" AS ENUM('buy', 'sell', 'hold');--> statement-breakpoint
CREATE TYPE "public"."signal_source" AS ENUM('tech', 'ai', 'event', 'community');--> statement-breakpoint
CREATE TABLE "signal" (
	"id" text PRIMARY KEY NOT NULL,
	"stock_code" text NOT NULL,
	"action" "signal_action" NOT NULL,
	"source" "signal_source" DEFAULT 'tech' NOT NULL,
	"strength" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"indicators" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "signal_stock_created_idx" ON "signal" USING btree ("stock_code","created_at");--> statement-breakpoint
CREATE INDEX "signal_action_created_idx" ON "signal" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "signal_created_idx" ON "signal" USING btree ("created_at");