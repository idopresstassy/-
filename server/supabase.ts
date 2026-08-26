import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Request } from "express";

export type AppUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: "admin" | "user";
  createdAt: Date;
  lastSignedIn: Date;
};

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  if (adminClient) return adminClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase server environment variables are not configured.");
  }

  adminClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}

function getBearerToken(req: Request) {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
}

export async function getRequestUser(req: Request): Promise<AppUser | null> {
  const token = getBearerToken(req);
  if (!token) return null;

  const supabase = getSupabaseAdmin();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,name,email,role,created_at,last_signed_in_at")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError || !profile) return null;

  return {
    id: profile.id,
    name: profile.name ?? null,
    email: profile.email ?? null,
    role: profile.role === "admin" ? "admin" : "user",
    createdAt: new Date(profile.created_at),
    lastSignedIn: new Date(profile.last_signed_in_at),
  };
}
