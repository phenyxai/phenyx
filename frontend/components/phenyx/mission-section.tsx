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
          see how the parts of your life relate
        </h2>

        {/* Grid: body + constellation */}
        <div
          className="grid lg:grid-cols-[1fr_1.2fr] gap-10 lg:gap-10 items-start"
          style={{ marginTop: "8px" }}
        >
          <div className="lowercase">
            <p
              style={{
                fontSize: "17px",
                lineHeight: 1.7,
                color: "rgba(255,253,253,0.62)",
                fontWeight: 300,
                maxWidth: "480px",
                marginBottom: "22px",
              }}
            >
              a constellation is not the stars. it is the shape they make once you see them together.
            </p>
            <p
              style={{
                fontSize: "17px",
                lineHeight: 1.7,
                color: "rgba(255,253,253,0.62)",
                fontWeight: 300,
                maxWidth: "480px",
                marginBottom: "22px",
              }}
            >
              seven points run from where you began to where you are heading, each looking at one question through the evidence of your life.
            </p>
            <p
              style={{
                fontSize: "17px",
                lineHeight: 1.7,
                color: "rgba(255,253,253,0.62)",
                fontWeight: 300,
                maxWidth: "480px",
                marginBottom: "22px",
              }}
            >
              it is not a profile you finish. new things appear, old ones return, some fall away, and the shape keeps enough of you to notice when you change.
            </p>
            <p
              style={{
                fontSize: "17px",
                lineHeight: 1.7,
                color: "#FFFDFD",
                fontWeight: 500,
                maxWidth: "480px",
              }}
            >
              the points stay the same. what fills them is yours.
            </p>
          </div>

          <div className="relative">
            <MissionConstellation />
          </div>
        </div>

        {/* Example note */}
        <p
          className="lowercase"
          style={{
            fontSize: "13px",
            color: "rgba(255,253,253,0.5)",
            lineHeight: 1.6,
            marginTop: "32px",
            fontWeight: 300,
          }}
        >
          example: the same seven, seen by time. note: an example. yours is built only from the accounts you connect.
        </p>
      </div>
    </section>
  );
}
