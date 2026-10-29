import type { PoolEntry } from "./sui/queryPlan";

export type PoolNames = Record<string, { name: string; symbol: string }>;

export function filterPools(
  pools: PoolEntry[],
  search: string,
  names: PoolNames,
) {
  const term = search.trim().toLowerCase();
  const addressTerm = term.startsWith("0x")
    ? term.replace(/^0x0+/, "0x")
    : term;
  return pools.filter((pool) => {
    const meta = names[pool.coinType];
    const text =
      `${meta?.name || ""} ${meta?.symbol || ""} ${pool.coinType} ${pool.id}`.toLowerCase();
    return (
      text.includes(term) ||
      (term.startsWith("0x") &&
        [pool.coinType.toLowerCase(), pool.id.toLowerCase()].some((value) =>
          value.replace(/^0x0+/, "0x").includes(addressTerm),
        ))
    );
  });
}
