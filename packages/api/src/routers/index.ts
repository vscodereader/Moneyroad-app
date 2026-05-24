import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { newsRouter } from "./news";
import { notificationRouter } from "./notification";
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
  notification: notificationRouter,
  stock: stockRouter,
  watchlist: watchlistRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
