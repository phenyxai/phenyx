import type { Metadata } from "next"
import { Suspense } from "react"
import ResetClient from "./reset-client"

export const metadata: Metadata = {
  title: "Reset password",
}

export default function ResetPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center" />
      }
    >
      <ResetClient />
    </Suspense>
  )
}
