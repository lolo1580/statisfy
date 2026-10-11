import { describe, expect, it } from "vitest";
import { csvCell } from "@/lib/csv";

describe("csvCell", () => {
  it("neutralise les formules tableur", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+SUM(A1)")).toBe("'+SUM(A1)");
    expect(csvCell("-cmd")).toBe("'-cmd");
    expect(csvCell("@x")).toBe("'@x");
  });

  it("échappe guillemets, virgules et retours ligne", () => {
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });

  it("laisse les valeurs simples intactes", () => {
    expect(csvCell("Ice Nine Kills")).toBe("Ice Nine Kills");
    expect(csvCell(123)).toBe("123");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});
