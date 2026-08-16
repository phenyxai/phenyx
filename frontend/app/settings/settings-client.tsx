"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { OrboGuide } from "@/components/OrboGuide";
import { hasFullAccess } from "@/lib/billing";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { apiFetch } from "@/lib/api-client";

const PILLAR_ORDER = ["ORIGIN", "EMERGENCE", "SELF-CREATION", "CONVERGENCE", "BECOMING", "RECOGNITION", "TRANSCENDENCE"];
const PILLAR_HINTS: Record<string, string> = {
  ORIGIN: "morning ritual",
  EMERGENCE: "mid morning",
  "SELF-CREATION": "midday",
  CONVERGENCE: "afternoon",
  BECOMING: "end of day",
  RECOGNITION: "evening",
  TRANSCENDENCE: "before sleep",
};

const DEFAULT_TIMES: Record<string, string> = {
  ORIGIN: "07:00",
  EMERGENCE: "09:30",
  "SELF-CREATION": "12:00",
  CONVERGENCE: "14:30",
  BECOMING: "17:00",
  RECOGNITION: "19:00",
  TRANSCENDENCE: "21:00",
};

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [stellarColor, setStellarColor] = useState("#5599FF");
  const [profile, setProfile] = useState<any>(null);
  const [userEmail, setUserEmail] = useState("");
  
  // Edit states
  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [tempName, setTempName] = useState("");
  
  // Reflection times
  const [promptTimes, setPromptTimes] = useState<Record<string, string>>(DEFAULT_TIMES);
  const [timesMessage, setTimesMessage] = useState("");
  
  // Experience mode
  const [experienceMode, setExperienceMode] = useState("reflection");
  const [modeMessage, setModeMessage] = useState("");
  
  // Notifications
  const [notifyPrompt, setNotifyPrompt] = useState(false);
  const [weeklySummary, setWeeklySummary] = useState(true);
  const [notifMessage, setNotifMessage] = useState("");
  
  // Upgrade
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);
  
  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("phenyx_stellar_color");
    if (stored) setStellarColor(stored);
    
    if (searchParams.get("upgraded") === "true") {
      setShowUpgradeSuccess(true);
      window.history.replaceState({}, "", "/settings");
    }
    
    fetchData();
    setMounted(true);
  }, [searchParams]);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/signin");
      return;
    }
    
    setUserEmail(user.email || "");
    
    const { data: profileData } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    
    if (profileData) {
      setProfile(profileData);
      setDisplayName(profileData.display_name || "");
      let mode = profileData.experience_mode || "reflection";
      if (
        !hasFullAccess(profileData.tier) &&
        (mode === "signal" || mode === "observatory")
      ) {
        mode = "reflection";
      }
      setExperienceMode(mode);
      if (profileData.prompt_times) {
        setPromptTimes({ ...DEFAULT_TIMES, ...profileData.prompt_times });
      }
      if (profileData.notification_prefs) {
        setNotifyPrompt(profileData.notification_prefs.prompt_open ?? false);
        setWeeklySummary(profileData.notification_prefs.weekly_summary ?? true);
      }
    }
  };

  const handleSaveName = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    await supabase.from("user_profiles").update({ display_name: tempName }).eq("id", user.id);
    setDisplayName(tempName);
    setEditingName(false);
  };

  const handleSaveTimes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    await supabase.from("user_profiles").update({ prompt_times: promptTimes }).eq("id", user.id);
    setTimesMessage("your reflection times have been updated.");
    setTimeout(() => setTimesMessage(""), 3000);
  };

  const handleSaveMode = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (
      !hasFullAccess(profile?.tier) &&
      (experienceMode === "signal" || experienceMode === "observatory")
    ) {
      setModeMessage("upgrade to pro or gifted constellation on the upgrade page to use signal or observatory.");
      setTimeout(() => setModeMessage(""), 4000);
      return;
    }

    await supabase.from("user_profiles").update({ experience_mode: experienceMode }).eq("id", user.id);
    setModeMessage("your experience mode has been updated.");
    setTimeout(() => setModeMessage(""), 3000);
  };

  const handleSaveNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    await supabase.from("user_profiles").update({
      notification_prefs: { prompt_open: notifyPrompt, weekly_summary: weeklySummary }
    }).eq("id", user.id);
    setNotifMessage("your notification preferences have been updated.");
    setTimeout(() => setNotifMessage(""), 3000);
  };

  const handleUpgradeClick = () => {
    setUpgradeLoading(false);
    router.push("/upgrade");
  };

  const handleManageBilling = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setUpgradeLoading(true);
    try {
      const res = await apiFetch("/stripe/billing-portal", {
        method: "POST",
        body: JSON.stringify({ userId: user.id }),
      });
      const json = (await res.json()) as { url?: string };
      if (json.url) {
        window.location.href = json.url;
        return;
      }
    } finally {
      setUpgradeLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    await supabase.from("user_persona").delete().eq("user_id", user.id);
    await supabase.from("constellation_points").delete().eq("user_id", user.id);
    await supabase.from("user_profiles").delete().eq("id", user.id);
    await supabase.auth.signOut();
    router.push("/");
  };

  if (!mounted) return null;

  const sectionHeadingStyle = {
    fontSize: 10,
    color: stellarColor,
    textTransform: "uppercase" as const,
    letterSpacing: "0.12em",
    fontWeight: 500,
    marginBottom: 12,
  };

  const ghostButtonStyle = {
    background: "transparent",
    border: `0.5px solid ${stellarColor}`,
    color: stellarColor,
    borderRadius: 8,
    padding: "10px 24px",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.2s ease",
  };

  return (
    <main
      aria-label="your settings"
      style={{
        minHeight: "100vh",
        background: "#0A0A0A",
        color: "#FFFDFD",
      }}
    >
      {/* Topbar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 24px",
          borderBottom: "0.5px solid #1a1a1a",
        }}
      >
        <button
          onClick={() => router.push("/dashboard/daily")}
          aria-label="go back to daily"
          style={{
            background: "none",
            border: "none",
            color: "#666",
            fontSize: 18,
            cursor: "pointer",
            padding: 0,
          }}
        >
          ←
        </button>
        <Link href="/" aria-label="PHENYX">
          <Image src="/phenyx-logo.png" alt="" width={20} height={20} style={{ opacity: 0.9 }} />
        </Link>
      </header>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 32 }}>settings</h1>

        {/* Upgrade Success */}
        {showUpgradeSuccess && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              background: "#0E0E0E",
              border: `0.5px solid ${stellarColor}`,
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 24,
            }}
          >
            <p style={{ fontSize: 13, color: stellarColor, fontWeight: 300, margin: 0 }}>
              full access unlocked. your constellation can now grow without limit.
            </p>
          </div>
        )}

        {/* Section 1: Account */}
        <section aria-label="account">
          <h2 style={sectionHeadingStyle}>account</h2>
          <dl style={{ fontSize: 13 }}>
            <dt style={{ color: "#444", marginBottom: 4 }}>display name</dt>
            <dd style={{ color: "#FFFDFD", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, marginLeft: 0 }}>
              {editingName ? (
                <div style={{ display: "flex", gap: 8, flex: 1 }}>
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    style={{ flex: 1, background: "#111", border: "0.5px solid #222", borderRadius: 6, padding: "6px 10px", color: "#FFFDFD", fontSize: 13 }}
                  />
                  <button onClick={handleSaveName} style={{ ...ghostButtonStyle, padding: "6px 12px" }}>save</button>
                </div>
              ) : (
                <>
                  {displayName || "not set"}
                  <button
                    aria-label="edit display name"
                    onClick={() => { setTempName(displayName); setEditingName(true); }}
                    style={{ fontSize: 11, color: "#444", background: "transparent", border: "none", cursor: "pointer" }}
                  >
                    edit
                  </button>
                </>
              )}
            </dd>
            <dt style={{ color: "#444", marginBottom: 4 }}>email</dt>
            <dd style={{ color: "#555", marginLeft: 0 }}>{userEmail}</dd>
          </dl>
        </section>

        <hr style={{ border: "none", borderTop: "1px solid #111", margin: "32px 0" }} />

        {/* Section 2: Reflection Times */}
        <section aria-label="your reflection times" id="reflection-times-section">
          <h2 style={sectionHeadingStyle}>your reflection times</h2>
          <p style={{ fontSize: 12, color: "#555", lineHeight: 1.6, marginBottom: 20 }}>
            these are the moments you anchored your practice to. adjust them as your life evolves.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {PILLAR_ORDER.map((pillar) => (
              <div key={pillar} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 11, color: "#666", display: "block" }}>{pillar.toLowerCase()}</span>
                  <span style={{ fontSize: 9, color: "#333" }}>{PILLAR_HINTS[pillar]}</span>
                </div>
                <input
                  type="time"
                  value={promptTimes[pillar] || DEFAULT_TIMES[pillar]}
                  onChange={(e) => setPromptTimes({ ...promptTimes, [pillar]: e.target.value })}
                  style={{ background: "#111", border: "0.5px solid #222", borderRadius: 6, padding: "6px 10px", color: "#FFFDFD", fontSize: 12 }}
                />
              </div>
            ))}
          </div>
          <button
            aria-label="save updated reflection times"
            onClick={handleSaveTimes}
            style={{ ...ghostButtonStyle, marginTop: 20 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#FFFDFD"; e.currentTarget.style.color = "#0A0A0A"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = stellarColor; }}
          >
            update my times
          </button>
          {timesMessage && <p role="status" aria-live="polite" style={{ fontSize: 11, color: stellarColor, marginTop: 8 }}>{timesMessage}</p>}
        </section>

        <hr style={{ border: "none", borderTop: "1px solid #111", margin: "32px 0" }} />

        {/* Section 3: Experience Mode */}
        <section aria-label="your experience mode" id="experience-mode-section">
          <h2 style={sectionHeadingStyle}>your experience</h2>
          <p style={{ fontSize: 12, color: "#555", lineHeight: 1.6, marginBottom: 20 }}>
            reflection is for everyone. signal and observatory are included with{" "}
            <Link href="/upgrade" style={{ color: stellarColor }}>pro or gifted constellation</Link>
            {" — they change how AI phrasing feels, not billing."}
          </p>
          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <legend className="sr-only">choose your experience mode</legend>
            {[
              { value: "reflection", name: "reflection", desc: "slow. deep. cinematic. one prompt per session. the full experience as designed.", paidOnly: false },
              { value: "signal", name: "signal", desc: "fast. focused. the core question only. for when you want to check in without going deep.", paidOnly: true },
              { value: "observatory", name: "observatory", desc: "analytical. shows the data behind each point. source signals and scores. for when you want to understand the pattern precisely.", paidOnly: true },
            ].map((mode) => {
              const locked = mode.paidOnly && !hasFullAccess(profile?.tier);
              return (
              <label
                key={mode.value}
                style={{
                  display: "block",
                  background: "#0E0E0E",
                  border: experienceMode === mode.value ? `0.5px solid ${stellarColor}` : "0.5px solid #1C1C1C",
                  borderRadius: 8,
                  padding: "14px 16px",
                  marginBottom: 8,
                  cursor: locked ? "not-allowed" : "pointer",
                  opacity: locked ? 0.45 : 1,
                }}
              >
                <input
                  type="radio"
                  name="experience-mode"
                  value={mode.value}
                  checked={experienceMode === mode.value}
                  onChange={() => {
                    if (!locked) setExperienceMode(mode.value);
                  }}
                  disabled={locked}
                  className="sr-only"
                />
                <span style={{ fontSize: 13, color: "#FFFDFD", fontWeight: 400, display: "block", marginBottom: 4 }}>{mode.name}</span>
                <span style={{ fontSize: 11, color: "#555", fontWeight: 300, lineHeight: 1.6 }}>{mode.desc}</span>
                {locked && (
                  <span style={{ fontSize: 10, color: "#444", display: "block", marginTop: 6 }}>upgrade to unlock</span>
                )}
              </label>
            );})}
          </fieldset>
          <button
            aria-label="save experience mode"
            onClick={handleSaveMode}
            style={{ ...ghostButtonStyle, marginTop: 12 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#FFFDFD"; e.currentTarget.style.color = "#0A0A0A"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = stellarColor; }}
          >
            update my experience
          </button>
          {modeMessage && <p role="status" aria-live="polite" style={{ fontSize: 11, color: stellarColor, marginTop: 8 }}>{modeMessage}</p>}
        </section>

        <hr style={{ border: "none", borderTop: "1px solid #111", margin: "32px 0" }} />

        {/* Section 4: Connected Platforms */}
        <section aria-label="connected platforms">
          <h2 style={sectionHeadingStyle}>connected platforms</h2>
          <p style={{ fontSize: 12, color: "#555", lineHeight: 1.6, marginBottom: 16 }}>
            these platforms are adding depth to your constellation. remove any at any time.
          </p>
          <p style={{ fontSize: 12, color: "#333", marginBottom: 12 }}>
            no platforms connected. connecting deepens your constellation.
          </p>
          <button
            aria-label="connect platforms"
            onClick={() => router.push("/onboarding")}
            style={ghostButtonStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#FFFDFD"; e.currentTarget.style.color = "#0A0A0A"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = stellarColor; }}
          >
            connect platforms
          </button>
        </section>

        <hr style={{ border: "none", borderTop: "1px solid #111", margin: "32px 0" }} />

        {/* Section 5: Notifications */}
        <section aria-label="notification preferences">
          <h2 style={sectionHeadingStyle}>notifications</h2>
          <p style={{ fontSize: 12, color: "#555", lineHeight: 1.6, marginBottom: 16 }}>
            phenyx waits for you. notifications are optional.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <span style={{ fontSize: 12, color: "#888" }}>notify me when my prompt opens</span>
              <button
                role="switch"
                aria-checked={notifyPrompt}
                onClick={() => setNotifyPrompt(!notifyPrompt)}
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  background: notifyPrompt ? stellarColor : "#222",
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.2s ease",
                }}
              >
                <span style={{
                  position: "absolute",
                  top: 2,
                  left: notifyPrompt ? 18 : 2,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "#FFFDFD",
                  transition: "left 0.2s ease",
                }} />
              </button>
            </label>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <span style={{ fontSize: 12, color: "#888" }}>weekly reflection summary by email</span>
              <button
                role="switch"
                aria-checked={weeklySummary}
                onClick={() => setWeeklySummary(!weeklySummary)}
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  background: weeklySummary ? stellarColor : "#222",
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.2s ease",
                }}
              >
                <span style={{
                  position: "absolute",
                  top: 2,
                  left: weeklySummary ? 18 : 2,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "#FFFDFD",
                  transition: "left 0.2s ease",
                }} />
              </button>
            </label>
          </div>
          <button
            onClick={handleSaveNotifications}
            style={{ ...ghostButtonStyle, marginTop: 16 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#FFFDFD"; e.currentTarget.style.color = "#0A0A0A"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = stellarColor; }}
          >
            update notifications
          </button>
          {notifMessage && <p role="status" aria-live="polite" style={{ fontSize: 11, color: stellarColor, marginTop: 8 }}>{notifMessage}</p>}
        </section>

        <hr style={{ border: "none", borderTop: "1px solid #111", margin: "32px 0" }} />

        {/* Section 6: Upgrade */}
        <section aria-label="upgrade your experience" id="upgrade-section">
          <h2 style={sectionHeadingStyle}>upgrade your experience</h2>
          {hasFullAccess(profile?.tier) ? (
            <>
              <p style={{ fontSize: 13, color: stellarColor, marginBottom: 8 }}>
                {profile?.tier === "gifted"
                  ? "gifted constellation · full access"
                  : "pro · full access"}
              </p>
              {profile?.tier === "pro" && profile?.stripe_subscription_id ? (
                <button
                  type="button"
                  aria-label="manage or cancel your subscription"
                  onClick={handleManageBilling}
                  disabled={upgradeLoading}
                  style={ghostButtonStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#FFFDFD"; e.currentTarget.style.color = "#0A0A0A"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = stellarColor; }}
                >
                  {upgradeLoading ? "loading..." : "manage subscription"}
                </button>
              ) : profile?.tier === "pro" ? (
                <p style={{ fontSize: 12, color: "#555", lineHeight: 1.6 }}>
                  yearly pro is a single payment — there is no monthly subscription to manage here.
                </p>
              ) : (
                <p style={{ fontSize: 12, color: "#555", lineHeight: 1.6 }}>
                  gifted constellation does not renew. thank you for supporting phenyx.
                </p>
              )}
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "#777", fontWeight: 300, lineHeight: 1.7, marginBottom: 20 }}>
                full access unlocks deeper reflection, constellation detail, signal & observatory experience modes on this screen, and more.
              </p>
              <ul style={{ listStyle: "none", marginBottom: 24, padding: 0 }}>
                {["two reflections per session", "source signals behind every constellation point", "faster constellation development", "signal & observatory modes here"].map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: stellarColor, flexShrink: 0 }} aria-hidden="true" />
                    <span style={{ fontSize: 12, color: "#aaa", fontWeight: 300 }}>{f}</span>
                  </li>
                ))}
              </ul>
              <p style={{ fontSize: 11, color: "#333", marginBottom: 20 }}>pick pro (month or year) or a one-time gifted constellation on the upgrade page.</p>
              <button
                type="button"
                aria-label="go to upgrade page"
                onClick={handleUpgradeClick}
                style={{ ...ghostButtonStyle, width: "100%" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#FFFDFD"; e.currentTarget.style.color = "#0A0A0A"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = stellarColor; }}
              >
                view plans &amp; pricing
              </button>
            </>
          )}
        </section>

        <hr style={{ border: "none", borderTop: "1px solid #111", margin: "32px 0" }} />

        {/* Section 7: Identity Exploration */}
        <section aria-label="identity exploration">
          <h2 style={sectionHeadingStyle}>identity exploration</h2>
          <p style={{ fontSize: 12, color: "#2a2a2a", lineHeight: 1.6, marginBottom: 12 }}>
            observe your constellation and grow it intentionally. set aspiration points. shape which pillars deepen. coming soon.
          </p>
          <div style={{ fontSize: 10, color: "#1e1e1e", border: "0.5px solid #1a1a1a", borderRadius: 8, padding: "10px 14px" }}>
            you will be among the first to access this. your constellation is already ready for it.
          </div>
        </section>

        <hr style={{ border: "none", borderTop: "1px solid #111", margin: "32px 0" }} />

        {/* Section 8: Restart Guide */}
        <section aria-label="restart the orbo guide">
          <h2 style={sectionHeadingStyle}>restart my guide</h2>
          <p style={{ fontSize: 12, color: "#555", lineHeight: 1.6, marginBottom: 16 }}>
            orbo will walk you through the platform again from the beginning.
          </p>
          <button
            aria-label="restart the orbo guide"
            onClick={() => {
              localStorage.removeItem("orbo_tour_constellation");
              localStorage.removeItem("orbo_tour_daily");
              localStorage.removeItem("orbo_tour_settings");
              router.push("/dashboard/constellation");
            }}
            style={ghostButtonStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#FFFDFD"; e.currentTarget.style.color = "#0A0A0A"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = stellarColor; }}
          >
            restart my guide
          </button>
        </section>

        <hr style={{ border: "none", borderTop: "1px solid #111", margin: "32px 0" }} />

        {/* Section 9: Your Data */}
        <section aria-label="your data">
          <h2 style={sectionHeadingStyle}>your data</h2>
          <p style={{ fontSize: 12, color: "#555", lineHeight: 1.6, marginBottom: 16 }}>
            your reflections and insights are encrypted and belong entirely to you.
          </p>
          <button
            aria-label="request a download of all your PHENYX records"
            onClick={() => {
              window.location.href = `mailto:contact@phenyxai.com?subject=data request&body=please send me all data associated with my account: ${userEmail}`;
            }}
            style={ghostButtonStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#FFFDFD"; e.currentTarget.style.color = "#0A0A0A"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = stellarColor; }}
          >
            request my data
          </button>
        </section>

        <hr style={{ border: "none", borderTop: "1px solid #111", margin: "32px 0" }} />

        {/* Section 10: Delete */}
        <section aria-label="delete your account">
          <h2 style={{ ...sectionHeadingStyle, color: "#6a2020" }}>delete my constellation</h2>
          <p style={{ fontSize: 12, color: "#444", lineHeight: 1.6, marginBottom: 16 }}>
            this permanently removes your constellation, all reflections, all synthesized insights, and your account. this cannot be undone.
          </p>
          <button
            aria-label="permanently delete my account and constellation. this cannot be undone."
            onClick={() => setShowDeleteDialog(true)}
            style={{
              background: "transparent",
              border: "0.5px solid #3a1010",
              color: "#6a2020",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            delete my constellation
          </button>
        </section>
      </div>

      {/* Delete Dialog */}
      {showDeleteDialog && (
        <dialog
          open
          aria-modal="true"
          role="alertdialog"
          aria-labelledby="delete-title"
          aria-describedby="delete-desc"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "#0E0E0E",
            border: "0.5px solid #3a1010",
            borderRadius: 10,
            padding: 24,
            maxWidth: 360,
            color: "#FFFDFD",
            zIndex: 1000,
          }}
        >
          <h2 id="delete-title" style={{ fontSize: 16, fontWeight: 500, marginBottom: 12 }}>are you sure?</h2>
          <p id="delete-desc" style={{ fontSize: 13, color: "#666", lineHeight: 1.6, marginBottom: 24 }}>
            this removes everything. permanently. within 24 hours. this cannot be undone.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handleDeleteAccount}
              style={{ flex: 1, background: "#3a1010", border: "none", color: "#FFFDFD", borderRadius: 8, padding: 11, fontSize: 12, cursor: "pointer" }}
            >
              yes, delete everything
            </button>
            <button
              onClick={() => setShowDeleteDialog(false)}
              autoFocus
              style={{ flex: 1, background: "transparent", border: "0.5px solid #333", color: "#888", borderRadius: 8, padding: 11, fontSize: 12, cursor: "pointer" }}
            >
              keep my constellation
            </button>
          </div>
        </dialog>
      )}

      {/* Orbo Guide */}
      <OrboGuide page="settings" stellarColor={stellarColor} motivation={profile?.motivation} />
    </main>
  );
}
