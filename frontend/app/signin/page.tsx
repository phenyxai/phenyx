import { Suspense } from "react"
import SignInClient from "./signin-client"

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center" />
      }
    >
      <SignInClient />
    </Suspense>
  )
}
