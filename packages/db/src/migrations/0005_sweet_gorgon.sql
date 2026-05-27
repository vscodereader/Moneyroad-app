CREATE TYPE "public"."discussion_sentiment" AS ENUM('up', 'neutral', 'down');--> statement-breakpoint
CREATE TABLE "discussion_message" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussion_room" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"stock_code" text,
	"sentiment" "discussion_sentiment" DEFAULT 'neutral' NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussion_room_like" (
	"user_id" text NOT NULL,
	"room_id" integer NOT NULL,
	"liked_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discussion_room_like_user_id_room_id_pk" PRIMARY KEY("user_id","room_id")
);
--> statement-breakpoint
CREATE TABLE "discussion_room_member" (
	"user_id" text NOT NULL,
	"room_id" integer NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discussion_room_member_user_id_room_id_pk" PRIMARY KEY("user_id","room_id")
);
--> statement-breakpoint
ALTER TABLE "discussion_message" ADD CONSTRAINT "discussion_message_room_id_discussion_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."discussion_room"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_message" ADD CONSTRAINT "discussion_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_room" ADD CONSTRAINT "discussion_room_stock_code_stock_master_mksc_shrn_iscd_fk" FOREIGN KEY ("stock_code") REFERENCES "public"."stock_master"("mksc_shrn_iscd") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_room" ADD CONSTRAINT "discussion_room_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_room_like" ADD CONSTRAINT "discussion_room_like_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_room_like" ADD CONSTRAINT "discussion_room_like_room_id_discussion_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."discussion_room"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_room_member" ADD CONSTRAINT "discussion_room_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_room_member" ADD CONSTRAINT "discussion_room_member_room_id_discussion_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."discussion_room"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discussion_message_room_id_idx" ON "discussion_message" USING btree ("room_id","id");--> statement-breakpoint
CREATE INDEX "discussion_message_room_created_at_idx" ON "discussion_message" USING btree ("room_id","created_at");--> statement-breakpoint
CREATE INDEX "discussion_room_stock_code_idx" ON "discussion_room" USING btree ("stock_code");--> statement-breakpoint
CREATE INDEX "discussion_room_created_at_idx" ON "discussion_room" USING btree ("created_at");