import { Suspense } from "react"
import SettingsClient from "./settings-client"

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center" />
      }
    >
      <SettingsClient />
    </Suspense>
  )
}
