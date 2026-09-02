import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Upgrade",
};

export default function UpgradeLayout({ children }: { children: ReactNode }) {
  return children;
}
