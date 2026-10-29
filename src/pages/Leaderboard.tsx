import { useState } from "react";
import { Trophy } from "lucide-react";
import { useProtocol } from "../hooks/useProtocol";
import { useI18n } from "../components/I18n";
import { PageTitle, TokenAmount, Empty } from "../components/Common";
import { Activity } from "../components/Activity";
import { SUI, explorer } from "../config/contracts";
import { short } from "../lib/sui/math";
export function Leaderboard() {
  const p = useProtocol(),
    { t } = useI18n(),
    [type, setType] = useState(SUI),
    [mode, setMode] = useState("total");
  const rounds = (p.history.data?.events || []).filter(
    (e) => e.name === "RoundSettled" && e.coinType === type,
  );
  const winners = new Map<
    string,
    { total: bigint; max: bigint; wins: number }
  >();
  for (const e of rounds) {
    const address = String(e.data.winner),
      n = BigInt(String(e.data.winner_amount)),
      old = winners.get(address) || { total: 0n, max: 0n, wins: 0 };
    winners.set(address, {
      total: old.total + n,
      max: n > old.max ? n : old.max,
      wins: old.wins + 1,
    });
  }
  const sorted = [...winners.entries()].sort((a, b) =>
    a[1][mode === "max" ? "max" : "total"] >
    b[1][mode === "max" ? "max" : "total"]
      ? -1
      : 1,
  );
  return (
    <>
      <PageTitle
        eyebrow={t("HALL OF FAME", "荣誉榜")}
        title={t(
          "The ones who held the last key.",
          "那些持有最后一把 Key 的人。",
        )}
        description={t(
          "Ranked by indexed settlements, separately for each token.",
          "按已索引结算排名，不同代币分别统计。",
        )}
      />
      <div className="filter-bar">
        <select
          aria-label="Leaderboard coin"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value={SUI}>SUI</option>
          {p.catalog.games
            .filter((g) => g.coinType !== SUI)
            .map((g) => (
              <option key={g.id} value={g.coinType}>
                {g.coinType.split("::").at(-1)}
              </option>
            ))}
        </select>
        <select
          aria-label="Ranking"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="total">{t("Cumulative winnings", "累计奖金")}</option>
          <option value="max">{t("Largest single win", "单次最大奖金")}</option>
        </select>
      </div>
      <section className="panel">
        {!sorted.length ? (
          <Empty title={t("The podium is waiting.", "领奖台，虚位以待。")}>
            {t(
              "No settled rounds for this token in the available index.",
              "可用索引中暂无此代币已结算轮次。",
            )}
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t("Player", "玩家")}</th>
                  <th>{t("Wins", "中奖次数")}</th>
                  <th>{t("Total awarded", "累计奖金")}</th>
                  <th>{t("Largest win", "最大奖金")}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(([address, v], i) => (
                  <tr key={address}>
                    <td>
                      {i === 0 ? (
                        <Trophy className="accent" size={18} />
                      ) : (
                        i + 1
                      )}
                    </td>
                    <td>
                      <a
                        href={explorer(p.config.network, "account", address)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {short(address)}
                      </a>
                    </td>
                    <td>{v.wins}</td>
                    <td>
                      <TokenAmount amount={v.total} type={type} />
                    </td>
                    <td>
                      <TokenAmount amount={v.max} type={type} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Activity
        names={["RoundSettled"]}
        title={t("Recent winners", "最近赢家")}
      />
    </>
  );
}
