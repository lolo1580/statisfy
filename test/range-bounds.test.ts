import { describe, expect, it } from "vitest";
import { dayKey, startOfLocalDay } from "@/lib/format";
import { rangeDayBounds } from "@/lib/stats/shared";

const timeZone = "Europe/Paris";

describe("rangeDayBounds", () => {
  it("accepte tout l'historique", () => {
    expect(rangeDayBounds({ days: null }, timeZone)).toEqual({});
  });

  it("convertit une période alignée sur des minuits locaux", () => {
    const from = startOfLocalDay(timeZone, new Date("2026-10-28T12:00:00Z"));
    const to = startOfLocalDay(timeZone, new Date("2026-10-30T12:00:00Z"));

    expect(rangeDayBounds({ days: null, from }, timeZone)).toMatchObject({
      fromDay: dayKey(from, timeZone),
    });
    expect(rangeDayBounds({ days: null, from, to }, timeZone)).toEqual({
      fromDay: dayKey(from, timeZone),
      // `to` est exclusif : le dernier jour inclus est la veille locale.
      toDay: dayKey(new Date(to.getTime() - 1), timeZone),
    });
  });

  it("refuse les fenêtres glissantes", () => {
    expect(rangeDayBounds({ days: 30 }, timeZone)).toBeNull();
  });

  it("refuse les bornes qui ne sont pas des minuits locaux", () => {
    expect(
      rangeDayBounds(
        {
          days: null,
          from: new Date("2026-01-01T00:00:00Z"),
          to: new Date("2027-01-01T00:00:00Z"),
        },
        timeZone,
      ),
    ).toBeNull();
  });

  it("refuse les périodes filtrées par entité", () => {
    expect(rangeDayBounds({ days: null, artistId: "a1" }, timeZone)).toBeNull();
    expect(rangeDayBounds({ days: null, trackId: "t1" }, timeZone)).toBeNull();
    expect(rangeDayBounds({ days: null, albumId: "al1" }, timeZone)).toBeNull();
  });
});
