import { redirect } from "next/navigation";

/**
 * /dashboard → /dashboard/constellation. PHE-100: the constellation is the home
 * and overview screen (spec doc 1 and 2). Every entry routes through here:
 * sign-in (`signin-client.tsx`), the end of onboarding's formation, and any
 * bare /dashboard link, so this one redirect makes constellation home
 * everywhere. Daily stays reachable at /dashboard/daily; nav order and tab
 * names belong to the navigation issue.
 */
export default function DashboardPage() {
  redirect("/dashboard/constellation");
}
