import { redirect } from "next/navigation";

/** /dashboard → /dashboard/daily (Daily is the default tab on entry). */
export default function DashboardPage() {
  redirect("/dashboard/daily");
}
