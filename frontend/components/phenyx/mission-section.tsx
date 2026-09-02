import { MissionConstellation } from "./mission-constellation";

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
          see how the parts of your life relate.
        </h2>

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
              seven dimensions. one living map. it updates as you do.
            </p>
          </div>

          <div className="relative">
            <MissionConstellation />
          </div>
        </div>

        <div style={{ marginTop: "64px" }}>
          <p
            className="uppercase"
            style={{
              fontSize: "11px",
              letterSpacing: "0.2em",
              color: "rgba(255,253,253,0.5)",
              marginBottom: "18px",
            }}
          >
            example
          </p>
          <h3
            className="lowercase"
            style={{
              fontSize: "22px",
              fontWeight: 500,
              color: "#FFFDFD",
              marginBottom: "14px",
            }}
          >
            the same seven, seen by time.
          </h3>
          <p
            className="lowercase"
            style={{
              fontSize: "15px",
              lineHeight: 1.7,
              color: "rgba(255,253,253,0.62)",
              fontWeight: 300,
              maxWidth: "640px",
            }}
          >
            your constellation isn't static. it evolves as you connect more platforms and live more life. each point shifts to reflect new patterns, new pivots, new versions of you.
          </p>
        </div>
      </div>
    </section>
  );
}
