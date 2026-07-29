CREATE TABLE "discussion_room_favorite" (
	"user_id" text NOT NULL,
	"room_id" integer NOT NULL,
	"favorited_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discussion_room_favorite_user_id_room_id_pk" PRIMARY KEY("user_id","room_id")
);
--> statement-breakpoint
ALTER TABLE "discussion_room_favorite" ADD CONSTRAINT "discussion_room_favorite_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_room_favorite" ADD CONSTRAINT "discussion_room_favorite_room_id_discussion_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."discussion_room"("id") ON DELETE cascade ON UPDATE no action;