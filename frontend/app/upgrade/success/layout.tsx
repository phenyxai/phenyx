import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Upgrade complete",
};

export default function UpgradeSuccessLayout({ children }: { children: ReactNode }) {
  return children;
}
