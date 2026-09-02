import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Constellation",
};

export default function ConstellationLayout({ children }: { children: ReactNode }) {
  return children;
}
