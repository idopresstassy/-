import { eq, and, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, books, donationInfo, bookmarks, readingProgress } from "../drizzle/schema";
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

export async function createBook(data: { title: string; author: string; genre: "classic" | "modern" | "foreign"; content?: string; description?: string; youtubeUrl?: string; googleDriveUrl?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(books).values(data).$returningId();
  return result[0].id;
}

export async function updateBook(id: number, data: Partial<{ title: string; author: string; genre: "classic" | "modern" | "foreign"; content: string; description: string; youtubeUrl: string; googleDriveUrl: string }>) {
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
