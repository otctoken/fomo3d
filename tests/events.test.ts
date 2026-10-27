import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fromBase64 } from "@mysten/sui/utils";
import type { SuiClientTypes } from "@mysten/sui/client";
import { decodeEvent, discoverIds } from "../src/lib/events";
import { eventSchemas } from "../src/lib/events/schemas";
import { devnetDeployment } from "../src/config/deployment";
import { config } from "../src/config/contracts";
const evidence = JSON.parse(
  readFileSync(
    new URL("../docs/deployment-verification.json", import.meta.url),
    "utf8",
  ),
);
describe("Public on-chain evidence", () => {
  it("decodes real deployment BCS rather than depending on transport JSON shape", () => {
    const events = Object.values(evidence.initialization)
      .flat()
      .map((raw) => {
        const e = raw as SuiClientTypes.EventEntry & { bcs: string };
        return decodeEvent({ ...e, bcs: fromBase64(e.bcs), json: null });
      });
    expect(discoverIds(events, {}, config("devnet").fomoType)).toMatchObject(
      devnetDeployment,
    );
  });
  it("has schemas for every required event", () => {
    for (const name of [
      "ProtocolInitialized",
      "GameCreated",
      "KeyPurchased",
      "RoundSettled",
      "IcoContributed",
      "IcoCompleted",
      "IcoRefunded",
      "IcoClaimProcessed",
      "BuybackExecuted",
      "BuybackSkipped",
      "MintProcessed",
      "TokensBurned",
      "PoolCreated",
      "SwapExecuted",
      "LiquidityAdded",
      "LiquidityRemoved",
    ])
      expect(eventSchemas).toHaveProperty(name);
  });
  it("verifies 14 deployed function signatures", () =>
    expect(Object.keys(evidence.functions)).toHaveLength(14));
});
