import { describe, expect, it } from "vitest";
import { buildCatalog, pagePlan, type Catalog } from "../src/lib/sui/queryPlan";
import { SUI } from "../src/config/contracts";
import type { ChainEvent } from "../src/lib/events";

const catalog: Catalog = {
  games: [
    { id: "main", coinType: SUI, creator: "admin" },
    ...Array.from({ length: 1000 }, (_, i) => ({
      id: `game-${i}`,
      coinType: `0x1::coin::T${i}`,
      creator: i % 2 ? "alice" : "bob",
    })),
  ],
  pools: [
    { id: "fomo-pool", coinType: "0x1::fomo3d::FOMO3D" },
    ...Array.from({ length: 1000 }, (_, i) => ({
      id: `pool-${i}`,
      coinType: `0x1::coin::T${i}`,
    })),
  ],
};

describe("page-specific RPC scope with a large directory", () => {
  it("loads just the SUI game and its opening gates, with no pools or token supply reads", () => {
    const p = pagePlan("/game/sui", "", catalog);
    expect(p.games.map((g) => g.id)).toEqual(["main"]);
    expect(p.pools).toEqual([]);
    expect([p.registry, p.ico, p.clock]).toEqual([true, true, true]);
    expect([p.claims, p.minter, p.halving]).toEqual([false, false, false]);
  });
  it("isolates a community game's state and does not query the ICO", () => {
    const p = pagePlan("/game/game-231", "", catalog);
    expect(p.games.map((g) => g.id)).toEqual(["game-231"]);
    expect(p.pools).toEqual([]);
    expect(p.ico).toBe(false);
  });
  it("limits home reads to the main game and the three displayed community cards", () => {
    const p = pagePlan("/", "", catalog);
    expect(p.games).toHaveLength(4);
    expect(p.pools).toHaveLength(0);
  });
  it("loads only the selected market pool, then changes scope when selection changes", () => {
    for (const id of ["pool-24", "pool-881"]) {
      const p = pagePlan("/fomo", `?tab=liquidity&pool=${id}`, catalog);
      expect(p.pools.map((v) => v.id)).toEqual([id]);
      expect(p.games).toEqual([]);
      expect([p.clock, p.ico, p.minter, p.halving]).toEqual([
        false,
        false,
        false,
        false,
      ]);
    }
    expect(pagePlan("/fomo", "", catalog).pools[0].id).toBe("fomo-pool");
  });
  it("stops pool queries when moving from market to token or claim tabs", () => {
    const token = pagePlan("/fomo", "?tab=token&pool=pool-24", catalog);
    expect(token.pools).toEqual([]);
    expect([token.minter, token.halving]).toEqual([true, true]);
    const claim = pagePlan("/fomo", "?tab=claim", catalog, "alice");
    expect(claim.pools).toEqual([]);
    expect([claim.ico, claim.registry, claim.claims]).toEqual([
      true,
      true,
      true,
    ]);
    expect(claim.games).toEqual([]);
  });
  it("paginates before loading objects and never loads an off-page game", () => {
    const first = pagePlan("/games", "", catalog);
    const second = pagePlan("/games", "?page=2", catalog);
    expect(first.games).toHaveLength(12);
    expect(second.games).toHaveLength(12);
    expect(
      second.games.some((g) => first.games.some((f) => f.id === g.id)),
    ).toBe(false);
    expect(first.matchingGames).toBe(1001);
    expect(first.pools).toEqual([]);
  });
  it("searches directory metadata before choosing which game objects to load", () => {
    const p = pagePlan("/games", "?q=game-999", catalog);
    expect(p.games.map((g) => g.id)).toEqual(["game-999"]);
    expect(p.matchingGames).toBe(1);
  });
  it.each(["-1", "NaN", "Infinity", "1.5"])(
    "handles invalid page %s",
    (page) => {
      expect(pagePlan("/games", `?page=${page}`, catalog).page).toBe(1);
    },
  );
  it("clamps pages after the directory shrinks", () => {
    const p = pagePlan("/games", "?page=99999", catalog);
    expect(p.page).toBe(p.totalPages);
    expect(p.games.length).toBeGreaterThan(0);
  });
  it("only reads the connected account's displayed games", () => {
    const p = pagePlan("/account", "", catalog, "alice");
    expect(p.games).toHaveLength(12);
    expect(p.games.every((g) => g.creator === "alice")).toBe(true);
    expect(p.matchingGames).toBe(500);
    expect(p.pools).toEqual([]);
    const disconnected = pagePlan("/account", "", catalog);
    expect(disconnected.games).toEqual([]);
    expect(disconnected.history).toBe(false);
  });
  it("does not fetch game or pool objects for leaderboard, admin, create or docs", () => {
    for (const path of [
      "/leaderboard",
      "/admin",
      "/create",
      "/docs",
      "/rules",
    ]) {
      const p = pagePlan(path, "", catalog, "admin");
      expect(p.games).toEqual([]);
      expect(p.pools).toEqual([]);
      expect(p.clock).toBe(false);
    }
    expect(pagePlan("/docs", "", catalog).history).toBe(false);
    expect(pagePlan("/rules", "", catalog).history).toBe(false);
  });
  it("preserves directory metadata without fetching objects; deduplicates configured IDs", () => {
    const events: ChainEvent[] = [
      {
        id: "event",
        type: "GameCreated",
        digest: "tx",
        checkpoint: "1",
        index: 0,
        name: "GameCreated",
        coinType: SUI,
        data: { game_id: "main", creator: "alice" },
      },
    ];
    const result = buildCatalog(
      events,
      { mainGame: "main", fomoPool: "fomo-pool" },
      "FOMO",
    );
    expect(result.games).toEqual([
      { id: "main", coinType: SUI, creator: "alice" },
    ]);
    expect(result.pools).toEqual([{ id: "fomo-pool", coinType: "FOMO" }]);
  });
});
