CREATE TABLE "discussion_file_attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"mime" text NOT NULL,
	"byte_size" integer NOT NULL,
	"file_name" text NOT NULL,
	"uploader_id" text NOT NULL,
	"message_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "moneyroad_image" ADD COLUMN "original_byte_size" integer;--> statement-breakpoint
ALTER TABLE "discussion_file_attachment" ADD CONSTRAINT "discussion_file_attachment_uploader_id_user_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_file_attachment" ADD CONSTRAINT "discussion_file_attachment_message_id_discussion_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."discussion_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discussion_file_attachment_message_id_uq" ON "discussion_file_attachment" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "discussion_file_attachment_uploader_id_idx" ON "discussion_file_attachment" USING btree ("uploader_id");