ALTER TABLE "discussion_message" ADD COLUMN "blinded_at" timestamp;--> statement-breakpoint
ALTER TABLE "discussion_message" ADD COLUMN "blinded_by" text;--> statement-breakpoint
ALTER TABLE "discussion_message" ADD COLUMN "blind_reason" text;--> statement-breakpoint
ALTER TABLE "discussion_message" ADD CONSTRAINT "discussion_message_blinded_by_user_id_fk" FOREIGN KEY ("blinded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;