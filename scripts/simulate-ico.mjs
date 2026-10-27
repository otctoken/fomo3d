// Read-only integration check. Never signs, executes, or requests a wallet/private key.
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { readFile, writeFile } from "node:fs/promises";
const evidence = JSON.parse(
  await readFile(
    new URL("../docs/deployment-verification.json", import.meta.url),
    "utf8",
  ),
);
const init = evidence.initialization.ProtocolInitialized[0].json,
  token = evidence.initialization.TokenInitialized[0].json,
  registry = evidence.initialization.PoolRegistryCreated[0].json;
const main = evidence.initialization.GameCreated.find((e) =>
  e.eventType.includes("::sui::SUI>"),
)?.json;
if (!main) throw new Error("Initialize the main game first");
const client = new SuiGrpcClient({
    network: "devnet",
    baseUrl: "https://fullnode.devnet.sui.io:443",
  }),
  pkg = evidence.packageId;
const { object } = await client.getObject({
  objectId: init.ico_id,
  include: { content: true },
});
const ico = bcs
  .struct("Ico", { id: bcs.Address, hardCap: bcs.u64(), boo: bcs.bool() })
  .parse(object.content);
if (!ico.boo || ico.hardCap === "0")
  throw new Error(
    "Live ICO already completed; this before-completion simulation no longer applies",
  );
const tx = new Transaction();
tx.setSender(init.admin);
const [payment] = tx.splitCoins(tx.gas, [BigInt(ico.hardCap)]);
const change = tx.moveCall({
  target: `${pkg}::game::join_ico`,
  arguments: [
    tx.object(token.minter_id),
    tx.object(init.registry_id),
    tx.object(registry.registry_id),
    tx.object(main.game_id),
    tx.object(init.ico_id),
    tx.object(init.claims_id),
    payment,
  ],
});
tx.transferObjects([change], init.admin);
tx.moveCall({
  target: `${pkg}::game::get_fomo3d`,
  arguments: [
    tx.object(token.minter_id),
    tx.object(init.ico_id),
    tx.object(init.claims_id),
  ],
});
const [key] = tx.splitCoins(tx.gas, [BigInt(main.initial_price)]);
tx.moveCall({
  target: `${pkg}::game::play_games`,
  typeArguments: ["0x2::sui::SUI"],
  arguments: [
    tx.object(init.registry_id),
    tx.object(main.game_id),
    key,
    tx.object(token.minter_id),
    tx.object(token.halving_cycle_id),
    tx.object("0x6"),
  ],
});
const result = await client.simulateTransaction({
  transaction: tx,
  checksEnabled: false,
  include: { events: true, effects: true },
});
if (result.FailedTransaction)
  throw new Error(result.FailedTransaction.status.error.message);
const events = result.Transaction.events.map((e) => ({
  type: e.eventType,
  data: e.json,
  bcs: Buffer.from(e.bcs).toString("base64"),
}));
for (const name of [
  "IcoCompleted",
  "PoolCreated",
  "IcoClaimProcessed",
  "MintProcessed",
  "KeyPurchased",
])
  if (!events.some((e) => e.type.includes(`::${name}`)))
    throw new Error(`Simulation missing ${name}`);
const report = {
  checkedAt: new Date().toISOString(),
  network: "devnet",
  packageId: pkg,
  simulationOnly: true,
  checksEnabled: false,
  gasPaymentMocked: result.gasPaymentMocked,
  remainingBefore: ico.hardCap,
  events,
};
await writeFile(
  new URL("../docs/ico-simulation.json", import.meta.url),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    {
      simulationOnly: true,
      gasPaymentMocked: result.gasPaymentMocked,
      events: events.map((e) => ({
        type: e.type.split("::").slice(1).join("::"),
        data: e.data,
      })),
    },
    null,
    2,
  ),
);
