import { useCurrentAccount, useCurrentNetwork } from "@mysten/dapp-kit-react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { Link } from "react-router-dom";
import {
  useProtocol,
  useBalance,
  useOwned,
  useEntitlement,
} from "../hooks/useProtocol";
import { useI18n } from "../components/I18n";
import { PageTitle, Stat, Empty, GameCard } from "../components/Common";
import { Activity } from "../components/Activity";
import { SUI, explorer } from "../config/contracts";
import { formatAmount, short } from "../lib/sui/math";
export function Account() {
  const account = useCurrentAccount(),
    network = useCurrentNetwork(),
    p = useProtocol(),
    sui = useBalance(SUI),
    fomo = useBalance(p.config.fomoType),
    owned = useOwned(),
    entitlement = useEntitlement(),
    { t } = useI18n();
  let recent: { digest: string; label: string; time: number }[] = [];
  try {
    recent = JSON.parse(
      localStorage.getItem(`fomo-txs:${network}:${account?.address}`) || "[]",
    );
  } catch {
    /* Invalid local cache is ignored. */
  }
  return (
    <>
      <PageTitle
        eyebrow={t("YOUR CORNER OF THE CHAIN", "你的链上空间")}
        title={t("My account", "我的账户")}
        description={account?.address}
      />
      {!account ? (
        <section className="panel">
          <Empty
            title={t("Your wallet is your account.", "钱包就是你的账户。")}
          >
            {t(
              "Connect to view balances, positions, and participation.",
              "连接钱包查看余额、仓位与参与记录。",
            )}
          </Empty>
          <div className="center">
            <ConnectButton>{t("Connect Wallet", "连接钱包")}</ConnectButton>
          </div>
        </section>
      ) : (
        <>
          <div className="stats-grid">
            <Stat label="SUI" value={formatAmount(sui.data)} />
            <Stat label="FOMO3D" value={formatAmount(fomo.data)} />
            <Stat
              label={t("Unclaimed ICO", "待领取 ICO")}
              value={formatAmount(entitlement.data)}
            />
            <Stat
              label={t("LP positions", "LP 仓位")}
              value={owned.data?.lps.length ?? "—"}
            />
          </div>
          <div className="section-heading">
            <h2>{t("My games", "我创建的游戏")}</h2>
            <Link className="text-link" to="/create">
              {t("Create game", "创建游戏")} ↗
            </Link>
          </div>
          <div className="games-grid">
            {p.data?.games
              .filter((g) => g.creator === account.address)
              .map((g) => (
                <GameCard key={g.id} game={g} />
              ))}
          </div>
          {!p.data?.games.some((g) => g.creator === account.address) && (
            <p className="muted">
              {t(
                "No created games in the available index.",
                "可用索引中没有你创建的游戏。",
              )}
            </p>
          )}
          <section className="panel">
            <div className="section-heading">
              <h3>{t("My LP objects", "我的 LP 对象")}</h3>
              <Link to="/fomo?tab=liquidity" className="text-link">
                {t("Manage liquidity", "管理流动性")} ↗
              </Link>
            </div>
            {owned.data?.lps.map((lp) => (
              <div key={lp.id} className="summary-row">
                <a
                  href={explorer(network, "object", lp.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {short(lp.id)}
                </a>
                <span>
                  {lp.shares} shares · {short(lp.pool)}
                </span>
              </div>
            ))}
            {!owned.data?.lps.length && (
              <p className="muted">
                {t("No LP objects owned.", "未持有 LP 对象。")}
              </p>
            )}
          </section>
          <div className="two-columns">
            <Activity
              names={["KeyPurchased", "RoundSettled"]}
              mine
              title={t("My keys & wins", "我的 Key 与中奖")}
            />
            <Activity
              names={[
                "IcoContributed",
                "IcoRefunded",
                "IcoClaimProcessed",
                "SwapExecuted",
                "LiquidityAdded",
                "LiquidityRemoved",
              ]}
              mine
              title={t("My token activity", "我的代币记录")}
            />
          </div>
          <section className="panel">
            <h3>
              {t("Confirmed transactions on this device", "本设备已确认交易")}
            </h3>
            {recent.map((r) => (
              <div className="summary-row" key={r.digest}>
                <span>{r.label}</span>
                <a
                  href={explorer(network, "tx", r.digest)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {short(r.digest)} ↗
                </a>
              </div>
            ))}
            {!recent.length && (
              <p className="muted">
                {t(
                  "No locally recorded confirmations. Full available activity is shown above.",
                  "暂无本设备确认记录，可用链上活动显示在上方。",
                )}
              </p>
            )}
          </section>
        </>
      )}
    </>
  );
}
