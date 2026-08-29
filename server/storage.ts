import { getSupabaseAdmin } from "./supabase";

/** 새 Supabase 버킷에 책 표지 등 공개 자산을 보관합니다. */
export const BOOK_COVERS_BUCKET = "book-covers";

export function normalizeStorageKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  return lastDot === -1 ? `${relKey}_${hash}` : `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export function getSupabaseStoragePublicUrl(baseUrl: string, bucket: string, key: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${bucket}/${key}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeStorageKey(relKey));
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(BOOK_COVERS_BUCKET).upload(key, data, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);

  const { data: publicUrlData } = supabase.storage.from(BOOK_COVERS_BUCKET).getPublicUrl(key);
  return { key, url: publicUrlData.publicUrl };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeStorageKey(relKey);
  const supabase = getSupabaseAdmin();
  const { data: publicUrlData } = supabase.storage.from(BOOK_COVERS_BUCKET).getPublicUrl(key);
  return { key, url: publicUrlData.publicUrl };
}

export async function storageGetSignedUrl(relKey: string, expiresIn = 3600): Promise<string> {
  const key = normalizeStorageKey(relKey);
  const { data, error } = await getSupabaseAdmin().storage
    .from(BOOK_COVERS_BUCKET)
    .createSignedUrl(key, expiresIn);
  if (error || !data?.signedUrl) throw new Error(`Supabase Storage signed URL failed: ${error?.message ?? "empty URL"}`);
  return data.signedUrl;
}
