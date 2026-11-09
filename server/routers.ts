import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./supabaseDb";

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    // 세션은 브라우저의 Supabase 클라이언트가 종료합니다.
    logout: publicProcedure.mutation(() => ({ success: true } as const)),
  }),

  books: router({
    list: publicProcedure
      .input(z.object({
        genre: z.enum(["classic", "modern", "foreign", "creative"]).optional(),
        creativeGenre: z.enum(["short_story", "romance", "fantasy", "wuxia", "mystery", "other"]).optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getBooks(input);
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const book = await db.getBookById(input.id, ctx.user?.role === "admin");
        if (!book) throw new TRPCError({ code: "NOT_FOUND", message: "도서를 찾을 수 없습니다." });
        return book;
      }),

    create: adminProcedure
      .input(z.object({
        title: z.string().min(1),
        author: z.string().min(1),
        genre: z.enum(["classic", "modern", "foreign", "creative"]),
        creativeGenre: z.enum(["short_story", "romance", "fantasy", "wuxia", "mystery", "other"]).optional(),
        content: z.string().optional(),
        description: z.string().optional(),
        youtubeUrl: z.string().optional(),
        googleDriveUrl: z.string().optional(),
        webtoonUrl: z.string().optional(),
      }).refine((value) => value.genre !== "creative" || Boolean(value.creativeGenre), {
        message: "창작 도서는 작품 장르를 선택해야 합니다.", path: ["creativeGenre"],
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
       genre: z.enum(["classic", "modern", "foreign", "creative"]).optional(),
       creativeGenre: z.enum(["short_story", "romance", "fantasy", "wuxia", "mystery", "other"]).nullable().optional(),
       content: z.string().optional(),
       description: z.string().optional(),
       youtubeUrl: z.string().optional(),
       googleDriveUrl: z.string().optional(),
        webtoonUrl: z.string().optional(),
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

  creative: router({
    submit: protectedProcedure
      .input(z.object({
        submissionId: z.number().int().positive().optional(),
        title: z.string().trim().min(1).max(200),
        authorName: z.string().trim().min(1).max(120),
        genre: z.enum(["short_story", "romance", "fantasy", "wuxia", "mystery", "other"]),
        description: z.string().trim().max(2000).optional(),
        content: z.string().trim().min(20).max(500000),
        rightsConfirmed: z.literal(true),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const save = input.submissionId
            ? (data: Parameters<typeof db.createCreativeSubmission>[0]) => db.resubmitCreativeSubmission(input.submissionId!, data)
            : db.createCreativeSubmission;
          const id = await save({
            userId: ctx.user.id, title: input.title, authorName: input.authorName,
            genre: input.genre, description: input.description, content: input.content,
          });
          return { id };
        } catch (error) {
          if (error instanceof Error && error.message.includes("검수 대기")) {
            throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error.message });
          }
          throw error;
        }
      }),

    rejected: protectedProcedure.input(z.object({ id: z.number().int().positive() }))
      .query(({ctx, input}) => db.getOwnRejectedSubmission(input.id, ctx.user.id)),

    mine: protectedProcedure.query(async ({ ctx }) => {
      return await db.getCreativeSubmissionsByUser(ctx.user.id);
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

  // 로그인 여부와 무관하게 인기 순위에 반영하기 위한 도서 열람 기록
  bookViews: router({
    record: publicProcedure
      .input(z.object({
        bookId: z.number().int().positive(),
        viewerId: z.string().uuid(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.recordBookView(input.bookId, input.viewerId, ctx.user?.id);
        return { success: true };
      }),
  }),

  // ==================== ADMIN ====================
  admin: router({
    stats: adminProcedure.query(async () => {
      const [totalUsers, todayVisitors, weeklyVisitors, monthlyVisitors, yearlyVisitors, dailyVisitors, popularBooks] = await Promise.all([
        db.getTotalUserCount(),
        db.getTodayVisitorCount(),
        db.getWeeklyVisitorCount(),
        db.getMonthlyVisitorCount(),
        db.getYearlyVisitorCount(),
        db.getDailyVisitorCounts(14),
        db.getPopularBooks(50),
      ]);
      return { totalUsers, todayVisitors, weeklyVisitors, monthlyVisitors, yearlyVisitors, dailyVisitors, popularBooks };
    }),

    users: adminProcedure.query(async () => {
      return await db.getAllUsers();
    }),

    creativeBooks: adminProcedure.query(() => db.getManagedCreativeBooks()),

    setCreativeVisibility: adminProcedure
      .input(z.object({ id: z.number().int().positive(), isPublic: z.boolean(), note: z.string().trim().min(1).max(2000) }))
      .mutation(async ({ctx, input}) => {
        await db.setCreativeBookVisibility(input.id, input.isPublic, ctx.user.id, input.note);
        return {success: true};
      }),

    creativeSubmissions: adminProcedure.query(async () => {
      return await db.getPendingCreativeSubmissions();
    }),

    approveCreativeSubmission: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const bookId = await db.approveCreativeSubmission(input.id, ctx.user.id);
        return { bookId };
      }),

    rejectCreativeSubmission: adminProcedure
      .input(z.object({ id: z.number().int().positive(), note: z.string().trim().min(1, "수정이 필요한 이유를 적어주세요.").max(2000) }))
      .mutation(async ({ ctx, input }) => {
        await db.rejectCreativeSubmission(input.id, ctx.user.id, input.note);
        return { success: true };
      }),

    userReadingHistory: adminProcedure
      .input(z.object({ userId: z.string().uuid() }))
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
