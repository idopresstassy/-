import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabasePublicKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const url = supabaseUrl;
const anonKey = supabasePublicKey;

if (!url || !anonKey) {
  console.warn("Supabase browser environment variables are not configured.");
}

export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key",
  { auth: { persistSession: true, autoRefreshToken: true } },
);
