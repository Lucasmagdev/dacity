import { useCallback, useEffect, useRef, useState } from "react";

const SRC = "/audio/theme.mp3";
const VOLUME = 0.35;
const FADE_MS = 1200;
const PREF_KEY = "audacity:music";

function readPref(): "on" | "off" | null {
  try {
    const v = localStorage.getItem(PREF_KEY);
    return v === "on" || v === "off" ? v : null;
  } catch {
    return null;
  }
}

function writePref(v: "on" | "off") {
  try {
    localStorage.setItem(PREF_KEY, v);
  } catch {
    /* storage blocked: preference just won't persist */
  }
}

/**
 * Looping theme music with a floating toggle.
 * Browsers block audio until the visitor interacts, so playback starts on the
 * first click/tap/key unless the visitor has muted it before.
 */
export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef(0);
  const [playing, setPlaying] = useState(false);

  const fadeTo = useCallback((target: number, then?: () => void) => {
    const audio = audioRef.current;
    if (!audio) return;
    cancelAnimationFrame(fadeRef.current);
    const from = audio.volume;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / FADE_MS, 1);
      audio.volume = from + (target - from) * t;
      if (t < 1) fadeRef.current = requestAnimationFrame(step);
      else then?.();
    };
    fadeRef.current = requestAnimationFrame(step);
  }, []);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return false;
    try {
      audio.volume = 0;
      await audio.play();
      fadeTo(VOLUME);
      return true;
    } catch {
      return false;
    }
  }, [fadeTo]);

  const pause = useCallback(() => {
    fadeTo(0, () => audioRef.current?.pause());
  }, [fadeTo]);

  // Try to start right away; if blocked, start on the first interaction.
  useEffect(() => {
    if (readPref() === "off") return;
    let armed = true;
    const kick = () => {
      if (!armed) return;
      armed = false;
      void play();
      remove();
    };
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    const remove = () => events.forEach((e) => window.removeEventListener(e, kick));

    void play().then((ok) => {
      if (ok) armed = false;
      else events.forEach((e) => window.addEventListener(e, kick, { passive: true }));
    });
    return () => {
      armed = false;
      remove();
    };
  }, [play]);

  // Pause while the tab is hidden, resume when it comes back.
  useEffect(() => {
    let resume = false;
    const onVis = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (document.hidden) {
        resume = !audio.paused;
        audio.pause();
      } else if (resume) {
        void audio.play();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  function toggle(e: React.MouseEvent) {
    // Don't let this click also trigger the "first interaction" autostart.
    e.stopPropagation();
    if (playing) {
      writePref("off");
      pause();
    } else {
      writePref("on");
      void play();
    }
  }

  return (
    <>
      <audio
        ref={audioRef}
        src={SRC}
        loop
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button
        type="button"
        className={`music${playing ? " music--on" : ""}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={toggle}
        aria-pressed={playing}
        aria-label={playing ? "Mute theme music" : "Play theme music"}
        title={playing ? "Mute music" : "Play music"}
      >
        <span className="music__bars" aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="music__label">{playing ? "Music on" : "Music off"}</span>
      </button>
    </>
  );
}
