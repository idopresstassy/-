import { getSupabaseAdmin } from "./supabase";

import type { CreativeGenre } from "../shared/creative";

export type Genre = "classic" | "modern" | "foreign" | "creative";
type UserId = string;
type BookRecord = {
  id: number; title: string; author: string; genre: Genre; content: string | null;
  description: string | null; coverUrl: string | null; youtubeUrl: string | null;
  audioUrl: string | null; webtoonUrl: string | null; googleDriveUrl: string | null;
  tableOfContents: string | null; studyMaterial: string | null; createdAt: Date; updatedAt: Date;
  creativeGenre: CreativeGenre | null;
};
const bookSelect = "id,title,author,genre,creative_genre,content,description,cover_url,youtube_url,audio_url,webtoon_url,source_url,table_of_contents,study_material,created_at,updated_at";
const asDate = (value: string | null | undefined) => value ? new Date(value) : new Date();
const fail = (error: unknown) => { if (error) throw error; };

function book(row: any): BookRecord {
  return { id: Number(row.id), title: row.title, author: row.author, genre: row.genre as Genre,
    content: row.content ?? null, description: row.description ?? null, coverUrl: row.cover_url ?? null,
    youtubeUrl: row.youtube_url ?? null, audioUrl: row.audio_url ?? null, webtoonUrl: row.webtoon_url ?? null,
    googleDriveUrl: row.source_url ?? null, tableOfContents: row.table_of_contents ?? null,
    studyMaterial: row.study_material ?? null, creativeGenre: row.creative_genre ?? null,
    createdAt: asDate(row.created_at), updatedAt: asDate(row.updated_at) };
}

function bookPayload(data: Record<string, unknown>) {
  const names: Record<string, string> = { youtubeUrl: "youtube_url", audioUrl: "audio_url", webtoonUrl: "webtoon_url", googleDriveUrl: "source_url", tableOfContents: "table_of_contents", studyMaterial: "study_material", coverUrl: "cover_url", creativeGenre: "creative_genre" };
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [names[key] ?? key, value]));
}

export async function getBooks(filter?: { genre?: Genre; search?: string; creativeGenre?: CreativeGenre }) {
  let query = getSupabaseAdmin().from("books").select(bookSelect);
  query = filter?.genre === "creative"
    ? query.order("created_at", { ascending: false }).order("id", { ascending: false })
    : query.order("created_at");
  if (filter?.genre) query = query.eq("genre", filter.genre);
  if (filter?.creativeGenre) query = query.eq("creative_genre", filter.creativeGenre);
  if (filter?.search?.trim()) query = query.or(`title.ilike.%${filter.search.trim()}%,author.ilike.%${filter.search.trim()}%`);
  const { data, error } = await query; fail(error); return (data ?? []).map(book);
}
export async function getBookById(id: number) { const { data, error } = await getSupabaseAdmin().from("books").select(bookSelect).eq("id", id).maybeSingle(); fail(error); return data ? book(data) : undefined; }
export async function getBookByTitleAuthor(title: string, author: string) { const { data, error } = await getSupabaseAdmin().from("books").select(bookSelect).eq("title", title).eq("author", author).maybeSingle(); fail(error); return data ? book(data) : undefined; }
export async function createBook(data: { title: string; author: string; genre: Genre; content?: string; description?: string; youtubeUrl?: string; audioUrl?: string; googleDriveUrl?: string; tableOfContents?: string; studyMaterial?: string; webtoonUrl?: string; coverUrl?: string; creativeGenre?: CreativeGenre }) { const { data: row, error } = await getSupabaseAdmin().from("books").insert(bookPayload(data)).select("id").single(); fail(error); return Number(row?.id); }
export async function updateBook(id: number, data: Record<string, unknown>) { const { error } = await getSupabaseAdmin().from("books").update(bookPayload(data)).eq("id", id); fail(error); }
export async function upsertBook(data: Parameters<typeof createBook>[0]) { const old = await getBookByTitleAuthor(data.title, data.author); if (old) { await updateBook(old.id, data); return { id: old.id, isUpdate: true }; } return { id: await createBook(data), isUpdate: false }; }
export async function deleteBook(id: number) { const db = getSupabaseAdmin(); await Promise.all([db.from("bookmarks").delete().eq("book_id", id), db.from("reading_progress").delete().eq("book_id", id), db.from("bookshelf").delete().eq("book_id", id), db.from("book_views").delete().eq("book_id", id)]); const { error } = await db.from("books").delete().eq("id", id); fail(error); }

