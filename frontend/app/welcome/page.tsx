"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchProfile } from "@/lib/api-client";
import { colorName } from "@/lib/stellar";
import { useSessionColor } from "@/contexts/session-color-context";
import { AuthBrand } from "@/components/phenyx/auth-chrome";

// Reveal stages: 0 = nothing, 1 = orb, 2 = name, 3 = color line (the accent is
// revealed here), 4 = enter. Timings follow the prototype's welcome sequence.
const STAGE_DELAYS = [100, 820, 1680, 2600];

/**
 * s3 — welcome: the person's name, then their assigned accent. The color is the
 * account's persisted, immutable identity (server-assigned in PHE-13); this
 * screen only reads and reveals it. Until the color line the orb and the stellar
 * icon beside the PHENYX wordmark are brand blue; at the color line both turn to
 * the accent, and the icon stays that color from here on (the rest of the app
 * paints it from the same `--s` the SessionColorProvider publishes).
 *
 * The sequence waits for the profile so the name and color never swap mid-reveal.
 * Under reduced motion everything appears at once with the accent already shown.
 */
export default function WelcomePage() {
  const router = useRouter();
  const { sessionColor, applySessionColor } = useSessionColor();
  const [firstName, setFirstName] = useState("traveler");
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    let active = true;
    fetchProfile()
      .then((profile) => {
        if (!active) return;
        // Publish through the session color mechanism: this page is reached by
        // client-side navigation, so the provider has not seen the new account.
        if (profile?.stellar_color) applySessionColor(profile.stellar_color);
        const first = profile?.display_name?.trim().split(/\s+/)[0];
        if (first) setFirstName(first.toLowerCase());
      })
      .catch(() => {
        // Best-effort: keep the stored/default color and generic name.
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [applySessionColor]);

  useEffect(() => {
    if (!ready) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStage(4);
      return;
    }
    const timers = STAGE_DELAYS.map((delay, i) => setTimeout(() => setStage(i + 1), delay));
    return () => timers.forEach(clearTimeout);
  }, [ready]);

  const handleEnter = () => {
    // s3 welcome → onboarding. The onboarding page self-routes via the persisted
    // onboarding_step (defaulting to the s3b fork when unset), so we just hand
    // off to /onboarding here — no step is set on this side. (PHE-14)
    router.push("/onboarding");
  };

  const revealed = stage >= 3;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#080808] px-5 py-24">
      <header className="auth-topbar">
        <AuthBrand revealed={revealed} />
      </header>

      <section className="auth-flow" aria-labelledby="welcome-title">
        <div
          aria-hidden="true"
          className="welcome-orb"
          data-in={stage >= 1 ? "true" : "false"}
          data-revealed={revealed ? "true" : undefined}
          style={{ marginBottom: "30px" }}
        />
        <h1
          id="welcome-title"
          className="auth-h welcome-step"
          data-in={stage >= 2 ? "true" : "false"}
        >
          welcome, {firstName}.
        </h1>
        <p className="auth-lede welcome-step" data-in={revealed ? "true" : "false"}>
          your stellar color is <b className="welcome-color">{colorName(sessionColor)}</b>.
        </p>
        <button
          type="button"
          className="welcome-enter welcome-step"
          data-in={stage >= 4 ? "true" : "false"}
          onClick={handleEnter}
        >
          enter
        </button>
      </section>
    </main>
  );
}
