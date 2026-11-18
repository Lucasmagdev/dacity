/**
 * "Vault Cam" share card: a short looping GIF drawn on a canvas in the player's browser, with their
 * gang's real farm numbers (security-camera look: cyan tint, scanlines, blinking REC, the DC counting up).
 * Nothing is sent anywhere: the GIF is handed to the phone's share sheet or downloaded.
 */

export type VaultCamData = {
  gang: string;
  boss: string;
  bossImage: string;
  /** how far to slide the portrait up (fraction of its height) so the face sits above the info box */
  bossLift?: number;
  /** lifetime DC farmed (claimed + pending) */
  farmed: number;
  ratePerDay: number;
  crew: number;
  farming: number;
  day: number;
  link: string;
};

export const W = 480;
export const H = 600;
const FRAMES = 30;
const DELAY = 80; // ms per frame (~2.4s loop)
const COUNT_FRAMES = 16; // the number counts up during these, then holds

const CYAN = "#22e4ff";
const AMBER = "#ffb020";
const MONO = 'ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace';

const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Couldn't load the portrait"));
    img.src = src;
  });
}

/** The boss portrait, cropped to fill the card and recolored like a cyan CCTV feed. Drawn once. */
function cctvBase(img: HTMLImageElement, lift: number) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;
  // cover-crop, biased to the top (faces)
  const s = Math.max(W / img.width, H / img.height) * 1.08;
  const dw = img.width * s;
  const dh = img.height * s;
  x.drawImage(img, (W - dw) / 2, -dh * lift, dw, dh);

  const d = x.getImageData(0, 0, W, H);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    let l = (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) / 255;
    l = Math.min(1, Math.max(0, (l - 0.06) * 1.25)); // a bit of contrast
    // dark teal -> cyan -> near white
    p[i] = 6 + l * l * 190;
    p[i + 1] = 22 + l * 200;
    p[i + 2] = 30 + l * 205;
  }
  x.putImageData(d, 0, 0);

  // static scanlines
  x.fillStyle = "rgba(0,0,0,0.22)";
  for (let y = 0; y < H; y += 3) x.fillRect(0, y, W, 1);

  // vignette
  const v = x.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H / 2, H * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,8,12,0.78)");
  x.fillStyle = v;
  x.fillRect(0, 0, W, H);
  return c;
}

function corners(x: CanvasRenderingContext2D) {
  const m = 18;
  const l = 30;
  x.strokeStyle = "rgba(255,255,255,0.9)";
  x.lineWidth = 3;
  x.beginPath();
  for (const [cx, cy, dx, dy] of [
    [m, m, 1, 1],
    [W - m, m, -1, 1],
    [m, H - m, 1, -1],
    [W - m, H - m, -1, -1],
  ]) {
    x.moveTo(cx, cy + dy * l);
    x.lineTo(cx, cy);
    x.lineTo(cx + dx * l, cy);
  }
  x.stroke();
}

