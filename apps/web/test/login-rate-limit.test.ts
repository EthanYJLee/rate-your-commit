import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkAndConsumeAttempt,
  clearFailedAttempts,
  MAX_ATTEMPTS,
  WINDOW_MS,
} from "../lib/login-rate-limit";

describe("login rate limiting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first MAX_ATTEMPTS calls for a key", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      expect(checkAndConsumeAttempt("bob@example.com")).toBe(true);
    }
  });

  it("rejects the call once MAX_ATTEMPTS has been consumed within the window", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      checkAndConsumeAttempt("carol@example.com");
    }
    expect(checkAndConsumeAttempt("carol@example.com")).toBe(false);
  });

  it("does not affect other keys (rate limiting is per-email)", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      checkAndConsumeAttempt("dave@example.com");
    }
    expect(checkAndConsumeAttempt("erin@example.com")).toBe(true);
  });

  it("resets once the window elapses", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      checkAndConsumeAttempt("frank@example.com");
    }
    expect(checkAndConsumeAttempt("frank@example.com")).toBe(false);

    vi.advanceTimersByTime(WINDOW_MS + 1);

    expect(checkAndConsumeAttempt("frank@example.com")).toBe(true);
  });

  it("clearFailedAttempts resets the count immediately (called on successful login)", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      checkAndConsumeAttempt("grace@example.com");
    }
    expect(checkAndConsumeAttempt("grace@example.com")).toBe(false);

    clearFailedAttempts("grace@example.com");

    expect(checkAndConsumeAttempt("grace@example.com")).toBe(true);
  });

  it("keys are case-insensitive (matches email normalization elsewhere)", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      checkAndConsumeAttempt("Henry@Example.com");
    }
    expect(checkAndConsumeAttempt("henry@example.com")).toBe(false);
  });

  it("each call synchronously consumes one slot, so concurrent (Promise.all-style) callers can't all pass MAX_ATTEMPTS checks against a stale count — the check IS the increment, not a separate step", () => {
    // Simulates the concurrency race the security review flagged:
    // N "simultaneous" callers, modeled as N synchronous calls before
    // any of them would have had a chance to await something else.
    // Because checkAndConsumeAttempt does both in one synchronous
    // step, exactly MAX_ATTEMPTS of them can succeed, never more.
    const results = Array.from({ length: MAX_ATTEMPTS + 10 }, () =>
      checkAndConsumeAttempt("ivan@example.com")
    );
    expect(results.filter(Boolean)).toHaveLength(MAX_ATTEMPTS);
  });

  it("sweeps expired entries once the tracked-key count crosses a bound, instead of growing forever", async () => {
    const { MAX_TRACKED_KEYS } = await import("../lib/login-rate-limit");

    for (let i = 0; i < MAX_TRACKED_KEYS + 50; i++) {
      checkAndConsumeAttempt(`user${i}@example.com`);
    }
    vi.advanceTimersByTime(WINDOW_MS + 1);
    // One more call should trigger a sweep of everything whose window
    // has already elapsed, keeping the map from growing unbounded.
    checkAndConsumeAttempt("trigger-sweep@example.com");

    const { trackedKeyCount } = await import("../lib/login-rate-limit");
    expect(trackedKeyCount()).toBeLessThan(MAX_TRACKED_KEYS + 51);
  });
});
