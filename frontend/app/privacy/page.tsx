import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyRedirectPage() {
  permanentRedirect("/privacy-policy");
}
