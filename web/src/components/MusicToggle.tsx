import { useEffect, useSyncExternalStore } from "react";

/**
 * Landing-page soundtrack. Browsers block audio until the visitor interacts with the page, so it
 * tries to start right away and otherwise starts on the first click/tap/key. Muting is remembered.
 */
const SRC = "/audio/theme.mp3";
const VOLUME = 0.22;
const KEY = "dacity.music";

let audio: HTMLAudioElement | null = null;
let on = readPref();
let playing = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function readPref() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

function el() {
  if (!audio) {
    audio = new Audio(SRC);
    audio.loop = true;
    audio.volume = VOLUME;
    audio.preload = "auto";
    audio.addEventListener("play", () => ((playing = true), emit()));
    audio.addEventListener("pause", () => ((playing = false), emit()));
  }
  return audio;
}

function play() {
  if (!on || document.hidden) return;
  el()
    .play()
    .catch(() => {
      /* blocked until the first interaction: the unlock listener retries */
    });
}

function pause() {
  audio?.pause();
}

function setOn(v: boolean) {
  on = v;
  try {
    localStorage.setItem(KEY, v ? "on" : "off");
  } catch {
    /* private mode: just don't remember it */
  }
  if (v) play();
  else pause();
  emit();
}

/** Plays the soundtrack while the component using it is mounted. */
function useSoundtrack() {
  useEffect(() => {
    play();
    const unlock = (e: Event) => {
      if ((e.target as Element | null)?.closest?.(".music")) return; // the button handles itself
      if (on && !playing) play();
    };
    const vis = () => (document.hidden ? pause() : play());
    const opts = { capture: true } as const;
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("keydown", unlock, opts);
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("pointerdown", unlock, opts);
      window.removeEventListener("keydown", unlock, opts);
      document.removeEventListener("visibilitychange", vis);
      pause();
    };
  }, []);
  return useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => (on ? (playing ? "playing" : "waiting") : "off"),
  );
}

export default function MusicToggle() {
  const state = useSoundtrack();
  const isOn = state !== "off";
  return (
    <button
      type="button"
      className={`music${isOn ? " is-on" : ""}${state === "playing" ? " is-playing" : ""}`}
      // still waiting for the browser to allow audio: the first click starts it instead of muting
      onClick={() => (state === "waiting" ? play() : setOn(!isOn))}
      aria-pressed={isOn}
      title={isOn ? "Music on (click to mute)" : "Music off (click to play)"}
    >
      <span className="music__bars" aria-hidden>
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="music__label">Music {isOn ? "on" : "off"}</span>
    </button>
  );
}
