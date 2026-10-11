import { describe, expect, it } from "vitest";
import {
  INVITATION_TTL_DAYS,
  MAX_INVITATION_TTL_DAYS,
  generateInvitationToken,
  invitationExpiry,
  isInvitationUsable,
} from "@/lib/invitation-rules";

const DAY = 24 * 60 * 60 * 1000;

describe("invitation-rules", () => {
  it("génère un jeton unique, sûr pour une URL", () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThan(20);
    expect(a).not.toBe(b);
  });

  it("applique la durée par défaut", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(invitationExpiry(undefined, now).getTime() - now.getTime()).toBe(
      INVITATION_TTL_DAYS * DAY,
    );
  });

  it("respecte une durée explicite", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(invitationExpiry(1, now).getTime() - now.getTime()).toBe(DAY);
  });

  it("borne la durée de validité à 365 jours", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(invitationExpiry(9999, now).getTime() - now.getTime()).toBe(
      MAX_INVITATION_TTL_DAYS * DAY,
    );
    expect(invitationExpiry(0, now).getTime() - now.getTime()).toBe(
      INVITATION_TTL_DAYS * DAY,
    );
  });

  it("n'accepte que les invitations en attente et non expirées", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const future = new Date("2026-01-02T00:00:00Z");
    const past = new Date("2025-12-31T00:00:00Z");

    expect(isInvitationUsable({ usedAt: null, expiresAt: future }, now)).toBe(
      true,
    );
    expect(isInvitationUsable({ usedAt: now, expiresAt: future }, now)).toBe(
      false,
    );
    expect(isInvitationUsable({ usedAt: null, expiresAt: past }, now)).toBe(
      false,
    );
  });
});
