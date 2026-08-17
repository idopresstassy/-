import { int, mediumtext, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const books = mysqlTable("books", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  author: varchar("author", { length: 200 }).notNull(),
  genre: mysqlEnum("genre", ["classic", "modern", "foreign"]).notNull(),
  content: mediumtext("content"),
  youtubeUrl: varchar("youtubeUrl", { length: 500 }),
  description: text("description"),
  googleDriveUrl: varchar("googleDriveUrl", { length: 1000 }),
  tableOfContents: text("tableOfContents"),
  studyMaterial: text("studyMaterial"),
  audioUrl: varchar("audioUrl", { length: 1000 }),
  webtoonUrl: varchar("webtoonUrl", { length: 1000 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Book = typeof books.$inferSelect;
export type InsertBook = typeof books.$inferInsert;

export const donationInfo = mysqlTable("donation_info", {
  id: int("id").autoincrement().primaryKey(),
  bankName: varchar("bankName", { length: 100 }),
  accountNumber: varchar("accountNumber", { length: 100 }),
  accountHolder: varchar("accountHolder", { length: 100 }),
  description: text("description"),
  email: varchar("email", { length: 320 }),
  representative: varchar("representative", { length: 100 }),
  closingMessage: text("closingMessage"),
  legalNotice: text("legalNotice"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DonationInfo = typeof donationInfo.$inferSelect;

export const bookmarks = mysqlTable("bookmarks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  bookId: int("bookId").notNull(),
  page: int("page").notNull(),
  label: varchar("label", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Bookmark = typeof bookmarks.$inferSelect;

export const readingProgress = mysqlTable("reading_progress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  bookId: int("bookId").notNull(),
  currentPage: int("currentPage").notNull().default(0),
  totalPages: int("totalPages").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReadingProgress = typeof readingProgress.$inferSelect;

// 로그인·비로그인 독자의 도서 열람 기록: 같은 독자의 동일 도서는 한 번만 누적
export const bookViews = mysqlTable("book_views", {
  id: int("id").autoincrement().primaryKey(),
  bookId: int("bookId").notNull(),
  viewerId: varchar("viewerId", { length: 64 }).notNull(),
  userId: int("userId"),
  viewedAt: timestamp("viewedAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("book_views_book_viewer_unique").on(table.bookId, table.viewerId),
]);

export type BookView = typeof bookViews.$inferSelect;

export const bookshelf = mysqlTable("bookshelf", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  bookId: int("bookId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BookshelfItem = typeof bookshelf.$inferSelect;

// 방문 기록 (통계용)
export const visits = mysqlTable("visits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  sessionId: varchar("sessionId", { length: 100 }),
  visitedAt: timestamp("visitedAt").defaultNow().notNull(),
});

export type Visit = typeof visits.$inferSelect;
