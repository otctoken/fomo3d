import { executionError } from "../lib/transactions/errors";
import { recordConfirmedEvents } from "../lib/events";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  useCurrentAccount,
  useCurrentClient,
  useCurrentNetwork,
  useDAppKit,
} from "@mysten/dapp-kit-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Transaction } from "@mysten/sui/transactions";
import type { SuiClientTypes } from "@mysten/sui/client";
import {
  X,
  CheckCircle2,
  LoaderCircle,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { useProtocol } from "../hooks/useProtocol";
import { explorer } from "../config/contracts";
import { formatAmount, short } from "../lib/sui/math";
import type { TxContext } from "../lib/transactions/builders";
import { useI18n } from "./I18n";
type Build = (c: TxContext) => Promise<Transaction>;
type Result = SuiClientTypes.Transaction<{ events: true; effects: true }>;
type Request = {
  label: string;
  details: string;
  build: Build;
  onSuccess?: (result: Result) => void;
};
const Context = createContext<{ busy: boolean; request: (r: Request) => void }>(
  { busy: false, request: () => {} },
);
export const useTransaction = () => useContext(Context);
export function explainError(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  const hints: Record<string, string> = {
    EVersion: "ICO has not completed / 协议尚未开放",
    EAmount: "Key price changed / Key 价格已变化",
    ERound: "Round timing changed / 轮次时间已变化",
    ESlippage: "Slippage exceeded / 超过滑点",
    ESpt: "Pool already used this Clock tick; retry / 当前时钟池已使用，请重试",
    EInitsui: "At least 100 SUI required / 至少需要 100 SUI",
  };
  const match = Object.entries(hints).find(([code]) => message.includes(code));
  return match ? `${match[1]} · ${message}` : message;
}
export function TransactionProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n(),
    account = useCurrentAccount(),
    client = useCurrentClient(),
    network = useCurrentNetwork(),
    kit = useDAppKit(),
    cache = useQueryClient(),
    p = useProtocol();
  const lock = useRef(false),
    [task, setTask] = useState<Request>(),
    [stage, setStage] = useState(""),
    [error, setError] = useState(""),
    [gas, setGas] = useState<bigint>(),
    [digest, setDigest] = useState(""),
    [result, setResult] = useState<Result>();
  const identity = useRef("");
  const executing = useRef(false);
  const context = (): TxContext => {
    if (!account)
      throw new Error(t("Connect your wallet first", "请先连接钱包"));
    if (!account.chains.includes(`sui:${network}`))
      throw new Error(
        t("Wallet does not support the selected network", "钱包不支持当前网络"),
      );
    return {
      client,
      sender: account.address,
      packageId: p.config.packageId,
      fomoType: p.config.fomoType,
      ids: p.ids,
    };
  };
  async function simulate(build: Build) {
    const c = context();
    const tx = await build(c);
    await tx.build({ client });
    const response = await client.simulateTransaction({
      transaction: tx,
      include: { effects: true },
    });
    if (response.FailedTransaction)
      throw executionError(response.FailedTransaction.status.error);
    if (response.gasPaymentMocked)
      throw new Error(
        "Simulation used mocked gas. A funded wallet is required.",
      );
    const costs = response.Transaction.effects.gasUsed;
    setGas(BigInt(costs.computationCost) + BigInt(costs.storageCost));
    return tx;
  }
  async function request(r: Request) {
    if (lock.current) return;
    lock.current = true;
    setTask(r);
    setError("");
    setDigest("");
    setResult(undefined);
    setGas(undefined);
    setStage("simulating");
    identity.current = `${network}:${account?.address}`;
    try {
      await simulate(r.build);
      setStage("review");
    } catch (e) {
      setError(explainError(e));
      setStage("error");
    }
  }
  async function execute() {
    if (!task || stage !== "review" || executing.current) return;
    executing.current = true;
    setStage("signing");
    try {
      if (identity.current !== `${network}:${account?.address}`)
        throw new Error("Account or network changed. Close and retry.");
      // A fresh transaction and a second simulation protect against stale shared-object state.
      const tx = await simulate(task.build);
      if (
        kit.stores.$currentNetwork.get() !== network ||
        kit.stores.$connection.get().account?.address !== account?.address
      )
        throw new Error(
          "Account or network changed during preflight. Close and retry.",
        );
      const response = await kit.signAndExecuteTransaction({
        transaction: tx,
        network,
        account: account!,
      });
      const executed = response.Transaction ?? response.FailedTransaction;
      setDigest(executed.digest);
      if (response.FailedTransaction)
        throw executionError(response.FailedTransaction.status.error);
      setStage("confirming");
      const confirmed = await client.waitForTransaction({
        digest: executed.digest,
        include: { events: true, effects: true },
        timeout: 60000,
      });
      if (confirmed.FailedTransaction)
        throw executionError(confirmed.FailedTransaction.status.error);
      const entry = {
        digest: executed.digest,
        label: task.label,
        time: Date.now(),
        network,
      };
      const key = `fomo-txs:${network}:${account!.address}`;
      try {
        const old = JSON.parse(localStorage.getItem(key) || "[]");
        localStorage.setItem(
          key,
          JSON.stringify([entry, ...old].slice(0, 100)),
        );
      } catch {
        /* Storage is optional. */
      }
      setResult(confirmed.Transaction);
      recordConfirmedEvents(network, p.config.packageId, confirmed.Transaction);
      setStage("success");
      await cache.invalidateQueries();
      task.onSuccess?.(confirmed.Transaction);
    } catch (e) {
      setError(explainError(e));
      setStage("error");
      await cache.invalidateQueries();
    }
  }
  function close() {
    if (["signing", "confirming", "simulating"].includes(stage)) return;
    setTask(undefined);
    lock.current = false;
    executing.current = false;
  }
  return (
    <Context.Provider value={{ busy: !!task, request: (r) => void request(r) }}>
      {children}
      {task && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tx-title"
          >
            <button
              className="icon-button close"
              onClick={close}
              disabled={["signing", "confirming", "simulating"].includes(stage)}
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <div className="modal-icon">
              {stage === "success" ? (
                <CheckCircle2 />
              ) : stage === "review" ? (
                <ShieldCheck />
              ) : (
                <LoaderCircle className={stage === "error" ? "" : "spin"} />
              )}
            </div>
            <p className="eyebrow">
              {network} · {t("WALLET TRANSACTION", "钱包交易")}
            </p>
            <h2 id="tx-title">{task.label}</h2>
            <p className="muted">{task.details}</p>
            <div className="summary-row">
              <span>{t("Account", "账户")}</span>
              <code>{short(account?.address)}</code>
            </div>
            <div className="summary-row">
              <span>{t("Estimated gross gas", "预计 Gas（未扣返还）")}</span>
              <strong>{formatAmount(gas, 9, 6)} SUI</strong>
            </div>
            {stage === "review" && (
              <>
                <p className="note">
                  {t(
                    "Review the amounts. Your wallet will request approval. Gas and shared state may change before execution.",
                    "请核对金额，随后由钱包确认签名。Gas 和共享对象状态可能变化。",
                  )}
                </p>
                <button
                  className="button primary full"
                  onClick={() => void execute()}
                >
                  {t("Confirm in wallet", "在钱包中确认")}
                </button>
              </>
            )}
            {["simulating", "signing", "confirming"].includes(stage) && (
              <p role="status" className="notice">
                {stage === "simulating"
                  ? t(
                      "Checking balances and simulating…",
                      "正在检查余额并模拟交易…",
                    )
                  : stage === "signing"
                    ? t("Waiting for wallet confirmation…", "等待钱包确认…")
                    : t("Waiting for on-chain confirmation…", "等待链上确认…")}
              </p>
            )}
            {error && (
              <div className="error" role="alert">
                {error}
                {digest && (
                  <p>
                    {t(
                      "A digest exists. Check its status before retrying to avoid a duplicate operation.",
                      "已存在交易哈希，重试前请检查状态，避免重复操作。",
                    )}
                  </p>
                )}
              </div>
            )}
            {digest && (
              <a
                className="text-link"
                target="_blank"
                rel="noreferrer"
                href={explorer(network, "tx", digest)}
              >
                {t("View transaction", "查看交易")} {short(digest)}{" "}
                <ExternalLink size={14} />
              </a>
            )}
            {result && (
              <div className="success">
                {t(
                  "Confirmed on Sui. Balances and games refreshed.",
                  "Sui 链上已确认，余额和游戏已刷新。",
                )}
                {result.events
                  .filter((e) =>
                    /::(GameCreated|PoolCreated)</.test(e.eventType),
                  )
                  .map((e, i) => (
                    <pre key={i}>{JSON.stringify(e.json, null, 2)}</pre>
                  ))}
              </div>
            )}
            {["error", "success"].includes(stage) && (
              <button className="button secondary full" onClick={close}>
                {t("Close", "关闭")}
              </button>
            )}
          </section>
        </div>
      )}
    </Context.Provider>
  );
}
