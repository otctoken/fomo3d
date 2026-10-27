import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fromBase64 } from "@mysten/sui/utils";
import { eventSchemas } from "../src/lib/events/schemas";
const simulation = JSON.parse(
  readFileSync(new URL("../docs/ico-simulation.json", import.meta.url), "utf8"),
);
const get = (name: keyof typeof eventSchemas) => {
  const e = simulation.events.find((e: { type: string }) =>
    e.type.includes(`::${name}`),
  );
  return eventSchemas[name].parse(fromBase64(e.bcs)) as Record<string, unknown>;
};
describe("Read-only Devnet ICO → claim → first-key integration evidence", () => {
  it("is explicitly simulated with mocked gas, never presented as a signed transaction", () => {
    expect(simulation.simulationOnly).toBe(true);
    expect(simulation.gasPaymentMocked).toBe(true);
    expect(simulation.checksEnabled).toBe(false);
  });
  it("emits IcoCompleted with 10,000 SUI jackpot and version 1", () => {
    expect(get("IcoCompleted")).toMatchObject({
      jackpot_after: "10000000000000",
      seed_sui: "1000000000000",
      version_after: "1",
    });
  });
  it("creates the FOMO pool during completion", () =>
    expect(get("PoolCreated")).toMatchObject({
      amount_x: "200000000000000000",
      amount_y: "1000000000000",
    }));
  it("claims 2.2 billion FOMO, then buys a key without admin start", () => {
    expect(get("IcoClaimProcessed").entitlement_removed).toBe(
      "2200000000000000000",
    );
    const key = get("KeyPurchased");
    expect(key).toMatchObject({
      paid_amount: "2000000000",
      key_number: "1",
      jackpot_after: "10002000000000",
    });
    expect(
      BigInt(String(key.maturity_ms)) - BigInt(String(key.timestamp_ms)),
    ).toBe(60000n);
  });
});
