import { createHash, createSign } from "node:crypto";
import { getSupabaseAdmin } from "./supabase";
import { getBookById } from "./supabaseDb";

const AUDIO_BUCKET = "book-audio";
const DEFAULT_VOICE = "ko-KR-Chirp3-HD-Achernar";
const MONTHLY_CHARACTER_LIMIT = 900_000;
let cachedToken: { value: string; expiresAt: number } | null = null;

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function serviceAccount() {
  const raw = process.env.GOOGLE_TTS_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value.client_email || !value.private_key || !value.project_id) return null;
    return value as { client_email: string; private_key: string; project_id: string };
  } catch {
    return null;
  }
}

async function getAccessToken(account: NonNullable<ReturnType<typeof serviceAccount>>) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(account.private_key).toString("base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) throw new Error("Google service account authentication failed");
  const token = await response.json() as { access_token: string; expires_in: number };
  cachedToken = { value: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
  return token.access_token;
}

async function synthesize(text: string, voiceName: string, addCommaPauses = false) {
  const account = serviceAccount();
  if (!account) throw new Error("Google TTS service account is not configured");
  const token = await getAccessToken(account);
  const response = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      input: addCommaPauses
        ? { markup: text.replace(/,(\s*)/g, ", [pause short]$1") }
        : { text },
      voice: { languageCode: "ko-KR", name: voiceName },
      audioConfig: { audioEncoding: "MP3", speakingRate: 1 },
    }),
  });
  const result = await response.json() as { audioContent?: string; error?: { message?: string } };
  if (!response.ok || !result.audioContent) throw new Error(result.error?.message || "Google TTS synthesis failed");
  return Buffer.from(result.audioContent, "base64");
}

async function signedAudioUrl(path: string) {
  const { data, error } = await getSupabaseAdmin().storage.from(AUDIO_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw new Error(`Cached audio URL failed: ${error?.message ?? "empty URL"}`);
  return data.signedUrl;
}

export type AudioRequest = {
  bookId: number;
  pageNumber: number;
  sentenceNumber: number;
  text: string;
};

export async function getOrCreateBookSentenceAudio(input: AudioRequest) {
  const text = input.text.trim();
  const voiceName = process.env.GOOGLE_TTS_VOICE_NAME || DEFAULT_VOICE;
  if (!text) throw new Error("문장이 비어 있습니다.");
  if (text.length > 4000) throw new Error("문장을 4,000자 이하로 나눠 주세요.");

  const book = await getBookById(input.bookId);
  if (!book) throw new Error("도서를 찾을 수 없습니다.");
  let canonicalText = book.content ?? "";
  if (!canonicalText.trim() && book.googleDriveUrl) {
    const match = book.googleDriveUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (match) {
      const response = await fetch(`https://docs.google.com/document/d/${match[1]}/export?format=txt`);
      if (response.ok) canonicalText = await response.text();
    }
  }
  const normalize = (value: string) => value.normalize("NFC").replace(/\([^)]*[\u3400-\u4DBF\u4E00-\u9FFF][^)]*\)|（[^）]*[\u3400-\u4DBF\u4E00-\u9FFF][^）]*）/g, "").replace(/[\u00B9\u00B2\u00B3\u2070-\u2079†‡※]/g, "").replace(/\s+/g, " ").trim();
  if (!canonicalText || !normalize(canonicalText).includes(normalize(text))) {
    throw new Error("뷰어에 표시된 도서 문장과 원문이 일치하지 않습니다.");
  }

  const pilotSetting = process.env.GOOGLE_TTS_PILOT_BOOK_ID?.trim() || "";
  const pilotBookId = Number(pilotSetting);
  if (pilotSetting.toLowerCase() !== "all" && (!Number.isInteger(pilotBookId) || input.bookId !== pilotBookId)) {
    return { fallback: true as const, reason: "pilot_only" as const };
  }
  if (!serviceAccount()) return { fallback: true as const, reason: "not_configured" as const };

  const sourceHash = sha256(text);
  const pausePilotBookId = Number(process.env.GOOGLE_TTS_PAUSE_TEST_BOOK_ID);
  const addCommaPauses = Number.isInteger(pausePilotBookId) && pausePilotBookId === input.bookId;
  const cacheBase = `${input.bookId}:${input.pageNumber}:${input.sentenceNumber}:${voiceName}:${sourceHash}`;
  // Keep old clips for every other book; generate a separate cache version for the pilot book.
  const cacheKey = sha256(addCommaPauses ? `${cacheBase}:comma-pause-v1` : cacheBase);
  const storagePath = `${input.bookId}/${input.pageNumber}/${voiceName}/${cacheKey}.mp3`;
  const supabase = getSupabaseAdmin();
  const { data: reservation, error: reserveError } = await supabase.rpc("reserve_book_audio", {
    p_cache_key: cacheKey,
    p_book_id: input.bookId,
    p_page_number: input.pageNumber,
    p_sentence_number: input.sentenceNumber,
    p_voice_name: voiceName,
    p_source_hash: sourceHash,
    p_storage_path: storagePath,
    p_characters: text.length,
  });
  if (reserveError) throw new Error(`오디오 캐시 예약에 실패했습니다: ${reserveError.message}`);

  if (reservation?.status === "quota") return { fallback: true as const, reason: "quota" as const };
  if (reservation?.status === "pending") {
    // Another reader is generating this exact sentence. Wait briefly for the shared cache.
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const { data, error } = await supabase.from("book_audio_cache").select("status,storage_path").eq("cache_key", cacheKey).maybeSingle();
      if (error) throw new Error(`오디오 캐시 조회에 실패했습니다: ${error.message}`);
      if (data?.status === "ready" && data.storage_path) {
        return { audioUrl: await signedAudioUrl(data.storage_path), fallback: false as const, cached: true };
      }
    }
    return { fallback: true as const, reason: "busy" as const };
  }

  if (reservation?.status === "ready" && reservation.storage_path) {
    return { audioUrl: await signedAudioUrl(reservation.storage_path), fallback: false as const, cached: true };
  }
  if (reservation?.status !== "generate") throw new Error("오디오 생성 상태를 확인할 수 없습니다.");

  let audio: Buffer;
  try {
    audio = await synthesize(text, voiceName, addCommaPauses);
  } catch (error) {
    await supabase.rpc("fail_book_audio", {
      p_cache_key: cacheKey, p_characters: text.length, p_release_usage: true,
    });
    console.error("Book audio synthesis failed:", error instanceof Error ? error.message : "unknown error");
    return { fallback: true as const, reason: "unavailable" as const };
  }

  const { error: uploadError } = await supabase.storage.from(AUDIO_BUCKET).upload(storagePath, audio, {
    contentType: "audio/mpeg", cacheControl: "31536000", upsert: true,
  });
  if (uploadError) {
    // Synthesis succeeded and may be billable, so keep the usage count for this request.
    await supabase.rpc("fail_book_audio", {
      p_cache_key: cacheKey, p_characters: text.length, p_release_usage: false,
    });
    throw new Error(`음성 파일 저장에 실패했습니다: ${uploadError.message}`);
  }

  const { error: finishError } = await supabase.rpc("finish_book_audio", {
    p_cache_key: cacheKey, p_storage_path: storagePath,
  });
  if (finishError) throw new Error(`음성 캐시 완료 기록에 실패했습니다: ${finishError.message}`);
  return { audioUrl: await signedAudioUrl(storagePath), fallback: false as const, cached: false };
}

