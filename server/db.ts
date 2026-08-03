import { eq, and, like, or, sql, desc, gte, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, books, donationInfo, bookmarks, readingProgress, bookshelf, visits } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) { values.lastSignedIn = new Date(); }
    if (Object.keys(updateSet).length === 0) { updateSet.lastSignedIn = new Date(); }
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== BOOKS ====================
export async function getBooks(filter?: { genre?: "classic" | "modern" | "foreign"; search?: string }) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select({
    id: books.id,
    title: books.title,
    author: books.author,
    genre: books.genre,
    description: books.description,
    youtubeUrl: books.youtubeUrl,
    googleDriveUrl: books.googleDriveUrl,
    createdAt: books.createdAt,
  }).from(books).$dynamic();

  const conditions = [];
  if (filter?.genre) {
    conditions.push(eq(books.genre, filter.genre));
  }
  if (filter?.search) {
    const term = `%${filter.search}%`;
    conditions.push(or(like(books.title, term), like(books.author, term))!);
  }
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  return await query.orderBy(books.createdAt);
}

export async function getBookById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(books).where(eq(books.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getBookByTitleAuthor(title: string, author: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(books).where(and(eq(books.title, title), eq(books.author, author))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createBook(data: { title: string; author: string; genre: "classic" | "modern" | "foreign"; content?: string; description?: string; youtubeUrl?: string; googleDriveUrl?: string; tableOfContents?: string; studyMaterial?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Explicitly set all optional fields to null if undefined to prevent Drizzle from using 'default'
  const values = {
    title: data.title,
    author: data.author,
    genre: data.genre,
    content: data.content ?? null,
    youtubeUrl: data.youtubeUrl ?? null,
    description: data.description ?? null,
    googleDriveUrl: data.googleDriveUrl ?? null,
    tableOfContents: data.tableOfContents ?? null,
    studyMaterial: data.studyMaterial ?? null,
  };
  const result = await db.insert(books).values(values).$returningId();
  return result[0].id;
}

// 같은 제목+작가의 도서가 있으면 업데이트, 없으면 새로 생성
export async function upsertBook(data: { title: string; author: string; genre: "classic" | "modern" | "foreign"; content?: string; description?: string; youtubeUrl?: string; googleDriveUrl?: string; tableOfContents?: string; studyMaterial?: string }): Promise<{ id: number; isUpdate: boolean }> {
  const existing = await getBookByTitleAuthor(data.title, data.author);
  if (existing) {
    await updateBook(existing.id, data);
    return { id: existing.id, isUpdate: true };
  } else {
    const id = await createBook(data);
    return { id, isUpdate: false };
  }
}

export async function updateBook(id: number, data: Partial<{ title: string; author: string; genre: "classic" | "modern" | "foreign"; content: string; description: string; youtubeUrl: string; googleDriveUrl: string; tableOfContents: string; studyMaterial: string }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(books).set(data).where(eq(books.id, id));
}

export async function deleteBook(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(books).where(eq(books.id, id));
  // Also clean up related bookmarks and progress
  await db.delete(bookmarks).where(eq(bookmarks.bookId, id));
  await db.delete(readingProgress).where(eq(readingProgress.bookId, id));
}

// ==================== DONATION INFO ====================
export async function getDonationInfo() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(donationInfo).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertDonationInfo(data: Partial<{ bankName: string; accountNumber: string; accountHolder: string; description: string; email: string; representative: string; closingMessage: string; legalNotice: string }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select({ id: donationInfo.id }).from(donationInfo).limit(1);
  if (existing.length > 0) {
    await db.update(donationInfo).set(data).where(eq(donationInfo.id, existing[0].id));
  } else {
    await db.insert(donationInfo).values(data);
  }
}

// ==================== BOOKMARKS ====================
export async function getBookmarksByUser(userId: number, bookId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.bookId, bookId))).orderBy(bookmarks.page);
}

export async function addBookmark(data: { userId: number; bookId: number; page: number; label?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(bookmarks).values(data).$returningId();
  return result[0].id;
}

export async function removeBookmark(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(bookmarks).where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));
}

// ==================== READING PROGRESS ====================
export async function getReadingProgress(userId: number, bookId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(readingProgress).where(and(eq(readingProgress.userId, userId), eq(readingProgress.bookId, bookId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertReadingProgress(data: { userId: number; bookId: number; currentPage: number; totalPages: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select({ id: readingProgress.id }).from(readingProgress).where(and(eq(readingProgress.userId, data.userId), eq(readingProgress.bookId, data.bookId))).limit(1);
  if (existing.length > 0) {
    await db.update(readingProgress).set({ currentPage: data.currentPage, totalPages: data.totalPages }).where(eq(readingProgress.id, existing[0].id));
  } else {
    await db.insert(readingProgress).values(data);
  }
}

// ==================== BOOKSHELF (내 책장) ====================
export async function getBookshelfByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const items = await db.select({
    id: bookshelf.id,
    bookId: bookshelf.bookId,
    createdAt: bookshelf.createdAt,
    title: books.title,
    author: books.author,
    genre: books.genre,
  }).from(bookshelf)
    .innerJoin(books, eq(bookshelf.bookId, books.id))
    .where(eq(bookshelf.userId, userId))
    .orderBy(bookshelf.createdAt);
  return items;
}

export async function addToBookshelf(userId: number, bookId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Check if already exists
  const existing = await db.select({ id: bookshelf.id }).from(bookshelf)
    .where(and(eq(bookshelf.userId, userId), eq(bookshelf.bookId, bookId))).limit(1);
  if (existing.length > 0) return existing[0].id;
  const result = await db.insert(bookshelf).values({ userId, bookId }).$returningId();
  return result[0].id;
}

export async function removeFromBookshelf(userId: number, bookId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(bookshelf).where(and(eq(bookshelf.userId, userId), eq(bookshelf.bookId, bookId)));
}

export async function isInBookshelf(userId: number, bookId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ id: bookshelf.id }).from(bookshelf)
    .where(and(eq(bookshelf.userId, userId), eq(bookshelf.bookId, bookId))).limit(1);
  return result.length > 0;
}

// ==================== ADMIN: STATISTICS ====================
export async function getTotalUserCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: count() }).from(users);
  return result[0]?.count || 0;
}

