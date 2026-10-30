import { normalizeSuiAddress, normalizeStructTag } from "@mysten/sui/utils";
import { devnetDeployment, mainnetDeployment } from "./deployment";
import networkSettings from "./network.json";
export const networks = ["devnet", "testnet", "mainnet"] as const;
export type Network = (typeof networks)[number];
export const SUI = normalizeStructTag("0x2::sui::SUI");
export const CLOCK = "0x6";
export const ICO_CAP = 11_000_000_000_000n;
const env = import.meta.env;
if (!networks.includes(networkSettings.network as Network))
  throw new Error(
    "src/config/network.json: network must be devnet, testnet or mainnet",
  );
export const defaultNetwork = networkSettings.network as Network;
export type ObjectIds = Partial<
  Record<
    | "registry"
    | "poolRegistry"
    | "ico"
    | "claims"
    | "mainGame"
    | "fomoPool"
    | "minter"
    | "halving",
    string
  >
>;
const names = {
  registry: "REGISTRY_ID",
  poolRegistry: "POOL_REGISTRY_ID",
  ico: "ICO_ID",
  claims: "GET_ICO_COIN_ID",
  mainGame: "MAIN_GAME_ID",
  fomoPool: "FOMO_POOL_ID",
  minter: "MINTER_ID",
  halving: "HALVING_CYCLE_ID",
};
export function config(network: Network) {
  const prefix = `VITE_${network.toUpperCase()}_`;
  const packageId =
      env[prefix + "PACKAGE_ID"] ||
  (network === "devnet"
    ? "0x0537376ee9476b19e487f7cd8a27538a3051bd240acbc751eb0410f771cc3305"
    : network === "mainnet"
      ? mainnetDeployment.packageId
      : "");
  const ids: ObjectIds = env[prefix + "PACKAGE_ID"]
  ? {}
  : network === "devnet"
    ? { ...devnetDeployment }
    : network === "mainnet"
      ? { ...mainnetDeployment.ids }
      : {};
  for (const [k, v] of Object.entries(names))
    if (env[prefix + v])
      ids[k as keyof ObjectIds] = normalizeSuiAddress(env[prefix + v]);
  return {
    network,
    packageId: packageId ? normalizeSuiAddress(packageId) : "",
    fomoType: packageId
      ? normalizeStructTag(`${packageId}::fomo3d::FOMO3D`)
      : "",
    ids,
    grpc: env[prefix + "GRPC_URL"] || `https://fullnode.${network}.sui.io:443`,
    graphql:
      env[prefix + "GRAPHQL_URL"] ||
      (network === "devnet" ? "" : `https://graphql.${network}.sui.io/graphql`),
    indexUrl: env.VITE_INDEXER_URL || "",
    supabaseUrl: env.VITE_SUPABASE_URL || "",
    supabaseKey: env.VITE_SUPABASE_ANON_KEY || "",
  };
}
export const explorer = (
  network: Network,
  kind: "object" | "tx" | "account",
  id: string,
) => `https://suiscan.xyz/${network}/${kind}/${encodeURIComponent(id)}`;
