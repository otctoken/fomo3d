import { describe, it, expect } from "vitest";
import { detectLanguage } from "../src/lib/language";
describe("Browser language selection", () => {
  it.each([
    "zh",
    "zh-CN",
    "zh-TW",
    "zh-HK",
    "zh-Hant",
    "zh-Hans",
    "zh-MO",
    "ZH_tw",
  ])("shows Chinese for %s", (language) =>
    expect(detectLanguage([language])).toBe("zh"),
  );
  it.each(["en-US", "ja-JP", "ko-KR", "fr-FR", "de-DE", ""])(
    "uses English for %s",
    (language) => expect(detectLanguage([language])).toBe("en"),
  );
  it("respects the first preferred language", () =>
    expect(detectLanguage(["en-US", "zh-CN"])).toBe("en"));
  it("remembers an explicit user choice", () => {
    expect(detectLanguage(["zh-TW"], "en")).toBe("en");
    expect(detectLanguage(["en-US"], "zh")).toBe("zh");
  });
  it("ignores corrupt saved preferences", () =>
    expect(detectLanguage(["zh-HK"], "bad")).toBe("zh"));
});
