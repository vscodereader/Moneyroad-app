import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Pre-launch waitlist (사전등록). Public email capture from the web landing page.
export const waitlist = pgTable("waitlist", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