export type CreativeSubmissionStatus = "pending" | "approved" | "rejected";
export type CreativeSubmission = {
  id: number;
  userId: string;
  title: string;
  authorName: string;
  genre: CreativeGenre;
  description: string | null;
  content: string;
  status: CreativeSubmissionStatus;
  reviewNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
};

const submissionSelect = "id,user_id,title,author_name,genre,description,content,status,review_note,created_at,reviewed_at";
function creativeSubmission(row: any): CreativeSubmission {
  return {
    id: Number(row.id), userId: row.user_id, title: row.title, authorName: row.author_name,
    genre: row.genre as CreativeGenre, description: row.description ?? null, content: row.content,
    status: row.status as CreativeSubmissionStatus, reviewNote: row.review_note ?? null,
    createdAt: asDate(row.created_at), reviewedAt: row.reviewed_at ? asDate(row.reviewed_at) : null,
  };
}

export async function createCreativeSubmission(input: {
  userId: UserId; title: string; authorName: string; genre: CreativeGenre;
  description?: string; content: string;
}) {
  const supabase = getSupabaseAdmin();
  const { count, error: countError } = await supabase.from("creative_submissions")
    .select("id", { count: "exact", head: true }).eq("user_id", input.userId).eq("status", "pending");
  fail(countError);
  if ((count ?? 0) >= 5) throw new Error("검수 대기 중인 원고는 한 번에 5편까지 제출할 수 있습니다.");
  const { data, error } = await supabase.from("creative_submissions").insert({
    user_id: input.userId, title: input.title, author_name: input.authorName,
    genre: input.genre, description: input.description?.trim() || null,
    content: input.content, rights_confirmed_at: new Date().toISOString(),
  }).select("id").single();
  fail(error);
  if (!data) throw new Error("원고를 저장하지 못했습니다.");
  return Number(data.id);
}

export async function getCreativeSubmissionsByUser(userId: UserId) {
  const { data, error } = await getSupabaseAdmin().from("creative_submissions")
    .select("id,title,author_name,genre,status,review_note,created_at,reviewed_at")
    .eq("user_id", userId).order("created_at", { ascending: false });
  fail(error);
  return (data ?? []).map((row: any) => ({
    id: Number(row.id), title: row.title, authorName: row.author_name,
    genre: row.genre as CreativeGenre, status: row.status as CreativeSubmissionStatus,
    reviewNote: row.review_note ?? null, createdAt: asDate(row.created_at),
    reviewedAt: row.reviewed_at ? asDate(row.reviewed_at) : null,
  }));
}

export async function getPendingCreativeSubmissions() {
  const { data, error } = await getSupabaseAdmin().from("creative_submissions")
    .select(`${submissionSelect},profiles!creative_submissions_user_id_fkey(name,email)`)
    .eq("status", "pending").order("created_at", { ascending: true });
  fail(error);
  return (data ?? []).map((row: any) => ({
    ...creativeSubmission(row), submitterName: row.profiles?.name ?? null,
    submitterEmail: row.profiles?.email ?? null,
  }));
}

export async function approveCreativeSubmission(id: number, reviewerId: UserId) {
  const { data, error } = await getSupabaseAdmin().rpc("approve_creative_submission", {
    p_submission_id: id, p_reviewed_by: reviewerId,
  });
  fail(error);
  return Number(data);
}

