import { SuiGrpcClient } from "@mysten/sui/grpc";
const packageId =
  process.env.PACKAGE_ID ||
  "0x0537376ee9476b19e487f7cd8a27538a3051bd240acbc751eb0410f771cc3305";
const client = new SuiGrpcClient({
  network: "devnet",
  baseUrl: "https://fullnode.devnet.sui.io:443",
});
for (const [label, run] of [
  ["package", () => client.getObject({ objectId: packageId })],
  [
    "initialization",
    () =>
      client.listEvents({
        filter: { eventType: `${packageId}::game::ProtocolInitialized` },
        limit: 10,
      }),
  ],
  [
    "token",
    () =>
      client.listEvents({
        filter: { eventType: `${packageId}::fomo3d::TokenInitialized` },
        limit: 10,
      }),
  ],
  [
    "pools",
    () =>
      client.listEvents({
        filter: { eventType: `${packageId}::swap::PoolRegistryCreated` },
        limit: 10,
      }),
  ],
  [
    "games",
    () =>
      client.listEvents({
        filter: { eventType: `${packageId}::game::GameCreated` },
        limit: 10,
      }),
  ],
]) {
  try {
    console.log(
      label,
      JSON.stringify(await run(), (_, v) =>
        v instanceof Uint8Array ? Array.from(v) : v,
      ),
    );
  } catch (e) {
    console.log(label, String(e));
  }
}
