export const CLOCK_MAX_AGE = 15_000;
export const CLOCK_MAX_RTT = 2_000;
export type ClockSample = {
  timestamp_ms: string;
  sampledAt: number;
  receivedAt: number;
  roundTripMs: number;
};

// Use a monotonic midpoint, not the completion time of unrelated object requests.
// This estimates network transit; consensus/node lag still prevents an exact wall-clock guarantee.
export function clockSample(
  timestamp_ms: string,
  started: number,
  received: number,
): ClockSample {
  return {
    timestamp_ms,
    sampledAt: (started + received) / 2,
    receivedAt: received,
    roundTripMs: received - started,
  };
}
export function estimateClock(sample: ClockSample | undefined, now: number) {
  if (!sample) return { timestamp: 0n, stale: true };
  const age = Math.max(0, now - sample.receivedAt);
  const elapsed = Math.max(0, Math.min(now - sample.sampledAt, CLOCK_MAX_AGE));
  return {
    timestamp: BigInt(sample.timestamp_ms) + BigInt(Math.floor(elapsed)),
    stale: age > CLOCK_MAX_AGE || sample.roundTripMs > CLOCK_MAX_RTT,
  };
}
export function countdownSeconds(maturity: string, timestamp: bigint) {
  const remaining = BigInt(maturity) - timestamp;
  // Do not display zero while a positive fraction of a second remains.
  return remaining > 0n ? (remaining + 999n) / 1000n : 0n;
}
export function gamePollInterval(
  maturity: string | undefined,
  sample: ClockSample | undefined,
  now: number,
  normal: number,
) {
  if (!maturity || maturity === "0" || normal !== 3000) return normal;
  const clock = estimateClock(sample, now);
  const left = BigInt(maturity) - clock.timestamp;
  return !clock.stale && left <= 10_000n && left >= -5_000n ? 1000 : normal;
}
