import type { Metadata } from "next"
import { Suspense } from "react"
import SettingsClient from "./settings-client"

export const metadata: Metadata = {
  title: "Settings",
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black flex flex-col items-center justify-center" />
      }
    >
      <SettingsClient />
    </Suspense>
  )
}
