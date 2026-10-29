import { SUI, type ObjectIds } from "../../config/contracts";
import type { ChainEvent } from "../events";

export type GameEntry = { id: string; coinType: string; creator: string };
export type PoolEntry = { id: string; coinType: string };
export type Catalog = { games: GameEntry[]; pools: PoolEntry[] };
export const GAME_PAGE_SIZE = 12;

export function buildCatalog(
  events: ChainEvent[],
  ids: ObjectIds,
  fomoType: string,
): Catalog {
  const games = new Map<string, GameEntry>();
  const pools = new Map<string, PoolEntry>();
  for (const e of events) {
    if (e.name === "GameCreated" && e.coinType) {
      const id = String(e.data.game_id);
      games.set(id, {
        id,
        coinType: e.coinType,
        creator: String(e.data.creator),
      });
    }
    if (e.name === "PoolCreated" && e.coinType) {
      const id = String(e.data.pool_id);
      pools.set(id, { id, coinType: e.coinType });
    }
  }
  if (ids.mainGame && !games.has(ids.mainGame))
    games.set(ids.mainGame, { id: ids.mainGame, coinType: SUI, creator: "" });
  if (ids.fomoPool && !pools.has(ids.fomoPool))
    pools.set(ids.fomoPool, { id: ids.fomoPool, coinType: fomoType });
  return { games: [...games.values()], pools: [...pools.values()] };
}

export function pagePlan(
  path: string,
  search: string,
  catalog: Catalog,
  address?: string,
  fomoType?: string,
) {
  const params = new URLSearchParams(search);
  const tab = params.get("tab") || "swap";
  const home = path === "/";
  const detail = path.startsWith("/game/");
  const market =
    path === "/swap" || (path === "/fomo" && !["token", "claim"].includes(tab));
  const ico = path === "/ico" || (path === "/fomo" && tab === "claim");
  const account = path === "/account" && !!address;
  const token = path === "/fomo" && tab === "token";
  let games: GameEntry[] = [];
  let page = 1,
    totalPages = 1,
    matchingGames = 0;
  if (home)
    games = [
      ...catalog.games.filter((g) => g.coinType === SUI).slice(0, 1),
      ...catalog.games.filter((g) => g.coinType !== SUI).slice(0, 3),
    ];
  if (detail) {
    const id = decodeURIComponent(path.slice("/game/".length));
    games = catalog.games
      .filter((g) => (id === "sui" ? g.coinType === SUI : g.id === id))
      .slice(0, 1);
  }
  if (path === "/games" || account) {
    const term = (params.get("q") || "").toLowerCase();
    const matches = catalog.games
      .filter((g) =>
        account
          ? g.creator === address
          : g.coinType.toLowerCase().includes(term) ||
            g.id.toLowerCase().includes(term),
      )
      .reverse();
    matchingGames = matches.length;
    totalPages = Math.max(1, Math.ceil(matches.length / GAME_PAGE_SIZE));
    const requested = Number(params.get("page"));
    page = Number.isSafeInteger(requested)
      ? Math.max(1, Math.min(totalPages, requested))
      : 1;
    games = matches.slice((page - 1) * GAME_PAGE_SIZE, page * GAME_PAGE_SIZE);
  }
  const isFomo = (pool: PoolEntry) =>
    fomoType
      ? pool.coinType === fomoType
      : pool.coinType.endsWith("::fomo3d::FOMO3D");
  const selectedPool = !market
    ? undefined
    : path === "/fomo"
      ? catalog.pools.find(isFomo)
      : catalog.pools.find((p) => p.id === params.get("pool")) ||
        catalog.pools.find((p) => !isFomo(p)) ||
        catalog.pools[0];
  const suiDetail = detail && games.some((g) => g.coinType === SUI);
  return {
    games,
    pools: selectedPool ? [selectedPool] : [],
    page,
    totalPages,
    matchingGames,
    detail,
    clock: games.length > 0,
    registry: home || detail || ico || (path === "/admin" && !!address),
    ico: home || ico || (detail && games.some((g) => g.coinType === SUI)),
    claims: !!address && (ico || account),
    minter: home || token || suiDetail,
    halving: token || path === "/docs" || suiDetail,
    history:
      !["/rules", "/docs"].includes(path) && (path !== "/account" || !!address),
    gameInterval: detail ? 3000 : 15000,
  };
}
