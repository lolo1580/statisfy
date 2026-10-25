import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Sert les fichiers statiques de Swagger UI depuis `node_modules`.
 *
 * Éviter un CDN permet aux instances auto-hébergées (souvent sans accès
 * Internet sortant) d'afficher la documentation. Les fichiers sont embarqués
 * dans la sortie `standalone` via `outputFileTracingIncludes` (next.config.ts).
 */
const DIST_DIR = path.join(process.cwd(), "node_modules", "swagger-ui-dist");

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
};

/** Uniquement un fichier plat, avec des extensions connues (anti-traversée). */
const FILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  if (!FILE_PATTERN.test(file)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const type = CONTENT_TYPES[path.extname(file).toLowerCase()];
  if (!type) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const data = await fs.readFile(path.join(DIST_DIR, file));
    return new Response(data, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
