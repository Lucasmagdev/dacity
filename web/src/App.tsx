import { useCallback, useEffect, useState } from "react";
import Landing from "./components/Landing";
import Loader from "./components/Loader";
import CharacterSelect from "./components/CharacterSelect";
import Hq from "./components/Hq";

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

  let page;
  if (route === "/choose") page = <CharacterSelect onBack={() => go("/")} onEnterHq={() => go("/hq")} />;
  else if (route === "/hq") page = <Hq onBack={() => go("/")} onFound={() => go("/choose")} />;
  else page = <Landing onEnter={() => go("/choose")} />;

  return (
    <>
      {page}
      {loading && <Loader onDone={finishLoading} />}
    </>
  );
}
