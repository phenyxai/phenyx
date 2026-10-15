import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Insights",
};

export default function InsightsLayout({ children }: { children: ReactNode }) {
  return children;
}
