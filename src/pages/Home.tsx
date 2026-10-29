import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  KeyRound,
  Plus,
  Sparkles,
  ShieldCheck,
  Flame,
  Layers3,
} from "lucide-react";
import { useProtocol } from "../hooks/useProtocol";
import { useI18n } from "../components/I18n";
import { Stat, GameCard, Countdown, TokenAmount } from "../components/Common";
import { Activity } from "../components/Activity";
import { SUI, ICO_CAP } from "../config/contracts";
import { formatAmount, icoReady } from "../lib/sui/math";
export function Home() {
  const p = useProtocol(),
    { t } = useI18n();
  const game = p.data?.games.find((g) => g.coinType === SUI),
    events = p.history.data?.events || [];
  const settled = events
    .filter((e) => e.name === "RoundSettled" && e.coinType === SUI)
    .reduce((sum, e) => sum + BigInt(String(e.data.winner_amount)), 0n);
  const ready = p.data?.icoReady && !!game;
  const raised = p.data?.ico ? ICO_CAP - BigInt(p.data.ico.hardCap) : undefined;
  return (
    <>
      <div className="home-intro">
        <div>
          <p className="eyebrow">
            <span className="dot" />
            {t("THE ON-CHAIN ENDGAME ON SUI", "SuiNetwork链上终局游戏")}
          </p>
          <h1>
            {t("One more key.", "再买一把 Key。")}
            <br />
            <span>{t("One last winner.", "最后一位，赢得奖池。")}</span>
          </h1>
          <p>
            {t(
              "A game of timing. A pool that grows. The last key takes the crown.",
              "一场关于时机的游戏。不断增长的奖池，属于最后购买 Key 的玩家。",
            )}
          </p>
        </div>
        <Link to="/games" className="button secondary">
          {t("Explore games", "探索游戏")}
          <ArrowUpRight size={17} />
        </Link>
      </div>
      <div className="hero-grid">
        <section className="jackpot-hero">
          <div className="hero-orbit" aria-hidden="true">
            <div className="orbit-ring" />
            <div className="orbit-ring two" />
            <KeyRound className="hero-key" />
          </div>
          <div className="hero-top">
            <span className="badge gold">
              <Sparkles size={12} />
              {t("THE MAIN EVENT", "主游戏")}
            </span>
            <span className="hero-network">
              SUI GAME <span className="dot" />
            </span>
          </div>
          <div className="hero-body">
            <p className="small-label">{t("CURRENT JACKPOT", "当前奖池")}</p>
            <div className="jackpot-number">
              {formatAmount(game?.balance)}
              <span>SUI</span>
            </div>
            <p className="hero-description">
              {game
                ? t(
                    "65% goes to the last player. Will it be you?",
                    "65% 奖池属于最后一位玩家。会是你吗？",
                  )
                : t(
                    "The arena is ready. The main game is awaiting on-chain initialization.",
                    "大厅已就绪。主游戏等待链上初始化。",
                  )}
            </p>
            {game ? (
              <Countdown game={game} large />
            ) : (
              <div className="countdown waiting">
                — : — : — <small>{t("NOT STARTED", "尚未开始")}</small>
              </div>
            )}
          </div>
          <div className="hero-bottom">
            <div>
              <span className="small-label">
                {t("WINNER SHARE", "赢家份额")}
              </span>
              <strong>
                {game ? formatAmount((BigInt(game.balance) * 65n) / 100n) : "—"}{" "}
                SUI
              </strong>
            </div>
            <Link to="/game/sui" className="button primary">
              <KeyRound size={17} />
              {game && ready
                ? t("Buy a key", "购买 Key")
                : t("View SUI game", "查看 SUI 游戏")}
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className="allocation">
            <span style={{ width: "65%" }} />
            <span style={{ width: "30%" }} />
            <span style={{ width: "5%" }} />
          </div>
          <div className="allocation-labels">
            <span>
              <i />
              {t("65% Winner", "65% 赢家")}
            </span>
            <span>
              <i />
              {t("30% Next round", "30% 下一轮")}
            </span>
            <span>
              <i />
              {t("5% Buyback & Burn FOMO3D", "5% 回购销毁FOMO3D")}
            </span>
          </div>
        </section>
        <div className="hero-side">
          {p.data?.ico?.boo ? (
            <section className="panel ico-teaser">
              <span className="badge purple">
                {t("GENESIS ICO", "创世 ICO")}
              </span>
              <h2>
                {t("The beginning of", "从这里开始")}
                <br />
                <span>something big.</span>
              </h2>
              <p className="muted">1 SUI = 200,000 FOMO3D</p>
              <div className="progress">
                <i
                  style={{
                    width: `${raised === undefined ? 0 : Number((raised * 10000n) / ICO_CAP) / 100}%`,
                  }}
                />
              </div>
              <div className="progress-label">
                <strong>{formatAmount(raised)} SUI</strong>
                <span>/ 11,000 SUI</span>
              </div>
              <Link to="/ico" className="button secondary full">
                {t("Join the ICO", "参与 ICO")}
                <ArrowUpRight size={17} />
              </Link>
            </section>
          ) : (
            <section className="panel ico-teaser">
              <span className="badge purple">FOMO3D</span>
              <h2>
                {ready
                  ? t("ICO completed. Game on.", "ICO 已完成，游戏开放。")
                  : t(
                      "Built on Sui. Driven by players.",
                      "构建于 Sui，由玩家推动。",
                    )}
              </h2>
              <p className="muted">
                {t(
                  "Explore the token, claim your allocation, and manage liquidity.",
                  "查看代币、领取份额和管理流动性。",
                )}
              </p>
              <Link to="/fomo" className="text-link">
                {t("Explore FOMO3D", "探索 FOMO3D")}
                <ArrowRight size={16} />
              </Link>
            </section>
          )}
          <Link to="/create" className="create-teaser">
            <div className="create-icon">
              <Plus />
            </div>
            <div>
              <h3>{t("Your token. Your game.", "你的代币，你的游戏。")}</h3>
              <p>{t("Build a game for your meme coin on Sui", "在SUI上为你的meme coin创建游戏")}</p>
            </div>
            <ArrowUpRight size={20} />
          </Link>
        </div>
      </div>
      <div className="stats-grid">
        <Stat
          label={t("GAMES DISCOVERED", "已发现游戏")}
          value={p.history.data ? p.catalog.games.length : "—"}
          detail={t("From contract events", "来自合约事件")}
        />
        <Stat
          label={t("SUI AWARDED", "已结算 SUI 奖金")}
          value={p.history.data ? formatAmount(settled) : "—"}
          detail={t("Indexed SUI rounds only", "仅已索引的 SUI 轮次")}
        />
        <Stat
          label={t("FOMO BURNED", "FOMO 已销毁")}
          value={formatAmount(p.data?.minter?.total_burned)}
          detail={t("Verified minter state", "来自 Minter 链上状态")}
        />
        <Stat
          label={t("PROTOCOL", "协议状态")}
          value={
            p.data?.registry?.version === "1"
              ? t("Open", "已开放")
              : p.data?.registry
                ? t("Genesis", "创世阶段")
                : "—"
          }
          detail={t("Permissionless settlement", "无需许可的轮次结算")}
        />
      </div>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("FIND YOUR ARENA", "寻找你的游戏")}</p>
          <h2>{t("Community games", "社区游戏")}</h2>
        </div>
        <Link to="/games" className="text-link">
          {t("All games", "所有游戏")}
          <ArrowRight size={16} />
        </Link>
      </div>
      <div className="games-grid">
        {p.data?.games
          .filter((g) => g.coinType !== SUI)
          .slice(0, 3)
          .map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        {!p.data?.games.some((g) => g.coinType !== SUI) && (
          <div className="community-empty">
            <Layers3 size={36} />
            <h3>{t("A new arena starts with you.", "新的游戏，从你开始。")}</h3>
            <p className="muted">
              {t(
                "No community games have been discovered in the available event history.",
                "可用事件历史中尚未发现社区游戏。",
              )}
            </p>
            <Link to="/create" className="button secondary">
              <Plus size={16} />
              {t("Create a game", "创建游戏")}
            </Link>
          </div>
        )}
      </div>
      <div className="two-columns">
        <Activity
          names={["KeyPurchased", "IcoContributed"]}
          limit={5}
          title={t("Latest moves", "最新动态")}
        />
        <Activity
          names={["RoundSettled"]}
          limit={5}
          title={t("Latest winners", "最新赢家")}
        />
      </div>
      <div className="principles">
        <div>
          <ShieldCheck />
          <strong>{t("Every move, on-chain", "每一步都在链上")}</strong>
          <p>
            {t(
              "Wallet-signed transactions. Verifiable results.",
              "钱包签名交易，可验证的结果。",
            )}
          </p>
        </div>
        <div>
          <KeyRound />
          <strong>{t("Last key takes 65%", "最后一把 Key 赢得 65%")}</strong>
          <p>
            {t(
              "Each key resets the countdown. Timing is everything.",
              "每次购买重置倒计时，时机决定结果。",
            )}
          </p>
        </div>
        <div>
          <Flame />
          <strong>{t("Play fuels the ecosystem", "游戏推动生态")}</strong>
          <p>
            {t(
              "Round settlement funds FOMO buyback and burns.",
              "轮次结算为 FOMO 回购与销毁提供资金。",
            )}
          </p>
        </div>
      </div>
    </>
  );
}
