export const U64_MAX = (1n << 64n) - 1n;
export function u64(n: bigint) {
  if (n < 0n || n > U64_MAX) throw new Error("Amount exceeds u64 range");
  return n;
}
export function parseAmount(s: string, decimals = 9) {
  if (
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 255 ||
    !/^\d+(\.\d*)?$/.test(s.trim())
  )
    throw new Error("Enter a valid non-negative decimal amount");
  const [whole, fraction = ""] = s.trim().split(".");
  if (fraction.length > decimals)
    throw new Error(`Maximum ${decimals} decimal places`);
  return u64(
    BigInt(whole) * 10n ** BigInt(decimals) +
      BigInt(fraction.padEnd(decimals, "0") || "0"),
  );
}
export function formatAmount(
  n: bigint | string | undefined,
  decimals = 9,
  precision = 4,
) {
  if (n === undefined) return "—";
  const x = BigInt(n),
    unit = 10n ** BigInt(decimals);
  const frac = (x % unit)
    .toString()
    .padStart(decimals, "0")
    .slice(0, precision)
    .replace(/0+$/, "");
  return (x / unit).toLocaleString("en-US") + (frac ? "." + frac : "");
}
export function keyPrice(keys: bigint, initial: bigint, pup: bigint) {
  return u64(initial + keys * ((initial * pup) / 1000n));
}
export function keyReward(
  price: bigint,
  supply: bigint,
  burned: bigint,
  threshold: bigint,
  divisor: bigint,
) {
  const requested = price * 5000n;
  const issued = supply + burned;
  if (price < 0n || requested > U64_MAX || issued > U64_MAX || divisor <= 0n)
    return undefined;
  // coin.move applies at most one halving before minting, using lifetime issuance.
  if (issued >= threshold && divisor <= 536_870_912n) divisor *= 2n;
  if (issued >= 10_000_000_000_000_000_000n) return 0n;
  // The contract checks the cap before minting; it does not clamp this reward.
  return requested / divisor;
}
export function quote(
  amount: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  sell: boolean,
) {
  if (amount <= 0n || reserveIn <= 0n || reserveOut <= 0n)
    throw new Error("Amount and pool reserves must be positive");
  const gross = (amount * reserveOut) / (reserveIn + amount),
    fee = sell ? (gross * 15n) / 1000n : 0n;
  return {
    gross,
    adminFee: fee,
    lpFee: fee,
    net: gross - fee * 2n,
    impactBps: (amount * 10000n) / (reserveIn + amount),
  };
}
export function minimum(amount: bigint, bps: bigint) {
  if (bps < 0n || bps > 5000n) throw new Error("Slippage must be 0–50%");
  return (amount * (10000n - bps)) / 10000n;
}
export function liquidityQuote(
  x: bigint,
  y: bigint,
  rx: bigint,
  ry: bigint,
  total: bigint,
) {
  if (x <= 0n || y <= 0n) throw new Error("Both deposits must be positive");
  const shares =
    total === 0n
      ? x < y
        ? x
        : y
      : [(x * total) / rx, (y * total) / ry].reduce((a, b) => (a < b ? a : b));
  const ceil = (a: bigint, b: bigint) => (a + b - 1n) / b;
  return {
    shares,
    usedX: total ? ceil(shares * rx, total) : x,
    usedY: total ? ceil(shares * ry, total) : y,
  };
}
export function removalQuote(
  shares: bigint,
  total: bigint,
  x: bigint,
  y: bigint,
) {
  if (shares <= 0n || shares > total) throw new Error("Invalid LP shares");
  const grossY = (y * shares) / total;
  return {
    x: (x * shares) / total,
    grossY,
    fee: grossY / 100n,
    netY: grossY - grossY / 100n,
  };
}
export function gameStatus(maturity: bigint, clock: bigint) {
  return maturity === 0n
    ? "Waiting"
    : clock > maturity
      ? "Settlement Available"
      : "Live";
}
export function icoReady(
  remaining: bigint | undefined,
  open: boolean | undefined,
  version: bigint | undefined,
  completed: boolean,
  gameExists: boolean,
) {
  return (
    remaining === 0n &&
    open === false &&
    version === 1n &&
    completed &&
    gameExists
  );
}
export function short(s?: string) {
  return s ? s.slice(0, 6) + "…" + s.slice(-4) : "—";
}
