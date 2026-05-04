import { Constellation } from "./constellation";

export function MissionSection() {
  return (
    <section id="mission" className="px-6 md:px-20" style={{ paddingTop: "100px", paddingBottom: "100px" }}>
      <div className="mx-auto grid lg:grid-cols-2 gap-16 lg:gap-24 items-start" style={{ maxWidth: "1100px" }}>
        {/* Left column - Text */}
        <div className="space-y-8">
          <div className="lowercase space-y-6">
            {/* Body text - 20px, weight 300, line height 1.7 */}
            <p
              style={{
                fontSize: "20px",
                fontWeight: 300,
                lineHeight: 1.7,
                color: "rgba(255,253,253,0.9)",
              }}
            >
              identity is not discovered. it is formed.
            </p>
            <p
              style={{
                fontSize: "20px",
                fontWeight: 300,
                lineHeight: 1.7,
                color: "rgba(255,253,253,0.9)",
              }}
            >
              what pulled you before you had words for it. who others saw before you did. what you built on purpose. where your worlds began to meet. what you are still becoming.
            </p>
            <p
              style={{
                fontSize: "20px",
                fontWeight: 300,
                lineHeight: 1.7,
                color: "rgba(255,253,253,0.9)",
              }}
            >
              you are not one thing. you are a pattern. most platforms only ever saw one piece of you.
            </p>
            <p
              style={{
                fontSize: "20px",
                fontWeight: 400,
                lineHeight: 1.7,
                color: "#FFFDFD",
              }}
            >
              <span className="uppercase">PHENYX COLLECTIVE</span> maps all of it.
            </p>
          </div>
        </div>
        
        {/* Right column - Constellation */}
        <div>
          <Constellation />
        </div>
      </div>
    </section>
  );
}