export async function rejectCreativeSubmission(id: number, reviewerId: UserId, note?: string) {
  const { data, error } = await getSupabaseAdmin().from("creative_submissions")
    .update({ status: "rejected", review_note: note?.trim() || null, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", id).eq("status", "pending").select("id").maybeSingle();
  fail(error);
  if (!data) throw new Error("이미 검수되었거나 원고를 찾을 수 없습니다.");
}

export async function getDonationInfo() { const { data, error } = await getSupabaseAdmin().from("donation_info").select("*").order("id").limit(1).maybeSingle(); fail(error); return data ? { id: Number(data.id), bankName: data.bank_name, accountNumber: data.account_number, accountHolder: data.account_holder, description: data.description, email: data.email, representative: data.representative, closingMessage: data.closing_message, legalNotice: data.legal_notice, updatedAt: asDate(data.updated_at) } : undefined; }
export async function upsertDonationInfo(data: Record<string, unknown>) { const names: Record<string, string> = { bankName: "bank_name", accountNumber: "account_number", accountHolder: "account_holder", closingMessage: "closing_message", legalNotice: "legal_notice" }; const payload = Object.fromEntries(Object.entries(data).map(([k, v]) => [names[k] ?? k, v])); const old = await getDonationInfo(); const { error } = old ? await getSupabaseAdmin().from("donation_info").update(payload).eq("id", old.id) : await getSupabaseAdmin().from("donation_info").insert(payload); fail(error); }

export async function getBookmarksByUser(userId: UserId, bookId: number) { const { data, error } = await getSupabaseAdmin().from("bookmarks").select("*").eq("user_id", userId).eq("book_id", bookId).order("page"); fail(error); return (data ?? []).map((x: any) => ({ id: Number(x.id), userId: x.user_id, bookId: Number(x.book_id), page: x.page, label: x.label, createdAt: asDate(x.created_at) })); }
export async function addBookmark(data: { userId: UserId; bookId: number; page: number; label?: string }) { const { data: row, error } = await getSupabaseAdmin().from("bookmarks").insert({ user_id: data.userId, book_id: data.bookId, page: data.page, label: data.label ?? null }).select("id").single(); fail(error); return Number(row?.id); }
export async function removeBookmark(id: number, userId: UserId) { const { error } = await getSupabaseAdmin().from("bookmarks").delete().eq("id", id).eq("user_id", userId); fail(error); }
export async function getReadingProgress(userId: UserId, bookId: number) { const { data, error } = await getSupabaseAdmin().from("reading_progress").select("*").eq("user_id", userId).eq("book_id", bookId).maybeSingle(); fail(error); return data ? { id: Number(data.id), userId: data.user_id, bookId: Number(data.book_id), currentPage: data.current_page, totalPages: data.total_pages, updatedAt: asDate(data.updated_at) } : undefined; }
export async function upsertReadingProgress(data: { userId: UserId; bookId: number; currentPage: number; totalPages: number }) { const { error } = await getSupabaseAdmin().from("reading_progress").upsert({ user_id: data.userId, book_id: data.bookId, current_page: data.currentPage, total_pages: data.totalPages }, { onConflict: "user_id,book_id" }); fail(error); }
export async function getBookshelfByUser(userId: UserId) { const { data, error } = await getSupabaseAdmin().from("bookshelf").select("id,book_id,created_at,books(title,author,genre)").eq("user_id", userId).order("created_at"); fail(error); return (data ?? []).map((x: any) => ({ id: Number(x.id), bookId: Number(x.book_id), createdAt: asDate(x.created_at), title: x.books?.title, author: x.books?.author, genre: x.books?.genre })); }
export async function addToBookshelf(userId: UserId, bookId: number) { const { data, error } = await getSupabaseAdmin().from("bookshelf").upsert({ user_id: userId, book_id: bookId }, { onConflict: "user_id,book_id" }).select("id").single(); fail(error); return Number(data?.id); }
export async function removeFromBookshelf(userId: UserId, bookId: number) { const { error } = await getSupabaseAdmin().from("bookshelf").delete().eq("user_id", userId).eq("book_id", bookId); fail(error); }
export async function isInBookshelf(userId: UserId, bookId: number) { const { count, error } = await getSupabaseAdmin().from("bookshelf").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("book_id", bookId); fail(error); return (count ?? 0) > 0; }

async function visitsSince(since: Date) { const { data, error } = await getSupabaseAdmin().from("visits").select("id,session_id,visited_at").gte("visited_at", since.toISOString()); fail(error); return data ?? []; }
const uniqueVisits = (rows: any[]) => new Set(rows.map((row) => row.session_id || String(row.id))).size;
export async function getTotalUserCount() { const { count, error } = await getSupabaseAdmin().from("profiles").select("*", { count: "exact", head: true }); fail(error); return count ?? 0; }
export async function getTodayVisitorCount() { const since = new Date(); since.setHours(0, 0, 0, 0); return uniqueVisits(await visitsSince(since)); }
export async function getWeeklyVisitorCount() { const since = new Date(); since.setDate(since.getDate() - 7); since.setHours(0, 0, 0, 0); return uniqueVisits(await visitsSince(since)); }
export async function getMonthlyVisitorCount() { const since = new Date(); since.setDate(1); since.setHours(0, 0, 0, 0); return uniqueVisits(await visitsSince(since)); }
export async function getYearlyVisitorCount() { const since = new Date(); since.setMonth(0, 1); since.setHours(0, 0, 0, 0); return uniqueVisits(await visitsSince(since)); }
export async function getDailyVisitorCounts(days = 14) { const start = new Date(); start.setDate(start.getDate() - (days - 1)); start.setHours(0, 0, 0, 0); const grouped = new Map<string, Set<string>>(); (await visitsSince(start)).forEach((row: any) => { const kst = new Date(new Date(row.visited_at).getTime() + 9 * 3600000); const key = kst.toISOString().slice(0, 10); if (!grouped.has(key)) grouped.set(key, new Set()); grouped.get(key)!.add(row.session_id || String(row.id)); }); return Array.from({ length: days }, (_, i) => { const day = new Date(start); day.setDate(start.getDate() + i); const kst = new Date(day.getTime() + 9 * 3600000); const date = kst.toISOString().slice(0, 10); return { date, label: `${String(kst.getUTCMonth() + 1).padStart(2, "0")}/${String(kst.getUTCDate()).padStart(2, "0")}`, visitors: grouped.get(date)?.size ?? 0 }; }); }
export async function getPopularBooks(limit = 10) { const db = getSupabaseAdmin(); const [{ data: books, error: bookError }, { data: views, error: viewError }] = await Promise.all([db.from("books").select("id,title,author"), db.from("book_views").select("book_id,viewer_id")]); fail(bookError); fail(viewError); const counts = new Map<number, Set<string>>(); (views ?? []).forEach((view: any) => { const id = Number(view.book_id); if (!counts.has(id)) counts.set(id, new Set()); counts.get(id)!.add(view.viewer_id); }); return (books ?? []).map((item: any) => ({ bookId: Number(item.id), title: item.title, author: item.author, readerCount: counts.get(Number(item.id))?.size ?? 0 })).filter((item) => item.readerCount > 0).sort((a, b) => b.readerCount - a.readerCount || a.title.localeCompare(b.title)).slice(0, limit); }
export async function recordBookView(bookId: number, viewerId: string, userId?: UserId) { const { error } = await getSupabaseAdmin().from("book_views").upsert({ book_id: bookId, viewer_id: viewerId, user_id: userId ?? null }, { onConflict: "book_id,viewer_id" }); fail(error); }
export async function recordVisit(userId?: UserId, sessionId?: string) { const { error } = await getSupabaseAdmin().from("visits").insert({ user_id: userId ?? null, session_id: sessionId ?? null }); fail(error); }
export async function getAllUsers() { const { data, error } = await getSupabaseAdmin().from("profiles").select("id,name,email,role,created_at,last_signed_in_at").order("created_at", { ascending: false }); fail(error); return (data ?? []).map((row: any) => ({ id: row.id, openId: row.id, name: row.name, email: row.email, role: row.role, createdAt: asDate(row.created_at), lastSignedIn: asDate(row.last_signed_in_at) })); }
export async function getUserReadingHistory(userId: UserId) { const { data, error } = await getSupabaseAdmin().from("reading_progress").select("book_id,current_page,total_pages,updated_at,books(title,author)").eq("user_id", userId).order("updated_at", { ascending: false }); fail(error); const all = (data ?? []).map((row: any) => ({ bookId: Number(row.book_id), currentPage: row.current_page, totalPages: row.total_pages, updatedAt: asDate(row.updated_at), title: row.books?.title, author: row.books?.author })); return { reading: all.filter((item) => item.totalPages === 0 || item.currentPage < item.totalPages - 1), completed: all.filter((item) => item.totalPages > 0 && item.currentPage >= item.totalPages - 1) }; }
export async function getAllUserEmails() { const { data, error } = await getSupabaseAdmin().from("profiles").select("name,email").not("email", "is", null); fail(error); return (data ?? []).filter((item: any) => item.email?.trim()); }
