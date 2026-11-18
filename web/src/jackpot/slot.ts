/**
 * Audacity Jackpot screen (plain DOM, no React: dozens of tiles animating every second).
 * It never decides anything: it sends the bet to the payment server and replays the round it gets back.
 */
import { COLS, ROWS, PAYS, RULES, count, type Cell, type Grid, type JackpotId, type PayId, type Round, type Spin } from "../../../server/src/slot/engine";

export type SpinResponse = {
  roundId: number;
  bet: number;
  cost: number;
  round: Round;
  payout: number;
  potPaid: number;
  balance: number;
  pot: number;
  fair: { serverSeedHash: string; clientSeed: string; nonce: number };
};
export type SlotConfig = { enabled: boolean; bets: number[]; buyEnabled: boolean; buyCostX: number; maxWinX: number };
export type SlotOptions = {
  config: SlotConfig;
  balance: number;
  pot: number;
  spin: (bet: number, buy: boolean) => Promise<SpinResponse>;
  onSettled: (r: SpinResponse) => void;
  onError: (message: string) => void;
};
export type SlotHandle = { setBalance: (n: number) => void; setPot: (n: number) => void; setConfig: (c: SlotConfig) => void; destroy: () => void };

const IMG: Record<string, string> = {
  coin: "/jackpot/ammo.png",
  red: "/characters/rare-256.webp",
  papa: "/characters/uncommon-256.webp",
  lil: "/characters/common-256.webp",
  rifle: "/jackpot/rifle.jpg",
  smg: "/jackpot/smg.jpg",
  pistol: "/jackpot/pistol.jpg",
  vest: "/jackpot/vest.jpg",
  medkit: "/jackpot/medkit.jpg",
  S: "/jackpot/box.jpg",
  V: "/jackpot/vault.jpg",
};
const NAME = (s: string) => (s === "S" ? "Gangster Box" : s === "V" ? "Vault" : PAYS[s as PayId]?.name ?? s);
const JP_X: Record<JackpotId, number> = { GRAND: 2000, MAJOR: 500, MINOR: 100, MINI: 20 };
const TIERS: [number, string][] = [[10, "BIG WIN"], [25, "MEGA WIN"], [50, "EPIC WIN"], [100, "LEGENDARY WIN"]];

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Tile = HTMLDivElement & { _c: number; _r: number; _cell: Cell };

const TEMPLATE = `
<section class="aj-ladder" aria-label="Vault jackpots">
  <div class="aj-jp grand" data-min="7"><div class="k">GRAND <i>7+ VAULTS · PROGRESSIVE</i></div><div class="v" data-jp="GRAND">0</div></div>
  <div class="aj-jp major" data-min="6"><div class="k">MAJOR <i>6</i></div><div class="v" data-jp="MAJOR">0</div></div>
  <div class="aj-jp minor" data-min="5"><div class="k">MINOR <i>5</i></div><div class="v" data-jp="MINOR">0</div></div>
  <div class="aj-jp mini" data-min="4"><div class="k">MINI <i>4</i></div><div class="v" data-jp="MINI">0</div></div>
</section>
<section class="aj-stage">
  <aside class="aj-side">
    <button class="aj-card aj-buy" data-id="buy" type="button"><img src="/jackpot/box.jpg" alt=""><span class="t1" data-id="buyt">BUY THE HEIST</span><span class="t2" data-id="buyc"></span></button>
    <div class="aj-card aj-vcard"><span class="k">VAULTS ON GRID</span><span class="big" data-id="vn">0</span><small>4+ cracks a jackpot</small></div>
    <div class="aj-card aj-heat" data-id="heat" hidden><span class="k">HEAT · FREE SPINS <span data-id="fsl">15</span></span><span class="big" data-id="hv">x0</span><small>Every multiplier stacks</small></div>
  </aside>
  <div class="aj-board">
    <div class="aj-msg" data-id="msg">8+ OF A KIND ANYWHERE PAYS · PRESS SPIN</div>
    <div class="aj-grid" data-id="grid" role="img" aria-label="Slot grid, 6 columns by 5 rows"></div>
  </div>
</section>
<section class="aj-deck">
  <div class="aj-stats">
    <div class="aj-stat"><span class="k">BALANCE · DC</span><span class="v" data-id="bal">0</span></div>
    <div class="aj-stat w"><span class="k" data-id="wk">WIN</span><span class="v" data-id="win">0.00</span></div>
  </div>
  <button class="aj-spin" data-id="spin" type="button" aria-label="Spin">SPIN</button>
  <div class="aj-right">
    <div class="aj-betc">
      <button class="aj-rb" data-id="bm" type="button" aria-label="Lower bet">−</button>
      <div class="aj-stat"><span class="k">BET · DC</span><span class="v" data-id="bet">0</span></div>
      <button class="aj-rb" data-id="bp" type="button" aria-label="Raise bet">+</button>
    </div>
    <button class="aj-tb" data-id="auto" type="button" aria-pressed="false">AUTO 25</button>
    <button class="aj-tb" data-id="turbo" type="button" aria-pressed="false">TURBO</button>
    <button class="aj-tb" data-id="snd" type="button" aria-pressed="true">SOUND ON</button>
  </div>
</section>
<div class="aj-ov" data-id="ov" hidden><canvas data-id="fx"></canvas><div class="ovc"><img class="ovimg" data-id="ovimg" alt="" hidden><div class="ovk" data-id="ovk"></div><div class="ovt" data-id="ovt"></div><div class="ova" data-id="ova"></div><div class="ovs" data-id="ovs"></div><div class="ovh">TAP TO CONTINUE</div></div></div>
`;

