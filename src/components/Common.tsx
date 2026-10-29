import { type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Clock3, KeyRound, Info, RefreshCw } from "lucide-react";
import {
  useProtocol,
  useMetadata,
  useBalance,
  useChainTime,
  useDeadlineCheck,
} from "../hooks/useProtocol";
import { countdownSeconds } from "../lib/sui/clock";
import { useI18n } from "./I18n";
import {
  formatAmount,
  gameStatus,
  keyPrice,
  holderAddress,
} from "../lib/sui/math";
import type { Game } from "../lib/sui/schemas";
import { SUI } from "../config/contracts";
import { TokenIcon } from "./TokenIcon";
export { TokenIcon } from "./TokenIcon";
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
  if (p.config.packageId && !p.error && !(p.historyEnabled && p.history.error))
    return null;
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
      {(p.error || (p.historyEnabled && p.history.error)) && (
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
              if (p.historyEnabled) void p.history.refetch();
            }}
            aria-label="Retry"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      )}
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
    time = useChainTime();
  useDeadlineCheck(game, time.timestamp, time.stale);
  if (game.maturity === "0")
    return (
      <div className={large ? "countdown waiting" : "timer"}>
        <Clock3 size={large ? 24 : 14} />
        {t("Waiting for the first key", "等待第一把 Key")}
      </div>
    );
  if (!p.data?.clock) return <span>—</span>;
  const seconds = countdownSeconds(game.maturity, time.timestamp),
    h = seconds / 3600n,
    m = (seconds % 3600n) / 60n,
    s = seconds % 60n;
  return (
    <div className={large ? "countdown" : "timer"}>
      <Clock3 size={large ? 22 : 14} />
      {time.stale
        ? t("Syncing…", "同步中…")
        : [h, m, s].map((n) => n.toString().padStart(2, "0")).join(" : ")}
      {!time.stale && seconds === 0n && (
        <small>
          {BigInt(p.data.clock.timestamp_ms) > BigInt(game.maturity)
            ? t(
                "Settlement subject to on-chain execution",
                "结算以链上执行为准",
              )
            : t("Verifying end time…", "正在核验结束时间…")}
        </small>
      )}
    </div>
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
          {game.total_keys === "0" ? "—" : holderAddress(game.address1)}
        </span>
        <ArrowUpRight size={18} />
      </div>
    </Link>
  );
}

export function GamePagination() {
  const p = useProtocol(),
    { t } = useI18n(),
    [params, setParams] = useSearchParams();
  if (p.plan.totalPages <= 1) return null;
  const go = (page: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    setParams(next);
  };
  return (
    <div className="filter-bar" aria-label={t("Game pages", "游戏分页")}>
      <button
        className="button secondary"
        disabled={p.plan.page <= 1}
        onClick={() => go(p.plan.page - 1)}
      >
        {t("Previous", "上一页")}
      </button>
      <span>
        {p.plan.page} / {p.plan.totalPages} · {p.plan.matchingGames}{" "}
        {t("games", "个游戏")}
      </span>
      <button
        className="button secondary"
        disabled={p.plan.page >= p.plan.totalPages}
        onClick={() => go(p.plan.page + 1)}
      >
        {t("Next", "下一页")}
      </button>
    </div>
  );
}
