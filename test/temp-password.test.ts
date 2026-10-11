import { describe, expect, it } from "vitest";
import {
  TEMP_PASSWORD_LENGTH,
  generateTemporaryPassword,
} from "@/lib/temp-password";

describe("temp-password", () => {
  it("respecte la longueur demandée", () => {
    expect(generateTemporaryPassword()).toHaveLength(TEMP_PASSWORD_LENGTH);
    expect(generateTemporaryPassword(20)).toHaveLength(20);
  });

  it("n'utilise que des caractères non ambigus", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateTemporaryPassword()).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/);
    }
  });

  it("produit des valeurs différentes", () => {
    expect(generateTemporaryPassword()).not.toBe(generateTemporaryPassword());
  });
});
