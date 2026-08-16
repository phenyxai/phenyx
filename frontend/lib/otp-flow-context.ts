// PHE-77 / PHE-45 — which door sent the user into OTP.
//
// The prototype keeps this as `_otpFlowContext` (`signup` | `signin`). Sign-in
// OTP must return to the authenticated product, never the welcome/onboarding
// funnel. Stored in sessionStorage so a refresh on the code screen keeps the
// same return path.

const STORAGE_KEY = "phenyx_otp_flow_context";

export type OtpFlowContext = "signup" | "signin";

export function setOtpFlowContext(context: OtpFlowContext): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, context);
  } catch {
    // private mode / quota — the caller still knows which screen it is on.
  }
}

export function getOtpFlowContext(): OtpFlowContext {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (value === "signin" || value === "signup") return value;
  } catch {
    // fall through
  }
  return "signup";
}

export function clearOtpFlowContext(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
