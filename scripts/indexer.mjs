// Run on a persistent Node host, never in the browser. Public RPC cannot restore pruned history.
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { createClient } from "@supabase/supabase-js";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
const network = process.env.INDEXER_NETWORK || "devnet";
const packageId = normalizeSuiAddress(
  process.env.INDEXER_PACKAGE_ID ||
    "0x0537376ee9476b19e487f7cd8a27538a3051bd240acbc751eb0410f771cc3305",
);
const client = process.env.INDEXER_GRAPHQL_URL
  ? new SuiGraphQLClient({ network, url: process.env.INDEXER_GRAPHQL_URL })
  : new SuiGrpcClient({
      network,
      baseUrl:
        process.env.INDEXER_GRPC_URL ||
        `https://fullnode.${network}.sui.io:443`,
    });
const db =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } },
      )
    : null;
const directory = new URL("../.indexer/", import.meta.url);
await mkdir(directory, { recursive: true });
const path = new URL(`${network}-${packageId}.json`, directory),
  temp = new URL(`${network}-${packageId}.tmp`, directory);
const chain = (await client.getChainIdentifier()).chainIdentifier;
let local = { chain, events: {}, states: {} };
if (!db) {
  try {
    local = JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  if (local.chain !== chain)
    throw new Error(
      "Network reset detected. Archive the old index and use a new namespace.",
    );
}
const initializers = {
  game: "ProtocolInitialized",
  fomo3d: "TokenInitialized",
  swap: "PoolRegistryCreated",
};
async function syncModule(module) {
  let state = local.states[module] || {
    cursor: null,
    initialized: false,
    complete: false,
    chain,
  };
  if (db) {
    const { data, error } = await db
      .from("fomo_cursors")
      .select("*")
      .eq("network", network)
      .eq("package_id", packageId)
      .eq("module", module)
      .maybeSingle();
    if (error) throw error;
    if (data) state = data;
  }
  if (state.chain !== chain)
    throw new Error("Chain identifier changed: refusing to mix histories");
  for (let page = 0; page < 100; page++) {
    const expectedCursor = state.cursor;
    const response = await client.listEvents({
      filter: { eventType: `${packageId}::${module}` },
      after: expectedCursor,
      limit: 50,
      signal: AbortSignal.timeout(20000),
    });
    if (
      response.hasNextPage &&
      (!response.endCursor || response.endCursor === state.cursor)
    )
      throw new Error("Non-advancing event cursor");
    const events = response.events.map((e) => ({
      id: `${e.transactionDigest}:${e.eventIndex}`,
      network,
      package_id: packageId,
      checkpoint: e.checkpoint || "0",
      bcs: Buffer.from(e.bcs).toString("base64"),
      event: { ...e, bcs: undefined },
    }));
    state = {
      ...state,
      cursor: response.endCursor || state.cursor,
      initialized:
        state.initialized ||
        response.events.some(
          (e) =>
            e.eventType === `${packageId}::${module}::${initializers[module]}`,
        ),
      updated_at: new Date().toISOString(),
    };
    state.complete = state.initialized && !response.hasNextPage;
    if (db) {
      const { error } = await db.rpc("save_fomo_page", {
        p_network: network,
        p_package: packageId,
        p_module: module,
        p_chain: chain,
        p_previous_cursor: expectedCursor,
        p_cursor: state.cursor,
        p_initialized: state.initialized,
        p_complete: state.complete,
        p_events: events,
      });
      if (error) throw error;
    } else {
      for (const event of events) local.events[event.id] = event;
      local.states[module] = state;
      await writeFile(temp, JSON.stringify(local));
      await rename(temp, path);
    }
    console.log(
      `${module}: ${events.length} events; initialization=${state.initialized}; caught_up=${!response.hasNextPage}`,
    );
    if (!response.hasNextPage) break;
  }
}
async function tick() {
  for (const module of Object.keys(initializers)) await syncModule(module);
}
console.log(
  `Indexing ${network} ${packageId} into ${db ? "Supabase" : "local .indexer (not a production API)"}`,
);
do {
  try {
    await tick();
  } catch (e) {
    console.error(e.message);
    if (process.argv.includes("--once")) process.exitCode = 1;
  }
  if (process.argv.includes("--once")) break;
  await new Promise((resolve) => setTimeout(resolve, 8000));
} while (true);
