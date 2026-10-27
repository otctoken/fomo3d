import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { detectLanguage, type Language } from "../lib/language";
const I18n = createContext({
  lang: "en",
  toggle: () => {},
  t: (en: string, zh: string) => en,
});
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("fomo-language");
    } catch {}
    return detectLanguage(
      navigator.languages?.length ? navigator.languages : [navigator.language],
      saved,
    );
  });
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);
  useEffect(() => {
    const sync = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("fomo-language");
      } catch {}
      setLang(detectLanguage(navigator.languages, saved));
    };
    window.addEventListener("languagechange", sync);
    return () => window.removeEventListener("languagechange", sync);
  }, []);
  return (
    <I18n.Provider
      value={{
        lang,
        t: (en, zh) => (lang === "zh" ? zh : en),
        toggle: () =>
          setLang((l) => {
            const next = l === "zh" ? "en" : "zh";
            try {
              localStorage.setItem("fomo-language", next);
            } catch {}
            document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
            return next;
          }),
      }}
    >
      {children}
    </I18n.Provider>
  );
}
export const useI18n = () => useContext(I18n);
