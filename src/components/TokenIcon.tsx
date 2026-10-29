import { useEffect, useState } from "react";
import { coinLogoUrl } from "../lib/coinLogos";

export function TokenIcon({
  type,
  size = "",
}: {
  type: string;
  size?: string;
}) {
  const url = coinLogoUrl(type);
  return <LogoImage key={`${type}:${url || ""}`} url={url} size={size} />;
}

function LogoImage({ url, size }: { url?: string; size: string }) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">(
    "loading",
  );
  useEffect(() => {
    if (!url || state !== "loading") return;
    const timer = setTimeout(() => setState("failed"), 10000);
    return () => clearTimeout(timer);
  }, [url, state]);
  return (
    <span className={`token-icon ${size}`} aria-hidden="true">
      {(!url || state !== "loaded") && "◈"}
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
