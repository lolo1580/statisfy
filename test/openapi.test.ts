import { describe, expect, it } from "vitest";
import { getOpenApiSpec } from "@/lib/api/openapi";

/**
 * Garde-fous sur la spécification OpenAPI : elle est écrite à la main, donc on
 * vérifie au minimum que les routes publiques sont documentées et que toutes
 * les références `$ref` pointent vers un composant existant (une référence
 * cassée casse Swagger UI sans faire échouer le build).
 */

type Json = Record<string, unknown>;

const spec = getOpenApiSpec() as Json;

function collectRefs(node: unknown, refs: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, refs);
  } else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "$ref" && typeof value === "string") refs.push(value);
      else collectRefs(value, refs);
    }
  }
  return refs;
}

function resolveRef(root: Json, ref: string): unknown {
  if (!ref.startsWith("#/")) return undefined;
  let current: unknown = root;
  for (const part of ref.slice(2).split("/")) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Json)[part];
  }
  return current;
}

describe("spécification OpenAPI", () => {
  it("déclare les routes publiques et d'administration", () => {
    const paths = spec.paths as Record<string, unknown>;
    expect(Object.keys(paths)).toEqual(
      expect.arrayContaining([
        "/api/public/stats",
        "/api/public/stats/card.svg",
        "/api/sync",
        "/api/import/your-spotify",
        "/api/export",
      ]),
    );
  });

  it("résout toutes les références $ref", () => {
    for (const ref of collectRefs(spec)) {
      expect(resolveRef(spec, ref), ref).toBeDefined();
    }
  });

  it("documente les réponses d'erreur des routes publiques", () => {
    const publicStats = ((spec.paths as Json)["/api/public/stats"] as Json)
      .get as Json;
    expect(Object.keys(publicStats.responses as Json)).toEqual(
      expect.arrayContaining(["200", "401", "429"]),
    );
  });
});
