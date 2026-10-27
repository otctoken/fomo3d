import { useState } from "react";
import { useProtocol, useOwned } from "../hooks/useProtocol";
import { useI18n } from "../components/I18n";
import { useTransaction } from "../components/Transactions";
import { PageTitle, Field, Empty, Stat } from "../components/Common";
import { adminInitialize } from "../lib/transactions/builders";
import { parseAmount } from "../lib/sui/math";
export function Admin() {
  const p = useProtocol(),
    owned = useOwned(),
    { t } = useI18n(),
    tx = useTransaction(),
    [mode, setMode] = useState("sui"),
    [seconds, setSeconds] = useState("60"),
    [price, setPrice] = useState("2"),
    [pup, setPup] = useState("2"),
    [seed, setSeed] = useState("200000"),
    [ack, setAck] = useState(false),
    [error, setError] = useState("");
  const cap = owned.data?.adminCaps[0];
  if (!cap)
    return (
      <Empty title={t("AdminCap required", "需要 AdminCap")}>
        {t(
          "This page is available only to a connected account holding the deployment’s AdminCap.",
          "此页面仅向持有当前部署 AdminCap 的钱包开放。",
        )}
      </Empty>
    );
  function submit() {
    try {
      if (!/^\d+$/.test(seconds) || !/^\d+$/.test(pup))
        throw new Error("Use integer seconds and growth");
      const params = {
        fomo: mode === "fomo",
        countdown: BigInt(seconds) * 1000n,
        price: parseAmount(price),
        pup: Number(pup),
        seed: parseAmount(seed),
      };
      setError("");
      tx.request({
        label: t("Initialize shared game", "初始化共享游戏"),
        details: t(
          "Permanent initialization: this token cannot be registered twice. Parameters cannot be edited afterward. This does not complete the ICO or bypass its fundraising conditions.",
          "永久初始化：同一代币不能重复注册，参数后续无法修改。此操作不会完成 ICO，也不会绕过募资条件。",
        ),
        build: (c) => adminInitialize(c, cap!.objectId, params),
      });
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="ADMINCAP VERIFIED"
        title={t("Protocol administration", "协议管理")}
        description={cap.objectId}
      />
      <div className="stats-grid compact">
        <Stat
          label="Registry.version"
          value={p.data?.registry?.version ?? "—"}
        />
        <Stat
          label={t("Games discovered", "已发现游戏")}
          value={p.data?.games.length ?? "—"}
        />
      </div>
      <section className="panel narrow">
        <h2>{t("Initialize a game", "初始化游戏")}</h2>
        <Field label={t("Game type", "游戏类型")}>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="sui">SUI</option>
            <option value="fomo">FOMO3D</option>
          </select>
        </Field>
        <Field label={t("Countdown · seconds", "倒计时 · 秒")}>
          <input
            value={seconds}
            onChange={(e) => setSeconds(e.target.value)}
            inputMode="numeric"
          />
        </Field>
        <Field label={t("Initial key price", "初始 Key 价格")}>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
          />
        </Field>
        <Field label={t("Linear increase · per mille", "线性增长 · 千分比")}>
          <input
            value={pup}
            onChange={(e) => setPup(e.target.value)}
            inputMode="numeric"
          />
        </Field>
        {mode === "fomo" && (
          <Field
            label={t(
              "FOMO seed · minimum 200,000",
              "FOMO 初始投入 · 至少 200,000",
            )}
          >
            <input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              inputMode="decimal"
            />
          </Field>
        )}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
          />
          <span>
            {t(
              "I understand this permanently sets game parameters and consumes the supplied seed, if any.",
              "我理解此操作永久设置游戏参数，并投入所指定的初始资金。",
            )}
          </span>
        </label>
        <button
          className="button primary full"
          disabled={!ack || tx.busy || (mode === "sui" && !!p.ids.mainGame)}
          onClick={submit}
        >
          {t("Review initialization", "检查初始化")}
        </button>
        {error && <p className="error">{error}</p>}
        <p className="note">
          {t(
            "No version override is exposed. ICO completion is controlled by the deployed contract.",
            "不提供版本覆盖入口。ICO 达标由部署的合约控制。",
          )}
        </p>
      </section>
    </>
  );
}
