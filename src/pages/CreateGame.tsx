import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { normalizeStructTag } from "@mysten/sui/utils";
import { useMetadata } from "../hooks/useProtocol";
import { useI18n } from "../components/I18n";
import { useTransaction } from "../components/Transactions";
import { PageTitle, Field, Balance } from "../components/Common";
import { createGame } from "../lib/transactions/builders";
import { parseAmount } from "../lib/sui/math";
import { eventSchemas } from "../lib/events/schemas";
import { SUI } from "../config/contracts";
export function CreateGame() {
  const { t } = useI18n(),
    tx = useTransaction(),
    account = useCurrentAccount(),
    navigate = useNavigate();
  const [type, setType] = useState(""),
    [seed, setSeed] = useState(""),
    [tokens, setTokens] = useState(""),
    [sui, setSui] = useState("100"),
    [price, setPrice] = useState(""),
    [pup, setPup] = useState("2"),
    [seconds, setSeconds] = useState("60"),
    [ack, setAck] = useState(false),
    [error, setError] = useState("");
  let coinType = "";
  try {
    coinType = normalizeStructTag(type);
  } catch {
    /* Incomplete input. */
  }
  const meta = useMetadata(coinType);
  function submit() {
    try {
      if (!meta.data)
        throw new Error(
          t("Verified token metadata is required.", "需要成功读取代币元数据。"),
        );
      if (!/^\d+$/.test(seconds) || !/^\d+$/.test(pup))
        throw new Error("Countdown and growth must be integers");
      const params = {
        type: coinType,
        initial: parseAmount(seed, meta.data.decimals),
        tokenLiquidity: parseAmount(tokens, meta.data.decimals),
        suiLiquidity: parseAmount(sui),
        price: parseAmount(price, meta.data.decimals),
        pup: Number(pup),
        countdown: BigInt(seconds) * 1000n,
      };
      setError("");
      tx.request({
        label: t("Create a new game", "创建新游戏"),
        details: t(
          "Deposits seed an irreversible shared game and a new AMM pool. You receive its initial LP position and can withdraw its liquidity.",
          "投入资金创建共享游戏和 AMM 池。你将收到初始 LP，可按合约规定撤出流动性。",
        ),
        build: (c) => createGame(c, params),
        onSuccess: (result) => {
          const event = result.events.find((e) =>
            e.eventType.includes("::game::GameCreated<"),
          );
          if (event) {
            const created = eventSchemas.GameCreated.parse(event.bcs);
            navigate(`/game/${created.game_id}`);
          }
        },
      });
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <>
      <PageTitle
        eyebrow={t("CREATE YOUR ARENA", "创建专属游戏")}
        title={t("Your community. Your endgame.", "你的社区，你的终局。")}
        description={t(
          "Launch a game and a Token/SUI pool in one wallet transaction.",
          "通过一笔钱包交易创建游戏与 Token/SUI 流动性池。",
        )}
      />
      <div className="form-layout">
        <section className="panel">
          <Field label="Coin Type" hint="0x…::module::TOKEN">
            <input
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="0x…::coin::COIN"
              spellCheck={false}
            />
          </Field>
          {meta.data && (
            <div className="notice">
              {meta.data.name} · {meta.data.symbol} · {meta.data.decimals}{" "}
              decimals
            </div>
          )}
          {meta.error && <p className="error">{meta.error.message}</p>}
          {coinType && <Balance type={coinType} />}
          <div className="two-columns">
            <Field label={t("Initial prize pool", "初始奖池投入")}>
              <input
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
              />
            </Field>
            <Field label={t("Token liquidity", "代币流动性")}>
              <input
                value={tokens}
                onChange={(e) => setTokens(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
              />
            </Field>
            <Field
              label={t("SUI liquidity · minimum 100", "SUI 流动性 · 至少 100")}
            >
              <input
                value={sui}
                onChange={(e) => setSui(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Field
              label={t("Initial key price · tokens", "初始 Key 价格 · 代币")}
              hint={t("1,000 to 10¹⁶ raw units", "1,000 至 10¹⁶ 原始单位")}
            >
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
              />
            </Field>
            <Field
              label={t("Linear increase · per mille", "线性涨幅 · 千分比")}
              hint="u8 · 0–255"
            >
              <input
                value={pup}
                onChange={(e) => setPup(e.target.value)}
                inputMode="numeric"
              />
            </Field>
            <Field
              label={t("Countdown · seconds", "倒计时 · 秒")}
              hint="10–28,800"
            >
              <input
                value={seconds}
                onChange={(e) => setSeconds(e.target.value)}
                inputMode="numeric"
              />
            </Field>
          </div>
          <Balance type={SUI} />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            <span>
              {t(
                "I understand that I hold the initial LP and may withdraw liquidity. Prize-pool deposits cannot be freely withdrawn.",
                "我理解初始 LP 由创建者持有并可撤出流动性。奖池投入不能自由撤回。",
              )}
            </span>
          </label>
          {error && <p className="error">{error}</p>}
          <button
            className="button primary full"
            disabled={!ack || !account || !meta.data || tx.busy}
            onClick={submit}
          >
            {t("Review & create game", "检查并创建游戏")}
          </button>
        </section>
        <aside className="panel help-panel">
          <span className="step">01</span>
          <h3>{t("Bring your token", "选择你的代币")}</h3>
          <p>
            {t(
              "One game per compatible Coin Type. SUI and FOMO3D use dedicated initialization.",
              "每个兼容 Coin Type 只可创建一个游戏。SUI 与 FOMO3D 使用专用初始化。",
            )}
          </p>
          <span className="step">02</span>
          <h3>{t("Set the rules", "设置游戏参数")}</h3>
          <p>
            {t(
              "Each purchase increases the key price linearly and resets the countdown. Parameters are fixed at creation.",
              "每次购买按线性规则提高 Key 价格并重置倒计时。创建后参数固定。",
            )}
          </p>
          <span className="step">03</span>
          <h3>{t("Seed the arena", "注入奖池与流动性")}</h3>
          <p>
            {t(
              "65% winner, 30% next round, 2% buyback and 3% blackhole transfer. Pool ratios determine the initial AMM price.",
              "65% 赢家、30% 下一轮、2% 回购、3% 黑洞转账。初始存入比例决定 AMM 价格。",
            )}
          </p>
        </aside>
      </div>
    </>
  );
}
