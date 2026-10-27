import type { SuiClientTypes } from "@mysten/sui/client";
import {
  useCurrentClient,
  useCurrentNetwork,
  useCurrentAccount,
} from "@mysten/dapp-kit-react";
import { useQuery } from "@tanstack/react-query";
import { bcs } from "@mysten/sui/bcs";
import { normalizeStructTag } from "@mysten/sui/utils";
import { config, SUI } from "../config/contracts";
import { fetchHistory, discoverIds } from "../lib/events";
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
export function useHistory() {
  const network = useCurrentNetwork();
  return useQuery({
    queryKey: ["history", network],
    queryFn: () => fetchHistory(network),
    refetchInterval: 8000,
    retry: 1,
  });
}
export function useProtocol() {
  const network = useCurrentNetwork(),
    client = useCurrentClient(),
    history = useHistory(),
    c = config(network);
  const ids = discoverIds(history.data?.events || [], c.ids, c.fomoType);
  const icoFinalized =
    history.data?.events.some(
      (e) => e.name === "IcoFinalized" && e.data.ico_id === ids.ico,
    ) ?? false;
  const icoCompleted =
    history.data?.events.some(
      (e) => e.name === "IcoCompleted" && e.data.ico_id === ids.ico,
    ) ?? false;
  const query = useQuery({
    queryKey: ["protocol", network, ids, history.data?.events.length],
    refetchInterval: 5000,
    retry: 1,
    enabled: !!c.packageId,
    queryFn: async () => {
      const read = async <T>(
        id: string | undefined,
        schema: { parse: (data: Uint8Array) => T },
        suffix: string,
      ): Promise<T | undefined> => {
        if (!id) return undefined;
        const { object } = await client.getObject({
          objectId: id,
          include: { content: true },
          signal: AbortSignal.timeout(12000),
        });
        const expected =
          (suffix.startsWith("::clock::") ? "0x2" : c.packageId) + suffix;
        if (normalizeStructTag(object.type) !== normalizeStructTag(expected))
          throw new Error(`Wrong object type: ${object.type}`);
        return schema.parse(object.content);
      };
      const [registry, ico, claims, minter, halving, clock] = await Promise.all(
        [
          read(ids.registry, RegistrySchema, "::game::Registry"),
          read(icoFinalized ? undefined : ids.ico, IcoSchema, "::game::Ico"),
          read(
            icoFinalized ? undefined : ids.claims,
            ClaimsSchema,
            "::game::GetIcoCoin",
          ),
          read(ids.minter, MinterSchema, "::fomo3d::Minter"),
          read(ids.halving, HalvingSchema, "::fomo3d::Halving_cycle"),
          read("0x6", ClockSchema, "::clock::Clock"),
        ],
      );
      const games: Game[] = [],
        pools: Pool[] = [];
      const gameEntries = new Map(
        (history.data?.events || [])
          .filter((e) => e.name === "GameCreated")
          .map((e) => [
            String(e.data.game_id),
            { coinType: e.coinType!, creator: String(e.data.creator) },
          ]),
      );
      if (ids.mainGame && !gameEntries.has(ids.mainGame))
        gameEntries.set(ids.mainGame, { coinType: SUI, creator: "" });
      for (const [id, entry] of gameEntries) {
        const g = await read(
          id,
          GameSchema,
          `::game::FomoData<${entry.coinType}>`,
        );
        if (g) games.push({ ...g, ...entry });
      }
      const poolEntries = new Map(
        (history.data?.events || [])
          .filter((e) => e.name === "PoolCreated")
          .map((e) => [String(e.data.pool_id), e.coinType!]),
      );
      if (ids.fomoPool && !poolEntries.has(ids.fomoPool))
        poolEntries.set(ids.fomoPool, c.fomoType);
      for (const [id, coinType] of poolEntries) {
        const p = await read(
          id,
          PoolSchema,
          `::swap::Pool<${coinType}, ${SUI}>`,
        );
        if (p) pools.push({ ...p, coinType });
      }
      return {
        registry,
        ico,
        claims,
        minter,
        halving,
        clock,
        games,
        pools,
        icoFinalized,
        icoReady:
          icoCompleted &&
          registry?.version === "1" &&
          (icoFinalized || (ico?.boo === false && ico.hardCap === "0")),
        receivedAt: Date.now(),
      };
    },
  });
  return { ...query, ids, config: c, history };
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
export function useOwned() {
  const client = useCurrentClient(),
    network = useCurrentNetwork(),
    account = useCurrentAccount(),
    c = config(network);
  return useQuery({
    queryKey: ["owned", network, account?.address],
    enabled: !!account && !!c.packageId,
    refetchInterval: 10000,
    queryFn: async () => {
      const all = [];
      let cursor: string | null = null;
      do {
        const page: SuiClientTypes.ListOwnedObjectsResponse<{ content: true }> =
          await client.listOwnedObjects({
            owner: account!.address,
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
      p.dataUpdatedAt,
    ],
    enabled: !!account && !!p.data?.claims,
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
