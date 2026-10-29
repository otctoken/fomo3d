import { Link, useParams } from "react-router-dom";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { KeyRound, ArrowLeft, Trophy } from "lucide-react";
import { useProtocol, useMetadata, useChainTime } from "../hooks/useProtocol";
import {
  PageTitle,
  Empty,
  Countdown,
  TokenAmount,
  TokenIcon,
  Stat,
  Balance,
} from "../components/Common";
import { Activity } from "../components/Activity";
import { useI18n } from "../components/I18n";
import { useTransaction } from "../components/Transactions";
import { SUI, explorer } from "../config/contracts";
import {
  keyPrice,
  keyReward,
  formatAmount,
  gameStatus,
  short,
} from "../lib/sui/math";
import { buyKey, settle } from "../lib/transactions/builders";
export function GamePage() {
  const { id } = useParams(),
    p = useProtocol(),
    chainTime = useChainTime(),
    { t } = useI18n(),
    tx = useTransaction(),
    account = useCurrentAccount();
  const game = p.data?.games.find((g) =>
    id === "sui" ? g.coinType === SUI : g.id === id,
  );
  const meta = useMetadata(game?.coinType || SUI);
  if (!game)
    return (
      <>
        <PageTitle
          eyebrow="SUI GAME"
          title={t("The next round starts here.", "下一轮，从这里开始。")}
        />
        <section className="panel">
          <Empty
            title={
              p.isLoading
                ? t("Reading game objects…", "读取游戏对象…")
                : p.isError
                  ? t("Game data unavailable", "暂时无法读取游戏数据")
                  : t("Game not found", "未找到游戏")
            }
          >
            {p.isLoading
              ? t(
                  "Loading the current network’s game state.",
                  "正在加载当前网络的游戏状态。",
                )
              : p.isError
                ? t(
                    "Check your connection and selected network, then retry.",
                    "请检查网络连接及所选网络后重试。",
                  )
                : id === "sui"
                  ? t(
                      "No main SUI game object has been discovered. An AdminCap holder must initialize it before the ICO can accept contributions.",
                      "尚未发现主 SUI 游戏对象，AdminCap 持有者需先初始化，ICO 才可认购。",
                    )
                  : t(
                      "This game is not in the available event index. Check the network and indexer configuration.",
                      "当前事件索引中没有此游戏，请检查网络和索引配置。",
                    )}
          </Empty>
          <Link className="button secondary" to="/games">
            {t("Back to games", "返回游戏列表")}
          </Link>
        </section>
      </>
    );
  const price = keyPrice(
      BigInt(game.total_keys),
      BigInt(game.initial_price),
      BigInt(game.price_update_percentage),
    ),
    state = gameStatus(
      BigInt(game.maturity),
      BigInt(p.data?.clock?.timestamp_ms || 0),
    ),
    pool = p.catalog.pools.find((v) => v.coinType === game.coinType);
  const minter = p.data?.minter,
    halving = p.data?.halving;
  const nextReward =
    game.coinType === SUI && minter && halving
      ? keyReward(
          price,
          BigInt(minter.cap.total_supply.value),
          BigInt(minter.total_burned),
          BigInt(halving.remaining),
          BigInt(halving.halved),
        )
      : undefined;
  const events = p.history.data?.events || [],
    myKeys = events.filter(
      (e) =>
        e.name === "KeyPurchased" &&
        e.data.game_id === game.id &&
        e.data.buyer === account?.address,
    );
  const rewards = events
    .filter(
      (e) =>
        e.name === "MintProcessed" &&
        e.data.kind === 0 &&
        e.data.recipient === account?.address &&
        myKeys.some((k) => k.digest === e.digest),
    )
    .reduce((a, e) => a + BigInt(String(e.data.actual_minted)), 0n);
  return (
    <>
      <Link to="/games" className="back-link">
        <ArrowLeft size={14} />
        {t("All games", "所有游戏")}
      </Link>
      <PageTitle
        eyebrow={`${meta.data?.symbol || "TOKEN"} ARENA`}
        title={t("The last key wins.", "最后一把 Key，赢得奖池。")}
        action={
          <span className={"badge " + (state === "Live" ? "green" : "")}>
            {state === "Waiting"
              ? t("Waiting", "等待开局")
              : state === "Live"
                ? t("Live", "进行中")
                : t("Settlement Available", "可结算")}
          </span>
        }
      />
      <div className="game-detail-grid">
        <section className="jackpot-hero detail">
          <div className="hero-top">
            <div className="token-title">
              <TokenIcon type={game.coinType} />
              <h3>{meta.data?.symbol || game.coinType.split("::").at(-1)}</h3>
            </div>
            <span>
              {t("Round", "轮次")} #{game.round_id}
            </span>
          </div>
          <p className="small-label">{t("CURRENT JACKPOT", "当前奖池")}</p>
          <div className="jackpot-number smaller">
            <TokenAmount amount={game.balance} type={game.coinType} />
          </div>
          <Countdown game={game} large />
          <div className="summary-row">
            <span>{t("Last key holder", "最后 Key 持有者")}</span>
            <a
              href={explorer(p.config.network, "account", game.address1)}
              target="_blank"
              rel="noreferrer"
            >
              {game.total_keys === "0" ? "—" : short(game.address1)}
            </a>
          </div>
          <div
            className={`stats-grid compact${game.coinType === SUI ? " sui-payouts" : ""}`}
          >
            <Stat
              label={t("Winner · 65%", "赢家 · 65%")}
              value={
                <TokenAmount
                  amount={(BigInt(game.balance) * 65n) / 100n}
                  type={game.coinType}
                />
              }
            />
            <Stat
              label={t("Next round · ~30%", "下一轮 · 约 30%")}
              value={
                <TokenAmount
                  amount={
                    BigInt(game.balance) -
                    (BigInt(game.balance) * 65n) / 100n -
                    (BigInt(game.balance) *
                      (game.coinType === SUI ||
                      game.coinType === p.config.fomoType
                        ? 5n
                        : 2n)) /
                      100n -
                    (game.coinType !== SUI &&
                    game.coinType !== p.config.fomoType
                      ? (BigInt(game.balance) * 3n) / 100n
                      : 0n)
                  }
                  type={game.coinType}
                />
              }
            />
            {game.coinType === SUI && (
              <Stat
                label={t("FOMO3D buyback & burn · 5%", "回购销毁 FOMO3D · 5%")}
                value={
                  <TokenAmount
                    amount={(BigInt(game.balance) * 5n) / 100n}
                    type={SUI}
                  />
                }
              />
            )}
          </div>
        </section>
        <section className="panel buy-panel">
          <KeyRound className="accent" />
          <h2>
            {state === "Settlement Available"
              ? t("Close this round.", "结算这一轮。")
              : t("Make your move.", "轮到你出手。")}
          </h2>
          <p className="muted">
            {t(
              "One key. A fresh countdown. A chance at the pool.",
              "一把 Key，重置倒计时，参与奖池争夺。",
            )}
          </p>
          <div className="price-display">
            <span>{t("NEXT KEY PRICE", "下一把 KEY 价格")}</span>
            <strong>
              <TokenAmount amount={price} type={game.coinType} precision={9} />
            </strong>
          </div>
          <Balance type={game.coinType} />
          <div className="key-details">
            <div className="summary-row">
              <span>{t("Linear increment / key", "每把线性增加")}</span>
              <strong>
                <TokenAmount
                  amount={
                    (BigInt(game.initial_price) *
                      BigInt(game.price_update_percentage)) /
                    1000n
                  }
                  type={game.coinType}
                  precision={9}
                />
              </strong>
            </div>
            <div className="summary-row">
              <span>{t("Timer reset", "计时重置")}</span>
              <strong>{BigInt(game.countdown) / 1000n + ""}s</strong>
            </div>
            <div className="summary-row">
              <span>{t("Keys this round", "本轮已购 Key")}</span>
              <strong>{game.total_keys}</strong>
            </div>
            {game.coinType === SUI && (
              <div className="summary-row">
                <span>{t("Estimated key reward", "购买 Key 预计奖励")}</span>
                <strong>{formatAmount(nextReward, 9, 9)} FOMO3D</strong>
              </div>
            )}
          </div>
          <button
            className="button primary full"
            disabled={
              !account ||
              tx.busy ||
              chainTime.stale ||
              p.data?.registry?.version !== "1" ||
              (game.coinType === SUI && !p.data?.icoReady) ||
              !!p.error
            }
            onClick={() =>
              tx.request(
                state === "Settlement Available"
                  ? {
                      label: t("Settle round", "结算轮次"),
                      details: t(
                        "The last buyer receives the winner payout. Anyone may trigger settlement.",
                        "赢家奖金发给最后购买者，任何人均可触发结算。",
                      ),
                      build: (c) => settle(c, game.id, game.coinType, pool?.id),
                    }
                  : {
                      label: t("Buy one key", "购买一把 Key"),
                      details: `${price} raw ${meta.data?.symbol || "token"} · ${t("Exact price; refresh required if it changes.", "精确价格，变化时需刷新。")}`,
                      build: (c) => buyKey(c, game.id, game.coinType, price),
                    },
              )
            }
          >
            {state === "Settlement Available" ? (
              <Trophy size={17} />
            ) : (
              <KeyRound size={17} />
            )}{" "}
            {state === "Settlement Available"
              ? t("Settle round", "结算轮次")
              : t("Buy key", "购买 Key")}
          </button>
          {!account && (
            <p className="note">
              {t("Connect your wallet to continue.", "连接钱包后继续。")}
            </p>
          )}
          {p.data?.registry?.version !== "1" && (
            <p className="warning">
              {t(
                "Trading automatically opens once the ICO is complete.",
                "ICO完成后自动开放购买。",
              )}
            </p>
          )}
          <p className="note">
            {t(
              "Gas is estimated in the review dialog before signing.",
              "签名前的确认窗口将显示 Gas 预估。",
            )}
          </p>
        </section>
      </div>
      <div className="stats-grid">
        <Stat
          label={t("Pending buyback", "待回购资金")}
          value={
            <TokenAmount amount={game.pending_buyback} type={game.coinType} />
          }
        />
        <Stat
          label={
            game.coinType === p.config.fomoType
              ? t("Direct burn · 5%", "直接销毁 · 5%")
              : t("Buyback allocation", "回购份额")
          }
          value={
            <TokenAmount
              amount={
                (BigInt(game.balance) *
                  (game.coinType === SUI || game.coinType === p.config.fomoType
                    ? 5n
                    : 2n)) /
                100n
              }
              type={game.coinType}
            />
          }
        />
        <Stat
          label={t("My indexed keys", "我已索引的 Key")}
          value={account ? myKeys.length : "—"}
        />
        <Stat
          label={t("My game rewards", "我的游戏奖励")}
          value={
            <TokenAmount
              amount={account ? rewards : undefined}
              type={p.config.fomoType}
            />
          }
        />
      </div>
      {game.coinType !== SUI && game.coinType !== p.config.fomoType && (
        <div className="notice">
          {t(
            "65% winner · 30% next round · 2% buyback · 3% Blackhole Transfer to 0x0. A transfer does not guarantee that the token’s total supply decreases.",
            "65% 赢家 · 30% 下一轮 · 2% 回购 · 3% 转入 0x0 黑洞地址。黑洞转账不保证第三方代币总供应量减少。",
          )}
        </div>
      )}
      <p className="small-code">
        {game.coinType}
        <br />
        <a
          href={explorer(p.config.network, "object", game.id)}
          target="_blank"
          rel="noreferrer"
        >
          Game: {game.id}
        </a>
      </p>
      <div className="two-columns">
        <Activity
          names={["KeyPurchased"]}
          gameId={game.id}
          title={t("Recent keys", "最近购买")}
        />
        <Activity
          names={["RoundSettled", "BuybackExecuted", "BuybackSkipped"]}
          gameId={game.id}
          title={t("Settlements & buybacks", "结算与回购")}
        />
      </div>
      <Activity
        names={["KeyPurchased", "RoundSettled"]}
        gameId={game.id}
        mine
        title={t("My participation", "我的参与记录")}
      />
    </>
  );
}
