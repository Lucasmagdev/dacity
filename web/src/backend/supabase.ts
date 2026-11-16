import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client for the browser. Uses the PUBLISHABLE key only: Row Level Security on the database
 * decides what each player can read, and every game action is a database function that checks the rules.
 * The secret key never goes here.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "dacity.auth" } }) : null;

/** Database errors come back as Postgres messages; keep only the human part. */
export function cleanError(message: string) {
  return message.replace(/^.*?ERROR:\s*/i, "").replace(/\s*\(SQLSTATE.*$/, "");
}

export async function rpc<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error("Supabase isn't configured (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY)");
  const { data, error } = await supabase.rpc(name, args ?? {});
  if (error) throw new Error(cleanError(error.message));
  return data as T;
}
