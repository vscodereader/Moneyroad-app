CREATE TYPE "public"."inquiry_status" AS ENUM('open', 'answered', 'closed');--> statement-breakpoint
CREATE TYPE "public"."inquiry_type" AS ENUM('signal', 'subscription', 'account', 'etc');--> statement-breakpoint
CREATE TABLE "inquiry" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"contact_email" text,
	"type" "inquiry_type" DEFAULT 'etc' NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"status" "inquiry_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inquiry" ADD CONSTRAINT "inquiry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inquiry_user_idx" ON "inquiry" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "inquiry_created_idx" ON "inquiry" USING btree ("created_at");