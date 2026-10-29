import { afterEach, describe, expect, it, vi } from "vitest";
import settings from "../src/config/network.json";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Repository-controlled network", () => {
  it("uses the committed network even when a legacy environment override exists", async () => {
    vi.stubEnv(
      "VITE_NETWORK",
      settings.network === "mainnet" ? "devnet" : "mainnet",
    );
    const { defaultNetwork, config } = await import("../src/config/contracts");
    expect(defaultNetwork).toBe(settings.network);
    expect(config(defaultNetwork).network).toBe(settings.network);
  });
  it("initializes the wallet kit with only the configured network", async () => {
    const { dAppKit } = await import("../src/lib/sui/client");
    expect(dAppKit.networks).toEqual([settings.network]);
    expect(dAppKit.stores.$currentNetwork.get()).toBe(settings.network);
  });
});
