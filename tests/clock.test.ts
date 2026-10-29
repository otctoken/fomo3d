import { describe, expect, it, vi } from "vitest";
import {
  clockSample,
  estimateClock,
  countdownSeconds,
  gamePollInterval,
} from "../src/lib/sui/clock";

describe("independent monotonic chain clock", () => {
  it("compensates using the clock RPC midpoint", () => {
    const sample = clockSample("100000", 1000, 1200);
    expect(sample.sampledAt).toBe(1100);
    expect(estimateClock(sample, 1200).timestamp).toBe(100100n);
    expect(estimateClock(sample, 6200).timestamp).toBe(105100n);
  });
  it("does not reset the clock baseline when a slow game/pool finishes later", () => {
    const sample = clockSample("100000", 1000, 1200);
    expect(estimateClock(sample, 9200).timestamp).toBe(108100n);
    expect(sample.receivedAt).toBe(1200);
  });
  it("ignores changes to the device wall clock", () => {
    const date = vi.spyOn(Date, "now").mockReturnValue(99999999999999);
    try {
      expect(
        estimateClock(clockSample("100000", 1000, 1200), 2200).timestamp,
      ).toBe(101100n);
    } finally {
      date.mockRestore();
    }
  });
  it("marks missing, old and high-latency samples as uncertain", () => {
    expect(estimateClock(undefined, 1000).stale).toBe(true);
    expect(estimateClock(clockSample("100000", 1000, 1200), 16201).stale).toBe(
      true,
    );
    expect(estimateClock(clockSample("100000", 1000, 4001), 4001).stale).toBe(
      true,
    );
  });
  it("bounds extrapolation across a sleeping tab or failed connection", () => {
    const result = estimateClock(clockSample("100000", 1000, 1200), 9999999);
    expect(result.timestamp).toBe(115000n);
    expect(result.stale).toBe(true);
  });
  it.each([
    [1n, 1n],
    [999n, 1n],
    [1000n, 1n],
    [1001n, 2n],
    [0n, 0n],
    [-1n, 0n],
  ])("rounds remaining %s ms up, never ending early", (left, seconds) => {
    expect(countdownSeconds("10000", 10000n - left)).toBe(seconds);
  });
  it("accepts a newly extended deadline rather than continuing the previous countdown", () => {
    expect(countdownSeconds("10000", 11000n)).toBe(0n);
    expect(countdownSeconds("71000", 11000n)).toBe(60n);
  });
  it("only accelerates the active game near its deadline, with bounded post-zero polling", () => {
    const sample = clockSample("100000", 1000, 1000);
    expect(gamePollInterval("160000", sample, 1000, 3000)).toBe(3000);
    expect(gamePollInterval("109000", sample, 1000, 3000)).toBe(1000);
    expect(gamePollInterval("100000", sample, 1000, 3000)).toBe(1000);
    expect(gamePollInterval("94000", sample, 1000, 3000)).toBe(3000);
    expect(gamePollInterval("109000", sample, 1000, 15000)).toBe(15000);
    expect(gamePollInterval("109000", sample, 20000, 3000)).toBe(3000);
    expect(gamePollInterval("0", sample, 1000, 3000)).toBe(3000);
  });
});
