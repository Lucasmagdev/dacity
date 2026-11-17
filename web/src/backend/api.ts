/**
 * The payment server on Railway (VITE_API_URL): builds withdrawal transactions and confirms deposits.
 * Calls carry the player's Supabase session so the server knows whose withdrawal it is.
 */
import { supabase } from "./supabase";

export const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").trim().replace(/\/$/, "");

export async function api<T = unknown>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  if (!API_URL) throw new Error("Payments are offline right now (payment server not configured)");
  const token = (await supabase?.auth.getSession())?.data.session?.access_token ?? "";
  let r: Response;
  try {
    r = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Can't reach the payment server. Check your connection and try again.");
  }
  const data = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(data.error || `Payment server error (${r.status})`);
  return data;
}
