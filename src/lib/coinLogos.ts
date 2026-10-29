import { normalizeStructTag } from "@mysten/sui/utils";
import registry from "../config/coin-logos.json";
import type { Network } from "../config/contracts";

type LogoRegistry = Partial<Record<Network | "common", Record<string, string>>>;

export function normalizeLogoUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed) || /[\s\\]/.test(trimmed))
    return undefined;
  try {
    const url = new URL(trimmed);
    if (!url.hostname || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export function coinLogoUrl(
  network: Network,
  coinType: string,
  logos: LogoRegistry = registry,
): string | undefined {
  let normalized: string;
  try {
    normalized = normalizeStructTag(coinType);
  } catch {
    return undefined;
  }
  // Network entries override common entries. Never match by ticker or package alone.
  for (const section of [logos[network], logos.common]) {
    for (const [type, url] of Object.entries(section || {})) {
      try {
        if (normalizeStructTag(type) === normalized)
          return normalizeLogoUrl(url);
      } catch {
        /* An invalid manual entry must not break other token icons. */
      }
    }
  }
  return undefined;
}
