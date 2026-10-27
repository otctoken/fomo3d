import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  Coins,
  KeyRound,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { useI18n } from "../components/I18n";
import { PageTitle, Field, Stat } from "../components/Common";
import { useProtocol } from "../hooks/useProtocol";
import { formatAmount, keyPrice, parseAmount } from "../lib/sui/math";
import { explorer } from "../config/contracts";
import { Logo } from "../components/Logo";
const CAP = 10_000_000_000_000_000_000n;
type Slice = { label: string; value: number; color: string; detail: string };
function Donut({
  slices,
  label,
  center,
}: {
  slices: Slice[];
  label: string;
  center: string;
}) {
  let offset = 0;
  return (
    <div className="chart-layout">
      <div className="donut">
        <svg viewBox="0 0 220 220" role="img" aria-label={label}>
          <title>{label}</title>
          <circle
            cx="110"
            cy="110"
            r="84"
            fill="none"
            stroke="#252d3b"
            strokeWidth="24"
          />
          {slices.map((s) => {
            const start = offset;
            offset += s.value;
            return (
              <circle
                key={s.label}
                cx="110"
                cy="110"
                r="84"
                fill="none"
                stroke={s.color}
                strokeWidth="24"
                pathLength="100"
                strokeDasharray={`${Math.max(0, s.value - 0.7)} ${100 - Math.max(0, s.value - 0.7)}`}
                strokeDashoffset={-start}
                transform="rotate(-90 110 110)"
              />
            );
          })}
        </svg>
        <div className="donut-center">
          <strong>{center}</strong>
          <span>{label}</span>
        </div>
      </div>
      <div className="chart-legend">
        {slices.map((s) => (
          <div className="legend-row" key={s.label}>
            <i style={{ background: s.color }} />
            <div>
              <strong>{s.label}</strong>
              <p>{s.detail}</p>
            </div>
            <b>{s.value}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}
function DocSection({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="panel doc-section">
      <div className="doc-section-title">
        <span>{n}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}
export function Docs() {
  const { t } = useI18n(),
    p = useProtocol();
  const [mode, setMode] = useState<"sui" | "meme" | "fomo">("sui"),
    [pot, setPot] = useState("10000"),
    [keys, setKeys] = useState(100),
    [initial, setInitial] = useState("2"),
    [growth, setGrowth] = useState("2"),
    [stage, setStage] = useState(0);
  let pool = 0n,
    price: bigint | undefined,
    increment: bigint | undefined,
    poolError = "",
    priceError = "";
  try {
    pool = parseAmount(pot);
  } catch {
    poolError = t(
      "Enter a valid example pool amount.",
      "请输入有效示例奖池金额。",
    );
  }
  try {
    if (!/^\d+$/.test(growth) || BigInt(growth) > 255n) throw new Error();
    const start = parseAmount(initial);
    if (start === 0n) throw new Error();
    price = keyPrice(BigInt(keys), start, BigInt(growth));
    increment = (start * BigInt(growth)) / 1000n;
  } catch {
    priceError = t(
      "Use a positive initial price and integer growth of 0–255 per mille.",
      "请输入正数初始价格及 0–255 的整数千分比涨幅。",
    );
  }
  const winner = (pool * 65n) / 100n,
    buyback =
      mode === "meme"
        ? (pool * 2n) / 100n
        : mode === "sui"
          ? (pool * 5n) / 100n
          : 0n,
    burn = mode === "fomo" ? (pool * 5n) / 100n : 0n,
    blackhole = mode === "meme" ? (pool * 3n) / 100n : 0n,
    rollover = pool - winner - buyback - burn - blackhole;
  const unit = mode === "sui" ? "SUI" : mode === "fomo" ? "FOMO3D" : "TOKEN";
  const rewardSlices: Slice[] = [
    {
      label: t("Last key holder", "最后 Key 持有者"),
      value: 65,
      color: "#eec780",
      detail: `${formatAmount(winner)} ${unit}`,
    },
    {
      label: t("Next round", "下一轮奖池"),
      value: 30,
      color: "#9b89c6",
      detail: `${formatAmount(rollover)} ${unit}`,
    },
    ...(mode === "meme"
      ? [
          {
            label: t("FOMO buyback", "FOMO 回购"),
            value: 2,
            color: "#63b7e8",
            detail: `${formatAmount(buyback)} TOKEN → SUI → FOMO3D`,
          },
          {
            label: t("Blackhole transfer", "黑洞转账"),
            value: 3,
            color: "#738097",
            detail: `${formatAmount(blackhole)} TOKEN → 0x0`,
          },
        ]
      : [
          {
            label:
              mode === "fomo"
                ? t("Direct burn", "直接销毁")
                : t("FOMO buyback & burn", "FOMO 回购销毁"),
            value: 5,
            color: "#63b7e8",
            detail:
              mode === "fomo"
                ? `${formatAmount(burn)} FOMO3D`
                : `${formatAmount(buyback)} SUI → FOMO3D`,
          },
        ]),
  ];
  let threshold = CAP / 4n;
  for (let i = 0; i < stage; i++) threshold += (CAP - threshold) / 4n;
  const divisor = 1n << BigInt(stage),
    reward = (2_000_000_000n * 5000n) / divisor;
  const nav = [
    ["overview", t("How to play", "如何参与")],
    ["settlement", t("Prize distribution", "奖金分配")],
    ["ico", t("ICO & launch", "ICO 与启动")],
    ["tokenomics", t("FOMO3D allocation", "代币分配")],
    ["pricing", t("Key pricing", "Key 定价")],
    ["halving", t("Rewards & halving", "奖励与减半")],
    ["amm", t("Swap & liquidity", "兑换与流动性")],
    ["risks", t("Risks & verification", "风险与验证")],
  ];
  return (
    <>
      <PageTitle
        eyebrow={t("THE FOMO3D FIELD GUIDE", "FOMO3D 游戏指南")}
        title={t("Understand every move.", "读懂每一步。")}
        description={t(
          "Contract-based rules, interactive examples, and verifiable on-chain mechanics.",
          "以真实合约为依据，结合交互示例理解链上机制。",
        )}
      />
      <div className="docs-layout">
        <aside className="docs-toc">
          <div>
            <BookOpen size={16} />
            {t("In this guide", "本页目录")}
          </div>
          {nav.map(([id, label], i) => (
            <a href={`#${id}`} key={id}>
              <span>0{i + 1}</span>
              {label}
            </a>
          ))}
          {p.config.packageId && (
            <a
              href={explorer(p.config.network, "object", p.config.packageId)}
              target="_blank"
              rel="noreferrer"
              className="docs-verify"
            >
              {t("Verify deployed package", "查看已部署合约")}
              <ExternalLink size={13} />
            </a>
          )}
        </aside>
        <div className="docs-content">
          <DocSection
            id="overview"
            n="01"
            title={t("One key resets the clock.", "一把 Key，重置时钟。")}
          >
            <p className="doc-lead">
              {t(
                "Fomo3D is a last-buyer game on Sui. Every successful key purchase adds its full payment to the pool and becomes the new last buyer. When the timer expires, anyone may settle the round; the prize goes to the last buyer, not the settler.",
                "Fomo3D 是 Sui 上的最后购买者游戏。每次成功购买 Key，全部付款进入奖池，购买者成为新的最后玩家。倒计时结束后任何人都能结算，奖金属于最后购买者，而非结算发起者。",
              )}
            </p>
            <div className="doc-flow">
              <div>
                <KeyRound />
                <strong>{t("Buy a key", "购买 Key")}</strong>
                <p>{t("Pay the exact current price", "支付当前精确价格")}</p>
                <ArrowRight className="flow-arrow" size={16} />
              </div>
              <div>
                <Clock3 />
                <strong>{t("Reset the timer", "重置计时")}</strong>
                <p>{t("Chain Clock + countdown", "链上时间 + 倒计时")}</p>
                <ArrowRight className="flow-arrow" size={16} />
              </div>
              <div>
                <Coins />
                <strong>{t("Settle the round", "结算轮次")}</strong>
                <p>{t("65% to the last buyer", "65% 奖金发给最后玩家")}</p>
              </div>
            </div>
            <div className="notice">
              {t(
                "Before the first key, maturity is zero: the game is Waiting with no countdown. Every new round returns to this state. The configured Devnet SUI game has a 60-second countdown; community games may choose 10 seconds to 8 hours.",
                "第一把 Key 前 maturity 为零，游戏处于等待状态，没有倒计时。每个新轮次都从该状态开始。已配置的 Devnet SUI 游戏倒计时为 60 秒，社区游戏可设置 10 秒至 8 小时。",
              )}
            </div>
          </DocSection>
          <DocSection
            id="settlement"
            n="02"
            title={t("Where the prize pool goes.", "奖池如何分配。")}
          >
            <p>
              {t(
                "Choose a game type and change the example jackpot. These are educational calculations, not live pool data. Examples use 9 decimals; real transactions use the coin’s actual decimals.",
                "选择游戏类型并修改示例奖池。这些是规则演示，不是实时奖池数据。示例使用 9 位小数，实际交易使用代币真实精度。",
              )}
            </p>
            <div className="segmented docs-modes">
              {[
                ["sui", "SUI"],
                ["meme", t("Community token", "社区代币")],
                ["fomo", "FOMO3D"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={mode === id ? "active" : ""}
                  onClick={() => setMode(id as typeof mode)}
                >
                  {label}
                </button>
              ))}
            </div>
            <Field label={t("Example jackpot", "示例奖池")}>
              <input
                value={pot}
                onChange={(e) => setPot(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            {poolError ? (
              <p className="error">{poolError}</p>
            ) : (
              <Donut
                slices={rewardSlices}
                label={t("PRIZE DISTRIBUTION", "奖金分配")}
                center="65%"
              />
            )}
            <p className="note">
              {t(
                "Allocations are floored in raw units. Rounding dust stays in the next-round pool, so its precise share may be slightly above 30%.",
                "各份额按原始单位向下取整，零头留在下一轮奖池，因此其精确比例可能略高于 30%。",
              )}
            </p>
            <div className="doc-callout">
              {mode === "meme"
                ? t(
                    "Blackhole Transfer sends tokens to 0x0. It does not call the third-party coin’s burn function and does not guarantee its total supply decreases.",
                    "黑洞转账将代币发送至 0x0，未调用第三方代币的销毁函数，不保证减少其总供应量。",
                  )
                : mode === "fomo"
                  ? t(
                      "The dedicated FOMO3D game burns 5% directly using its TreasuryCap. It does not use the community-token two-hop buyback route.",
                      "FOMO3D 专用游戏通过 TreasuryCap 直接销毁 5%，不采用普通代币的两跳回购。",
                    )
                  : t(
                      "The 5% buyback budget includes pending amounts from earlier rounds. If reserves or timing prevent a swap, the budget stays in pending_buyback for a future settlement.",
                      "5% 回购预算会叠加以前轮次的待执行金额。储备或时间限制导致无法兑换时，资金保留在 pending_buyback，等待后续结算。",
                    )}
            </div>
          </DocSection>
          <DocSection
            id="ico"
            n="03"
            title={t("A community-funded launch.", "由社区共同启动。")}
          >
            <div className="stats-grid compact">
              <Stat label={t("ICO TARGET", "募资目标")} value="11,000 SUI" />
              <Stat
                label={t("PER 1 SUI", "每 1 SUI 获得")}
                value="200,000 FOMO3D"
              />
            </div>
            <div className="ico-flow">
              <div>
                <span>11,000 SUI</span>
                <small>{t("ICO contributions", "ICO 募集资金")}</small>
              </div>
              <ArrowRight />
              <div>
                <span>1,000 SUI + 200M FOMO3D</span>
                <small>
                  {t(
                    "Initial AMM liquidity · initial LP transferred to 0x0",
                    "初始 AMM 流动性 · 初始 LP 转至 0x0",
                  )}
                </small>
                <span>10,000 SUI</span>
                <small>
                  {t("Main SUI game’s initial jackpot", "主 SUI 游戏初始奖池")}
                </small>
              </div>
            </div>
            <ol className="doc-list">
              <li>
                {t(
                  "Before completion, participants may refund their full current contribution, removing its FOMO claim entitlement.",
                  "达标前可退还当前全部认购，同时移除对应 FOMO 领取份额。",
                )}
              </li>
              <li>
                {t(
                  "The last contribution creates the FOMO/SUI pool, sets Registry.version to 1, closes the ICO and emits IcoCompleted in the same transaction.",
                  "最后一笔认购在同一交易内创建 FOMO/SUI 池、将 Registry.version 设为 1、关闭 ICO 并发出 IcoCompleted。",
                )}
              </li>
              <li>
                {t(
                  "The frontend verifies completion evidence and refreshed chain state. A 100% progress bar alone is insufficient. No administrator start is needed afterward.",
                  "前端核对完成事件与最新链上状态，仅进度达到 100% 不足以判定完成，无需管理员再次启动。",
                )}
              </li>
              <li>
                {t(
                  "Participants claim FOMO separately. The game is open, but its countdown starts only after the first key.",
                  "参与者单独领取 FOMO。游戏已开放，但倒计时在第一把 Key 购买后才开始。",
                )}
              </li>
            </ol>
            <Link to="/ico" className="text-link">
              {t("View live ICO status", "查看实时 ICO 状态")}
              <ArrowRight size={15} />
            </Link>
          </DocSection>
          <DocSection
            id="tokenomics"
            n="04"
            title={t(
              "FOMO3D: issuance, not promises.",
              "FOMO3D：发行规则，而非收益承诺。",
            )}
          >
            <div className="doc-token">
              <Logo />
              <div>
                <strong>FOMO3D</strong>
                <p>
                  9 decimals ·{" "}
                  {t(
                    "Configured lifetime cap: 10 billion",
                    "配置终身发行上限：100 亿枚",
                  )}
                </p>
              </div>
            </div>
            <Donut
              center="10B"
              label={t("CONFIGURED CAP", "配置发行上限")}
              slices={[
                {
                  label: t("ICO claim entitlement", "ICO 可领取份额"),
                  value: 22,
                  color: "#eec780",
                  detail: t(
                    "2.2 billion for a fully subscribed ICO",
                    "募资满额对应 22 亿枚",
                  ),
                },
                {
                  label: t("Initial AMM mint", "初始 AMM 铸币"),
                  value: 2,
                  color: "#63b7e8",
                  detail: t(
                    "200 million minted on ICO completion",
                    "ICO 达标时铸造 2 亿枚",
                  ),
                },
                {
                  label: t("Remaining issuance capacity", "剩余发行空间"),
                  value: 76,
                  color: "#9b89c6",
                  detail: t(
                    "7.6 billion nominal capacity, mainly for game rewards",
                    "名义剩余 76 亿枚，主要供游戏奖励发行",
                  ),
                },
              ]}
            />
            <p>
              {t(
                "The 76% is capacity left after full ICO claims and the initial pool mint, not a separately reserved or pre-minted allocation. There is no standalone team, airdrop or vesting allocation in this contract. ICO claims and game rewards share the same lifetime issuance check.",
                "76% 是全部 ICO 领取和初始建池铸币后的剩余空间，并非单独锁定或预铸份额。当前合约没有独立的团队、空投或归属释放分配。ICO 领取与游戏奖励共用同一终身发行检查。",
              )}
            </p>
            <div className="formula">
              {t(
                "Lifetime issued = current supply + total burned",
                "终身累计发行 = 当前供应量 + 累计销毁量",
              )}
            </div>
            <p>
              {t(
                "Burning reduces current supply but does not restore lifetime issuance capacity. Actual issuance is MintProcessed.actual_minted; an entitlement removed or reward requested does not prove minting occurred.",
                "销毁减少当前供应量，但不会恢复终身发行额度。实际发行以 MintProcessed.actual_minted 为准，移除份额或申请奖励不等同于成功铸币。",
              )}
            </p>
            <div className="warning">
              {t(
                "Contract limitation: the cap is checked before minting without clamping the mint to remaining capacity. A mint may overshoot the configured cap, and a later claim may remove entitlement but mint zero. This chart describes configured capacity, not an absolute supply guarantee.",
                "合约限制：上限在铸币前检查，单笔铸币量未裁剪到剩余额度，可能超出配置上限。后续领取可能移除份额但实际铸币为零。此图表示配置空间，不是供应量绝对上限保证。",
              )}
            </div>
          </DocSection>
          <DocSection
            id="pricing"
            n="05"
            title={t(
              "Linear growth. Exact arithmetic.",
              "线性增长，精确计算。",
            )}
          >
            <p>
              {t(
                "Price grows by a fixed increment based on the initial price. The growth parameter is per mille, not a percentage of the previous key’s price.",
                "价格按基于初始价格的固定增量增长。涨幅参数是初始价格的千分比，不是前一把 Key 价格的百分比。",
              )}
            </p>
            <div className="formula">
              increment = floor(initial × pup / 1000)
              <br />
              next_price = initial + total_keys × increment
            </div>
            <div className="two-columns">
              <Field
                label={t("Example initial price · SUI", "示例初始价格 · SUI")}
              >
                <input
                  inputMode="decimal"
                  value={initial}
                  onChange={(e) => setInitial(e.target.value)}
                />
              </Field>
              <Field
                label={t(
                  "Growth · per mille (0–255)",
                  "涨幅 · 千分比（0–255）",
                )}
              >
                <input
                  inputMode="numeric"
                  value={growth}
                  onChange={(e) => setGrowth(e.target.value)}
                />
              </Field>
            </div>
            <Field
              label={`${t("Keys already purchased", "已购买 Key 数量")}: ${keys}`}
            >
              <input
                type="range"
                min="0"
                max="1000"
                value={keys}
                onChange={(e) => setKeys(Number(e.target.value))}
              />
            </Field>
            <div className="price-chart">
              <svg
                viewBox="0 0 600 160"
                role="img"
                aria-label={t(
                  "Linear key price example",
                  "Key 价格线性增长示例",
                )}
              >
                <path d="M30 12V135H580" stroke="#3c465a" fill="none" />
                <path
                  d={increment === 0n ? "M30 125H570" : "M30 125L570 20"}
                  stroke="#eec780"
                  fill="none"
                  strokeWidth="3"
                />
                <circle
                  cx={30 + keys * 0.54}
                  cy={increment === 0n ? 125 : 125 - keys * 0.105}
                  r="6"
                  fill="#6acbff"
                />
                <text x="30" y="155" fill="#7f8ca4" fontSize="11">
                  0
                </text>
                <text x="530" y="155" fill="#7f8ca4" fontSize="11">
                  1,000 keys
                </text>
              </svg>
            </div>
            <div className="stats-grid compact">
              <Stat
                label={t("FIXED INCREMENT", "固定增量")}
                value={`${formatAmount(increment, 9, 9)} SUI`}
              />
              <Stat
                label={t("NEXT KEY PRICE", "下一把 KEY 价格")}
                value={`${formatAmount(price, 9, 9)} SUI`}
              />
            </div>
            <p className="note">
              {t(
                "Illustrative chart with a normalized vertical scale. Real purchases re-read the exact on-chain count and price before signing.",
                "示意图采用归一化纵轴，实际购买在签名前重新读取链上 Key 数量和精确价格。",
              )}
            </p>
            {priceError && <p className="error">{priceError}</p>}
          </DocSection>
          <DocSection
            id="halving"
            n="06"
            title={t(
              "Rewards halve as issuance grows.",
              "随发行量增长，奖励减半。",
            )}
          >
            <p>
              {t(
                "Only SUI-game key purchases mint game rewards: raw SUI paid × 5,000 ÷ reward divisor. Both tokens have 9 decimals, so a 2 SUI key initially mints 10,000 FOMO3D. Other token games do not mint this reward.",
                "只有 SUI 游戏购买 Key 会铸造游戏奖励：SUI 原始付款量 × 5,000 ÷ 奖励除数。两种代币均为 9 位小数，因此初始 2 SUI Key 对应 10,000 FOMO3D。其他代币游戏不产生此奖励。",
              )}
            </p>
            <div className="formula">
              reward = floor(paid_sui_raw × 5000 / divisor)
              <br />
              next_threshold = threshold + floor((cap − threshold) / 4)
            </div>
            <Field
              label={`${t("Explore reward stage (illustration)", "查看奖励阶段（演示）")}: ${stage}`}
            >
              <input
                type="range"
                min="0"
                max="10"
                value={stage}
                onChange={(e) => setStage(Number(e.target.value))}
              />
            </Field>
            <div
              className="halving-bars"
              role="group"
              aria-label={t("Reward stages", "奖励阶段")}
            >
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  style={{ height: `${Math.max(8, 120 / 2 ** i)}px` }}
                  className={i === stage ? "selected" : ""}
                  onClick={() => setStage(i)}
                  aria-label={`${t("Stage", "阶段")} ${i}`}
                >
                  <span>{i}</span>
                </button>
              ))}
            </div>
            <div className="stats-grid compact">
              <Stat
                label={t("EXAMPLE DIVISOR", "示例奖励除数")}
                value={`÷ ${divisor}`}
              />
              <Stat
                label={t("2 SUI KEY REWARD", "2 SUI KEY 的奖励")}
                value={`${formatAmount(reward, 9, 9)} FOMO`}
              />
              <Stat
                label={t("NEXT LIFETIME THRESHOLD", "下一终身发行门槛")}
                value={formatAmount(threshold)}
              />
              <Stat
                label={t("LIVE ON-CHAIN DIVISOR", "实际链上奖励除数")}
                value={
                  p.data?.halving?.halved ? `÷ ${p.data.halving.halved}` : "—"
                }
              />
            </div>
            <p>
              {t(
                "The first threshold is 2.5 billion lifetime-issued tokens. Halving is checked once per SUI reward mint. Large issuance jumps may need several purchases to catch up; ICO claims do not advance halving themselves. The divisor stops increasing after 2³⁰.",
                "首次门槛为终身累计发行 25 亿枚，每次 SUI 奖励铸造最多执行一次减半。发行量跃升后可能需要多次购买才能追上阶段，ICO 领取本身不推进减半。奖励除数最多增长至 2³⁰。",
              )}
            </p>
          </DocSection>
          <DocSection
            id="amm"
            n="07"
            title={t("The AMM and its real fees.", "AMM 与真实手续费。")}
          >
            <div className="formula">
              gross_out = floor(amount_in × reserve_out / (reserve_in +
              amount_in))
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("Operation", "操作")}</th>
                    <th>{t("Contract calculation", "合约计算")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Token → SUI</td>
                    <td>
                      {t(
                        "Two fees of floor(gross_out × 15 / 1000): one to admin, one retained in the pool. Net ≈ 97% of gross.",
                        "两笔各 floor(gross_out × 15 / 1000) 的费用：一笔给管理员，一笔留池。净输出约为毛输出的 97%。",
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td>SUI → Token</td>
                    <td>
                      {t(
                        "No separate swap fee; AMM price impact still applies.",
                        "无额外兑换费用，仍存在 AMM 价格影响。",
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td>{t("Remove LP", "移除 LP")}</td>
                    <td>
                      {t(
                        "1% of gross SUI output goes to admin. min_y checks the gross output before this fee.",
                        "SUI 毛输出的 1% 给管理员，min_y 检查扣费前毛输出。",
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              {t(
                "Adding liquidity returns an LP object and unused tokens. Removing liquidity consumes one entire LP. Community game creators own the initial LP and may withdraw liquidity. The ICO-created FOMO pool is different: its initial LP is transferred to 0x0.",
                "添加流动性返回 LP 对象与多余代币，移除流动性消耗整个 LP。社区游戏创建者持有初始 LP 并可撤出流动性。ICO 创建的 FOMO 池不同，其初始 LP 转至 0x0。",
              )}
            </p>
            <Link to="/fomo?tab=liquidity" className="text-link">
              {t("Explore liquidity", "查看流动性")}
              <ArrowRight size={15} />
            </Link>
          </DocSection>
          <DocSection
            id="risks"
            n="08"
            title={t("What the UI cannot guarantee.", "界面无法保证的事情。")}
          >
            <ul className="doc-list">
              <li>
                {t(
                  "Keys are not refundable. Another player may buy later. You can lose all funds; there is no guaranteed return.",
                  "Key 不可退款，可能出现后续玩家。参与可能损失全部资金，无收益保证。",
                )}
              </li>
              <li>
                {t(
                  "Creator-owned LP, shallow liquidity and price manipulation affect buyback outcomes. The same-Clock-timestamp guard is not a general MEV defense.",
                  "创建者控制的 LP、浅流动性和价格操纵影响回购结果。同一时钟检查并非全面 MEV 防护。",
                )}
              </li>
              <li>
                {t(
                  "AdminCap can change the protocol version. This frontend never uses change_version to bypass ICO conditions.",
                  "AdminCap 在合约中可修改协议版本，本前端不使用 change_version 绕过 ICO 条件。",
                )}
              </li>
              <li>
                {t(
                  "A permanent catalog needs a running persistent index. Public RPC history can be pruned. Live balances and transaction validity always come from the chain.",
                  "永久目录依赖持续运行的持久索引。公共 RPC 历史可能被裁剪，实时余额和交易有效性始终以链上状态为准。",
                )}
              </li>
              <li>
                {t(
                  "Your wallet handles every signature. This site never requests, stores or uploads private keys or seed phrases.",
                  "每次签名由你的钱包完成，网站不索取、保存或上传私钥、助记词。",
                )}
              </li>
            </ul>
            <div className="docs-source">
              <ShieldCheck size={20} />
              <div>
                <strong>{t("Source of truth", "规则来源")}</strong>
                <p>
                  <a
                    href="https://github.com/otctoken/fomo3d/tree/main/contract/sources"
                    target="_blank"
                    rel="noreferrer"
                  >
                    coin.move · fomo.move · swap.move ↗
                  </a>
                </p>
                <p className="small-code">{p.config.packageId}</p>
              </div>
            </div>
          </DocSection>
        </div>
      </div>
    </>
  );
}
