ALTER TABLE "news" ADD COLUMN "categories" jsonb;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "author_id" text;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "news_pinned_pub_date_idx" ON "news" USING btree ("pinned","pub_date");