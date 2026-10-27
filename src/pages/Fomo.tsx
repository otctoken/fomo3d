import { Logo } from "../components/Logo";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { ArrowDownUp, Flame, Coins, ArrowUpRight } from "lucide-react";
import {
  useProtocol,
  useMetadata,
  useOwned,
  useBalance,
} from "../hooks/useProtocol";
import { useI18n } from "../components/I18n";
import { useTransaction } from "../components/Transactions";
import {
  PageTitle,
  Field,
  TokenAmount,
  Balance,
  Stat,
  Empty,
} from "../components/Common";
import { Activity } from "../components/Activity";
import { Ico } from "./Ico";
import {
  parseAmount,
  formatAmount,
  quote,
  minimum,
  liquidityQuote,
  removalQuote,
  short,
} from "../lib/sui/math";
import {
  swap,
  addLiquidity,
  removeLiquidity,
} from "../lib/transactions/builders";
import { SUI, explorer } from "../config/contracts";
export function Fomo() {
  const [params, setParams] = useSearchParams(),
    tab = params.get("tab") || "swap",
    { t } = useI18n();
  return (
    <>
      <PageTitle
        eyebrow="THE FOMO3D ECONOMY"
        title={t("More than the last key.", "不止最后一把 Key。")}
        description={t(
          "Swap tokens, provide liquidity, and explore the on-chain economy.",
          "兑换代币、提供流动性，探索链上经济。",
        )}
      />
      <div className="tabs">
        {[
          ["swap", t("Swap", "兑换")],
          ["liquidity", t("Liquidity", "流动性")],
          ["token", t("Token overview", "代币概况")],
          ["claim", t("ICO & claim", "ICO 与领取")],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setParams({ tab: id })}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "claim" ? (
        <Ico compact />
      ) : tab === "token" ? (
        <TokenOverview />
      ) : (
        <Market liquidity={tab === "liquidity"} />
      )}
    </>
  );
}
function TokenOverview() {
  const p = useProtocol(),
    { t } = useI18n(),
    balance = useBalance(p.config.fomoType);
  const events = p.history.data?.events || [],
    minted = (kind: number) =>
      events
        .filter((e) => e.name === "MintProcessed" && e.data.kind === kind)
        .reduce((a, e) => a + BigInt(String(e.data.actual_minted)), 0n);
  const supply = p.data?.minter?.cap.total_supply.value,
    burned = p.data?.minter?.total_burned;
  return (
    <>
      <section className="panel token-overview">
        <Logo className="token-emblem" />
        <div>
          <p className="eyebrow">FOMO3D · SUI COIN · 9 DECIMALS</p>
          <h2>{t("An economy in motion.", "持续运转的代币经济。")}</h2>
          <p className="muted">
            {t(
              "SUI key purchases mint rewards; settlement can buy back and burn FOMO. Minting is subject to the actual contract cap and halving logic.",
              "SUI Key 购买产生奖励，结算可触发 FOMO 回购销毁。铸币受真实合约上限和减半逻辑约束。",
            )}
          </p>
          <p className="small-code">{p.config.fomoType}</p>
        </div>
      </section>
      <div className="stats-grid">
        <Stat
          label={t("Circulating supply", "当前流通量")}
          value={formatAmount(supply)}
        />
        <Stat
          label={t("Lifetime issued", "终身累计发行")}
          value={
            supply !== undefined && burned !== undefined
              ? formatAmount(BigInt(supply) + BigInt(burned))
              : "—"
          }
        />
        <Stat label={t("Burned", "累计销毁")} value={formatAmount(burned)} />
        <Stat
          label={t("My FOMO3D", "我的 FOMO3D")}
          value={formatAmount(balance.data)}
        />
      </div>
      <div className="stats-grid">
        <Stat
          label={t("Current reward divisor", "当前奖励除数")}
          value={p.data?.halving?.halved || "—"}
        />
        <Stat
          label={t("Next halving threshold", "下次减半门槛")}
          value={formatAmount(p.data?.halving?.remaining)}
        />
        <Stat
          label={t("ICO mints · indexed", "ICO 铸币 · 已索引")}
          value={p.history.data ? formatAmount(minted(1)) : "—"}
        />
        <Stat
          label={t("Game mints · indexed", "游戏铸币 · 已索引")}
          value={p.history.data ? formatAmount(minted(0)) : "—"}
        />
      </div>
      <div className="two-columns">
        <Activity
          names={["TokensBurned", "BuybackExecuted", "BuybackSkipped"]}
          title={t("Buyback & burn history", "回购与销毁历史")}
        />
        <Activity
          names={["MintProcessed", "HalvingApplied"]}
          title={t("Issuance & halving", "发行与减半")}
        />
      </div>
    </>
  );
}
function Market({ liquidity }: { liquidity: boolean }) {
  const p = useProtocol(),
    { t } = useI18n(),
    account = useCurrentAccount(),
    tx = useTransaction(),
    owned = useOwned();
  const [poolId, setPoolId] = useState(""),
    [sell, setSell] = useState(false),
    [amount, setAmount] = useState(""),
    [amountY, setAmountY] = useState(""),
    [slippage, setSlippage] = useState("0.5"),
    [error, setError] = useState("");
  const pools = p.data?.pools || [],
    pool =
      pools.find((v) => v.id === poolId) ||
      pools.find((v) => v.coinType === p.config.fomoType) ||
      pools[0];
  const meta = useMetadata(pool?.coinType || p.config.fomoType);
  let q: ReturnType<typeof quote> | undefined,
    lq: ReturnType<typeof liquidityQuote> | undefined,
    x = 0n,
    y = 0n,
    bps = 50n,
    validation = "";
  try {
    bps = parseAmount(slippage, 2);
    minimum(1n, bps);
    if (pool && meta.data && amount) {
      x = parseAmount(amount, liquidity || sell ? meta.data.decimals : 9);
      if (liquidity) {
        y = parseAmount(amountY);
        lq = liquidityQuote(
          x,
          y,
          BigInt(pool.reserve_x),
          BigInt(pool.reserve_y),
          BigInt(pool.total_shares),
        );
      } else
        q = quote(
          x,
          BigInt(sell ? pool.reserve_x : pool.reserve_y),
          BigInt(sell ? pool.reserve_y : pool.reserve_x),
          sell,
        );
    }
  } catch (e) {
    validation = String(e);
  }
  const inputType = sell ? pool?.coinType : SUI,
    outputType = sell ? SUI : pool?.coinType;
  function submit() {
    if (!pool) return;
    try {
      if (validation) throw new Error(validation);
      if (liquidity) {
        if (!lq) throw new Error("Enter both liquidity amounts");
        tx.request({
          label: t("Add liquidity", "添加流动性"),
          details: `${formatAmount(x, meta.data!.decimals)} ${meta.data!.symbol} + ${formatAmount(y)} SUI · ${t("Unused coins and LP will return to your wallet.", "多余代币和 LP 将转入你的钱包。")}`,
          build: (c) =>
            addLiquidity(c, pool.id, pool.coinType, x, y, lq!.shares, bps),
        });
      } else {
        if (!q || q.net === 0n) throw new Error("Enter a valid swap amount");
        tx.request({
          label: t("Swap tokens", "兑换代币"),
          details: `${t("Minimum received", "最少收到")}: ${formatAmount(minimum(q.net, bps), sell ? 9 : meta.data!.decimals)} ${sell ? "SUI" : meta.data!.symbol}`,
          build: (c) => swap(c, pool.id, pool.coinType, sell, x, q!.net, bps),
        });
      }
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <>
      {!pool ? (
        <section className="panel">
          <Empty title={t("No AMM pool discovered yet", "尚未发现 AMM 池")}>
            {t(
              "The FOMO/SUI pool is created by the successful ICO completion transaction. Community pools are created together with games.",
              "FOMO/SUI 池在 ICO 达标交易中创建，社区池在创建游戏时一同建立。",
            )}
          </Empty>
        </section>
      ) : (
        <div className="market-layout">
          <section className="panel market-form">
            <div className="section-heading">
              <h2>
                {liquidity
                  ? t("Provide liquidity", "提供流动性")
                  : t("Swap", "兑换")}
              </h2>
              <ArrowDownUp size={20} />
            </div>
            <Field label={t("Pool", "交易池")}>
              <select
                value={pool.id}
                onChange={(e) => {
                  setPoolId(e.target.value);
                  setAmount("");
                  setAmountY("");
                }}
              >
                {pools.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.coinType.split("::").at(-1)} / SUI · {short(v.id)}
                  </option>
                ))}
              </select>
            </Field>
            {!liquidity && (
              <div className="segmented">
                <button
                  className={!sell ? "active" : ""}
                  onClick={() => {
                    setSell(false);
                    setAmount("");
                  }}
                >
                  SUI → {meta.data?.symbol || "Token"}
                </button>
                <button
                  className={sell ? "active" : ""}
                  onClick={() => {
                    setSell(true);
                    setAmount("");
                  }}
                >
                  {meta.data?.symbol || "Token"} → SUI
                </button>
              </div>
            )}
            <div className="amount-box">
              <label>
                {liquidity ? meta.data?.symbol : t("You pay", "支付")}
              </label>
              <input
                aria-label="Amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
              />
              <Balance type={liquidity ? pool.coinType : inputType!} />
            </div>
            {liquidity ? (
              <div className="amount-box">
                <label>SUI</label>
                <input
                  aria-label="SUI liquidity"
                  inputMode="decimal"
                  value={amountY}
                  onChange={(e) => setAmountY(e.target.value)}
                  placeholder="0.0"
                />
                <Balance type={SUI} />
              </div>
            ) : (
              <div className="amount-box receive">
                <label>{t("You receive · estimated", "预计收到")}</label>
                <strong>
                  <TokenAmount amount={q?.net} type={outputType!} />
                </strong>
                <Balance type={outputType!} />
              </div>
            )}
            <Field label={t("Slippage tolerance · %", "滑点容忍度 · %")}>
              <input
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            {q && (
              <>
                <div className="summary-row">
                  <span>{t("Price impact (curve)", "曲线价格影响")}</span>
                  <strong>{formatAmount(q.impactBps, 2, 2)}%</strong>
                </div>
                <div className="summary-row">
                  <span>{t("Minimum received", "最少收到")}</span>
                  <strong>
                    <TokenAmount
                      amount={minimum(q.net, bps)}
                      type={outputType!}
                    />
                  </strong>
                </div>
                <div className="summary-row">
                  <span>
                    {t("Admin + LP output fees", "管理员 + LP 输出费用")}
                  </span>
                  <strong>
                    <TokenAmount
                      amount={q.adminFee + q.lpFee}
                      type={outputType!}
                    />
                  </strong>
                </div>
              </>
            )}
            {lq && (
              <>
                <div className="summary-row">
                  <span>{t("LP shares", "LP 份额")}</span>
                  <strong>{lq.shares.toString()}</strong>
                </div>
                <div className="summary-row">
                  <span>{t("Unused deposits returned", "退回多余存入")}</span>
                  <strong>
                    <TokenAmount amount={x - lq.usedX} type={pool.coinType} /> +{" "}
                    {formatAmount(y - lq.usedY)} SUI
                  </strong>
                </div>
              </>
            )}
            {(error || validation) && (
              <p className="error">{error || validation}</p>
            )}
            <button
              className="button primary full"
              disabled={
                !account ||
                tx.busy ||
                !meta.data ||
                !!validation ||
                !(liquidity ? lq : q)
              }
              onClick={submit}
            >
              {liquidity
                ? t("Review deposit", "检查存入")
                : t("Review swap", "检查兑换")}
            </button>
            {!account && (
              <p className="note">
                {t("Connect your wallet to continue.", "连接钱包后继续。")}
              </p>
            )}
          </section>
          <aside>
            <section className="panel">
              <p className="eyebrow">{t("POOL ANALYTICS", "交易池数据")}</p>
              <h2>{meta.data?.symbol || "TOKEN"} / SUI</h2>
              <div className="summary-row">
                <span>{t("Token reserve", "代币储备")}</span>
                <strong>
                  <TokenAmount amount={pool.reserve_x} type={pool.coinType} />
                </strong>
              </div>
              <div className="summary-row">
                <span>{t("SUI reserve", "SUI 储备")}</span>
                <strong>{formatAmount(pool.reserve_y)} SUI</strong>
              </div>
              <div className="summary-row">
                <span>{t("Total LP shares", "LP 总份额")}</span>
                <strong>{pool.total_shares}</strong>
              </div>
              <a
                className="text-link"
                href={explorer(p.config.network, "object", pool.id)}
                target="_blank"
                rel="noreferrer"
              >
                {t("Verify pool", "查看链上池")}
                <ArrowUpRight size={16} />
              </a>
              <div className="notice">
                {t(
                  "Token → SUI: two fees of floor(gross output × 1.5%). SUI → Token: no additional fee. Removing LP charges 1% of gross SUI output.",
                  "Token → SUI：两笔向下取整的 1.5% 输出费用。SUI → Token：无额外手续费。移除 LP 收取 SUI 输出的 1%。",
                )}
              </div>
            </section>
            {liquidity && (
              <section className="panel positions">
                <h3>{t("My LP positions", "我的 LP 仓位")}</h3>
                {owned.data?.lps
                  .filter((lp) => lp.pool === pool.id)
                  .map((lp) => {
                    let r: ReturnType<typeof removalQuote>;
                    try {
                      r = removalQuote(
                        BigInt(lp.shares),
                        BigInt(pool.total_shares),
                        BigInt(pool.reserve_x),
                        BigInt(pool.reserve_y),
                      );
                    } catch {
                      return null;
                    }
                    return (
                      <div className="lp-position" key={lp.id}>
                        <div className="summary-row">
                          <code>{short(lp.id)}</code>
                          <span>{lp.shares} shares</span>
                        </div>
                        <p>
                          {t("Net output", "净到账")}:{" "}
                          <TokenAmount amount={r.x} type={pool.coinType} /> +{" "}
                          {formatAmount(r.netY)} SUI
                        </p>
                        <p className="muted">
                          {t("SUI fee", "SUI 手续费")}: {formatAmount(r.fee)}
                        </p>
                        <button
                          className="button secondary full"
                          disabled={tx.busy || !!validation}
                          onClick={() =>
                            tx.request({
                              label: t(
                                "Remove full LP position",
                                "移除全部 LP 仓位",
                              ),
                              details: `${t("Redeems and destroys this LP. Expected net SUI", "赎回并销毁此 LP，预计净收 SUI")}: ${formatAmount(r.netY)}; fee ${formatAmount(r.fee)} SUI. ${t("Contract min_y checks gross output before the 1% fee.", "合约 min_y 检查扣除 1% 费用前的输出。")}`,
                              build: (c) =>
                                removeLiquidity(
                                  c,
                                  pool.id,
                                  pool.coinType,
                                  lp.id,
                                  r.x,
                                  r.grossY,
                                  bps,
                                ),
                            })
                          }
                        >
                          {t("Remove liquidity", "移除流动性")}
                        </button>
                      </div>
                    );
                  })}
                {!owned.data?.lps.some((lp) => lp.pool === pool.id) && (
                  <p className="muted">
                    {t("No owned LP for this pool.", "此池暂无你持有的 LP。")}
                  </p>
                )}
              </section>
            )}
          </aside>
        </div>
      )}
      <Activity
        names={
          liquidity ? ["LiquidityAdded", "LiquidityRemoved"] : ["SwapExecuted"]
        }
        title={
          liquidity
            ? t("Liquidity history", "流动性历史")
            : t("Swap history", "兑换历史")
        }
      />
    </>
  );
}
