CREATE TYPE "public"."notice_category" AS ENUM('notice', 'update', 'event');--> statement-breakpoint
CREATE TABLE "notice" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" "notice_category" DEFAULT 'notice' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notice" ADD CONSTRAINT "notice_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notice_pinned_created_idx" ON "notice" USING btree ("pinned","created_at");--> statement-breakpoint
CREATE INDEX "notice_created_idx" ON "notice" USING btree ("created_at");