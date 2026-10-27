import type { SuiClientTypes } from "@mysten/sui/client";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import {
  fromBase64,
  normalizeStructTag,
  parseStructTag,
} from "@mysten/sui/utils";
import {
  config,
  SUI,
  type Network,
  type ObjectIds,
} from "../../config/contracts";
import { eventSchemas } from "./schemas";
export type ChainEvent = {
  id: string;
  type: string;
  name: string;
  coinType?: string;
  digest: string;
  checkpoint: string;
  index: number;
  data: Record<string, unknown>;
};
export type History = {
  events: ChainEvent[];
  source: "rpc" | "persistent";
  complete: boolean;
  updatedAt: number;
};
export function decodeEvent(e: SuiClientTypes.EventEntry): ChainEvent {
  const tag = parseStructTag(e.eventType),
    name = tag.name;
  const schema = eventSchemas[name as keyof typeof eventSchemas];
  const data = schema ? schema.parse(e.bcs) : e.json || {};
  return {
    id: `${e.transactionDigest}:${e.eventIndex}`,
    type: e.eventType,
    name,
    coinType: tag.typeParams[0]
      ? normalizeStructTag(tag.typeParams[0])
      : undefined,
    digest: e.transactionDigest,
    checkpoint: e.checkpoint || "0",
    index: e.eventIndex,
    data,
  };
}
const caches = new Map<
  string,
  { events: Map<string, ChainEvent>; cursors: Record<string, string | null> }
>();
const confirmedEvents = new Map<string, Map<string, ChainEvent>>();
export function recordConfirmedEvents(
  network: Network,
  packageId: string,
  result: SuiClientTypes.Transaction<{ events: true }>,
) {
  const key = `${network}:${packageId}`;
  const map = confirmedEvents.get(key) || new Map<string, ChainEvent>();
  result.events.forEach((event, eventIndex) => {
    if (!event.eventType.startsWith(`${packageId}::`)) return;
    const decoded = decodeEvent({
      ...event,
      eventIndex,
      checkpoint: result.checkpoint,
      transactionDigest: result.digest,
    });
    map.set(decoded.id, decoded);
  });
  confirmedEvents.set(key, map);
}
function mergeConfirmed(key: string, events: ChainEvent[]) {
  const merged = new Map(events.map((e) => [e.id, e]));
  for (const e of confirmedEvents.get(key)?.values() || []) merged.set(e.id, e);
  return [...merged.values()];
}
export async function fetchHistory(network: Network): Promise<History> {
  const c = config(network);
  if (!c.packageId)
    return {
      events: [],
      source: "rpc",
      complete: false,
      updatedAt: Date.now(),
    };
  const key = `${network}:${c.packageId}`;
  if (c.supabaseUrl && c.supabaseKey) {
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(c.supabaseUrl, c.supabaseKey);
    const events: ChainEvent[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db
        .from("fomo_events")
        .select("*")
        .eq("network", network)
        .eq("package_id", c.packageId)
        .order("checkpoint")
        .order("id")
        .range(offset, offset + 999);
      if (error) throw error;
      for (const row of data || [])
        events.push(decodeEvent({ ...row.event, bcs: fromBase64(row.bcs) }));
      if (!data || data.length < 1000) break;
    }
    const { data: states, error } = await db
      .from("fomo_cursors")
      .select("*")
      .eq("network", network)
      .eq("package_id", c.packageId);
    if (error) throw error;
    return {
      events: mergeConfirmed(key, events),
      source: "persistent",
      complete: states?.length === 3 && states.every((s) => s.complete),
      updatedAt: states?.length
        ? Math.min(...states.map((s) => Date.parse(s.updated_at)))
        : 0,
    };
  }
  const client = c.graphql
    ? new (await import("@mysten/sui/graphql")).SuiGraphQLClient({
        network,
        url: c.graphql,
      })
    : new SuiGrpcClient({ network, baseUrl: c.grpc });
  let cache = caches.get(key);
  if (!cache) {
    cache = { events: new Map(), cursors: {} };
    caches.set(key, cache);
  }
  for (const module of ["game", "fomo3d", "swap"]) {
    // Paginate scan-limited empty pages too; resume on the next poll after this work budget.
    for (let page = 0; page < 20; page++) {
      const response = await client.listEvents({
        filter: { eventType: `${c.packageId}::${module}` },
        after: cache.cursors[module],
        limit: 50,
        signal: AbortSignal.timeout(12000),
      });
      for (const event of response.events) {
        const decoded = decodeEvent(event);
        cache.events.set(decoded.id, decoded);
      }
      if (response.endCursor) cache.cursors[module] = response.endCursor;
      if (!response.hasNextPage) break;
      if (!response.endCursor)
        throw new Error("Event index returned a non-advancing cursor");
    }
  }
  return {
    events: mergeConfirmed(key, [...cache.events.values()]),
    source: "rpc",
    complete: false,
    updatedAt: Date.now(),
  };
}
export function discoverIds(
  events: ChainEvent[],
  base: ObjectIds,
  fomoType: string,
): ObjectIds {
  const ids = { ...base };
  for (const e of events) {
    const d = e.data;
    if (e.name === "ProtocolInitialized")
      Object.assign(ids, {
        registry: d.registry_id,
        ico: d.ico_id,
        claims: d.claims_id,
      });
    if (e.name === "TokenInitialized")
      Object.assign(ids, { minter: d.minter_id, halving: d.halving_cycle_id });
    if (e.name === "PoolRegistryCreated")
      ids.poolRegistry = String(d.registry_id);
    if (e.name === "GameCreated" && e.coinType === SUI)
      ids.mainGame = String(d.game_id);
    if (e.name === "PoolCreated" && e.coinType === fomoType)
      ids.fomoPool = String(d.pool_id);
  }
  return ids;
}
export const eventAmount = (e: ChainEvent, key: string) =>
  BigInt(String(e.data[key] ?? 0));
export function sortEvents(events: ChainEvent[]) {
  return [...events].sort((a, b) =>
    BigInt(a.checkpoint) === BigInt(b.checkpoint)
      ? b.index - a.index
      : BigInt(a.checkpoint) > BigInt(b.checkpoint)
        ? -1
        : 1,
  );
}
