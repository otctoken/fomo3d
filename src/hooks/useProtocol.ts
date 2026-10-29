import type { SuiClientTypes } from "@mysten/sui/client";
import {
  useCurrentClient,
  useCurrentNetwork,
  useCurrentAccount,
} from "@mysten/dapp-kit-react";
import {
  useQuery,
  useQueries,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { bcs } from "@mysten/sui/bcs";
import { normalizeStructTag } from "@mysten/sui/utils";
import { config, SUI } from "../config/contracts";
import { fetchHistory, discoverIds } from "../lib/events";
import { buildCatalog, pagePlan } from "../lib/sui/queryPlan";
import {
  clockSample,
  estimateClock,
  gamePollInterval,
  type ClockSample,
} from "../lib/sui/clock";
import {
  ClockSchema,
  GameSchema,
  RegistrySchema,
  IcoSchema,
  ClaimsSchema,
  MinterSchema,
  HalvingSchema,
  PoolSchema,
  LpSchema,
  type Game,
  type Pool,
} from "../lib/sui/schemas";

// One observer per resource at the route boundary. Consumers only read this context.
// Leaving a page removes game/pool observers; inactive base queries stop polling.
function useProtocolState() {
  const cache = useQueryClient();
  const network = useCurrentNetwork(),
    client = useCurrentClient(),
    account = useCurrentAccount();
  const location = useLocation(),
    c = config(network);
  const emptyPlan = pagePlan(
    location.pathname,
    location.search,
    { games: [], pools: [] },
    account?.address,
  );
  const historyEnabled =
    !!c.packageId &&
    (emptyPlan.history || (emptyPlan.halving && !c.ids.halving));
  const history = useQuery({
    queryKey: ["history", network],
    queryFn: ({ signal }) => fetchHistory(network, signal),
    enabled: historyEnabled,
    refetchInterval: location.pathname.startsWith("/game/") ? 15000 : 30000,
    staleTime: 15000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
  const ids = discoverIds(history.data?.events || [], c.ids, c.fomoType);
  const catalog = buildCatalog(history.data?.events || [], ids, c.fomoType);
  const plan = pagePlan(
    location.pathname,
    location.search,
    catalog,
    account?.address,
  );
  const icoFinalized =
    history.data?.events.some(
      (e) => e.name === "IcoFinalized" && e.data.ico_id === ids.ico,
    ) ?? false;
  const icoCompleted =
    history.data?.events.some(
      (e) => e.name === "IcoCompleted" && e.data.ico_id === ids.ico,
    ) ?? false;
  const key = (id: string | undefined) => [
    "chain-object",
    network,
    c.packageId,
    id,
  ];
  async function read<T>(
    id: string,
    schema: { parse: (data: Uint8Array) => T },
    suffix: string,
    signal: AbortSignal,
  ): Promise<T> {
    const { object } = await client.getObject({
      objectId: id,
      include: { content: true },
      signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
    });
    const expected =
      (suffix.startsWith("::clock::") ? "0x2" : c.packageId) + suffix;
    if (normalizeStructTag(object.type) !== normalizeStructTag(expected))
      throw new Error(`Wrong object type: ${object.type}`);
    return schema.parse(object.content);
  }
  function options<T>(
    id: string | undefined,
    schema: { parse: (data: Uint8Array) => T },
    suffix: string,
    enabled: boolean,
    interval: number,
  ) {
    return {
      queryKey: key(id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        read(id!, schema, suffix, signal),
      enabled: !!id && !!c.packageId && enabled,
      staleTime: interval,
      refetchInterval: (query: { state: { error: Error | null } }) =>
        query.state.error ? Math.max(interval, 30000) : interval,
      refetchIntervalInBackground: false,
      retry: 1,
    };
  }
  const registry = useQuery(
    options(
      ids.registry,
      RegistrySchema,
      "::game::Registry",
      plan.registry,
      10000,
    ),
  );
  const ico = useQuery(
    options(
      ids.ico,
      IcoSchema,
      "::game::Ico",
      plan.ico && !icoFinalized,
      10000,
    ),
  );
  const claims = useQuery(
    options(
      ids.claims,
      ClaimsSchema,
      "::game::GetIcoCoin",
      plan.claims && !icoFinalized,
      30000,
    ),
  );
  const minter = useQuery(
    options(ids.minter, MinterSchema, "::fomo3d::Minter", plan.minter, 30000),
  );
  const halving = useQuery(
    options(
      ids.halving,
      HalvingSchema,
      "::fomo3d::Halving_cycle",
      plan.halving,
      30000,
    ),
  );
  const clock = useQuery<ClockSample, Error>({
    queryKey: ["chain-clock", network],
    enabled: plan.clock && !!c.packageId,
    staleTime: 5000,
    refetchInterval: (query) => {
      if (query.state.error) return 30000;
      const current =
        plan.detail && plan.games[0]
          ? cache.getQueryData<ReturnType<typeof GameSchema.parse>>(
              key(plan.games[0].id),
            )
          : undefined;
      return gamePollInterval(
        current?.maturity,
        query.state.data,
        performance.now(),
        3000,
      ) === 1000
        ? 1000
        : 5000;
    },
    refetchIntervalInBackground: false,
    retry: 1,
    queryFn: async ({ signal }) => {
      const start = performance.now();
      const value = await read("0x6", ClockSchema, "::clock::Clock", signal);
      return clockSample(value.timestamp_ms, start, performance.now());
    },
  });
  const games = useQueries({
    queries: plan.games.map((entry) => ({
      ...options(
        entry.id,
        GameSchema,
        `::game::FomoData<${entry.coinType}>`,
        true,
        plan.gameInterval,
      ),
      refetchInterval: (query: {
        state: {
          data?: ReturnType<typeof GameSchema.parse>;
          error: Error | null;
        };
      }) =>
        query.state.error
          ? 30000
          : gamePollInterval(
              query.state.data?.maturity,
              clock.data,
              performance.now(),
              plan.gameInterval,
            ),
    })),
  });
  const pools = useQueries({
    queries: plan.pools.map((entry) =>
      options(
        entry.id,
        PoolSchema,
        `::swap::Pool<${entry.coinType}, ${SUI}>`,
        true,
        5000,
      ),
    ),
  });
  const active: UseQueryResult<unknown, Error>[] = [
    ...(plan.registry && ids.registry ? [registry] : []),
    ...(plan.ico && !icoFinalized && ids.ico ? [ico] : []),
    ...(plan.claims && !icoFinalized && ids.claims ? [claims] : []),
    ...(plan.minter && ids.minter ? [minter] : []),
    ...(plan.halving && ids.halving ? [halving] : []),
    ...(plan.clock ? [clock] : []),
    ...games,
    ...pools,
  ];
  const error = active.find((q) => q.error)?.error || null;
  return {
    ids,
    config: c,
    catalog,
    plan,
    history,
    historyEnabled,
    syncActive: !!c.packageId && (active.length > 0 || historyEnabled),
    isLoading:
      active.some((q) => q.isLoading) || (historyEnabled && history.isLoading),
    isError: !!error,
    error,
    // Only active queries contribute to status; cached off-page failures are irrelevant.
    dataUpdatedAt: active.length
      ? Math.min(...active.map((q) => q.dataUpdatedAt))
      : 0,
    refetch: () => Promise.all(active.map((q) => q.refetch())),
    data: {
      registry: plan.registry ? registry.data : undefined,
      ico: plan.ico && !icoFinalized ? ico.data : undefined,
      claims: plan.claims && !icoFinalized ? claims.data : undefined,
      minter: plan.minter ? minter.data : undefined,
      halving: plan.halving ? halving.data : undefined,
      clock: plan.clock ? clock.data : undefined,
      clockError: plan.clock ? clock.error : null,
      games: games.flatMap((q, i): Game[] =>
        q.data ? [{ ...q.data, ...plan.games[i] }] : [],
      ),
      pools: pools.flatMap((q, i): Pool[] =>
        q.data ? [{ ...q.data, ...plan.pools[i] }] : [],
      ),
      icoFinalized,
      icoReady:
        icoCompleted &&
        registry.data?.version === "1" &&
        (icoFinalized || (ico.data?.boo === false && ico.data.hardCap === "0")),
    },
  };
}
const ProtocolContext = createContext<ReturnType<
  typeof useProtocolState
> | null>(null);
export function ProtocolProvider({ children }: { children: ReactNode }) {
  const state = useProtocolState();
  return createElement(ProtocolContext.Provider, { value: state }, children);
}
export function useProtocol() {
  const value = useContext(ProtocolContext);
  if (!value) throw new Error("ProtocolProvider missing");
  return value;
}
export function useHistory() {
  return useProtocol().history;
}

export function useChainTime() {
  const p = useProtocol();
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const tick = () => setNow(performance.now());
    const timer = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  const estimate = estimateClock(p.data.clock, now);
  return { ...estimate, stale: estimate.stale || !!p.error };
}

// Recheck the visible game's end once per round/deadline, not once per render.
export function useDeadlineCheck(
  game: Game,
  timestamp: bigint,
  stale: boolean,
) {
  const p = useProtocol(),
    cache = useQueryClient(),
    checked = useRef("");
  useEffect(() => {
    const deadlineKey = `${p.config.network}:${game.id}:${game.round_id}:${game.maturity}`;
    if (
      stale ||
      game.maturity === "0" ||
      timestamp < BigInt(game.maturity) ||
      checked.current === deadlineKey
    )
      return;
    checked.current = deadlineKey;
    void cache.invalidateQueries(
      {
        queryKey: [
          "chain-object",
          p.config.network,
          p.config.packageId,
          game.id,
        ],
        exact: true,
      },
      { cancelRefetch: false },
    );
    void cache.invalidateQueries(
      { queryKey: ["chain-clock", p.config.network], exact: true },
      { cancelRefetch: false },
    );
  }, [
    game.id,
    game.round_id,
    game.maturity,
    timestamp,
    stale,
    p.config.network,
    p.config.packageId,
    cache,
  ]);
}
export function useMetadata(coinType: string) {
  const client = useCurrentClient(),
    network = useCurrentNetwork();
  return useQuery({
    queryKey: ["metadata", network, coinType],
    enabled: !!coinType,
    staleTime: 3600000,
    queryFn: async () => {
      const { coinMetadata } = await client.getCoinMetadata({ coinType });
      if (!coinMetadata) throw new Error("Coin metadata unavailable");
      return coinMetadata;
    },
  });
}
export function useBalance(coinType: string) {
  const client = useCurrentClient(),
    network = useCurrentNetwork(),
    account = useCurrentAccount();
  return useQuery({
    queryKey: ["balance", network, account?.address, coinType],
    enabled: !!account && !!coinType,
    refetchInterval: 8000,
    queryFn: async () =>
      BigInt(
        (await client.getBalance({ owner: account!.address, coinType })).balance
          .balance,
      ),
  });
}
export function useOwned(adminOnly = false, enabled = true) {
  const client = useCurrentClient(),
    network = useCurrentNetwork(),
    account = useCurrentAccount(),
    c = config(network);
  return useQuery({
    queryKey: ["owned", network, account?.address, adminOnly],
    enabled: enabled && !!account && !!c.packageId,
    refetchInterval: adminOnly ? 60000 : 15000,
    staleTime: adminOnly ? 60000 : 15000,
    queryFn: async () => {
      const all = [];
      let cursor: string | null = null;
      do {
        const page: SuiClientTypes.ListOwnedObjectsResponse<{ content: true }> =
          await client.listOwnedObjects({
            owner: account!.address,
            type: adminOnly ? `${c.packageId}::game::AdminCap` : undefined,
            cursor,
            limit: 50,
            include: { content: true },
          });
        all.push(...page.objects);
        cursor = page.hasNextPage ? page.cursor : null;
      } while (cursor);
      return {
        adminCaps: all.filter(
          (o) => o.type === `${c.packageId}::game::AdminCap`,
        ),
        lps: all
          .filter((o) => o.type.startsWith(`${c.packageId}::swap::LP<`))
          .map((o) => ({
            ...LpSchema.parse(o.content),
            type: normalizeStructTag(o.type),
          })),
      };
    },
  });
}
export function useEntitlement() {
  const p = useProtocol(),
    client = useCurrentClient(),
    account = useCurrentAccount();
  return useQuery({
    queryKey: [
      "entitlement",
      p.config.network,
      account?.address,
      p.data?.claims?.get.id,
    ],
    enabled: !!account && !!p.data?.claims,
    refetchInterval: 15000,
    staleTime: 15000,
    queryFn: async () => {
      const parentId = p.data!.claims!.get.id;
      let cursor: string | null = null;
      // A missing address is zero; transport failures remain errors, never an invented zero balance.
      do {
        const page: SuiClientTypes.ListDynamicFieldsResponse =
          await client.listDynamicFields({ parentId, cursor, limit: 50 });
        const field = page.dynamicFields.find(
          (f) =>
            f.name.type === "address" &&
            bcs.Address.parse(f.name.bcs) === account!.address,
        );
        if (field) {
          const { dynamicField } = await client.getDynamicField({
            parentId,
            name: field.name,
          });
          return BigInt(bcs.u64().parse(dynamicField.value.bcs));
        }
        cursor = page.hasNextPage ? page.cursor : null;
      } while (cursor);
      return 0n;
    },
  });
}
