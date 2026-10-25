import { NextResponse } from "next/server";
import { getOpenApiSpec } from "@/lib/api/openapi";

export const dynamic = "force-dynamic";

/** Spécification OpenAPI de l'instance, consommée par la page `/api-docs`. */
export async function GET() {
  return NextResponse.json(getOpenApiSpec(), {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
