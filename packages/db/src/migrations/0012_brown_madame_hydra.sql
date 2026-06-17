CREATE TABLE "stock_resource" (
	"id" serial PRIMARY KEY NOT NULL,
	"stock_code" text NOT NULL,
	"resource_type" text NOT NULL,
	"provider" text NOT NULL,
	"source_url" text,
	"storage_bucket" text,
	"storage_key" text NOT NULL,
	"mime_type" text DEFAULT 'image/png' NOT NULL,
	"status" text NOT NULL,
	"content_hash" text,
	"etag" text,
	"error_message" text,
	"byte_size" integer,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_resource" ADD CONSTRAINT "stock_resource_stock_code_stock_master_mksc_shrn_iscd_fk" FOREIGN KEY ("stock_code") REFERENCES "public"."stock_master"("mksc_shrn_iscd") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_resource_stock_type_idx" ON "stock_resource" USING btree ("stock_code","resource_type");--> statement-breakpoint
CREATE INDEX "stock_resource_status_idx" ON "stock_resource" USING btree ("status");