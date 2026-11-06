import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { getQazoAppData, saveQazoAppData } from "./db";
import { qazoAppStateSchema } from "@shared/qazo";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  qazo: router({
    load: protectedProcedure.input(z.object({ expectedOpenId: z.string().min(1).max(256) }).strict()).query(async ({ ctx, input }) => {
      if (input.expectedOpenId !== ctx.user.openId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const raw = await getQazoAppData(ctx.user.id);
      if (!raw) return { ownerOpenId: ctx.user.openId, state: null };
      let decoded: unknown;
      try {
        decoded = JSON.parse(raw);
      } catch {
        throw new Error("Saved Qazo data could not be read. Export or reset it from your device.");
      }
      const parsed = qazoAppStateSchema.safeParse(decoded);
      if (!parsed.success) throw new Error("Saved Qazo data has an unsupported format.");
      return { ownerOpenId: ctx.user.openId, state: parsed.data };
    }),
    save: protectedProcedure.input(qazoAppStateSchema).mutation(async ({ ctx, input }) => {
      const data = JSON.stringify(input);
      if (new TextEncoder().encode(data).byteLength > 5_000_000) throw new Error("Qazo data is larger than the allowed limit.");
      await saveQazoAppData(ctx.user.id, data);
      return { saved: true, updatedAt: new Date().toISOString() };
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
