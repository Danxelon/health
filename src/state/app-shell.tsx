/**
 * Language and theme state.
 *
 * Kept in React context rather than a global store because there are exactly
 * two values, both of which must survive a reload — localStorage is the right
 * tool, and it degrades gracefully when unavailable (private windows throw on
 * access, so every read is guarded).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { DEFAULT_LANG, LANGS, lookup, type Lang } from "@/lib/strings.ts";

const LANG_KEY = "jr.lang";
const THEME_KEY = "jr.theme";

type Theme = "light" | "dark" | "system";

function readStored<T extends string>(key: string, allowed: readonly T[]): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
  } catch {
    // Storage can be blocked entirely; a missing preference is not an error.
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* preference simply does not persist */
  }
}

interface AppShellValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** Translate a dot-path key into the current language. */
  t: (path: string) => string;
  /** A bilingual pair, for `aria-label`s that must not be language-switched away. */
  tb: (pair: { bn: string; en: string }) => string;
  isBn: boolean;
}

const AppShellContext = createContext<AppShellValue | null>(null);

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = readStored(LANG_KEY, LANGS);
    if (stored) return stored;
    // First visit: match the browser, defaulting to Bengali for a BD audience.
    try {
      return navigator.language.toLowerCase().startsWith("en") ? "en" : DEFAULT_LANG;
    } catch {
      return DEFAULT_LANG;
    }
  });

  const [theme, setThemeState] = useState<Theme>(() => readStored(THEME_KEY, ["light", "dark"] as const) ?? "light");

  useEffect(() => {
    document.documentElement.lang = lang;
    writeStored(LANG_KEY, lang);
  }, [lang]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    writeStored(THEME_KEY, theme);
  }, [theme]);

  const t = useCallback((path: string) => lookup(path, lang), [lang]);
  const tb = useCallback((pair: { bn: string; en: string }) => pair[lang], [lang]);

  const value = useMemo<AppShellValue>(
    () => ({
      lang,
      setLang: setLangState,
      toggleLang: () => setLangState((prev) => (prev === "bn" ? "en" : "bn")),
      theme,
      setTheme: setThemeState,
      t,
      tb,
      isBn: lang === "bn",
    }),
    [lang, theme, t, tb]
  );

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell(): AppShellValue {
  const ctx = useContext(AppShellContext);
  if (!ctx) throw new Error("useAppShell must be used inside <AppShellProvider>");
  return ctx;
}

/** The common case: just the translator. */
export function useT(): (path: string) => string {
  return useAppShell().t;
}
