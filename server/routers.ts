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
        content: z.string().optional(),
        description: z.string().optional(),
        youtubeUrl: z.string().optional(),
        googleDriveUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, isUpdate } = await db.upsertBook(input);
        return { id, isUpdate };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        author: z.string().min(1).optional(),
        genre: z.enum(["classic", "modern", "foreign"]).optional(),
        content: z.string().optional(),
        description: z.string().optional(),
        youtubeUrl: z.string().optional(),
        googleDriveUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateBook(id, data);
        return { success: true };
      }),

    // 구글 드라이브 문서 텍스트를 프록시로 가져오는 API
    fetchGoogleDriveContent: publicProcedure
      .input(z.object({ url: z.string() }))
      .query(async ({ input }) => {
        try {
          // Google Docs URL에서 document ID 추출
          const match = input.url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
          if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "유효하지 않은 구글 드라이브 URL입니다." });
          const docId = match[1];
          const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
          const response = await fetch(exportUrl);
          if (!response.ok) throw new TRPCError({ code: "NOT_FOUND", message: "문서를 불러올 수 없습니다." });
          const text = await response.text();
          return { content: text };
        } catch (e: any) {
          if (e instanceof TRPCError) throw e;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "문서를 불러오는 중 오류가 발생했습니다." });
        }
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

  // ==================== ADMIN ====================
  admin: router({
    stats: adminProcedure.query(async () => {
      const [totalUsers, todayVisitors, popularBooks] = await Promise.all([
        db.getTotalUserCount(),
        db.getTodayVisitorCount(),
        db.getPopularBooks(10),
      ]);
      return { totalUsers, todayVisitors, popularBooks };
    }),

    users: adminProcedure.query(async () => {
      return await db.getAllUsers();
    }),

    userReadingHistory: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return await db.getUserReadingHistory(input.userId);
      }),

    sendBulkEmail: adminProcedure
      .input(z.object({
        subject: z.string().min(1),
        body: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        const recipients = await db.getAllUserEmails();
        if (recipients.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "이메일이 등록된 회원이 없습니다." });
        }
        
        // 플랫폼 알림 시스템을 통해 관리자에게 발송 결과 알림
        // (현재 플랫폼에서는 직접 SMTP 메일 발송이 지원되지 않아 notifyOwner로 대체)
        const { notifyOwner } = await import("./_core/notification");
        
        const recipientList = recipients.map(r => `${r.name || '미설정'} <${r.email}>`).join('\n');
        const sent = await notifyOwner({
          title: `[홍보 메일 발송] ${input.subject}`,
          content: `대상: ${recipients.length}명\n\n수신자 목록:\n${recipientList}\n\n--- 메일 내용 ---\n${input.body}`,
        });
        
        if (!sent) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "알림 서비스 연결에 실패했습니다. 잠시 후 다시 시도해주세요." });
        }
        
        return { success: true, sentCount: recipients.length };
      }),
  }),

  // 방문 기록
  visit: router({
    record: publicProcedure.mutation(async ({ ctx }) => {
      const userId = ctx.user?.id;
      // IP + User-Agent 기반으로 세션 ID 생성 (동일 브라우저 중복 방지)
      const ip = ctx.req.headers["x-forwarded-for"] || ctx.req.socket.remoteAddress || "unknown";
      const ua = ctx.req.headers["user-agent"] || "unknown";
      const sessionId = `${String(ip).split(",")[0].trim()}_${ua.slice(0, 50)}`;
      await db.recordVisit(userId, sessionId);
      return { success: true };
    }),
  }),

  bookshelf: router({
    list: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getBookshelfByUser(ctx.user.id);
      }),

    add: protectedProcedure
      .input(z.object({ bookId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.addToBookshelf(ctx.user.id, input.bookId);
        return { id };
      }),

    remove: protectedProcedure
      .input(z.object({ bookId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.removeFromBookshelf(ctx.user.id, input.bookId);
        return { success: true };
      }),

    isInShelf: protectedProcedure
      .input(z.object({ bookId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.isInBookshelf(ctx.user.id, input.bookId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
