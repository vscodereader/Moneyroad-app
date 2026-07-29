CREATE TYPE "public"."discussion_message_type" AS ENUM('text', 'image', 'file');--> statement-breakpoint
CREATE TABLE "discussion_message_image" (
	"message_id" integer NOT NULL,
	"image_id" integer NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "discussion_message_image_message_id_image_id_pk" PRIMARY KEY("message_id","image_id")
);
--> statement-breakpoint
CREATE TABLE "moneyroad_image" (
	"id" serial PRIMARY KEY NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"mime" text NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"uploader_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discussion_message" ADD COLUMN "type" "discussion_message_type" DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "discussion_message" ADD COLUMN "file_bucket" text;--> statement-breakpoint
ALTER TABLE "discussion_message" ADD COLUMN "file_key" text;--> statement-breakpoint
ALTER TABLE "discussion_message" ADD COLUMN "file_mime" text;--> statement-breakpoint
ALTER TABLE "discussion_message" ADD COLUMN "file_size" integer;--> statement-breakpoint
ALTER TABLE "discussion_message" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "discussion_message_image" ADD CONSTRAINT "discussion_message_image_message_id_discussion_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."discussion_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_message_image" ADD CONSTRAINT "discussion_message_image_image_id_moneyroad_image_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."moneyroad_image"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moneyroad_image" ADD CONSTRAINT "moneyroad_image_uploader_id_user_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;