export async function getTodayVisitorCount() {
  const db = await getDb();
  if (!db) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // sessionId 기준으로 중복 제거하여 실제 방문자 수 집계
  const result = await db.select({ count: sql<number>`COUNT(DISTINCT COALESCE(sessionId, id))` }).from(visits)
    .where(gte(visits.visitedAt, today));
  return result[0]?.count || 0;
}

export async function getWeeklyVisitorCount() {
  const db = await getDb();
  if (!db) return 0;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);
  const result = await db.select({ count: sql<number>`COUNT(DISTINCT COALESCE(sessionId, id))` }).from(visits)
    .where(gte(visits.visitedAt, weekAgo));
  return result[0]?.count || 0;
}

export async function getMonthlyVisitorCount() {
  const db = await getDb();
  if (!db) return 0;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const result = await db.select({ count: sql<number>`COUNT(DISTINCT COALESCE(sessionId, id))` }).from(visits)
    .where(gte(visits.visitedAt, monthStart));
  return result[0]?.count || 0;
}

export async function getYearlyVisitorCount() {
  const db = await getDb();
  if (!db) return 0;
  const yearStart = new Date();
  yearStart.setMonth(0, 1);
  yearStart.setHours(0, 0, 0, 0);
  const result = await db.select({ count: sql<number>`COUNT(DISTINCT COALESCE(sessionId, id))` }).from(visits)
    .where(gte(visits.visitedAt, yearStart));
  return result[0]?.count || 0;
}

export async function getPopularBooks(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  // 인기 도서 = 읽기 진행도 레코드가 가장 많은 도서
  const result = await db.select({
    bookId: readingProgress.bookId,
    readerCount: count(),
    title: books.title,
    author: books.author,
  }).from(readingProgress)
    .innerJoin(books, eq(readingProgress.bookId, books.id))
    .groupBy(readingProgress.bookId, books.title, books.author)
    .orderBy(desc(count()))
    .limit(limit);
  return result;
}

export async function recordVisit(userId?: number, sessionId?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(visits).values({ userId: userId || null, sessionId: sessionId || null });
}

// ==================== ADMIN: USER MANAGEMENT ====================
export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select({
    id: users.id,
    openId: users.openId,
    name: users.name,
    email: users.email,
    role: users.role,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(desc(users.createdAt));
}

export async function getUserReadingHistory(userId: number) {
  const db = await getDb();
  if (!db) return { reading: [], completed: [] };
  const all = await db.select({
    bookId: readingProgress.bookId,
    currentPage: readingProgress.currentPage,
    totalPages: readingProgress.totalPages,
    updatedAt: readingProgress.updatedAt,
    title: books.title,
    author: books.author,
  }).from(readingProgress)
    .innerJoin(books, eq(readingProgress.bookId, books.id))
    .where(eq(readingProgress.userId, userId))
    .orderBy(desc(readingProgress.updatedAt));
  
  // 현재 읽는 책 vs 완독한 책 분리 (currentPage >= totalPages - 1 이면 완독)
  const reading = all.filter(item => item.totalPages === 0 || item.currentPage < item.totalPages - 1);
  const completed = all.filter(item => item.totalPages > 0 && item.currentPage >= item.totalPages - 1);
  return { reading, completed };
}

export async function getAllUserEmails() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({ email: users.email, name: users.name }).from(users);
  return result.filter(u => u.email && u.email.trim() !== "");
}
