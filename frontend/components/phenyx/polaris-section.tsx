"use client";

import { PolarisQA } from "./polaris-qa";

export function PolarisSection() {
  return (
    <section
      id="s0-polaris"
      className="px-6 md:px-20"
      style={{ paddingTop: "100px", paddingBottom: "100px" }}
    >
      <div className="mx-auto" style={{ maxWidth: "1100px" }}>
        <p
          className="uppercase"
          style={{
            fontSize: "11px",
            letterSpacing: "0.2em",
            color: "rgba(255,253,253,0.5)",
            marginBottom: "26px",
          }}
        >
          polaris
        </p>

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
          follow one thread all the way through
        </h2>

        <p
          className="lowercase"
          style={{
            fontSize: "17px",
            lineHeight: 1.7,
            color: "rgba(255,253,253,0.62)",
            fontWeight: 300,
            maxWidth: "680px",
            marginBottom: "18px",
          }}
        >
          the constellation lets you see yourself. polaris lets you use what you see. ask about something you keep returning to, or where it might be leading. polaris answers from the context already here, so you never start by explaining yourself.
        </p>

        <p
          className="lowercase"
          style={{
            fontSize: "17px",
            lineHeight: 1.7,
            color: "rgba(255,253,253,0.62)",
            fontWeight: 300,
            maxWidth: "680px",
            marginBottom: "18px",
          }}
        >
          and when you arrive with no question, a few things come forward on their own.
        </p>

        <p
          className="lowercase"
          style={{
            fontSize: "17px",
            fontWeight: 400,
            lineHeight: 1.7,
            color: "#FFFDFD",
            maxWidth: "680px",
            marginBottom: "36px",
          }}
        >
          you bring the question. the context is already here.
        </p>

        <PolarisQA />
      </div>
    </section>
  );
}
