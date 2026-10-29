import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useProtocol } from "../hooks/useProtocol";
import {
  PageTitle,
  GameCard,
  GamePagination,
  Empty,
} from "../components/Common";
import { useI18n } from "../components/I18n";
import { gameStatus } from "../lib/sui/math";
export function Games() {
  const p = useProtocol(),
    { t } = useI18n(),
    [params, setParams] = useSearchParams(),
    [search, setSearch] = useState(params.get("q") || ""),
    [status, setStatus] = useState("all"),
    [sort, setSort] = useState("recent");
  const urlSearch = params.get("q") || "";
  useEffect(() => setSearch(urlSearch), [urlSearch]);
  useEffect(() => {
    if (search === (params.get("q") || "")) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params);
      next.set("q", search);
      next.delete("page");
      setParams(next, { replace: true });
    }, 350);
    return () => clearTimeout(timer);
  }, [search, params, setParams]);
  const games = (p.data?.games || []).filter(
    (g) =>
      status === "all" ||
      gameStatus(
        BigInt(g.maturity),
        BigInt(p.data?.clock?.timestamp_ms || 0),
      ) === status,
  );
  if (sort === "pool")
    games.sort(
      (a, b) =>
        a.coinType.localeCompare(b.coinType) ||
        (BigInt(a.balance) > BigInt(b.balance) ? -1 : 1),
    );
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
          <option value="all">
            {t("All states · this page", "本页全部状态")}
          </option>
          <option value="Waiting">{t("Waiting", "等待开局")}</option>
          <option value="Live">{t("Live", "进行中")}</option>
          <option value="Settlement Available">
            {t("Settlement Available", "可结算")}
          </option>
        </select>
        <select
          aria-label="Sort"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="recent">{t("Newest first", "最新创建")}</option>
          <option value="pool">
            {t(
              "Pool size (this page, within token)",
              "本页奖池大小（同币种内）",
            )}
          </option>
        </select>
      </div>
      <p className="note">
        {t(
          "Search covers the indexed directory. Live state is loaded for up to 12 games per page; status and pool sorting apply to this page.",
          "搜索覆盖已索引目录，每页最多读取 12 个游戏的实时状态；状态筛选和奖池排序仅作用于本页。",
        )}
      </p>
      {p.isLoading && (
        <p className="muted">
          {t("Loading game states…", "正在读取游戏状态…")}
        </p>
      )}
      <div className="games-grid">
        {games.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </div>
      {!games.length && !p.isLoading && (
        <Empty title={t("No matching games discovered", "未发现匹配的游戏")}>
          {t(
            "Games are discovered from GameCreated events. No demo games are inserted.",
            "游戏来自 GameCreated 事件，不插入模拟游戏。",
          )}
        </Empty>
      )}
      <GamePagination />
    </>
  );
}
