import { redirect } from "next/navigation";

/** /dashboard/profile moved to /dashboard/you (PHE-91, v244 shell). */
export default function ProfileRedirectPage() {
  redirect("/dashboard/you");
}
