import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { appName } from "@/lib/env";

/** Icône PWA générée à la volée (192/512 px selon `?size=`). */
export async function GET(request: NextRequest) {
  const requested = Number(request.nextUrl.searchParams.get("size") ?? "512");
  const size = Number.isFinite(requested)
    ? Math.min(512, Math.max(64, Math.round(requested)))
    : 512;
  const letter = appName.slice(0, 1).toUpperCase() || "S";

  return new ImageResponse(
    (
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
              fontSize: Math.round(size * 0.38),
              fontWeight: 800,
              color: "#0d1117",
            }}
          >
            {letter}
          </span>
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=86400" },
    },
  );
}
