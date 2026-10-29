import { createDAppKit } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { config, defaultNetwork } from "../../config/contracts";
export const dAppKit = createDAppKit({
  networks: [defaultNetwork],
  defaultNetwork,
  createClient: (network) =>
    new SuiGrpcClient({ network, baseUrl: config(network).grpc }),
});
declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
