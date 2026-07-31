ALTER TABLE "user" ALTER COLUMN "onboarding_completed_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "onboarding_completed_at" DROP NOT NULL;