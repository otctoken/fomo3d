import { describe, expect, it } from "vitest";
import { coinLogoUrl, normalizeLogoUrl } from "../src/lib/coinLogos";
import { SUI } from "../src/config/contracts";

describe("administrator-maintained token logo links", () => {
  it("matches full Coin Types regardless of address padding", () => {
    const registry = {
      "0x2::sui::SUI": "https://images.example/sui.svg",
    };
    expect(coinLogoUrl(SUI, registry)).toBe("https://images.example/sui.svg");
    expect(coinLogoUrl("0x3::sui::SUI", registry)).toBeUndefined();
  });
  it("resolves the shared mapping without a network argument", () => {
    const registry = {
      "0x7::coin::COIN": "https://images.example/coin.png",
    };
    expect(coinLogoUrl("0x7::coin::COIN", registry)).toBe(
      "https://images.example/coin.png",
    );
  });
  it("allows different deployment addresses to share one logo URL", () => {
    const registry = {
      "0x7::coin::COIN": "https://images.example/shared.svg",
      "0x8::coin::COIN": "https://images.example/shared.svg",
    };
    expect(coinLogoUrl("0x7::coin::COIN", registry)).toBe(
      "https://images.example/shared.svg",
    );
    expect(coinLogoUrl("0x8::coin::COIN", registry)).toBe(
      "https://images.example/shared.svg",
    );
  });
  it("invalid links and unknown coins resolve to the placeholder", () => {
    expect(coinLogoUrl("incomplete")).toBeUndefined();
    expect(coinLogoUrl("0x8::coin::COIN")).toBeUndefined();
    expect(
      coinLogoUrl(SUI, {
        "0x2::sui::SUI": "data:image/png;base64,AAAA",
      }),
    ).toBeUndefined();
  });
  it("ignores malformed manual keys without breaking valid entries", () => {
    expect(
      coinLogoUrl(SUI, {
        invalid: "https://images.example/bad.png",
        "0x2::sui::SUI": "https://images.example/sui.png",
      }),
    ).toBe("https://images.example/sui.png");
  });
  it.each([
    "data:image/png;base64,AAAA",
    "blob:https://example.com/id",
    "file:///C:/logo.png",
    "C:\\logo.png",
    "/logo.png",
    "javascript:alert(1)",
    "https://user:pass@example.com/logo.png",
    "https://",
    "https:\\example.com/logo.png",
    "https://example.com/my logo.png",
  ])("rejects non-public-link input %s", (input) => {
    expect(normalizeLogoUrl(input)).toBeUndefined();
  });
  it("accepts remote links without requiring a file extension", () => {
    expect(normalizeLogoUrl(" https://images.example/icon?id=123 ")).toBe(
      "https://images.example/icon?id=123",
    );
    expect(normalizeLogoUrl("http://images.example/icon.svg")).toBe(
      "http://images.example/icon.svg",
    );
  });
  it("ships a configured SUI link", () => {
    expect(coinLogoUrl(SUI)).toMatch(/^https:\/\//);
  });
});