function fit(x: CanvasRenderingContext2D, text: string, max: number) {
  if (x.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && x.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}

function stamp(t: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}`;
}

function drawFrame(x: CanvasRenderingContext2D, base: HTMLCanvasElement, d: VaultCamData, f: number, start: Date) {
  x.drawImage(base, 0, 0);

  // rolling bright band (the camera's refresh)
  const bandY = ((f / FRAMES) * (H + 120)) - 60;
  const g = x.createLinearGradient(0, bandY - 40, 0, bandY + 40);
  g.addColorStop(0, "rgba(120,240,255,0)");
  g.addColorStop(0.5, "rgba(120,240,255,0.10)");
  g.addColorStop(1, "rgba(120,240,255,0)");
  x.fillStyle = g;
  x.fillRect(0, bandY - 40, W, 80);

  // a glitch line on a couple of frames
  if (f === 7 || f === 22) {
    const gy = f === 7 ? 150 : 380;
    x.drawImage(base, 0, gy, W, 10, 10, gy, W, 10);
    x.fillStyle = "rgba(180,250,255,0.18)";
    x.fillRect(0, gy + 4, W, 2);
  }

  corners(x);

  // REC + camera label
  x.textBaseline = "alphabetic";
  x.font = `700 17px ${MONO}`;
  if (Math.floor(f / 5) % 2 === 0) {
    x.fillStyle = "#ff2b4a";
    x.beginPath();
    x.arc(48, 47, 7, 0, Math.PI * 2);
    x.fill();
  }
  x.fillStyle = "#fff";
  x.fillText("REC", 62, 53);
  x.textAlign = "right";
  x.fillText("CAM 03", W - 46, 53);
  x.fillText("THE VAULT", W - 46, 75);
  x.textAlign = "left";

  // the info box
  const bx = 44;
  const by = 300;
  const bw = W - 88;
  const bh = 170;
  x.fillStyle = "rgba(2,16,22,0.72)";
  x.fillRect(bx, by, bw, bh);
  x.strokeStyle = "rgba(34,228,255,0.85)";
  x.lineWidth = 1.5;
  x.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);

  const pad = bx + 16;
  const max = bw - 32;
  x.font = `700 15px ${MONO}`;
  x.fillStyle = "#fff";
  const subj = "SUBJECT: ";
  x.fillText(subj, pad, by + 30);
  x.fillStyle = AMBER;
  const sw = x.measureText(subj).width;
  x.fillText(fit(x, d.gang.toUpperCase(), max - sw), pad + sw, by + 30);

  x.fillStyle = "#fff";
  x.fillText(fit(x, `ACTIVITY: FARMING ${fmtInt(d.ratePerDay)} DC/DAY`, max), pad, by + 54);

  const k = Math.min(1, f / COUNT_FRAMES);
  const eased = 1 - Math.pow(1 - k, 3);
  const big = `+${fmtInt(d.farmed * eased)} DC`;
  let size = 46;
  x.font = `800 ${size}px ${MONO}`;
  while (x.measureText(big).width > max && size > 24) x.font = `800 ${--size}px ${MONO}`;
  x.fillStyle = "#fff";
  x.shadowColor = CYAN;
  x.shadowBlur = 14;
  x.fillText(big, pad, by + 112);
  x.shadowBlur = 0;

  x.font = `700 15px ${MONO}`;
  const status = d.farming > 0 ? "STILL FARMING" : "LAYING LOW";
  x.fillText(fit(x, `STATUS: ${status} · DAY ${d.day} · CREW ${d.crew}`, max), pad, by + 148);

  // timestamp + boss, then the invite link on its own line
  x.font = `700 14px ${MONO}`;
  x.fillStyle = "#fff";
  x.fillText(stamp(new Date(start.getTime() + f * DELAY)), 44, H - 70);
  x.font = `700 13px ${MONO}`;
  x.fillStyle = "rgba(255,255,255,0.75)";
  x.textAlign = "right";
  x.fillText(fit(x, `BOSS: ${d.boss.toUpperCase()}`, 190), W - 44, H - 70);
  x.textAlign = "left";
  x.font = `700 15px ${MONO}`;
  x.fillStyle = CYAN;
  x.fillText(fit(x, d.link.replace(/^https?:\/\/(www\.)?/, ""), W - 88), 44, H - 45);
}

/** Renders the looping GIF. Takes ~1s on a phone. */
export async function renderVaultCam(d: VaultCamData): Promise<Blob> {
  const [{ GIFEncoder, quantize, applyPalette }, img] = await Promise.all([import("gifenc"), loadImage(d.bossImage)]);
  const base = cctvBase(img, d.bossLift ?? 0.02);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  const start = new Date();

  // one palette for every frame keeps colors steady and the file small: sample frame 0 (REC dot on)
  // and the last frame (full number)
  drawFrame(x, base, d, 0, start);
  const a = x.getImageData(0, 0, W, H).data;
  drawFrame(x, base, d, FRAMES - 1, start);
  const b = x.getImageData(0, 0, W, H).data;
  const both = new Uint8ClampedArray(a.length * 2);
  both.set(a);
  both.set(b, a.length);
  const palette = quantize(both, 256);

  const gif = GIFEncoder();
  for (let f = 0; f < FRAMES; f++) {
    drawFrame(x, base, d, f, start);
    const px = x.getImageData(0, 0, W, H).data;
    gif.writeFrame(applyPalette(px, palette), W, H, { palette: f === 0 ? palette : undefined, delay: DELAY, repeat: 0 });
    if (f % 6 === 5) await new Promise((r) => setTimeout(r)); // let the spinner breathe
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}
