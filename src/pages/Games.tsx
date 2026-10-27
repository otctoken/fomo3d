import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useProtocol } from "../hooks/useProtocol";
import { PageTitle, GameCard, Empty } from "../components/Common";
import { useI18n } from "../components/I18n";
import { gameStatus } from "../lib/sui/math";
export function Games() {
  const p = useProtocol(),
    { t } = useI18n(),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [sort, setSort] = useState("recent");
  const games = (p.data?.games || []).filter(
    (g) =>
      g.coinType.toLowerCase().includes(search.toLowerCase()) &&
      (status === "all" ||
        gameStatus(
          BigInt(g.maturity),
          BigInt(p.data?.clock?.timestamp_ms || 0),
        ) === status),
  );
  if (sort === "pool")
    games.sort(
      (a, b) =>
        a.coinType.localeCompare(b.coinType) ||
        (BigInt(a.balance) > BigInt(b.balance) ? -1 : 1),
    );
  else games.reverse();
  return (
    <>
      <PageTitle
        eyebrow={t("THE ARENAS", "游戏大厅")}
        title={t("Find your next move.", "寻找下一步。")}
        description={t(
          "Every arena is a shared Sui object. Explore the community’s games.",
          "每个游戏都是 Sui 共享对象，探索社区创建的游戏。",
        )}
        action={
          <Link to="/create" className="button primary">
            <Plus size={17} />
            {t("Create game", "创建游戏")}
          </Link>
        }
      />
      <div className="filter-bar">
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Search token"
            placeholder={t(
              "Search token or Coin Type…",
              "搜索代币或 Coin Type…",
            )}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">{t("All states", "全部状态")}</option>
          <option value="Waiting">Waiting</option>
          <option value="Live">Live</option>
          <option value="Settlement Available">Settlement Available</option>
        </select>
        <select
          aria-label="Sort"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="recent">{t("Newest first", "最新创建")}</option>
          <option value="pool">
            {t("Pool size (within token)", "奖池大小（同币种内）")}
          </option>
        </select>
      </div>
      <div className="games-grid">
        {games.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </div>
      {!games.length && (
        <Empty title={t("No matching games discovered", "未发现匹配的游戏")}>
          {t(
            "Games are discovered from GameCreated events. No demo games are inserted.",
            "游戏来自 GameCreated 事件，不插入模拟游戏。",
          )}
        </Empty>
      )}
    </>
  );
}
