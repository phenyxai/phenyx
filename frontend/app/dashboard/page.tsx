import { redirect } from "next/navigation";
import { DASHBOARD_HOME } from "@/lib/dashboard-nav";

/**
 * /dashboard → /dashboard/constellation. The constellation is the home and
 * overview screen (spec doc 1 and 2; PHE-100, PHE-96). Every entry routes
 * through here: sign-in, the end of onboarding's formation, and any bare
 * /dashboard link, so this one redirect makes constellation home everywhere.
 * Old /dashboard/daily and /dashboard/you bookmarks are redirected in
 * next.config.mjs.
 */
export default function DashboardPage() {
  redirect(DASHBOARD_HOME);
}
