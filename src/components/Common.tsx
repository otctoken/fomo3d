import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Clock3, KeyRound, Info, RefreshCw } from "lucide-react";
import { useProtocol, useMetadata, useBalance } from "../hooks/useProtocol";
import { useI18n } from "./I18n";
import { formatAmount, gameStatus, keyPrice, short } from "../lib/sui/math";
import type { Game } from "../lib/sui/schemas";
import { SUI } from "../config/contracts";
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <KeyRound size={28} />
      </div>
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}
export function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function DataHealth() {
  const p = useProtocol(),
    { t } = useI18n();
  return (
    <>
      {!p.config.packageId && (
        <div className="notice">
          <Info size={18} />
          {t(
            "No deployment configured for this network. Set its environment variables before using transactions.",
            "此网络尚未配置合约，请先配置环境变量。",
          )}
        </div>
      )}
      {(p.error || p.history.error) && (
        <div className="notice error">
          <Info size={18} />
          <span>
            {t(
              "Chain data could not be refreshed. Actions require a fresh on-chain precheck.",
              "链上数据刷新失败。交易前将重新检查链上状态。",
            )}{" "}
            {String(p.error?.message || p.history.error?.message)}
          </span>
          <button
            className="icon-button"
            onClick={() => {
              void p.refetch();
              void p.history.refetch();
            }}
            aria-label="Retry"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      )}
      <div className="data-health">
        <span className={p.data && !p.error ? "dot" : "dot amber"} />
        {p.isLoading
          ? t("Reading Sui…", "正在读取 Sui…")
          : p.data
            ? t("On-chain state · refreshes every 5s", "链上状态 · 每 5 秒刷新")
            : t("Awaiting chain data", "等待链上数据")}
        <span className="health-history">
          {p.history.data?.source === "persistent"
            ? p.history.data.complete
              ? t(
                  "Persistent index · complete from initialization",
                  "持久索引 · 从初始化完整同步",
                )
              : t("Persistent index · backfilling", "持久索引 · 补全中")
            : t(
                "Public RPC history · coverage not guaranteed",
                "公共 RPC 历史 · 不保证完整",
              )}
        </span>
      </div>
    </>
  );
}
export function Countdown({
  game,
  large = false,
}: {
  game: Game;
  large?: boolean;
}) {
  const p = useProtocol(),
    { t } = useI18n(),
    [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  if (game.maturity === "0")
    return (
      <div className={large ? "countdown waiting" : "timer"}>
        <Clock3 size={large ? 24 : 14} />
        {t("Waiting for the first key", "等待第一把 Key")}
      </div>
    );
  if (!p.data?.clock) return <span>—</span>;
  const age = Math.max(0, tick - p.data.receivedAt),
    chain = BigInt(p.data.clock.timestamp_ms) + BigInt(Math.min(age, 15000));
  const left =
    BigInt(game.maturity) > chain ? BigInt(game.maturity) - chain : 0n;
  const seconds = left / 1000n,
    h = seconds / 3600n,
    m = (seconds % 3600n) / 60n,
    s = seconds % 60n;
  return (
    <div className={large ? "countdown" : "timer"}>
      <Clock3 size={large ? 22 : 14} />
      {[h, m, s].map((n) => n.toString().padStart(2, "0")).join(" : ")}
      {age > 15000 && <small>{t("Syncing", "同步中")}</small>}
    </div>
  );
}
export function TokenIcon({
  type,
  size = "",
}: {
  type: string;
  size?: string;
}) {
  const meta = useMetadata(type);
  return (
    <span className={"token-icon " + size}>
      {meta.data?.iconUrl ? (
        <img
          src={meta.data.iconUrl}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : type === SUI ? (
        "◈"
      ) : (
        type.split("::").at(-1)?.slice(0, 1)
      )}
    </span>
  );
}
export function TokenAmount({
  amount,
  type,
  precision = 4,
}: {
  amount: string | bigint | undefined;
  type: string;
  precision?: number;
}) {
  const meta = useMetadata(type);
  return (
    <>
      {formatAmount(
        amount,
        meta.data?.decimals ?? (type === SUI ? 9 : 0),
        precision,
      )}{" "}
      <small>
        {meta.data?.symbol ||
          (type === SUI ? "SUI" : `raw ${type.split("::").at(-1)}`)}
      </small>
    </>
  );
}
export function Balance({ type }: { type: string }) {
  const b = useBalance(type),
    { t } = useI18n();
  return (
    <span className="balance">
      {t("Wallet", "钱包")}: <TokenAmount amount={b.data} type={type} />
    </span>
  );
}
export function GameCard({ game }: { game: Game }) {
  const p = useProtocol(),
    meta = useMetadata(game.coinType),
    { t } = useI18n();
  const state = gameStatus(
    BigInt(game.maturity),
    BigInt(p.data?.clock?.timestamp_ms || 0),
  );
  return (
    <Link className="game-card" to={`/game/${game.id}`}>
      <div className="card-top">
        <div className="token-title">
          <TokenIcon type={game.coinType} />
          <div>
            <h3>{meta.data?.symbol || game.coinType.split("::").at(-1)}</h3>
            <span>
              {t("Round", "轮次")} #{game.round_id}
            </span>
          </div>
        </div>
        <span className={"badge " + (state === "Live" ? "green" : "")}>
          {state === "Waiting"
            ? t("Waiting", "等待开始")
            : state === "Live"
              ? t("Live", "进行中")
              : t("Settle", "待结算")}
        </span>
      </div>
      <p className="small-label">{t("CURRENT JACKPOT", "当前奖池")}</p>
      <div className="card-pot">
        <TokenAmount amount={game.balance} type={game.coinType} />
      </div>
      <Countdown game={game} />
      <div className="card-details">
        <span>
          {t("Next key", "下一把 Key")}
          <strong>
            <TokenAmount
              amount={keyPrice(
                BigInt(game.total_keys),
                BigInt(game.initial_price),
                BigInt(game.price_update_percentage),
              )}
              type={game.coinType}
            />
          </strong>
        </span>
        <span>
          {t("Winner gets", "赢家获得")}
          <strong>65%</strong>
        </span>
      </div>
      <p className="small-code" title={game.coinType}>
        {game.coinType}
      </p>
      <div className="card-bottom">
        <span>
          {t("Last buyer", "最后购买者")}{" "}
          {game.total_keys === "0" ? "—" : short(game.address1)}
        </span>
        <ArrowUpRight size={18} />
      </div>
    </Link>
  );
}
