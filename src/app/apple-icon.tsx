import { ImageResponse } from "next/og";
import { appName } from "@/lib/env";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const letter = appName.slice(0, 1).toUpperCase() || "S";
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0d1117",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "72%",
          height: "72%",
          borderRadius: "50%",
          background: "#1db954",
        }}
      >
        <span
          style={{
            display: "flex",
            fontSize: 70,
            fontWeight: 800,
            color: "#0d1117",
          }}
        >
          {letter}
        </span>
      </div>
    </div>,
    size,
  );
}
