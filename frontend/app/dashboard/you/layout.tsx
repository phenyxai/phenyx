import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "You",
};

export default function YouLayout({ children }: { children: ReactNode }) {
  return children;
}
