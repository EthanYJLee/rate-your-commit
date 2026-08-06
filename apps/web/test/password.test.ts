import { describe, expect, it } from "vitest";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "../lib/password";

describe("hashPassword / verifyPassword", () => {
  it("verifies a password against its own hash", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("wrong-password-entirely", hash)).toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const hash1 = await hashPassword("correct-horse-battery-staple");
    const hash2 = await hashPassword("correct-horse-battery-staple");
    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword("correct-horse-battery-staple", hash2)).toBe(true);
  });

  it("stores the hash as saltHex:hashHex, never the plaintext password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(hash).not.toContain("correct-horse-battery-staple");
    expect(hash.split(":")).toHaveLength(2);
  });

  it("rejects gracefully (not throw) on a malformed stored hash", async () => {
    expect(await verifyPassword("anything", "not-a-valid-stored-hash")).toBe(false);
    expect(await verifyPassword("anything", "")).toBe(false);
  });

  it("exports a minimum password length floor for callers to validate against", () => {
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(12);
  });
});
