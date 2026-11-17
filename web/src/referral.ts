/**
 * Referral links: https://audacitygame.xyz/?ref=<gang-name-as-slug>
 *
 * The visitor's browser remembers the FIRST invite link it opened. When they found their gang, the code
 * goes to the database, which binds the referrer once and for all (and ignores unknown or own codes).
 * Rewards are paid by the database itself when a deposit is confirmed on-chain: nothing here can create
 * a reward, this file only carries the code from the link to the sign-up.
 */
import { useEffect, useState } from "react";
import { MOCK } from "./mock";
import { supabase } from "./backend/supabase";

const KEY = "dacity.ref";

/** Same rule as public.ref_code() in the database: lowercase letters/digits, the rest becomes one dash. */
export const refCode = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const refLink = (code: string) => `${window.location.origin}/?ref=${encodeURIComponent(code)}`;

export function storedRef(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearStoredRef() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Read ?ref= (also inside the #/ route), keep the first one seen, and tidy the address bar. */
function capture() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const hashQuery = url.hash.includes("?") ? new URLSearchParams(url.hash.slice(url.hash.indexOf("?") + 1)) : null;
  const raw = url.searchParams.get("ref") ?? hashQuery?.get("ref") ?? null;
  if (!raw) return;
  const code = refCode(raw).slice(0, 40);
  try {
    if (code.length >= 3 && !localStorage.getItem(KEY)) localStorage.setItem(KEY, code);
  } catch {
    /* private mode: the link still works for this visit only if they found the gang now */
  }
  url.searchParams.delete("ref");
  if (hashQuery) {
    hashQuery.delete("ref");
    const route = url.hash.slice(0, url.hash.indexOf("?"));
    url.hash = hashQuery.toString() ? `${route}?${hashQuery}` : route;
  }
  window.history.replaceState(null, "", url.toString());
}
capture();

/** The gang that invited this visitor (null if no link, or the code doesn't exist). */
export function useInviter(): { code: string; gang: string } | null {
  const [inviter, setInviter] = useState<{ code: string; gang: string } | null>(null);
  useEffect(() => {
    const code = storedRef();
    if (!code) return;
    if (MOCK || !supabase) {
      setInviter({ code, gang: code });
      return;
    }
    supabase.rpc("referral_lookup", { p_code: code }).then(({ data }) => {
      if (typeof data === "string" && data) setInviter({ code, gang: data });
    });
  }, []);
  return inviter;
}
