import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useProtocol } from "../hooks/useProtocol";
import { usePoolNames } from "../hooks/usePoolNames";
import { filterPools } from "../lib/poolSearch";
import { short } from "../lib/sui/math";
import { useI18n } from "./I18n";
import { Field } from "./Common";

export function PoolPicker() {
  const p = useProtocol(),
    { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const { names, pending } = usePoolNames(p.catalog.pools);
  const matches = filterPools(p.catalog.pools, search, names);
  const selected = p.plan.pools[0];
  const selectedVisible = matches.some((pool) => pool.id === selected?.id);
  function label(pool: (typeof p.catalog.pools)[number]) {
    const meta = names[pool.coinType];
    const name =
      meta?.name || meta?.symbol || pool.coinType.split("::").at(-1) || "Token";
    const characters = Array.from(name);
    const compactName =
      characters.length > 20 ? characters.slice(0, 20).join("") + "…" : name;
    return `${compactName} / SUI · ${short(pool.id)}`;
  }
  return (
    <section className="panel pool-picker">
      <div className="pool-picker-fields">
        <Field label={t("Search token or pool", "搜索代币或交易池")}>
          <input
            aria-label={t("Search token or pool", "搜索代币或交易池")}
            placeholder={t(
              "Name, symbol, coin type or pool address",
              "名称、符号、代币地址或池地址",
            )}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        <Field label={t("Pool", "交易池")}>
          <select
            aria-label={t("Pool", "交易池")}
            value={selected?.id || ""}
            onChange={(event) => {
              const next = new URLSearchParams(params);
              next.set("pool", event.target.value);
              setParams(next);
            }}
          >
            {!selected && (
              <option value="">{t("Select a pool", "选择交易池")}</option>
            )}
            {selected && !selectedVisible && (
              <option value={selected.id}>
                {t("Current", "当前")}: {label(selected)}
              </option>
            )}
            {matches.map((pool) => (
              <option key={pool.id} value={pool.id}>
                {label(pool)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {!matches.length && (
        <p className="note" role="status">
          {t("No matching pools.", "没有匹配的交易池。")}
        </p>
      )}
      {pending && (
        <p className="note" role="status">
          {t(
            "Loading token names… You can already search by address.",
            "正在加载代币名称…可先按地址搜索。",
          )}
        </p>
      )}
      {selected && (
        <p className="small-code pool-address">
          {selected.coinType}
          <br />
          {t("Pool", "交易池")}: {selected.id}
        </p>
      )}
    </section>
  );
}
