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

export type Theme = "light" | "dark" | "system";

function resolveTheme(t: Theme): "light" | "dark" {
  if (t === "dark") return "dark";
  if (t === "light") return "light";
  if (t === "system") {
    try {
      if (
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        return "dark";
      }
    } catch {
      // ignore
    }
  }
  return "light";
}

function applyTheme(t: Theme): void {
  const resolved = resolveTheme(t);
  document.documentElement.setAttribute("data-theme", resolved);
}

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

export interface AppShellValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
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

  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = readStored(THEME_KEY, ["light", "dark", "system"] as const);
    return stored ?? "light";
  });

  useEffect(() => {
    document.documentElement.lang = lang;
    writeStored(LANG_KEY, lang);
  }, [lang]);

  useEffect(() => {
    applyTheme(theme);
    writeStored(THEME_KEY, theme);

    if (theme === "system" && typeof window !== "undefined" && window.matchMedia) {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => applyTheme("system");
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
  }, [theme]);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    writeStored(THEME_KEY, nextTheme);
    applyTheme(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = resolveTheme(prev) === "dark" ? "light" : "dark";
      writeStored(THEME_KEY, next);
      applyTheme(next);
      return next;
    });
  }, []);

  const t = useCallback((path: string) => lookup(path, lang), [lang]);
  const tb = useCallback((pair: { bn: string; en: string }) => pair[lang], [lang]);

  const value = useMemo<AppShellValue>(
    () => ({
      lang,
      setLang: setLangState,
      toggleLang: () => setLangState((prev) => (prev === "bn" ? "en" : "bn")),
      theme,
      setTheme,
      toggleTheme,
      t,
      tb,
      isBn: lang === "bn",
    }),
    [lang, theme, setTheme, toggleTheme, t, tb]
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
