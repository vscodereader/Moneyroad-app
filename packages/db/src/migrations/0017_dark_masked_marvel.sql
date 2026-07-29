CREATE TABLE "discussion_room_block" (
	"user_id" text NOT NULL,
	"room_id" integer NOT NULL,
	"blocked_by" text,
	"blocked_at" timestamp DEFAULT now() NOT NULL,
	"blocked_until" timestamp NOT NULL,
	CONSTRAINT "discussion_room_block_user_id_room_id_pk" PRIMARY KEY("user_id","room_id")
);
--> statement-breakpoint
ALTER TABLE "discussion_room_member" ADD COLUMN "muted_until" timestamp;--> statement-breakpoint
ALTER TABLE "discussion_room_member" ADD COLUMN "muted_by" text;--> statement-breakpoint
ALTER TABLE "discussion_room_block" ADD CONSTRAINT "discussion_room_block_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_room_block" ADD CONSTRAINT "discussion_room_block_room_id_discussion_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."discussion_room"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_room_block" ADD CONSTRAINT "discussion_room_block_blocked_by_user_id_fk" FOREIGN KEY ("blocked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_room_member" ADD CONSTRAINT "discussion_room_member_muted_by_user_id_fk" FOREIGN KEY ("muted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;