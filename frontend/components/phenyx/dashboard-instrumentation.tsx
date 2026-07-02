"use client";

import { useEffect } from "react";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { identify, trackLogin, recordDaysSinceLastVisit } from "@/lib/analytics";

/**
 * Load-time analytics wiring for the dashboard shell (PHE-35). Renders nothing.
 *
 * Once the session resolves it associates the analytics queue with the user
 * (`identify`), which also backfills any events queued before the user was
 * known — notably the sidebar's initial `tab_visit`, emitted synchronously on
 * first render before this async `getUser()` returns. Then it records the load
 * (`login`) and computes `days_since_last_visit` from the stored last-visit
 * timestamp (updating it to now).
 *
 * Lives in the layout (not a tab) so it runs once per shell load and not on tab
 * navigation — the layout, like the sidebar, does not remount on segment change.
 */
export function DashboardInstrumentation() {
  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user) return;
      identify(user.id);
      trackLogin();
      recordDaysSinceLastVisit(user.id);
    })();
    return () => {
      active = false;
    };
  }, []);

  return null;
}
