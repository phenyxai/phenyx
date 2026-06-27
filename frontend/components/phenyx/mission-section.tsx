import { MissionConstellation } from "./mission-constellation";
import { PolarisQA } from "./polaris-qa";

export function MissionSection() {
  return (
    <section
      id="s0-mission"
      className="px-6 md:px-20"
      style={{ paddingTop: "100px", paddingBottom: "100px" }}
    >
      <div className="mx-auto" style={{ maxWidth: "1100px" }}>
        {/* Eyebrow */}
        <p
          className="uppercase"
          style={{
            fontSize: "11px",
            letterSpacing: "0.2em",
            color: "rgba(255,253,253,0.5)",
            marginBottom: "26px",
          }}
        >
          your constellation
        </p>

        {/* Headline */}
        <h2
          className="lowercase"
          style={{
            fontSize: "clamp(32px, 4.6vw, 52px)",
            fontWeight: 400,
            lineHeight: 1.2,
            marginBottom: "24px",
            maxWidth: "740px",
            color: "#FFFDFD",
          }}
        >
          this is your digital blueprint.
        </h2>

        {/* Grid: body + constellation */}
        <div
          className="grid lg:grid-cols-[1fr_1.2fr] gap-10 lg:gap-10 items-start"
          style={{ marginTop: "8px" }}
        >
          <div className="lowercase">
            <p
              style={{
                fontSize: "19px",
                lineHeight: 1.7,
                color: "rgba(255,253,253,0.62)",
                fontWeight: 300,
                maxWidth: "480px",
              }}
            >
              this isn&apos;t a snapshot. it updates as you do. seven points, from who you&apos;ve always been to where you&apos;re still becoming.
            </p>
          </div>

          <div className="relative">
            <MissionConstellation />
          </div>
        </div>

        {/* Dig deeper with polaris */}
        <p
          className="lowercase"
          style={{
            fontSize: "22px",
            color: "#FFFDFD",
            fontWeight: 600,
            marginTop: "56px",
          }}
        >
          dig deeper with polaris
        </p>
        <p
          className="lowercase"
          style={{
            fontSize: "15px",
            color: "rgba(255,253,253,0.62)",
            lineHeight: 1.6,
            maxWidth: "560px",
            marginTop: "10px",
            fontWeight: 300,
          }}
        >
          ask about any point in your constellation. polaris doesn&apos;t guess. it works from what your data already shows.
        </p>

        <PolarisQA />
      </div>
    </section>
  );
}
