"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy /settings surface. v67 settings live on Profile; this route
 * forwards so gifted/pause copy is no longer reachable.
 */
export default function SettingsClient() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/profile");
  }, [router]);

  return (
    <main
      aria-label="your settings"
      className="flex min-h-screen items-center justify-center bg-[#0A0A0A]"
    />
  );
}
