import { describe, expect, it } from "vitest";
import { filterPools } from "../src/lib/poolSearch";

const pools = [
  { id: "0x0000123", coinType: "0x00000abc::coin::CAT" },
  { id: "0x0000456", coinType: "0x00000def::coin::DOG" },
];
const names = { [pools[0].coinType]: { name: "星际猫 Cat", symbol: "KITTY" } };
describe("Pool directory search", () => {
  it.each([
    "星际猫",
    "cat",
    " kItTy ",
    "0xabc",
    "0x00000abc::coin::CAT",
    "0x123",
  ])("finds names, symbols and addresses: %s", (query) => {
    expect(filterPools(pools, query, names)).toEqual([pools[0]]);
  });
  it("keeps coins searchable without metadata and handles empty results", () => {
    expect(filterPools(pools, "dog", names)).toEqual([pools[1]]);
    expect(filterPools(pools, "missing", names)).toEqual([]);
    expect(filterPools(pools, " ", names)).toEqual(pools);
  });
});
