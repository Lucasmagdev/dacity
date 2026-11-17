import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { env } from "./env.js";

/** Supabase with the SECRET key: bypasses RLS, can call the service-only functions. Server only. */
export const db = createClient(env.supabaseUrl, env.supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** This process, for worker leases. */
export const INSTANCE = `${process.env.RAILWAY_REPLICA_ID || "local"}-${randomUUID().slice(0, 8)}`;

export async function call<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

/** Only one instance runs each job at a time; the lease expires on its own if this process dies. */
export const acquireLease = (name: string, ttlSeconds: number) =>
  call<boolean>("acquire_lease", { p_name: name, p_holder: INSTANCE, p_ttl_seconds: ttlSeconds });

/** The Supabase user behind a player's access token (sent by the web app), or null. */
export async function userFromToken(token: string): Promise<string | null> {
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}
