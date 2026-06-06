import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  books: router({
    list: publicProcedure
      .input(z.object({
        genre: z.enum(["classic", "modern", "foreign"]).optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getBooks(input);
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const book = await db.getBookById(input.id);
        if (!book) throw new TRPCError({ code: "NOT_FOUND", message: "도서를 찾을 수 없습니다." });
        return book;
      }),

    create: adminProcedure
      .input(z.object({
        title: z.string().min(1),
        author: z.string().min(1),
        genre: z.enum(["classic", "modern", "foreign"]),
        content: z.string().min(1),
        youtubeUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createBook(input);
        return { id };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        author: z.string().min(1).optional(),
        genre: z.enum(["classic", "modern", "foreign"]).optional(),
        content: z.string().min(1).optional(),
        youtubeUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateBook(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteBook(input.id);
        return { success: true };
      }),
  }),

  donation: router({
    get: publicProcedure.query(async () => {
      return await db.getDonationInfo();
    }),

    update: adminProcedure
      .input(z.object({
        bankName: z.string().optional(),
        accountNumber: z.string().optional(),
        accountHolder: z.string().optional(),
        description: z.string().optional(),
        email: z.string().optional(),
        representative: z.string().optional(),
        closingMessage: z.string().optional(),
        legalNotice: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.upsertDonationInfo(input);
        return { success: true };
      }),
  }),

  bookmarks: router({
    list: protectedProcedure
      .input(z.object({ bookId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getBookmarksByUser(ctx.user.id, input.bookId);
      }),

    add: protectedProcedure
      .input(z.object({
        bookId: z.number(),
        page: z.number(),
        label: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.addBookmark({ userId: ctx.user.id, ...input });
        return { id };
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.removeBookmark(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  progress: router({
    get: protectedProcedure
      .input(z.object({ bookId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getReadingProgress(ctx.user.id, input.bookId);
      }),

    save: protectedProcedure
      .input(z.object({
        bookId: z.number(),
        currentPage: z.number(),
        totalPages: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.upsertReadingProgress({ userId: ctx.user.id, ...input });
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
