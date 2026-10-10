import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Discover",
};

export default function DiscoverLayout({ children }: { children: ReactNode }) {
  return children;
}
