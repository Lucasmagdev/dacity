import { useEffect, useState } from "react";
import Scene from "./Scene";
import Nav from "./Nav";
import { isLive, useDismissed, usePlatform, type Announcement } from "../mock/platform";

const ICON = { info: "i", event: "★", warning: "!" } as const;

export function AnnouncementCard({ a, onClose }: { a: Announcement; onClose?: () => void }) {
  return (
    <div className={`announce announce--${a.kind}`} role="status">
      <span className="announce__icon" aria-hidden>
        {ICON[a.kind]}
      </span>
      <div className="announce__body">
        <strong>{a.title}</strong>
        <p>{a.message}</p>
      </div>
      {onClose && (
        <button type="button" className="announce__close" onClick={onClose} aria-label="Dismiss announcement">
          ×
        </button>
      )}
    </div>
  );
}

/** Re-render when an announcement's expiry passes. */
function useTick(ms = 30_000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

/**
 * Floating notices for every player: the live announcement (dismissible once per announcement)
 * and, for admins, a reminder that maintenance is on while they bypass it.
 */
export default function GlobalNotices({ adminBypass, maintenanceNotice }: { adminBypass: boolean; maintenanceNotice: boolean }) {
  useTick();
  const p = usePlatform();
  const live = isLive(p.announcement) ? p.announcement : null;
  const [dismissed, dismiss] = useDismissed(live?.id);

  const showAnn = live && !dismissed;
  const showBypass = adminBypass && p.maintenance.on;
  const showMaint = maintenanceNotice && p.maintenance.on;
  if (!showAnn && !showBypass && !showMaint) return null;

  return (
    <div className="notices">
      {showBypass && (
        <div className="notices__bypass">
          Maintenance is ON · you're seeing the game as admin. <a href="#/admin">Admin panel</a>
        </div>
      )}
      {showMaint && (
        <AnnouncementCard
          a={{
            id: "maintenance",
            kind: "warning",
            title: "Under maintenance",
            message: p.maintenance.message || "We're upgrading the city. Back shortly.",
            createdAt: 0,
            expiresAt: null,
          }}
        />
      )}
      {showAnn && <AnnouncementCard a={live} onClose={dismiss} />}
    </div>
  );
}

export function MaintenanceScreen({ onBack }: { onBack: () => void }) {
  const m = usePlatform((s) => s.maintenance);
  return (
    <div className="page select">
      <Scene dim />
      <Nav links={false} onBack={onBack} />
      <div className="select__inner">
        <div className="gate panel gate--maint">
          <span className="gate__cone" aria-hidden>
            <i />
            <i />
          </span>
          <p className="eyebrow">Under maintenance</p>
          <h2>The city is closed</h2>
          <p className="muted">{m.message || "We're upgrading the city. Back shortly."}</p>
          <p className="muted gate__small">Your gang, coins and gangsters are safe. Farming keeps counting while we work.</p>
          <button type="button" className="btn" onClick={onBack}>
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
