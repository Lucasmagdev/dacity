/**
 * Game-wide state the admin controls: maintenance mode, the global announcement and the admin log.
 *
 * MOCK: lives in localStorage and syncs live across tabs of this browser (open the game in one tab and
 * #/admin in another to see it). In production this must come from a server that every player reads,
 * with writes accepted only when signed by an admin wallet. Maintenance should also pause the contracts
 * (DacityGang already has `whenNotPaused`).
 */
import { useSyncExternalStore } from "react";

export type AnnouncementKind = "info" | "event" | "warning";

export type Announcement = {
  id: string;
  kind: AnnouncementKind;
  title: string;
  message: string;
  createdAt: number;
  /** null = stays until removed */
  expiresAt: number | null;
};

export type AdminLogEntry = { id: string; at: number; by: string; action: string; detail: string };

export type PlatformState = {
  maintenance: { on: boolean; message: string; since: number | null };
  announcement: Announcement | null;
  log: AdminLogEntry[];
  /** Boxes sold game-wide (drives the launch sale). Admin gifts don't count. */
  boxesSold: number;
};

const KEY = "dacity.platform.v1";
const DISMISSED_KEY = "dacity.dismissed";
const LOG_MAX = 50;

const initial = (): PlatformState => ({
  maintenance: { on: false, message: "", since: null },
  announcement: null,
  log: [],
  boxesSold: 0,
});

function read(): PlatformState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...initial(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return initial();
}

let state = read();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function set(next: PlatformState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  emit();
}

// another tab (e.g. the admin panel) changed it
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      state = read();
      emit();
    } else if (e.key === DISMISSED_KEY) {
      dismissed = readDismissed();
      emit();
    }
  });
}

export function usePlatform<T = PlatformState>(select: (s: PlatformState) => T = (s) => s as unknown as T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => select(state),
  );
}

const uid = () => Math.random().toString(36).slice(2, 10);

const withLog = (s: PlatformState, by: string, action: string, detail: string): PlatformState => ({
  ...s,
  log: [{ id: uid(), at: Date.now(), by, action, detail }, ...s.log].slice(0, LOG_MAX),
});

export const isLive = (a: Announcement | null, now = Date.now()): a is Announcement =>
  !!a && (a.expiresAt === null || a.expiresAt > now);

export const platform = {
  /** Read fresh (another tab may have sold boxes). */
  boxesSold: () => read().boxesSold,

  recordBoxSale(count: number) {
    const fresh = read();
    set({ ...fresh, boxesSold: fresh.boxesSold + count });
  },

  log(by: string, action: string, detail: string) {
    set(withLog(state, by, action, detail));
  },

  setMaintenance(on: boolean, message: string, by: string) {
    set(
      withLog(
        { ...state, maintenance: { on, message: message.trim(), since: on ? Date.now() : null } },
        by,
        on ? "Maintenance ON" : "Maintenance OFF",
        on ? message.trim() || "(no message)" : "Game reopened",
      ),
    );
  },

  announce(a: Omit<Announcement, "id" | "createdAt">, by: string) {
    const ann: Announcement = { ...a, title: a.title.trim(), message: a.message.trim(), id: uid(), createdAt: Date.now() };
    set(withLog({ ...state, announcement: ann }, by, "Announcement", `[${ann.kind}] ${ann.title}`));
  },

  clearAnnouncement(by: string) {
    if (!state.announcement) return;
    set(withLog({ ...state, announcement: null }, by, "Announcement removed", state.announcement.title));
  },
};

// ------------------------------------------------------------------ per-player "dismiss" of the banner

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
  } catch {
    return [];
  }
}

let dismissed = readDismissed();

export function useDismissed(id: string | undefined) {
  const isDismissed = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => !!id && dismissed.includes(id),
  );
  const dismiss = () => {
    if (!id) return;
    dismissed = [id, ...dismissed].slice(0, 20);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
    } catch {
      /* ignore */
    }
    emit();
  };
  return [isDismissed, dismiss] as const;
}
