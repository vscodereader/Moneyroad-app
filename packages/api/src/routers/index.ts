import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { discussionRouter } from "./discussion";
import { inquiryRouter } from "./inquiry";
import { newsRouter } from "./news";
import { noticeRouter } from "./notice";
import { notificationRouter } from "./notification";
import { priceAlertRouter } from "./price-alert";
import { signalRouter } from "./signal";
import { stockRouter } from "./stock";
import { todoRouter } from "./todo";
import { watchlistRouter } from "./watchlist";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => "OK"),
  privateData: protectedProcedure.handler(({ context }) => ({
    message: "This is private",
    user: context.session?.user,
  })),
  todo: todoRouter,
  news: newsRouter,
  notice: noticeRouter,
  notification: notificationRouter,
  signal: signalRouter,
  stock: stockRouter,
  watchlist: watchlistRouter,
  discussion: discussionRouter,
  inquiry: inquiryRouter,
  priceAlert: priceAlertRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
