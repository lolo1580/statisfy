import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { safeUnzip } from "@/lib/archive";

describe("safeUnzip", () => {
  it("décompresse une archive normale", () => {
    const zip = zipSync({
      "a.json": strToU8("[1]"),
      "b.json": strToU8("[2]"),
    });
    const files = safeUnzip(zip);
    expect(Object.keys(files).sort()).toEqual(["a.json", "b.json"]);
  });

  it("filtre les entrées au-delà du plafond par fichier", () => {
    const zip = zipSync({
      "big.bin": new Uint8Array(1024),
      "small.json": strToU8("ok"),
    });
    const files = safeUnzip(zip, { maxEntryBytes: 10 });
    expect(Object.keys(files)).toEqual(["small.json"]);
  });

  it("borne la taille décompressée cumulée", () => {
    const zip = zipSync({
      "a.bin": new Uint8Array(100),
      "b.bin": new Uint8Array(100),
      "c.bin": new Uint8Array(100),
    });
    const files = safeUnzip(zip, { maxTotalBytes: 150 });
    // Les entrées dépassant le cumul sont ignorées.
    expect(Object.keys(files).length).toBeLessThan(3);
    const total = Object.values(files).reduce((sum, f) => sum + f.length, 0);
    expect(total).toBeLessThanOrEqual(150);
  });
});
