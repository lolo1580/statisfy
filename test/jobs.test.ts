import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { job: { updateMany: vi.fn() } },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { recoverStaleJobs } from "@/lib/jobs";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.job.updateMany.mockResolvedValue({ count: 2 });
});

describe("recoverStaleJobs", () => {
  it("marque en erreur les jobs running trop anciens", async () => {
    const now = new Date("2026-10-28T12:00:00Z");
    const count = await recoverStaleJobs({ now, olderThanMs: 60_000 });

    expect(count).toBe(2);
    expect(prismaMock.job.updateMany).toHaveBeenCalledWith({
      where: {
        status: "running",
        startedAt: { lt: new Date("2026-10-28T11:59:00Z") },
      },
      data: {
        status: "error",
        error: "Job interrompu (redémarrage ou perte de l'instance).",
        finishedAt: now,
      },
    });
  });

  it("filtre par utilisateur quand demandé", async () => {
    await recoverStaleJobs({ userId: "u1" });

    expect(prismaMock.job.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "u1", status: "running" }),
      }),
    );
  });
});
