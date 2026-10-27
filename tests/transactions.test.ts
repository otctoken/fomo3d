import { describe, it, expect, vi } from "vitest";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { SUI } from "../src/config/contracts";
import {
  buyKey,
  contribute,
  refund,
  claim,
  settle,
  createGame,
  swap,
  addLiquidity,
  removeLiquidity,
  validateCreate,
  type TxContext,
} from "../src/lib/transactions/builders";
import {
  GameSchema,
  ClockSchema,
  IcoSchema,
  RegistrySchema,
  PoolSchema,
  LpSchema,
} from "../src/lib/sui/schemas";
const id = (i: number) => normalizeSuiAddress("0x" + i.toString(16));
const fomoType = `${id(99)}::fomo3d::FOMO3D`,
  token = `${id(98)}::coin::TOKEN`;
function fixture() {
  const ids = {
    registry: id(10),
    mainGame: id(11),
    ico: id(12),
    claims: id(13),
    minter: id(14),
    halving: id(15),
    poolRegistry: id(16),
    fomoPool: id(17),
  };
  const game = {
    id: ids.mainGame,
    balance: "1000000",
    pending_buyback: "0",
    address1: id(20),
    countdown: "60000",
    maturity: "0",
    initial_price: "2000000000",
    price_update_percentage: 2,
    total_keys: "0",
    round_id: "1",
  };
  const pool = {
    id: id(18),
    reserve_x: "1000000",
    reserve_y: "1000000000000",
    total_shares: "1000000",
    buytime: "0",
    selltime: "0",
    addtime: "0",
    removetime: "0",
  };
  const objects: Record<string, Uint8Array> = {
    [ids.registry]: RegistrySchema.serialize({
      id: ids.registry,
      admin: id(20),
      version: 1,
    }).toBytes(),
    [ids.mainGame]: GameSchema.serialize(game).toBytes(),
    [ids.ico]: IcoSchema.serialize({
      id: ids.ico,
      hardCap: "11000000000000",
      boo: true,
    }).toBytes(),
    [id(6)]: ClockSchema.serialize({
      id: id(6),
      timestamp_ms: "100000",
    }).toBytes(),
    [id(18)]: PoolSchema.serialize(pool).toBytes(),
    [id(19)]: LpSchema.serialize({
      id: id(19),
      pool: id(18),
      shares: "10000",
    }).toBytes(),
  };
  const client = {
    getObject: vi.fn(async ({ objectId }: { objectId: string }) => ({
      object: { content: objects[normalizeSuiAddress(objectId)] },
    })),
    getBalance: vi.fn(async () => ({
      balance: { balance: "18000000000000000000" },
    })),
    listDynamicFields: vi.fn(async () => ({
      dynamicFields: [],
      hasNextPage: false,
      cursor: null,
    })),
  } as unknown as SuiGrpcClient;
  const c: TxContext = {
    client,
    sender: id(20),
    packageId: id(99),
    fomoType,
    ids,
  };
  return { c, game, pool, objects };
}
const calls = (tx: Awaited<ReturnType<typeof refund>>) =>
  tx
    .getData()
    .commands.filter((c) => c.$kind === "MoveCall")
    .map((c) => c.MoveCall!);
