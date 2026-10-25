import { createRouter, publicQuery } from "./middleware";
import { orderRouter } from "./orderRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  orders: orderRouter,
});

export type AppRouter = typeof appRouter;
