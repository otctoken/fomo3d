import type { SuiClientTypes } from "@mysten/sui/client";
const codes: Record<string, Record<string, string>> = {
  game: {
    "0": "Unstarted round or missing entitlement / 轮次未开始或无可领取份额",
    "1": "Coin type already registered or unsupported / 代币已注册或类型不支持",
    "2": "Countdown out of range / 倒计时超出范围",
    "3": "Protocol version is not open / 协议尚未开放",
    "4": "Key price changed; refresh and retry / Key 价格变化，请刷新",
    "5": "Round timing changed / 轮次时间已变化",
    "6": "ICO is not in the required phase / ICO 阶段不符",
    "7": "Amount must be positive / 金额必须大于零",
    "8": "Key price overflow / Key 价格溢出",
    "9": "At least 100 SUI liquidity required / 至少 100 SUI 流动性",
    "10": "Initial key price out of range / 初始 Key 价格超出范围",
  },
  swap: {
    "0": "Zero amount or zero LP shares / 金额或 LP 份额为零",
    "1": "Insufficient liquidity / 流动性不足",
    "2": "Slippage exceeded / 超出滑点",
    "3": "LP belongs to another pool / LP 与池不匹配",
    "4": "SUI cannot be used as pool token / 不可用 SUI 创建此池",
    "5": "Pool already exists / 池已存在",
    "6": "Pool used in the same Clock tick; retry / 同一时钟池已使用，请重试",
  },
};
export function executionError(
  error: SuiClientTypes.ExecutionError | null | undefined,
) {
  if (!error) return new Error("Transaction failed");
  if (error.$kind === "MoveAbort") {
    const abort = error.MoveAbort,
      module = abort.location?.module || "",
      hint = codes[module]?.[abort.abortCode];
    return new Error(
      `${hint || error.message} [${module}::${abort.abortCode}]`,
    );
  }
  return new Error(error.message);
}
