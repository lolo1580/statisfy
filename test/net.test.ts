import { describe, expect, it } from "vitest";
import { isPrivateIp } from "@/lib/net";

describe("isPrivateIp", () => {
  it("bloque les plages privées / réservées IPv4", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("laisse passer les IPv4 publiques", () => {
    for (const ip of [
      "8.8.8.8",
      "1.1.1.1",
      "151.101.1.1",
      "172.32.0.1",
      "192.169.0.1",
    ]) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });

  it("gère les adresses IPv6", () => {
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
    expect(isPrivateIp("fd00::1")).toBe(true);
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIp("2001:4860:4860::8888")).toBe(false);
  });

  it("bloque par prudence ce qui n'est pas une adresse IP", () => {
    expect(isPrivateIp("example.com")).toBe(true);
  });
});
