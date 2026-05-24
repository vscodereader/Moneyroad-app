CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'sent', 'failed', 'bounced', 'no_recipients');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('buy_signal', 'sell_signal', 'price_alert', 'breaking_news', 'market_summary');--> statement-breakpoint
CREATE TYPE "public"."watchlist_type" AS ENUM('signal', 'news');--> statement-breakpoint
CREATE TABLE "news" (
	"id" text PRIMARY KEY NOT NULL,
	"originallink" text,
	"title" text NOT NULL,
	"link" text,
	"description" text DEFAULT '' NOT NULL,
	"summary" text,
	"pub_date" timestamp NOT NULL,
	"query" text,
	"source" text,
	"category" text,
	"tags" jsonb,
	"content" text,
	"stock_code" text,
	"source_type" text DEFAULT 'auto' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "news_originallink_unique" UNIQUE("originallink")
);
--> statement-breakpoint
CREATE TABLE "news_subscription" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"query" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"delivery_status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"ticket_id" text,
	"failed_reason" text,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_master" (
	"mksc_shrn_iscd" text PRIMARY KEY NOT NULL,
	"market_type" text NOT NULL,
	"nxt" boolean DEFAULT false NOT NULL,
	"stnd_iscd" text NOT NULL,
	"hts_kor_isnm" text NOT NULL,
	"scrt_grp_cls_code" char(2),
	"avls_scal_cls_code" char(1),
	"bstp_larg_div_code" char(4),
	"bstp_medm_div_code" char(4),
	"bstp_smal_div_code" char(4),
	"mnin_cls_code_yn" char(1),
	"sprn_strr_nmix_issu_yn" char(1),
	"kospi200_apnt_cls_code" char(1),
	"kospi100_issu_yn" char(1),
	"kospi50_issu_yn" char(1),
	"elw_pblc_yn" char(1),
	"sri_nmix_yn" char(1),
	"kospi_issu_yn" char(1),
	"vntr_issu_yn" char(1),
	"invt_alrm_yn" char(1),
	"ksq150_nmix_yn" char(1),
	"low_current_yn" char(1),
	"krx_issu_yn" char(1),
	"etp_prod_cls_code" char(1),
	"krx100_issu_yn" char(1),
	"krx_car_yn" char(1),
	"krx_smcn_yn" char(1),
	"krx_bio_yn" char(1),
	"krx_bank_yn" char(1),
	"etpr_undt_objt_co_yn" char(1),
	"krx_enrg_chms_yn" char(1),
	"krx_stel_yn" char(1),
	"short_over_cls_code" char(1),
	"krx_medi_cmnc_yn" char(1),
	"krx_cnst_yn" char(1),
	"krx_scrt_yn" char(1),
	"krx_ship_yn" char(1),
	"krx_insu_yn" char(1),
	"krx_trnp_yn" char(1),
	"stck_sdpr" integer,
	"frml_mrkt_deal_qty_unit" integer,
	"ovtm_mrkt_deal_qty_unit" integer,
	"trht_yn" char(1),
	"sltr_yn" char(1),
	"mang_issu_yn" char(1),
	"mrkt_alrm_cls_code" char(2),
	"mrkt_alrm_risk_adnt_yn" char(1),
	"insn_pbnt_yn" char(1),
	"byps_lstn_yn" char(1),
	"flng_cls_code" char(2),
	"fcam_mod_cls_code" char(2),
	"icic_cls_code" char(2),
	"marg_rate" integer,
	"crdt_able" char(1),
	"crdt_days" integer,
	"prdy_vol" text,
	"stck_fcam" text,
	"stck_lstn_date" char(8),
	"lstn_stcn" text,
	"cpfn" text,
	"stac_month" char(2),
	"po_prc" integer,
	"prst_cls_code" char(1),
	"ssts_hot_yn" char(1),
	"stange_runup_yn" char(1),
	"krx300_issu_yn" char(1),
	"sale_account" text,
	"bsop_prfi" text,
	"op_prfi" text,
	"thtr_ntin" text,
	"roe" text,
	"base_date" char(8),
	"prdy_avls_scal" text,
	"grp_code" char(3),
	"co_crdt_limt_over_yn" char(1),
	"secu_lend_able_yn" char(1),
	"stln_able_yn" char(1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_master_stnd_iscd_unique" UNIQUE("stnd_iscd")
);
--> statement-breakpoint
CREATE TABLE "user_notification_setting" (
	"user_id" text PRIMARY KEY NOT NULL,
	"buy_signal" boolean DEFAULT true NOT NULL,
	"sell_signal" boolean DEFAULT true NOT NULL,
	"price_alert" boolean DEFAULT true NOT NULL,
	"breaking_news" boolean DEFAULT true NOT NULL,
	"market_summary" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_push_token" (
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_push_token_user_id_token_pk" PRIMARY KEY("user_id","token")
);
--> statement-breakpoint
CREATE TABLE "user_watchlist" (
	"user_id" text NOT NULL,
	"stock_code" text NOT NULL,
	"type" "watchlist_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_watchlist_user_id_stock_code_type_pk" PRIMARY KEY("user_id","stock_code","type")
);
--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_stock_code_stock_master_mksc_shrn_iscd_fk" FOREIGN KEY ("stock_code") REFERENCES "public"."stock_master"("mksc_shrn_iscd") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_subscription" ADD CONSTRAINT "news_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_history" ADD CONSTRAINT "notification_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_setting" ADD CONSTRAINT "user_notification_setting_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_push_token" ADD CONSTRAINT "user_push_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_watchlist" ADD CONSTRAINT "user_watchlist_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_watchlist" ADD CONSTRAINT "user_watchlist_stock_code_stock_master_mksc_shrn_iscd_fk" FOREIGN KEY ("stock_code") REFERENCES "public"."stock_master"("mksc_shrn_iscd") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "news_pub_date_idx" ON "news" USING btree ("pub_date");--> statement-breakpoint
CREATE INDEX "news_query_idx" ON "news" USING btree ("query");--> statement-breakpoint
CREATE INDEX "news_stock_code_idx" ON "news" USING btree ("stock_code");--> statement-breakpoint
CREATE INDEX "news_source_type_idx" ON "news" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "notification_history_user_idx" ON "notification_history" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_history_user_type_created_idx" ON "notification_history" USING btree ("user_id","type","created_at");--> statement-breakpoint
CREATE INDEX "notification_history_ticket_idx" ON "notification_history" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "stock_master_market_type_idx" ON "stock_master" USING btree ("market_type");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_master_stnd_iscd_idx" ON "stock_master" USING btree ("stnd_iscd");--> statement-breakpoint
CREATE INDEX "stock_master_hts_kor_isnm_idx" ON "stock_master" USING btree ("hts_kor_isnm");--> statement-breakpoint
CREATE INDEX "user_watchlist_user_type_idx" ON "user_watchlist" USING btree ("user_id","type");