export function mountSlot(root: HTMLElement, opts: SlotOptions): SlotHandle {
  root.classList.add("aj");
  root.innerHTML = TEMPLATE;
  const q = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector(`[data-id="${id}"]`) as T;

  let cfg = opts.config;
  let balance = opts.balance;
  let pot = opts.pot;
  const prefs = { bi: 2, mute: false, turbo: false };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem("aj.prefs") || "{}")); } catch { /* private mode */ }
  const savePrefs = () => { try { localStorage.setItem("aj.prefs", JSON.stringify(prefs)); } catch { /* ignore */ } };
  prefs.bi = Math.max(0, Math.min(cfg.bets.length - 1, prefs.bi));

  let busy = false, auto = 0, fs = false, fsLeft = 0, heat = 0, destroyed = false;
  let grid: Grid = [];
  let lastV = 0;
  const els = new Map<number, Tile>();
  const gridEl = q<HTMLDivElement>("grid");
  let cw = 80;
  const bet = () => cfg.bets[prefs.bi];
  const T = (ms: number) => (prefs.turbo ? ms * 0.45 : ms);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  Object.values(IMG).forEach((src) => { const i = new Image(); i.src = src; });

  /* ---------------- sound ---------------- */
  let ac: AudioContext | null = null;
  const actx = () => {
    if (prefs.mute) return null;
    if (!ac) { try { ac = new AudioContext(); } catch { return null; } }
    if (ac.state === "suspended") void ac.resume();
    return ac;
  };
  const tone = (f: number, d: number, type: OscillatorType = "square", v = 0.06, when = 0, f2?: number) => {
    const a = actx(); if (!a) return;
    const t = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + 0.03);
  };
  const noise = (d: number, v = 0.1, when = 0, hp = 800) => {
    const a = actx(); if (!a) return;
    const t = a.currentTime + when, b = a.createBuffer(1, Math.floor(a.sampleRate * d), a.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
    const s = a.createBufferSource(); s.buffer = b;
    const f = a.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp;
    const g = a.createGain(); g.gain.value = v;
    s.connect(f).connect(g).connect(a.destination); s.start(t);
  };
  const snd = {
    spin: () => noise(0.2, 0.07, 0, 1400),
    land: () => tone(130, 0.12, "sine", 0.2, 0, 55),
    win: (n: number) => [523.25, 659.25, 783.99, 1046.5].slice(0, 2 + Math.min(2, n)).forEach((f, i) => tone(f, 0.2, "square", 0.05, i * 0.06)),
    pop: () => { noise(0.14, 0.12, 0, 2400); tone(90, 0.15, "sine", 0.15, 0, 40); },
    mult: () => { tone(220, 0.35, "sawtooth", 0.06, 0, 1400); tone(70, 0.45, "sine", 0.3, 0.3, 35); noise(0.3, 0.1, 0.3, 300); },
    scatter: () => [783.99, 987.77, 1318.5, 1567.98].forEach((f, i) => tone(f, 0.55, "triangle", 0.09, i * 0.09)),
    tier: () => [659.25, 880, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.28, "square", 0.06, i * 0.07)),
    tick: () => tone(1900, 0.03, "square", 0.022),
    near: () => tone(330, 0.35, "triangle", 0.09, 0, 495),
    siren: () => { for (let i = 0; i < 5; i++) { tone(660, 0.25, "sawtooth", 0.05, i * 0.5, 990); tone(990, 0.25, "sawtooth", 0.05, i * 0.5 + 0.25, 660); } },
  };

  /* ---------------- grid ---------------- */
  const tf = (c: number, r: number) => `translate(${c * cw}px,${r * cw}px)`;
  const layout = () => {
    cw = gridEl.clientWidth / COLS;
    gridEl.style.setProperty("--cw", cw + "px");
    els.forEach((el) => (el.style.transform = tf(el._c, el._r)));
  };
  const ro = new ResizeObserver(layout);
  ro.observe(gridEl);

  const mcol = (m: number) => (m <= 6 ? "#3ddc84" : m <= 15 ? "#4da3ff" : m <= 50 ? "#ff3d93" : "#ffd36b");
  function mk(cell: Cell): Tile {
    const el = document.createElement("div") as Tile;
    el.className = "tile";
    const t = document.createElement("div");
    t.className = "t";
    if (cell.s === "M") {
      t.classList.add("m"); t.style.setProperty("--mc", mcol(cell.m ?? 2)); t.innerHTML = `<span>x${cell.m}</span>`;
    } else {
      const img = new Image(); img.src = IMG[cell.s]; img.alt = NAME(cell.s); img.draggable = false; t.appendChild(img);
      if (cell.s === "S") { t.classList.add("sc"); t.insertAdjacentHTML("beforeend", "<b>BOX</b>"); }
      else if (cell.s === "V") { t.classList.add("vt"); t.insertAdjacentHTML("beforeend", "<b>VAULT</b>"); }
      else if (cell.s === "coin") t.classList.add("top");
      else if (cell.s === "red" || cell.s === "papa" || cell.s === "lil") t.classList.add("hi");
    }
    el.appendChild(t); gridEl.appendChild(el); els.set(cell.id, el); el._cell = cell;
    return el;
  }
  function move(el: Tile, c: number, fromR: number, toR: number, dur: number, delay = 0) {
    el._c = c; el._r = toR; el.style.transform = tf(c, toR);
    return el.animate([{ transform: tf(c, fromR) }, { transform: tf(c, toR) }], { duration: dur, delay, easing: "cubic-bezier(.3,1.25,.5,1)", fill: "backwards" })
      .finished.then(() => undefined, () => undefined);
  }
  async function clearGrid() {
    const ps: Promise<unknown>[] = [];
    els.forEach((el) => ps.push(el.animate([{ transform: tf(el._c, el._r), opacity: 1 }, { transform: tf(el._c, el._r + ROWS + 1), opacity: 0 }],
      { duration: T(240), delay: T(el._c * 25), easing: "ease-in", fill: "forwards" }).finished.catch(() => undefined)));
    await Promise.all(ps);
    els.forEach((el) => el.remove()); els.clear();
  }
  async function dropGrid(g: Grid) {
    const ps: Promise<void>[] = [];
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) ps.push(move(mk(g[c][r]), c, r - ROWS - 1, r, T(420), T(c * 70 + (ROWS - 1 - r) * 28)));
      setTimeout(snd.land, T(c * 70 + 330));
    }
    await Promise.all(ps);
  }
  async function applyTumble(g2: Grid) {
    const ps: Promise<void>[] = [];
    for (let c = 0; c < COLS; c++) {
      const col = g2[c], k = col.filter((x) => !els.has(x.id)).length;
      for (let r = 0; r < ROWS; r++) {
        const el = els.get(col[r].id);
        if (el) { if (el._r !== r) ps.push(move(el, c, el._r, r, T(330))); }
        else ps.push(move(mk(col[r]), c, r - k - 1, r, T(380), T(60)));
      }
    }
    await Promise.all(ps);
    snd.land();
  }
  async function burst(ids: number[]) {
    const gone = ids.map((id) => [id, els.get(id)] as const).filter((p): p is readonly [number, Tile] => !!p[1]);
    gone.forEach(([, el]) => { el.classList.remove("win"); el.classList.add("pop"); });
    snd.pop();
    await sleep(T(260));
    gone.forEach(([id, el]) => { el.remove(); els.delete(id); });
  }
  const flash = (s: string) => els.forEach((el) => { if (el._cell.s === s) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); } });

  /* ---------------- HUD ---------------- */
  const msg = (h: string) => (q("msg").innerHTML = h);
  const setWin = (v: number, label = "WIN") => { q("win").textContent = fmt(v); q("wk").textContent = label; };
  function upd() {
    const b = bet(), maxBet = Math.max(...cfg.bets);
    q("bal").textContent = fmt(balance);
    q("bet").textContent = fmt(b);
    q("buyc").textContent = `${cfg.buyCostX}× BET · ${fmt(cfg.buyCostX * b)} DC`;
    root.querySelectorAll<HTMLElement>("[data-jp]").forEach((e) => {
      const id = e.dataset.jp as JackpotId;
      e.textContent = fmt(JP_X[id] * b + (id === "GRAND" ? pot * Math.min(1, b / maxBet) : 0));
    });
    (q("bm") as HTMLButtonElement).disabled = busy || prefs.bi === 0;
    (q("bp") as HTMLButtonElement).disabled = busy || prefs.bi === cfg.bets.length - 1;
    (q("buy") as HTMLButtonElement).disabled = busy || !cfg.buyEnabled || !cfg.enabled;
    (q("buy") as HTMLButtonElement).hidden = !cfg.buyEnabled;
    const sp = q("spin") as HTMLButtonElement;
    sp.disabled = !cfg.enabled || (busy && auto === 0);
    sp.textContent = auto > 0 ? "STOP" : "SPIN";
    sp.classList.toggle("stop", auto > 0);
    q("auto").setAttribute("aria-pressed", String(auto > 0));
    q("auto").textContent = auto > 0 ? `AUTO ${auto}` : "AUTO 25";
    q("turbo").setAttribute("aria-pressed", String(prefs.turbo));
    q("snd").setAttribute("aria-pressed", String(!prefs.mute));
    q("snd").textContent = prefs.mute ? "SOUND OFF" : "SOUND ON";
    q("heat").hidden = !fs;
    q("fsl").textContent = String(fsLeft);
    q("hv").textContent = "x" + heat;
    root.classList.toggle("heist", fs);
  }
  function vaults() {
    const n = count(grid, "V");
    q("vn").textContent = String(n);
    root.querySelectorAll<HTMLElement>(".aj-jp").forEach((j) => j.classList.toggle("near", n === Number(j.dataset.min) - 1));
    if (n >= 3 && n > lastV) snd.near();
    lastV = n;
  }

  /* ---------------- coin rain ---------------- */
  const fx = q<HTMLCanvasElement>("fx"), cx = fx.getContext("2d")!, coin = new Image();
  coin.src = "/jackpot/ammo.png";
  type P = { x: number; y: number; vx: number; vy: number; s: number; ph: number; vp: number };
  let parts: P[] = [], rate = 0, raf = 0;
  function fxStart(r: number) { rate = reduce ? Math.min(r, 1) : r; if (!raf) { parts = []; raf = requestAnimationFrame(fxLoop); } }
  function fxLoop() {
    const dpr = Math.min(2, devicePixelRatio || 1), w = fx.clientWidth, h = fx.clientHeight;
    if (fx.width !== Math.round(w * dpr)) { fx.width = Math.round(w * dpr); fx.height = Math.round(h * dpr); }
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, w, h);
    for (let i = 0; i < rate; i++) {
      if (Math.random() < 0.5) parts.push({ x: Math.random() * w, y: -40, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3, s: 26 + Math.random() * 30, ph: Math.random() * 6, vp: 0.1 + Math.random() * 0.15 });
      else parts.push({ x: w / 2, y: h * 0.55, vx: (Math.random() - 0.5) * 16, vy: -8 - Math.random() * 10, s: 24 + Math.random() * 34, ph: Math.random() * 6, vp: 0.1 + Math.random() * 0.2 });
    }
    parts = parts.filter((p) => p.y < h + 60);
    for (const p of parts) {
      p.vy += 0.32; p.x += p.vx; p.y += p.vy; p.ph += p.vp;
      cx.save(); cx.translate(p.x, p.y); cx.scale(Math.max(0.12, Math.abs(Math.cos(p.ph))), 1);
      if (coin.complete && coin.naturalWidth) cx.drawImage(coin, -p.s / 2, -p.s / 2, p.s, p.s);
      cx.restore();
    }
    if (!destroyed && (rate > 0 || parts.length)) raf = requestAnimationFrame(fxLoop);
    else { raf = 0; cx.clearRect(0, 0, w, h); }
  }

  /* ---------------- overlays ---------------- */
  const ov = q("ov");
  let ovTap: (() => void) | null = null;
  ov.addEventListener("click", () => ovTap?.());
  function setTitle(t: string) { const e = q("ovt"); e.textContent = t; e.classList.remove("pop"); void e.offsetWidth; e.classList.add("pop"); }
  function showOv(o: { t: string; k?: string; a?: string; s?: string; img?: string; jack?: boolean }) {
    ov.hidden = false; ov.classList.toggle("jack", !!o.jack);
    const im = q<HTMLImageElement>("ovimg"); im.hidden = !o.img; if (o.img) im.src = o.img;
    q("ovk").textContent = o.k ?? ""; q("ovs").innerHTML = o.s ?? ""; q("ova").textContent = o.a ?? "";
    setTitle(o.t);
  }
  const hideOv = () => { ov.hidden = true; rate = 0; ovTap = null; };
  const hold = (ms: number) => new Promise<void>((res) => {
    let done = false; const end = () => { if (done) return; done = true; hideOv(); res(); };
    ovTap = end; setTimeout(end, ms);
  });
  function countUp(amount: number, dur: number, onStep: (v: number) => void) {
    return new Promise<void>((res) => {
      const t0 = performance.now(); let stop = false, lastTick = 0;
      ovTap = () => { stop = true; };
      const step = (now: number) => {
        const p = stop ? 1 : Math.min(1, (now - t0) / dur), v = amount * (1 - Math.pow(1 - p, 2));
        q("ova").textContent = fmt(v); onStep(v);
        if (now - lastTick > 70) { snd.tick(); lastTick = now; }
        if (p < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  }
  async function banner(t: string, s: string, img: string, ms: number) {
    showOv({ t, s, img, k: "AUDACITY GAME" }); fxStart(1); snd.scatter();
    await hold(auto > 0 ? T(ms) : ms + 1500);
  }
  async function celebrate(win: number, b: number) {
    let top = 0; TIERS.forEach((t, i) => { if (win >= t[0] * b) top = i; });
    let cur = -1;
    showOv({ t: TIERS[0][1], k: "AUDACITY GAME", a: fmt(0) }); fxStart(1);
    await countUp(win, 1800 + top * 900, (v) => {
      let i = -1; TIERS.forEach((t, k) => { if (v >= t[0] * b) i = k; });
      if (i > cur && i >= 0) { cur = i; setTitle(TIERS[i][1]); snd.tier(); rate = 1 + i * 2; }
    });
    setTitle(TIERS[top][1]);
    await hold(auto > 0 ? 1200 : 2600);
  }
  async function celebrateJackpot(id: JackpotId, amount: number, nV: number) {
    showOv({ t: id + " JACKPOT", k: "THE VAULT IS CRACKED", img: "/jackpot/vault.jpg", a: fmt(0), jack: true, s: `<b>${nV} VAULTS</b> ON THE GRID` });
    snd.siren(); fxStart(id === "GRAND" ? 9 : id === "MAJOR" ? 6 : 4);
    await countUp(amount, id === "MINI" ? 2200 : 4200, () => undefined);
    await hold(auto > 0 ? 1800 : 4000);
  }

  /* ---------------- replay of the server's round ---------------- */
  async function fireMults() {
    flash("M"); snd.mult();
    await sleep(T(950));
  }
  /**
   * Animates one spin; returns what it paid in DC (jackpot pot share included). `room` = what is left before
   * the round's max win: a spin never shows (or counts) more than that, since anything above the cap isn't paid.
   */
  async function playSpin(s: Spin, b: number, potPaid: number, room = Infinity): Promise<number> {
    snd.spin();
    await clearGrid();
    grid = s.grid; lastV = 0;
    await dropGrid(grid); vaults();
    let tw = 0;
    for (const st of s.steps) {
      const ids = new Set(st.ids);
      els.forEach((el, id) => { if (ids.has(id)) el.classList.add("win"); });
      for (const w of st.wins) tw += w.x * b;
      msg(st.wins.map((w) => `${w.n}× ${NAME(w.s).toUpperCase()} <b>${fmt(w.x * b)}</b>`).join(" · "));
      setWin(tw, s.free ? "SPIN WIN" : "TUMBLE WIN"); snd.win(st.wins.length);
      await sleep(T(820));
      await burst(st.ids);
      grid = st.grid;
      await applyTumble(grid); vaults();
      await sleep(T(120));
    }
    const win = s.winX * b;
    if (s.free && s.tumbleX > 0) {
      if (s.mult > 0) { await fireMults(); const h = q("heat"); h.classList.remove("bump"); void h.offsetWidth; h.classList.add("bump"); }
      heat = s.heat; upd();
      msg(heat > 0 ? `${fmt(tw)} × HEAT ${heat} = <b>${fmt(win)}</b>` : `SPIN WIN <b>${fmt(win)}</b> · NO HEAT YET`);
      setWin(win); await sleep(T(700));
    } else if (!s.free && s.tumbleX > 0 && s.mult > 0) {
      await fireMults();
      msg(`${fmt(tw)} × ${s.mult} = <b>${fmt(win)}</b>`);
      setWin(win); await sleep(T(700));
    } else if (s.tumbleX === 0) msg(s.free ? "NO WIN · THE HEIST ROLLS ON" : "NO WIN · SPIN AGAIN");

    let paid = win;
    if (s.scatterX > 0) {
      paid += s.scatterX * b;
      flash("S"); snd.scatter(); msg(`${s.nS} GANGSTER BOXES · <b>${fmt(s.scatterX * b)}</b> + ${RULES.heistSpins} FREE SPINS`);
      await sleep(T(1300));
    }
    if (s.addedSpins > 0) {
      fsLeft += s.addedSpins; upd(); flash("S"); snd.scatter();
      msg(`${s.nS} BOXES · <b>+${s.addedSpins} FREE SPINS</b>`); await sleep(T(1100));
    }
    if (s.jackpot) {
      const amount = s.jackpotX * b + (s.jackpot === "GRAND" ? potPaid : 0);
      paid += amount;
      flash("V"); await sleep(T(900));
      await celebrateJackpot(s.jackpot, Math.min(amount, Math.max(0, room - (paid - amount))), s.nV);
    } else if (s.winX >= 10) await celebrate(Math.min(win, room), b);
    return Math.min(paid, room);
  }

  async function replay(r: SpinResponse) {
    const b = r.bet, round = r.round;
    const total = r.payout + r.potPaid;
    let shown = 0;
    // max win: the animation stops counting at what the round actually pays
    const room = () => (round.capped ? Math.max(0, total - shown) : Infinity);
    const maxed = () => round.capped && room() <= 0.005;
    if (round.base) shown += await playSpin(round.base, b, r.potPaid, room());
    if (round.triggered && !maxed()) {
      fs = true; fsLeft = RULES.heistSpins; heat = 0; upd();
      await banner("THE HEIST IS ON", `<b>${RULES.heistSpins} FREE SPINS</b> · HEAT STACKS ON EVERY WIN`, "/jackpot/box.jpg", 2400);
      let heistTotal = 0;
      for (const s of round.free) {
        fsLeft--; upd();
        const p = await playSpin(s, b, r.potPaid, room());
        heistTotal += p; shown += p;
        setWin(heistTotal, "HEIST TOTAL");
        await sleep(T(300));
        if (maxed()) break; // nothing after the max win is paid, so the Heist ends here
      }
      const hitMax = maxed();
      showOv(hitMax
        ? { t: "MAX WIN", k: "THE VAULT IS EMPTY · CAPPED AT", img: "/jackpot/vault.jpg", a: fmt(0), s: `${cfg.maxWinX.toLocaleString("en-US")}× BET · THE BIGGEST WIN A ROUND CAN PAY` }
        : { t: "HEIST COMPLETE", k: "THE CREW GOT AWAY WITH", img: "/jackpot/vault.jpg", a: fmt(0), s: `HEAT x${heat} · ${(heistTotal / b).toFixed(1)}× BET` });
      fxStart(heistTotal >= 20 * b ? 5 : 2); snd.tier();
      await countUp(heistTotal, 2400, () => undefined);
      await hold(auto > 0 ? 1800 : 3500);
      fs = false; heat = 0; fsLeft = 0;
    }
    if (round.capped) msg(`MAX WIN REACHED · <b>${fmt(total)} DC</b>`);
    else if (Math.abs(total - shown) > 0.01 && total > 0) msg(`ROUND PAID <b>${fmt(total)} DC</b>`);
    setWin(total, round.triggered ? "ROUND WIN" : "WIN");
  }

  /* ---------------- play ---------------- */
  async function play(buy: boolean) {
    if (busy || destroyed) return;
    const b = bet(), cost = buy ? cfg.buyCostX * b : b;
    if (!cfg.enabled) { msg("THE JACKPOT IS CLOSED RIGHT NOW"); return; }
    if (balance < cost) { msg(`NOT ENOUGH DC · THIS COSTS <b>${fmt(cost)}</b>`); auto = 0; upd(); return; }
    busy = true; balance -= cost; setWin(0); upd();
    let res: SpinResponse | null = null;
    try {
      res = await opts.spin(b, buy);
    } catch (e) {
      balance += cost; auto = 0; busy = false; upd();
      msg(`<b>${(e as Error).message.toUpperCase()}</b>`);
      opts.onError((e as Error).message);
      return;
    }
    pot = res.pot; upd();
    await replay(res);
    balance = res.balance; busy = false; upd();
    opts.onSettled(res);
    if (auto > 0) {
      auto--; upd();
      if (auto > 0) { await sleep(T(350)); void play(false); }
    }
  }

  /* ---------------- controls ---------------- */
  const wake = () => actx();
  q("spin").onclick = () => { wake(); if (auto > 0) { auto = 0; upd(); return; } void play(false); };
  q("auto").onclick = () => { wake(); if (auto > 0) { auto = 0; upd(); return; } auto = 25; upd(); void play(false); };
  q("turbo").onclick = () => { prefs.turbo = !prefs.turbo; savePrefs(); upd(); };
  q("snd").onclick = () => { prefs.mute = !prefs.mute; savePrefs(); upd(); wake(); };
  q("bm").onclick = () => { if (busy || prefs.bi === 0) return; prefs.bi--; savePrefs(); upd(); };
  q("bp").onclick = () => { if (busy || prefs.bi === cfg.bets.length - 1) return; prefs.bi++; savePrefs(); upd(); };
  let armT = 0;
  q("buy").onclick = () => {
    wake();
    if (busy) return;
    const bt = q("buy");
    if (!bt.classList.contains("arm")) {
      bt.classList.add("arm"); q("buyt").textContent = "TAP TO CONFIRM";
      clearTimeout(armT);
      armT = window.setTimeout(() => { bt.classList.remove("arm"); q("buyt").textContent = "BUY THE HEIST"; }, 3000);
      return;
    }
    clearTimeout(armT); bt.classList.remove("arm"); q("buyt").textContent = "BUY THE HEIST";
    auto = 0; void play(true);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code !== "Space" || (e.target as HTMLElement).closest("button,input,textarea,[role=dialog]")) return;
    e.preventDefault(); wake();
    if (!ov.hidden) { ovTap?.(); return; }
    if (auto === 0) void play(false);
  };
  document.addEventListener("keydown", onKey);

  // opening board: a still sample grid so the screen never starts empty (not a result)
  layout();
  const ids = { n: -1 };
  const sample: PayId[] = ["medkit", "vest", "pistol", "smg", "rifle", "lil", "papa", "red", "coin"];
  grid = Array.from({ length: COLS }, (_, c) =>
    Array.from({ length: ROWS }, (_, r) => ({ id: ids.n--, s: (c * 2 + r) % 11 === 10 ? "V" : (c + r) % 13 === 12 ? "S" : sample[(c * 3 + r * 5) % sample.length] }) as Cell));
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) { const el = mk(grid[c][r]); el._c = c; el._r = r; el.style.transform = tf(c, r); }
  vaults(); upd();
  if (!cfg.enabled) msg("THE JACKPOT IS CLOSED RIGHT NOW");

  return {
    setBalance: (n) => { if (!busy) { balance = n; upd(); } },
    setPot: (n) => { pot = n; upd(); },
    setConfig: (c) => { cfg = c; prefs.bi = Math.max(0, Math.min(c.bets.length - 1, prefs.bi)); upd(); if (c.enabled && !busy) msg("8+ OF A KIND ANYWHERE PAYS · PRESS SPIN"); },
    destroy: () => { destroyed = true; auto = 0; ro.disconnect(); document.removeEventListener("keydown", onKey); cancelAnimationFrame(raf); void ac?.close(); root.innerHTML = ""; },
  };
}
