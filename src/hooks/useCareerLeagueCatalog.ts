import { useEffect, useState } from "react";
import { CATALOG_EVENT } from "@/lib/catalog-events";

/** Keeps career creation forms in sync with the Supabase-backed sports catalog. */
export function useCareerLeagueCatalog(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = () => setVersion((current) => current + 1);
    window.addEventListener(CATALOG_EVENT, refresh);
    // Keep the provider client outside selection-page startup. Catalogue
    // fetching still starts after mount, with bundled clubs available first.
    void import("@/lib/db-catalog")
      .then(({ loadDbCatalog }) => loadDbCatalog())
      .then(() => {
        if (active) refresh();
      })
      .catch(() => undefined);
    return () => {
      active = false;
      window.removeEventListener(CATALOG_EVENT, refresh);
    };
  }, []);

  return version;
}
