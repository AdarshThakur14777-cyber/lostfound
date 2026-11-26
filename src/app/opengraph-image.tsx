import { ImageResponse } from "next/og";

export const alt = "Campus Lost & Found — report it, verify it, get it back";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 68px",
          background: "linear-gradient(135deg, #0b1220 0%, #102a56 55%, #0b6b5d 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              position: "relative",
              width: 58,
              height: 58,
              borderRadius: 16,
              background: "linear-gradient(135deg, #3b82f6, #0f9d8a)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 21,
                height: 21,
                marginTop: -4,
                marginLeft: -4,
                border: "4.5px solid #ffffff",
                borderRadius: 999,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 38,
                top: 38,
                width: 5,
                height: 14,
                borderRadius: 999,
                background: "#ffffff",
                transform: "rotate(-45deg)",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.4 }}>Campus Lost &amp; Found</span>
            <span style={{ fontSize: 17, color: "#a9c3e6" }}>Privacy-first returns, start to finish</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={{ fontSize: 74, fontWeight: 800, letterSpacing: -2.6, lineHeight: 1.05 }}>
            Lost it? Found it?
          </span>
          <span style={{ fontSize: 74, fontWeight: 800, letterSpacing: -2.6, lineHeight: 1.05, color: "#7dd3c7" }}>
            Get it back.
          </span>
          <span style={{ fontSize: 25, color: "#c7d7ea", maxWidth: 820, lineHeight: 1.4 }}>
            Report in under a minute. Secret details stay encrypted. Every handover is supervised and recorded.
          </span>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {["Private verification", "Supervised handover", "Audited custody chain"].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 18px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.22)",
                background: "rgba(255,255,255,0.08)",
                fontSize: 19,
                color: "#e9f1fb",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
