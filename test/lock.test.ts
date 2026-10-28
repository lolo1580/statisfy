import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
    syncLock: {
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  acquireLock,
  LockBusyError,
  releaseLock,
  startLockHeartbeat,
  withLock,
} from "@/lib/lock";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  prismaMock.$queryRaw.mockImplementation(
    async (query: { values: unknown[] }) => [{ owner: query.values[1] }],
  );
  prismaMock.syncLock.deleteMany.mockResolvedValue({ count: 1 });
  prismaMock.syncLock.updateMany.mockResolvedValue({ count: 1 });
});

describe("acquireLock", () => {
  it("acquiert le verrou et le libère avec le bon propriétaire", async () => {
    const handle = await acquireLock("sync:c1");
    expect(handle).not.toBeNull();

    await handle?.release();

    expect(prismaMock.syncLock.deleteMany).toHaveBeenCalledWith({
      where: { key: "sync:c1", owner: handle?.owner },
    });
  });

  it("renvoie null quand le verrou est détenu", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);
    await expect(acquireLock("sync:c1")).resolves.toBeNull();
  });

  it("ne libère pas un verrou appartenant à un autre", async () => {
    await releaseLock("sync:c1", "owner-1");
    expect(prismaMock.syncLock.deleteMany).toHaveBeenCalledWith({
      where: { key: "sync:c1", owner: "owner-1" },
    });
  });
});

describe("withLock", () => {
  it("exécute la fonction puis libère le verrou", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withLock("sync:c1", fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(prismaMock.syncLock.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("échoue avec LockBusyError si le verrou est pris", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);
    await expect(withLock("sync:c1", async () => "ok")).rejects.toBeInstanceOf(
      LockBusyError,
    );
  });
});

describe("startLockHeartbeat", () => {
  it("prolonge le verrou périodiquement", async () => {
    vi.useFakeTimers();
    const stop = startLockHeartbeat(
      { key: "sync:c1", owner: "owner-1", release: async () => undefined },
      9_000,
    );

    await vi.advanceTimersByTimeAsync(3_000);
    expect(prismaMock.syncLock.updateMany).toHaveBeenCalledWith({
      where: { key: "sync:c1", owner: "owner-1" },
      data: { expiresAt: expect.any(Date) },
    });

    stop();
    prismaMock.syncLock.updateMany.mockClear();
    await vi.advanceTimersByTimeAsync(6_000);
    expect(prismaMock.syncLock.updateMany).not.toHaveBeenCalled();
  });
});
