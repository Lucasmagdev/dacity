/**
 * The API the web app calls (and Helius webhooks). Everything that moves money checks the player's
 * Supabase session and that the withdrawal/deposit belongs to them.
 *
 *   GET  /health                         status of the jobs (for Railway's health check)
 *   POST /deposits/check      {reference} credit a deposit right away instead of waiting for the timer
 *   POST /withdrawals/tx      {id}        the transaction for the player to sign
 *   POST /withdrawals/submitted {id}      the player sent it: confirm and mark it sent
 *   POST /withdrawals/cancel  {id}        refund a withdrawal that was never sent
 *   POST /slot/spin           {bet, buy}  Audacity Jackpot: take the bet in DC, play the round, pay it
 *   POST /webhooks/helius                 Helius saw a transfer to a game wallet: check deposits now
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { env } from "./env.js";
import { userFromToken } from "./db.js";
import { log } from "./log.js";
import { checkDepositByReference, depositsTick } from "./jobs/deposits.js";
import { HttpError, cancelWithdrawal, withdrawalSubmitted, withdrawalTx } from "./jobs/withdrawals.js";
import { jobStatus } from "./jobs/runner.js";
import { spinRound } from "./slot/play.js";

const MAX_BODY = 64 * 1024;

// ---------------------------------------------------------------- tiny per-IP rate limit
const hits = new Map<string, { n: number; reset: number }>();
function limited(ip: string, max = 60, windowMs = 60_000) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + windowMs });
    return false;
  }
  h.n++;
  return h.n > max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
}, 60_000).unref();

// ---------------------------------------------------------------- helpers
function cors(req: IncomingMessage, res: ServerResponse) {
  const origin = (req.headers.origin ?? "").replace(/\/$/, "");
  if (origin && (env.webOrigins.length === 0 || env.webOrigins.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Max-Age", "600");
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, "Body too large");
    chunks.push(c as Buffer);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

async function player(req: IncomingMessage): Promise<string> {
  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  const user = await userFromToken(token);
  if (!user) throw new HttpError(401, "Sign in again");
  return user;
}

const idOf = (b: Record<string, unknown>) => {
  const id = Number(b.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Missing id");
  return id;
};

const sameSecret = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

let webhookTimer: NodeJS.Timeout | null = null;

// ---------------------------------------------------------------- routes
async function route(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://x");
  const path = url.pathname.replace(/\/$/, "") || "/";

  if (req.method === "GET" && (path === "/" || path === "/health")) {
    return send(res, 200, { ok: true, network: env.network, ammoLive: !!env.ammoMint, jobs: jobStatus() });
  }
  if (req.method !== "POST") throw new HttpError(404, "Not found");

  if (path === "/webhooks/helius") {
    const auth = req.headers.authorization ?? "";
    if (!env.heliusSecret || !sameSecret(auth, env.heliusSecret)) throw new HttpError(401, "Bad webhook secret");
    await readJson(req).catch(() => ({}));
    // a burst of transfers → one scan shortly after
    if (!webhookTimer) {
      webhookTimer = setTimeout(() => {
        webhookTimer = null;
        depositsTick().catch((e) => log.warn("webhook", "deposit scan failed", { error: (e as Error).message }));
      }, 1500);
    }
    return send(res, 200, { ok: true });
  }

  const body = await readJson(req);
  if (path === "/deposits/check") {
    const reference = String(body.reference ?? "");
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(reference)) throw new HttpError(400, "Bad reference");
    return send(res, 200, await checkDepositByReference(reference));
  }
  if (path === "/withdrawals/tx") return send(res, 200, await withdrawalTx(await player(req), idOf(body)));
  if (path === "/withdrawals/submitted") return send(res, 200, await withdrawalSubmitted(await player(req), idOf(body)));
  if (path === "/withdrawals/cancel") return send(res, 200, await cancelWithdrawal(await player(req), idOf(body)));
  if (path === "/slot/spin") return send(res, 200, await spinRound(await player(req), body));
  throw new HttpError(404, "Not found");
}

export function startHttp() {
  const server = createServer(async (req, res) => {
    cors(req, res);
    if (req.method === "OPTIONS") return void res.writeHead(204).end();
    const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0].trim();
    if (!req.url?.startsWith("/webhooks/") && limited(ip)) return send(res, 429, { error: "Too many requests, slow down" });
    try {
      await route(req, res);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status >= 500) log.error("http", "request failed", { path: req.url, error: (e as Error).message });
      send(res, status, { error: status === 500 ? "Server error, try again" : (e as Error).message });
    }
  });
  server.keepAliveTimeout = 65_000;
  server.listen(env.port, () => log.info("http", `listening on :${env.port}`));
  return server;
}
