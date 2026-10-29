import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentClient, useCurrentNetwork } from "@mysten/dapp-kit-react";
import type { PoolEntry } from "../lib/sui/queryPlan";
import type { PoolNames } from "../lib/poolSearch";

// Metadata is cached for an hour, with only two lookups in flight. Pool reserves
// continue to be read exclusively by the current page's selected-pool query.
export function usePoolNames(pools: PoolEntry[]) {
  const client = useCurrentClient(),
    network = useCurrentNetwork(),
    cache = useQueryClient();
  const typesKey = JSON.stringify(
    [...new Set(pools.map((p) => p.coinType))].sort(),
  );
  const scope = `${network}:${typesKey}`;
  const [result, setResult] = useState<{
    scope: string;
    names: PoolNames;
    pending: boolean;
  }>({ scope: "", names: {}, pending: false });
  useEffect(() => {
    const types = JSON.parse(typesKey) as string[];
    let stopped = false,
      cursor = 0;
    const names: PoolNames = {};
    for (const type of types) {
      const cached = cache.getQueryData<{ name: string; symbol: string }>([
        "metadata",
        network,
        type,
      ]);
      if (cached) names[type] = cached;
    }
    setResult({ scope, names: { ...names }, pending: types.length > 0 });
    async function worker() {
      while (!stopped && cursor < types.length) {
        const coinType = types[cursor++];
        try {
          const meta = await cache.fetchQuery({
            queryKey: ["metadata", network, coinType],
            staleTime: 3600000,
            gcTime: 3600000,
            retry: false,
            queryFn: async ({ signal }) => {
              const { coinMetadata } = await client.getCoinMetadata({
                coinType,
                signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
              });
              if (!coinMetadata) throw new Error("Coin metadata unavailable");
              return coinMetadata;
            },
          });
          if (!stopped) {
            names[coinType] = meta;
            setResult({ scope, names: { ...names }, pending: true });
          }
        } catch {
          /* Keep the coin type/address searchable if metadata is unavailable. */
        }
      }
    }
    void Promise.all([worker(), worker()]).then(() => {
      if (!stopped) setResult({ scope, names: { ...names }, pending: false });
    });
    return () => {
      stopped = true;
    };
  }, [cache, client, network, typesKey, scope]);
  return result.scope === scope
    ? result
    : { names: {} as PoolNames, pending: pools.length > 0 };
}
