import { describe, it, expect } from "vitest";
import {
  parseAmount,
  formatAmount,
  keyPrice,
  keyReward,
  quote,
  minimum,
  liquidityQuote,
  pairedLiquidityAmount,
  removalQuote,
  gameStatus,
  icoReady,
  U64_MAX,
} from "../src/lib/sui/math";
describe("Exact contract arithmetic", () => {
  it("round trips the u64 maximum without a Number conversion", () => {
    expect(parseAmount("18446744073.709551615")).toBe(U64_MAX);
    expect(formatAmount(U64_MAX, 9, 9)).toBe("18,446,744,073.709551615");
  });
  it.each([
    "1e9",
    "-1",
    "0.0000000001",
    "NaN",
    "Infinity",
    "18446744073.709551616",
  ])("rejects unsafe input %s", (s) => expect(() => parseAmount(s)).toThrow());
  it("supports token-specific decimals", () => {
    expect(parseAmount("123.456789", 6)).toBe(123456789n);
    expect(parseAmount("123", 0)).toBe(123n);
  });
  it("uses a floored per-key linear increment, not compound interest", () => {
    expect(keyPrice(1000n, 2000000000n, 2n)).toBe(6000000000n);
    expect(keyPrice(100n, 1001n, 2n)).toBe(1201n);
  });
  it("rejects key overflow", () =>
    expect(() => keyPrice(U64_MAX, U64_MAX, 255n)).toThrow());
  it("quotes asymmetric fees with independent flooring", () => {
    const q = quote(100n, 900n, 10000n, true);
    expect(q).toMatchObject({
      gross: 1000n,
      adminFee: 15n,
      lpFee: 15n,
      net: 970n,
    });
    expect(quote(100n, 900n, 10000n, false).net).toBe(1000n);
    expect(quote(1n, 1n, 133n, true).net).toBe(66n);
  });
  it("applies slippage only to net swap proceeds", () => {
    expect(minimum(970n, 50n)).toBe(965n);
    expect(() => minimum(1n, 5001n)).toThrow();
  });
  it("calculates ceiling deposits and returned change", () => {
    const q = liquidityQuote(10n, 10n, 3n, 7n, 10n);
    expect(q).toEqual({ shares: 14n, usedX: 5n, usedY: 10n });
  });
  it("handles an emptied pool restart", () =>
    expect(liquidityQuote(40n, 20n, 0n, 0n, 0n)).toEqual({
      shares: 20n,
      usedX: 40n,
      usedY: 20n,
    }));
  it("quotes the 1% SUI redemption fee separately from gross slippage checks", () =>
    expect(removalQuote(10n, 100n, 1000n, 100000n)).toEqual({
      x: 100n,
      grossY: 10000n,
      fee: 100n,
      netY: 9900n,
    }));
});
describe("Next SUI key reward", () => {
  const price = 2_000_000_000n;
  const threshold = 2_500_000_000_000_000_000n;
  const cap = 10_000_000_000_000_000_000n;
  it("rewards 10,000 FOMO3D for the initial 2 SUI key", () => {
    expect(keyReward(price, 0n, 0n, threshold, 1n)).toBe(10_000_000_000_000n);
    expect(keyReward(keyPrice(1n, price, 2n), 0n, 0n, threshold, 1n)).toBe(
      10_020_000_000_000n,
    );
  });
  it("halves before minting at the threshold, counting burned tokens", () => {
    expect(keyReward(price, threshold - 1n, 0n, threshold, 1n)).toBe(
      price * 5000n,
    );
    expect(keyReward(price, threshold - 1n, 1n, threshold, 1n)).toBe(
      price * 2500n,
    );
  });
  it("only advances one halving per purchase and respects the maximum divisor", () => {
    expect(keyReward(price, cap - 1n, 0n, threshold, 1n)).toBe(price * 2500n);
    expect(keyReward(price, cap - 1n, 0n, threshold, 1_073_741_824n)).toBe(
      (price * 5000n) / 1_073_741_824n,
    );
  });
  it("stops at the lifetime cap, without clamping a reward that crosses it", () => {
    expect(keyReward(price, cap - 1n, 0n, cap, 1n)).toBe(price * 5000n);
    expect(keyReward(price, cap - 1n, 1n, cap, 1n)).toBe(0n);
  });
  it("does not display a reward for an overflowing Move multiplication", () => {
    expect(
      keyReward(U64_MAX / 5000n + 1n, 0n, 0n, threshold, 1n),
    ).toBeUndefined();
  });
});
describe("Liquidity amount pairing", () => {
  it("pairs either side using raw reserves, including different coin decimals", () => {
    const tokens = parseAmount("12.5", 6),
      tokenReserve = parseAmount("1000", 6),
      suiReserve = parseAmount("50", 9);
    expect(pairedLiquidityAmount(tokens, tokenReserve, suiReserve)).toBe(
      parseAmount("0.625", 9),
    );
    expect(
      pairedLiquidityAmount(parseAmount("0.625", 9), suiReserve, tokenReserve),
    ).toBe(tokens);
  });
  it("rounds up by the smallest unit so the other side cannot underfund the ratio", () => {
    expect(pairedLiquidityAmount(1n, 3n, 7n)).toBe(3n);
    const q = liquidityQuote(
      1n,
      pairedLiquidityAmount(1n, 3n, 7n),
      3n,
      7n,
      100n,
    );
    expect(q.shares).toBe(33n);
    expect(q.usedX).toBeLessThanOrEqual(1n);
    expect(q.usedY).toBeLessThanOrEqual(3n);
  });
  it("preserves precision above Number's safe range", () => {
    expect(pairedLiquidityAmount(9_007_199_254_740_993n, 3n, 2n)).toBe(
      6_004_799_503_160_662n,
    );
  });
  it("handles zero inputs, rejects empty reserves and prevents u64 overflow", () => {
    expect(pairedLiquidityAmount(0n, 3n, 7n)).toBe(0n);
    expect(() => pairedLiquidityAmount(1n, 0n, 7n)).toThrow();
    expect(() => pairedLiquidityAmount(1n, 7n, 0n)).toThrow();
    expect(() => pairedLiquidityAmount(U64_MAX, 1n, 2n)).toThrow();
  });
});
describe("ICO lifecycle and chain Clock", () => {
  it("does not unlock from a full progress bar alone", () => {
    expect(icoReady(0n, true, 0n, false, true)).toBe(false);
    expect(icoReady(0n, false, 1n, false, true)).toBe(false);
    expect(icoReady(0n, false, 1n, true, false)).toBe(false);
  });
  it("automatically opens after matching event and object refresh, but has no timer before first key", () => {
    expect(icoReady(0n, false, 1n, true, true)).toBe(true);
    expect(gameStatus(0n, 100000n)).toBe("Waiting");
    expect(gameStatus(160000n, 100000n)).toBe("Live");
  });
  it("allows buying at maturity equality; settlement requires strictly later Clock", () => {
    expect(gameStatus(100n, 100n)).toBe("Live");
    expect(gameStatus(100n, 101n)).toBe("Settlement Available");
  });
});
