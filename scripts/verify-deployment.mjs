import { SuiGrpcClient } from "@mysten/sui/grpc";
import { writeFile, mkdir, readFile } from "node:fs/promises";
const packageId =
  "0x0537376ee9476b19e487f7cd8a27538a3051bd240acbc751eb0410f771cc3305";
const client = new SuiGrpcClient({
  network: "devnet",
  baseUrl: "https://fullnode.devnet.sui.io:443",
});
const signatures = {
  game: {
    join_ico: [8, 0, 1],
    refund_ico: [4, 0, 1],
    get_fomo3d: [4, 0, 0],
    play_games: [7, 1, 0],
    open_award_sui: [6, 0, 0],
    open_award_meme: [8, 1, 0],
    open_award_fomo3d: [7, 0, 0],
    init_FomoData: [9, 1, 0],
    admin_init_FomoData: [6, 1, 0],
    init_FomoData_fomo3d: [8, 0, 0],
  },
  swap: {
    swap_x_to_y: [6, 2, 1],
    swap_y_to_x: [5, 2, 1],
    add_liquidity: [6, 2, 3],
    remove_liquidity: [7, 2, 2],
  },
};
const report = {
  checkedAt: new Date().toISOString(),
  packageId,
  network: "devnet",
  functions: {},
  initialization: {},
};
for (const [moduleName, fns] of Object.entries(signatures))
  for (const [name, expected] of Object.entries(fns)) {
    const { function: fn } = await client.getMoveFunction({
      packageId,
      moduleName,
      name,
    });
    const actual = [
      fn.parameters.length,
      fn.typeParameters.length,
      fn.returns.length,
    ];
    if (String(actual) !== String(expected) || fn.visibility !== "public")
      throw new Error(
        `${moduleName}::${name}: expected ${expected}, got ${actual}`,
      );
    report.functions[`${moduleName}::${name}`] = fn;
  }
for (const [module, name] of [
  ["game", "ProtocolInitialized"],
  ["fomo3d", "TokenInitialized"],
  ["swap", "PoolRegistryCreated"],
  ["game", "GameCreated"],
]) {
  const response = await client.listEvents({
    filter: { eventType: `${packageId}::${module}::${name}` },
    limit: 50,
  });
  report.initialization[name] = response.events.map((e) => ({
    ...e,
    bcs: Buffer.from(e.bcs).toString("base64"),
  }));
}
await mkdir(new URL("../docs/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../docs/deployment-verification.json", import.meta.url),
  JSON.stringify(report, null, 2),
);
console.log(
  `Verified ${Object.keys(report.functions).length} public signatures, including type arity, parameter arity, and return counts. Saved public evidence in docs/deployment-verification.json.`,
);
