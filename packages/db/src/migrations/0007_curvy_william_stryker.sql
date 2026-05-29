CREATE TYPE "public"."price_alert_direction" AS ENUM('above', 'below');--> statement-breakpoint
CREATE TABLE "user_price_alert" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stock_code" text NOT NULL,
	"direction" "price_alert_direction" NOT NULL,
	"target_price" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"triggered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_price_alert" ADD CONSTRAINT "user_price_alert_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_price_alert" ADD CONSTRAINT "user_price_alert_stock_code_stock_master_mksc_shrn_iscd_fk" FOREIGN KEY ("stock_code") REFERENCES "public"."stock_master"("mksc_shrn_iscd") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_price_alert_user_idx" ON "user_price_alert" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_price_alert_stock_idx" ON "user_price_alert" USING btree ("stock_code");