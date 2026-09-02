import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Daily",
};

export default function DailyLayout({ children }: { children: ReactNode }) {
  return children;
}
