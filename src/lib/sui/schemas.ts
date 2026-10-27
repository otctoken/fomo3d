import { bcs } from "@mysten/sui/bcs";
const ID = bcs.Address;
export const GameSchema = bcs.struct("FomoData", {
  id: ID,
  balance: bcs.u64(),
  pending_buyback: bcs.u64(),
  address1: ID,
  countdown: bcs.u64(),
  maturity: bcs.u64(),
  initial_price: bcs.u64(),
  price_update_percentage: bcs.u8(),
  total_keys: bcs.u64(),
  round_id: bcs.u64(),
});
export const RegistrySchema = bcs.struct("Registry", {
  id: ID,
  admin: ID,
  version: bcs.u64(),
});
export const IcoSchema = bcs.struct("Ico", {
  id: ID,
  hardCap: bcs.u64(),
  boo: bcs.bool(),
});
export const ClaimsSchema = bcs.struct("GetIcoCoin", {
  id: ID,
  get: bcs.struct("Table", { id: ID, size: bcs.u64() }),
});
export const MinterSchema = bcs.struct("Minter", {
  id: ID,
  cap: bcs.struct("TreasuryCap", {
    id: ID,
    total_supply: bcs.struct("Supply", { value: bcs.u64() }),
  }),
  total_burned: bcs.u64(),
});
export const HalvingSchema = bcs.struct("Halving_cycle", {
  id: ID,
  current: bcs.u64(),
  remaining: bcs.u64(),
  halved: bcs.u64(),
});
export const PoolSchema = bcs.struct("Pool", {
  id: ID,
  reserve_x: bcs.u64(),
  reserve_y: bcs.u64(),
  total_shares: bcs.u128(),
  buytime: bcs.u64(),
  selltime: bcs.u64(),
  addtime: bcs.u64(),
  removetime: bcs.u64(),
});
export const LpSchema = bcs.struct("LP", {
  id: ID,
  pool: ID,
  shares: bcs.u128(),
});
export const ClockSchema = bcs.struct("Clock", {
  id: ID,
  timestamp_ms: bcs.u64(),
});
export type Game = ReturnType<typeof GameSchema.parse> & {
  coinType: string;
  creator?: string;
};
export type Pool = ReturnType<typeof PoolSchema.parse> & { coinType: string };
