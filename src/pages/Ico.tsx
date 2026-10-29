import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { useProtocol, useEntitlement } from "../hooks/useProtocol";
import { PageTitle, Field, Stat, Balance } from "../components/Common";
import { Activity } from "../components/Activity";
import { useI18n } from "../components/I18n";
import { useTransaction } from "../components/Transactions";
import { contribute, refund, claim } from "../lib/transactions/builders";
import { parseAmount, formatAmount } from "../lib/sui/math";
import { ICO_CAP, SUI } from "../config/contracts";
export function Ico({ compact = false }: { compact?: boolean }) {
  const p = useProtocol(),
    entitlement = useEntitlement(),
    account = useCurrentAccount(),
    tx = useTransaction(),
    { t } = useI18n(),
    [amount, setAmount] = useState(""),
    [error, setError] = useState("");
  const ico = p.data?.ico;
  const remaining = ico ? BigInt(ico.hardCap) : p.data?.icoFinalized?0n:undefined,
    raised = remaining === undefined ? undefined : ICO_CAP - remaining;
  let input = 0n;
  try {
    input = parseAmount(amount);
  } catch {
    /* Input may be incomplete. */
  }
  const completed = p.data?.icoReady;
  const request = () => {
    try {
      const value = parseAmount(amount);
      if (value <= 0n || remaining === undefined || value > remaining)
        throw new Error(
          t(
            "Enter an amount within the remaining allocation.",
            "请输入剩余额度内的有效金额。",
          ),
        );
      setError("");
      tx.request({
        label: t("Contribute to ICO", "认购 ICO"),
        details: `${formatAmount(value)} SUI → ${formatAmount(value * 200000n)} FOMO3D`,
        build: (c) => contribute(c, value),
      });
    } catch (e) {
      setError(String(e));
    }
  };
  return (
    <>
      {!compact && (
        <PageTitle
          eyebrow="FOMO3D GENESIS"
          title={t("It starts with the community.", "从社区开始。")}
          description={t(
            "Fund the first SUI game and claim your FOMO3D tokens once the raise is complete.",
            "为首个SUI游戏注入资金，募集完成后可领取你的FOMO3D代币。",
          )}
        />
      )}
      <div className="two-columns">
        <section className="panel">
          <div className="section-heading">
            <h2>{t("Genesis offering", "创世发行")}</h2>
            <span className="badge purple">
              {completed
                ? t("Completed", "已完成")
                : ico?.boo
                  ? t("Open", "开放中")
                  : t("Loading", "加载中")}
            </span>
          </div>
          <div className="ico-total">
            {formatAmount(raised)} <small>SUI</small>
          </div>
          <p className="muted">
            {t("of 11,000 SUI community target", "募集目标 11,000 SUI")}
          </p>
          <div className="progress large">
            <i
              style={{
                width: `${raised === undefined ? 0 : Number((raised * 10000n) / ICO_CAP) / 100}%`,
              }}
            />
          </div>
          <div className="stats-grid compact">
            <Stat
              label={t("Remaining", "剩余额度")}
              value={`${formatAmount(remaining)} SUI`}
            />
            <Stat
              label={t("Progress", "进度")}
              value={
                raised === undefined
                  ? "—"
                  : `${Number((raised * 10000n) / ICO_CAP) / 100}%`
              }
            />
          </div>
          <div className="notice">
            {t(
              "On completion: 1,000 SUI seeds the FOMO pool; the remaining 10,000 SUI seeds the main game. The first key starts its timer.",
              "达标后：1,000 SUI 注入 FOMO 池，剩余 10,000 SUI 形成主游戏奖池。第一把 Key 启动计时。",
            )}
          </div>
          {!p.ids.mainGame && (
            <p className="warning">
              {t(
                "The main SUI game has not been initialized. Contributions remain unavailable until an AdminCap holder initializes it.",
                "主 SUI 游戏尚未初始化，需 AdminCap 持有者完成初始化后才能认购。",
              )}
            </p>
          )}
        </section>
        <section className="panel">
          <h2>
            {completed
              ? t("Your allocation", "你的份额")
              : t("Join the beginning", "参与创世")}
          </h2>
          <Balance type={SUI} />
          {ico?.boo && (
            <>
              <Field label={t("Contribute SUI", "认购 SUI")}>
                <input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
              <div className="summary-row">
                <span>{t("Expected FOMO3D", "预计获得 FOMO3D")}</span>
                <strong>{formatAmount(input * 200000n)}</strong>
              </div>
              <button
                className="button primary full"
                disabled={!account || tx.busy || !p.ids.mainGame}
                onClick={request}
              >
                {t("Review contribution", "检查认购")}
              </button>
            </>
          )}
          <div className="summary-row">
            <span>{t("Unclaimed entitlement", "待领取份额")}</span>
            <strong>{formatAmount(entitlement.data)} FOMO3D</strong>
          </div>
          {entitlement.error && (
            <p className="error">{entitlement.error.message}</p>
          )}
          {ico?.boo ? (
            <button
              className="button secondary full"
              disabled={!account || tx.busy || !entitlement.data}
              onClick={() =>
                tx.request({
                  label: t("Refund ICO", "退款"),
                  details: t(
                    "Refund your full current contribution and remove its entitlement.",
                    "退还当前全部认购，并移除对应领取份额。",
                  ),
                  build: refund,
                })
              }
            >
              {t("Refund contribution", "退还认购")}
            </button>
          ) : (
            <button
              className="button primary full"
              disabled={!completed || !account || tx.busy || !entitlement.data}
              onClick={() =>
                tx.request({
                  label: t("Claim FOMO3D", "领取 FOMO3D"),
                  details: t(
                    "Removes your entitlement. Actual tokens minted are recorded in MintProcessed.",
                    "将移除待领取份额，实际铸币数量以 MintProcessed 事件为准。",
                  ),
                  build: claim,
                })
              }
            >
              {t("Claim FOMO3D", "领取 FOMO3D")}
            </button>
          )}
          {!account && (
            <p className="note">
              {t("Connect your wallet to participate.", "连接钱包后参与。")}
            </p>
          )}
          {error && <p className="error">{error}</p>}
        </section>
      </div>
      {!compact && (
        <Activity
          names={[
            "IcoContributed",
            "IcoRefunded",
            "IcoClaimProcessed",
            "MintProcessed",
          ]}
          mine
          title={t("My ICO activity", "我的 ICO 记录")}
        />
      )}
    </>
  );
}