describe("PTBs built from real contract signatures", () => {
  it("transfers ICO change back to the sender", async () => {
    const { c } = fixture(),
      tx = await contribute(c, 1000000000n);
    expect(calls(tx)[0].function).toBe("join_ico");
    expect(calls(tx)[0].arguments).toHaveLength(7);
    expect(tx.getData().commands.at(-1)?.$kind).toBe("TransferObjects");
  });
  it("rejects contributions above the current remaining cap", async () => {
    const { c } = fixture();
    await expect(contribute(c, 11000000000001n)).rejects.toThrow("remaining");
  });
  it("returns refund coins; claim has no nonexistent return to transfer", async () => {
    const { c } = fixture();
    expect((await refund(c)).getData().commands.at(-1)?.$kind).toBe(
      "TransferObjects",
    );
    expect(calls(await claim(c))[0].arguments).toHaveLength(3);
  });
  it("checks the current exact key price", async () => {
    const { c } = fixture();
    await expect(buyKey(c, c.ids.mainGame!, SUI, 2000000001n)).rejects.toThrow(
      "price changed",
    );
    expect(
      calls(await buyKey(c, c.ids.mainGame!, SUI, 2000000000n))[0].arguments,
    ).toHaveLength(6);
  });
  it("rejects expired buys and premature settlement", async () => {
    const { c, game, objects } = fixture();
    await expect(settle(c, c.ids.mainGame!, SUI)).rejects.toThrow(
      "not available",
    );
    objects[c.ids.mainGame!] = GameSchema.serialize({
      ...game,
      maturity: "99999",
    }).toBytes();
    await expect(buyKey(c, c.ids.mainGame!, SUI, 2000000000n)).rejects.toThrow(
      "expired",
    );
  });
  it.each([
    [SUI, "open_award_sui", 5],
    [fomoType, "open_award_fomo3d", 6],
    [token, "open_award_meme", 7],
  ] as const)(
    "uses dedicated settlement route for %s",
    async (type, name, count) => {
      const { c, game, objects } = fixture();
      objects[c.ids.mainGame!] = GameSchema.serialize({
        ...game,
        maturity: "99999",
      }).toBytes();
      const call = calls(await settle(c, c.ids.mainGame!, type, id(18)))[0];
      expect(call.function).toBe(name);
      expect(call.arguments).toHaveLength(count);
    },
  );
  it("splits a single aggregate token coin into the two distinct create-game inputs", async () => {
    const { c } = fixture();
    const tx = await createGame(c, {
      type: token,
      initial: 1000n,
      tokenLiquidity: 2000n,
      suiLiquidity: 100000000000n,
      price: 1000n,
      pup: 2,
      countdown: 10000n,
    });
    const call = calls(tx)[0];
    expect(call.arguments).toHaveLength(8);
    expect(call.arguments[2]).not.toEqual(call.arguments[3]);
    expect(tx.getData().commands.some((c) => c.$kind === "SplitCoins")).toBe(
      true,
    );
  });
  it("enforces create limits and special token restrictions", () => {
    const { c } = fixture(),
      valid = {
        type: token,
        initial: 0n,
        tokenLiquidity: 1n,
        suiLiquidity: 100000000000n,
        price: 1000n,
        pup: 255,
        countdown: 28800000n,
      };
    expect(validateCreate(c, valid)).toBe(token);
    for (const changed of [
      { type: SUI },
      { type: fomoType },
      { pup: 256 },
      { countdown: 9999n },
      { suiLiquidity: 99999999999n },
      { price: 999n },
    ])
      expect(() => validateCreate(c, { ...valid, ...changed })).toThrow();
  });
  it("uses the asymmetric swap argument lists and transfers output", async () => {
    const { c } = fixture();
    const sell = await swap(c, id(18), token, true, 100n, 96000000n, 50n),
      buy = await swap(c, id(18), token, false, 1000000000n, 999n, 50n);
    expect(calls(sell)[0].arguments).toHaveLength(5);
    expect(calls(buy)[0].arguments).toHaveLength(4);
    expect(sell.getData().commands.at(-1)?.$kind).toBe("TransferObjects");
  });
  it("transfers LP and both changes for adding liquidity", async () => {
    const { c } = fixture();
    const tx = await addLiquidity(
      c,
      id(18),
      token,
      1000n,
      1000000000n,
      1000n,
      50n,
    );
    expect(tx.getData().commands.at(-1)?.TransferObjects?.objects).toHaveLength(
      3,
    );
  });
  it("transfers both outputs for full LP redemption", async () => {
    const { c } = fixture();
    const tx = await removeLiquidity(
      c,
      id(18),
      token,
      id(19),
      10000n,
      10000000000n,
      50n,
    );
    expect(calls(tx)[0].arguments).toHaveLength(6);
    expect(tx.getData().commands.at(-1)?.TransferObjects?.objects).toHaveLength(
      2,
    );
  });
  it("constructs fresh transactions for retries", async () => {
    const { c } = fixture();
    expect(await claim(c)).not.toBe(await claim(c));
  });
});
