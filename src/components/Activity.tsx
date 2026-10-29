import { useCurrentAccount } from "@mysten/dapp-kit-react";
import {
  ExternalLink,
  Trophy,
  ArrowDownUp,
  KeyRound,
  Flame,
} from "lucide-react";
import { useHistory } from "../hooks/useProtocol";
import { sortEvents, type ChainEvent } from "../lib/events";
import { short } from "../lib/sui/math";
import { SUI, explorer } from "../config/contracts";
import { useCurrentNetwork } from "@mysten/dapp-kit-react";
import { TokenAmount, Empty } from "./Common";
import { useI18n } from "./I18n";
export function Activity({
  names,
  gameId,
  poolId,
  mine = false,
  limit = 12,
  title,
}: {
  names?: string[];
  gameId?: string;
  poolId?: string;
  mine?: boolean;
  limit?: number;
  title?: string;
}) {
  const history = useHistory(),
    account = useCurrentAccount(),
    network = useCurrentNetwork(),
    { t } = useI18n();
  const events = sortEvents(history.data?.events || [])
    .filter(
      (e) =>
        (!names || names.includes(e.name)) &&
        (!gameId || e.data.game_id === gameId) &&
        (!poolId || e.data.pool_id === poolId) &&
        (!mine ||
          (!!account && Object.values(e.data).includes(account.address))),
    )
    .slice(0, limit);
  return (
    <section className="panel activity">
      <div className="section-heading">
        <h3>{title || t("On-chain activity", "链上动态")}</h3>
        <span className="badge">{t("EVENTS", "事件")}</span>
      </div>
      {!events.length ? (
        <Empty
          title={
            history.isLoading
              ? t("Loading events", "正在加载事件")
              : t("No indexed activity yet", "暂无已索引记录")
          }
        >
          {mine && !account
            ? t(
                "Connect your wallet to see your history.",
                "连接钱包查看个人记录。",
              )
            : t(
                "Confirmed contract events appear here.",
                "已确认的合约事件将在此显示。",
              )}
        </Empty>
      ) : (
        <div className="activity-list">
          {events.map((e) => (
            <EventRow key={e.id} e={e} network={network} />
          ))}
        </div>
      )}
    </section>
  );
}
function EventRow({
  e,
  network,
}: {
  e: ChainEvent;
  network: "devnet" | "testnet" | "mainnet";
}) {
  const d = e.data;
  const address = String(
    d.buyer ||
      d.winner ||
      d.participant ||
      d.provider ||
      d.caller ||
      d.recipient ||
      d.creator ||
      "",
  );
  const amount =
    d.paid_amount ||
    d.winner_amount ||
    d.accepted_sui ||
    d.returned_sui ||
    d.actual_minted ||
    d.amount ||
    d.amount_in ||
    d.initial_balance;
  const type =
    e.coinType ||
    (e.name.startsWith("Ico")
      ? SUI
      : e.type.split("::")[0] + "::fomo3d::FOMO3D");
  return (
    <a
      className="activity-row"
      href={explorer(network, "tx", e.digest)}
      target="_blank"
      rel="noreferrer"
    >
      <span className="event-icon">
        {e.name === "KeyPurchased" ? (
          <KeyRound size={16} />
        ) : e.name === "RoundSettled" ? (
          <Trophy size={16} />
        ) : e.name.includes("Burn") ? (
          <Flame size={16} />
        ) : (
          <ArrowDownUp size={16} />
        )}
      </span>
      <div>
        <strong>{e.name}</strong>
        <small>
          {short(address)} · #{e.checkpoint}
        </small>
      </div>
      <div className="event-value">
        {amount !== undefined ? (
          <TokenAmount
            amount={String(amount)}
            type={e.name === "SwapExecuted" && d.direction === 1 ? SUI : type}
          />
        ) : (
          short(e.digest)
        )}
        <ExternalLink size={12} />
      </div>
    </a>
  );
}