export async function listBookAudioCache(limit = 100) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("book_audio_cache")
    .select("cache_key,book_id,page_number,sentence_number,voice_name,status,created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (error) throw new Error(`오디오 캐시 목록을 불러오지 못했습니다: ${error.message}`);

  const bookIds = [...new Set((data ?? []).map((row) => Number(row.book_id)))];
  const { data: books, error: booksError } = bookIds.length
    ? await supabase.from("books").select("id,title").in("id", bookIds)
    : { data: [], error: null };
  if (booksError) throw new Error(`도서 제목을 불러오지 못했습니다: ${booksError.message}`);
  const titles = new Map((books ?? []).map((book) => [Number(book.id), book.title]));

  return (data ?? []).map((row) => ({
    cacheKey: row.cache_key,
    bookId: Number(row.book_id),
    bookTitle: titles.get(Number(row.book_id)) ?? `도서 #${row.book_id}`,
    pageNumber: row.page_number,
    sentenceNumber: row.sentence_number,
    voiceName: row.voice_name,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function deleteBookAudioCache(cacheKey: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("book_audio_cache")
    .select("cache_key,status,storage_path")
    .eq("cache_key", cacheKey)
    .maybeSingle();
  if (error) throw new Error(`오디오 캐시를 확인하지 못했습니다: ${error.message}`);
  if (!data) return { deleted: false, storageRemoved: true };
  if (data.status === "generating") throw new Error("생성 중인 음성은 잠시 후 삭제해 주세요.");

  const { error: storageError } = await supabase.storage.from(AUDIO_BUCKET).remove([data.storage_path]);
  if (storageError) {
    throw new Error(`저장된 음성 파일을 삭제하지 못했습니다: ${storageError.message}`);
  }

  // Delete the cache record after the MP3 is removed. The next request can then regenerate it.
  const { error: deleteError } = await supabase
    .from("book_audio_cache")
    .delete()
    .eq("cache_key", cacheKey);
  if (deleteError) throw new Error(`오디오 캐시 기록을 삭제하지 못했습니다: ${deleteError.message}`);

  // Monthly usage remains as an audit of TTS already generated and billed.
  return { deleted: true, storageRemoved: true };
}

export async function getBookAudioMonthlyUsage() {
  const { data, error } = await getSupabaseAdmin().rpc("get_book_audio_monthly_usage");
  if (error) throw new Error(`월간 오디오 사용량 조회에 실패했습니다: ${error.message}`);
  return { charactersUsed: Number(data ?? 0), characterLimit: MONTHLY_CHARACTER_LIMIT };
}
