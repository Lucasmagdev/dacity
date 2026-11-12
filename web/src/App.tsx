import { useCallback, useEffect, useState } from "react";
import Landing from "./components/Landing";
import Loader from "./components/Loader";
import CharacterSelect from "./components/CharacterSelect";
import Hq from "./components/Hq";
import Admin from "./components/Admin";
import GlobalNotices, { MaintenanceScreen } from "./components/GlobalNotices";
import { useAdmin } from "./config/admin";
import { usePlatform } from "./mock/platform";
import "./admin.css";

/** Routes that are closed to players while maintenance is on. */
const GAME_ROUTES = ["/choose", "/hq"];

function useHashRoute() {
  const read = () => window.location.hash.replace(/^#/, "") || "/";
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const go = (to: string) => {
    window.location.hash = to;
    window.scrollTo(0, 0);
  };
  return [route, go] as const;
}

export default function App() {
  const [route, go] = useHashRoute();
  const [loading, setLoading] = useState(true);
  const finishLoading = useCallback(() => setLoading(false), []);
  const { isAdmin } = useAdmin();
  const maintenance = usePlatform((s) => s.maintenance.on);
  const blocked = maintenance && !isAdmin && GAME_ROUTES.includes(route);

  let page;
  if (route === "/admin") page = <Admin onBack={() => go("/")} />;
  else if (blocked) page = <MaintenanceScreen onBack={() => go("/")} />;
  else if (route === "/choose") page = <CharacterSelect onBack={() => go("/")} onEnterHq={() => go("/hq")} />;
  else if (route === "/hq") page = <Hq onBack={() => go("/")} onFound={() => go("/choose")} />;
  else page = <Landing onEnter={() => go("/choose")} />;

  return (
    <>
      {page}
      {route !== "/admin" && <GlobalNotices adminBypass={isAdmin} maintenanceNotice={!isAdmin && !blocked} />}
      {loading && <Loader onDone={finishLoading} />}
    </>
  );
}
