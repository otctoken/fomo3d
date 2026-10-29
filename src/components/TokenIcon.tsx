import { useEffect, useState } from "react";
import { coinLogoUrl } from "../lib/coinLogos";

export function TokenIcon({
  type,
  size = "",
  fallback = true,
}: {
  type: string;
  size?: string;
  fallback?: boolean;
}) {
  const url = coinLogoUrl(type);
  return (
    <LogoImage
      key={`${type}:${url || ""}`}
      url={url}
      size={size}
      fallback={fallback}
    />
  );
}

function LogoImage({
  url,
  size,
  fallback,
}: {
  url?: string;
  size: string;
  fallback: boolean;
}) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">(
    "loading",
  );
  useEffect(() => {
    if (!url || state !== "loading") return;
    const timer = setTimeout(() => setState("failed"), 10000);
    return () => clearTimeout(timer);
  }, [url, state]);
  if (!fallback && (!url || state === "failed")) return null;
  return (
    <span
      className={`token-icon ${size}`}
      aria-hidden="true"
      style={!fallback && state !== "loaded" ? { display: "none" } : undefined}
    >
      {fallback && (!url || state !== "loaded") && "◈"}
      {url && state !== "failed" && (
        <img
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          decoding="async"
          className={
            state === "loaded" ? "token-logo-loaded" : "token-logo-loading"
          }
          onLoad={(e) =>
            setState(e.currentTarget.naturalWidth > 0 ? "loaded" : "failed")
          }
          onError={() => setState("failed")}
        />
      )}
    </span>
  );
}
