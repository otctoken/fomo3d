import type { SuiClientTypes } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { bcs } from "@mysten/sui/bcs";
import { normalizeStructTag } from "@mysten/sui/utils";
import { CLOCK, SUI, type ObjectIds } from "../../config/contracts";
import {
  GameSchema,
  ClockSchema,
  IcoSchema,
  RegistrySchema,
  PoolSchema,
  LpSchema,
} from "../sui/schemas";
import {
  keyPrice,
  minimum,
  quote,
  liquidityQuote,
  removalQuote,
  u64,
} from "../sui/math";
export type TxContext = {
  client: SuiGrpcClient;
  sender: string;
  packageId: string;
  fomoType: string;
  ids: ObjectIds;
};
function start(c: TxContext) {
  if (!c.packageId)
    throw new Error("Contract is not configured on this network");
  const tx = new Transaction();
  tx.setSender(c.sender);
  return tx;
}
function id(c: TxContext, k: keyof ObjectIds) {
  const value = c.ids[k];
  if (!value)
    throw new Error(
      `Missing ${k} object. Initialize or configure the deployment first.`,
    );
  return value;
}
const target = (c: TxContext, module: string, name: string) =>
  `${c.packageId}::${module}::${name}`;
async function read<T>(
  c: TxContext,
  objectId: string,
  schema: { parse: (x: Uint8Array) => T },
) {
  const { object } = await c.client.getObject({
    objectId,
    include: { content: true },
  });
  return schema.parse(object.content);
}
async function balance(c: TxContext, type: string, amount: bigint) {
  const { balance } = await c.client.getBalance({
    owner: c.sender,
    coinType: type,
  });
  if (BigInt(balance.balance) < amount)
    throw new Error(
      `Insufficient ${type === SUI ? "SUI" : type.split("::").at(-1)} balance`,
    );
}
async function live(c: TxContext) {
  const r = await read(c, id(c, "registry"), RegistrySchema);
  if (r.version !== "1")
    throw new Error("Protocol is not open: Registry.version must be 1");
}
export async function buyKey(
  c: TxContext,
  gameId: string,
  type: string,
  expected: bigint,
) {
  await live(c);
  const [g, clock] = await Promise.all([
    read(c, gameId, GameSchema),
    read(c, CLOCK, ClockSchema),
  ]);
  const price = keyPrice(
    BigInt(g.total_keys),
    BigInt(g.initial_price),
    BigInt(g.price_update_percentage),
  );
  if (price !== expected)
    throw new Error("Key price changed. Refresh the quote and try again.");
  if (
    BigInt(g.maturity) > 0n &&
    BigInt(clock.timestamp_ms) > BigInt(g.maturity)
  )
    throw new Error("Round expired. Settle before buying.");
  await balance(c, type, price);
  const tx = start(c);
  tx.moveCall({
    target: target(c, "game", "play_games"),
    typeArguments: [type],
    arguments: [
      tx.object(id(c, "registry")),
      tx.object(gameId),
      tx.coin({ type, balance: price }),
      tx.object(id(c, "minter")),
      tx.object(id(c, "halving")),
      tx.object(CLOCK),
    ],
  });
  return tx;
}
export async function contribute(c: TxContext, amount: bigint) {
  u64(amount);
  const ico = await read(c, id(c, "ico"), IcoSchema);
  if (!ico.boo) throw new Error("ICO is closed");
  if (amount <= 0n) throw new Error("Enter a positive contribution amount");
  await balance(c, SUI, amount);
  const tx = start(c);
  const change = tx.moveCall({
    target: target(c, "game", "join_ico"),
    arguments: [
      tx.object(id(c, "minter")),
      tx.object(id(c, "registry")),
      tx.object(id(c, "poolRegistry")),
      tx.object(id(c, "mainGame")),
      tx.object(id(c, "ico")),
      tx.object(id(c, "claims")),
      tx.coin({ type: SUI, balance: amount }),
    ],
  });
  tx.transferObjects([change], c.sender);
  return tx;
}
export async function refund(c: TxContext) {
  const tx = start(c);
  const coin = tx.moveCall({
    target: target(c, "game", "refund_ico"),
    arguments: [
      tx.object(id(c, "mainGame")),
      tx.object(id(c, "ico")),
      tx.object(id(c, "claims")),
    ],
  });
  tx.transferObjects([coin], c.sender);
  return tx;
}
export async function claim(c: TxContext) {
  const tx = start(c);
  tx.moveCall({
    target: target(c, "game", "get_fomo3d"),
    arguments: [
      tx.object(id(c, "minter")),
      tx.object(id(c, "ico")),
      tx.object(id(c, "claims")),
    ],
  });
  return tx;
}
export async function settle(
  c: TxContext,
  gameId: string,
  type: string,
  poolId?: string,
) {
  await live(c);
  const [g, clock] = await Promise.all([
    read(c, gameId, GameSchema),
    read(c, CLOCK, ClockSchema),
  ]);
  if (g.maturity === "0" || BigInt(clock.timestamp_ms) <= BigInt(g.maturity))
    throw new Error(
      "Settlement is not available according to the latest on-chain Clock",
    );
  const tx = start(c),
    o = (k: keyof ObjectIds) => tx.object(id(c, k));
  if (type === SUI)
    tx.moveCall({
      target: target(c, "game", "open_award_sui"),
      arguments: [
        o("registry"),
        tx.object(gameId),
        o("fomoPool"),
        o("minter"),
        tx.object(CLOCK),
      ],
    });
  else if (type === c.fomoType)
    tx.moveCall({
      target: target(c, "game", "open_award_fomo3d"),
      arguments: [
        o("registry"),
        o("poolRegistry"),
        tx.object(gameId),
        o("fomoPool"),
        o("minter"),
        tx.object(CLOCK),
      ],
    });
  else {
    if (!poolId) throw new Error("Game AMM pool is not indexed");
    tx.moveCall({
      target: target(c, "game", "open_award_meme"),
      typeArguments: [type],
      arguments: [
        o("registry"),
        o("poolRegistry"),
        tx.object(gameId),
        tx.object(poolId),
        o("fomoPool"),
        o("minter"),
        tx.object(CLOCK),
      ],
    });
  }
  return tx;
}
export type CreateGameInput = {
  type: string;
  initial: bigint;
  tokenLiquidity: bigint;
  suiLiquidity: bigint;
  price: bigint;
  pup: number;
  countdown: bigint;
};
export function validateCreate(
  c: Pick<TxContext, "fomoType">,
  p: CreateGameInput,
) {
  const type = normalizeStructTag(p.type);
  if (type === SUI || type === c.fomoType)
    throw new Error("SUI and FOMO3D use administrator initialization");
  if (p.countdown < 10000n || p.countdown > 28800000n)
    throw new Error("Countdown must be 10 seconds to 8 hours");
  if (p.price < 1000n || p.price > 10000000000000000n)
    throw new Error(
      "Initial key price must be 1,000–10,000,000,000,000,000 raw units",
    );
  if (!Number.isInteger(p.pup) || p.pup < 0 || p.pup > 255)
    throw new Error("Price growth must be an integer from 0 to 255 per mille");
  if (p.suiLiquidity < 100000000000n || p.tokenLiquidity <= 0n)
    throw new Error("Provide at least 100 SUI and positive token liquidity");
  [p.initial, p.tokenLiquidity, p.suiLiquidity, p.price].forEach(u64);
  return type;
}
async function ensureUnique(c: TxContext, type: string) {
  const typeName = bcs.struct("TypeName", { name: bcs.string() });
  let cursor: string | null = null;
  for (const parentId of [id(c, "registry"), id(c, "poolRegistry")]) {
    do {
      const page: SuiClientTypes.ListDynamicFieldsResponse =
        await c.client.listDynamicFields({ parentId, cursor, limit: 50 });
      for (const f of page.dynamicFields)
        if (f.name.type.endsWith("::type_name::TypeName")) {
          const raw = typeName.parse(f.name.bcs).name;
          if (
            normalizeStructTag(raw.startsWith("0x") ? raw : "0x" + raw) === type
          )
            throw new Error(
              "A game or AMM pool already exists for this Coin Type",
            );
        }
      cursor = page.hasNextPage ? page.cursor : null;
    } while (cursor);
  }
}
export async function createGame(c: TxContext, p: CreateGameInput) {
  const type = validateCreate(c, p);
  await live(c);
  await ensureUnique(c, type);
  await Promise.all([
    balance(c, type, p.initial + p.tokenLiquidity),
    balance(c, SUI, p.suiLiquidity),
  ]);
  const tx = start(c);
  const combined = tx.coin({
    type,
    balance: u64(p.initial + p.tokenLiquidity),
  });
  const [seed] = tx.splitCoins(combined, [p.initial]);
  tx.moveCall({
    target: target(c, "game", "init_FomoData"),
    typeArguments: [type],
    arguments: [
      tx.object(id(c, "registry")),
      tx.object(id(c, "poolRegistry")),
      seed,
      combined,
      tx.coin({ type: SUI, balance: p.suiLiquidity }),
      tx.pure.u64(p.countdown),
      tx.pure.u64(p.price),
      tx.pure.u8(p.pup),
    ],
  });
  return tx;
}
export async function swap(
  c: TxContext,
  poolId: string,
  type: string,
  sell: boolean,
  amount: bigint,
  expected: bigint,
  bps: bigint,
) {
  const pool = await read(c, poolId, PoolSchema);
  const q = quote(
    amount,
    BigInt(sell ? pool.reserve_x : pool.reserve_y),
    BigInt(sell ? pool.reserve_y : pool.reserve_x),
    sell,
  );
  const min = minimum(expected, bps);
  if (q.net < min || min <= 0n)
    throw new Error("Quote moved beyond slippage or output is zero");
  await balance(c, sell ? type : SUI, amount);
  const tx = start(c);
  const args = [
    tx.object(poolId),
    tx.coin({ type: sell ? type : SUI, balance: amount }),
    tx.pure.u64(min),
  ];
  if (sell) args.push(tx.object(id(c, "poolRegistry")));
  args.push(tx.object(CLOCK));
  const out = tx.moveCall({
    target: target(c, "swap", sell ? "swap_x_to_y" : "swap_y_to_x"),
    typeArguments: [type, SUI],
    arguments: args,
  });
  tx.transferObjects([out], c.sender);
  return tx;
}
export async function addLiquidity(
  c: TxContext,
  poolId: string,
  type: string,
  x: bigint,
  y: bigint,
  expectedShares: bigint,
  bps: bigint,
) {
  const pool = await read(c, poolId, PoolSchema),
    q = liquidityQuote(
      x,
      y,
      BigInt(pool.reserve_x),
      BigInt(pool.reserve_y),
      BigInt(pool.total_shares),
    );
  const min = minimum(expectedShares, bps);
  if (q.shares < min || min <= 0n) throw new Error("Liquidity quote changed");
  await Promise.all([balance(c, type, x), balance(c, SUI, y)]);
  const tx = start(c);
  const [lp, changeX, changeY] = tx.moveCall({
    target: target(c, "swap", "add_liquidity"),
    typeArguments: [type, SUI],
    arguments: [
      tx.object(poolId),
      tx.coin({ type, balance: x }),
      tx.coin({ type: SUI, balance: y }),
      tx.pure.u128(min),
      tx.object(CLOCK),
    ],
  });
  tx.transferObjects([lp, changeX, changeY], c.sender);
  return tx;
}
export async function removeLiquidity(
  c: TxContext,
  poolId: string,
  type: string,
  lpId: string,
  expectedX: bigint,
  expectedGrossY: bigint,
  bps: bigint,
) {
  const [pool, lp] = await Promise.all([
    read(c, poolId, PoolSchema),
    read(c, lpId, LpSchema),
  ]);
  if (lp.pool !== poolId) throw new Error("LP does not belong to this pool");
  const q = removalQuote(
    BigInt(lp.shares),
    BigInt(pool.total_shares),
    BigInt(pool.reserve_x),
    BigInt(pool.reserve_y),
  );
  if (q.x < minimum(expectedX, bps) || q.grossY < minimum(expectedGrossY, bps))
    throw new Error("Redemption quote changed");
  const tx = start(c);
  const [x, y] = tx.moveCall({
    target: target(c, "swap", "remove_liquidity"),
    typeArguments: [type, SUI],
    arguments: [
      tx.object(poolId),
      tx.object(lpId),
      tx.pure.u64(minimum(expectedX, bps)),
      tx.pure.u64(minimum(expectedGrossY, bps)),
      tx.object(id(c, "poolRegistry")),
      tx.object(CLOCK),
    ],
  });
  tx.transferObjects([x, y], c.sender);
  return tx;
}
export async function adminInitialize(
  c: TxContext,
  capId: string,
  p: {
    fomo: boolean;
    countdown: bigint;
    price: bigint;
    pup: number;
    seed: bigint;
  },
) {
  if (
    p.countdown < 10000n ||
    p.countdown > 28800000n ||
    p.price < 1000n ||
    p.pup < 0 ||
    p.pup > 255 ||
    !Number.isInteger(p.pup)
  )
    throw new Error("Invalid initialization parameters");
  const { object: cap } = await c.client.getObject({ objectId: capId });
  if (
    cap.type !== `${c.packageId}::game::AdminCap` ||
    cap.owner.$kind !== "AddressOwner" ||
    cap.owner.AddressOwner !== c.sender
  )
    throw new Error("A valid owned AdminCap is required");
  const tx = start(c);
  if (p.fomo) {
    if (p.seed < 200000000000000n)
      throw new Error("FOMO seed must be at least 200,000 FOMO");
    await balance(c, c.fomoType, p.seed);
    tx.moveCall({
      target: target(c, "game", "init_FomoData_fomo3d"),
      arguments: [
        tx.object(capId),
        tx.object(id(c, "registry")),
        tx.object(id(c, "poolRegistry")),
        tx.coin({ type: c.fomoType, balance: p.seed }),
        tx.pure.u64(p.countdown),
        tx.pure.u64(p.price),
        tx.pure.u8(p.pup),
      ],
    });
  } else
    tx.moveCall({
      target: target(c, "game", "admin_init_FomoData"),
      typeArguments: [SUI],
      arguments: [
        tx.object(capId),
        tx.object(id(c, "registry")),
        tx.pure.u64(p.countdown),
        tx.pure.u64(p.price),
        tx.pure.u8(p.pup),
      ],
    });
  return tx;
}
