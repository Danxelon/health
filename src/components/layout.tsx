/**
 * The layout: constant top navigation, constant left navigation rail, page body,
 * footer. The top bar is always present and never hides on scroll; the left rail
 * is a fixed region on wide screens (md+) and folds into the top bar on narrow
 * screens.
 */

import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Droplet,
  Menu,
  Newspaper,
  Phone,
  Settings,
  Stethoscope,
  UserPlus,
  X,
} from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";

import type { ComponentType } from "react";

type NavItem = {
  to: string;
  key: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean | "true" | "false" }>;
};

/* -------------------------------------------------------------------------- */
/* Primary destinations — the two core options, then content, then account    */
/* -------------------------------------------------------------------------- */

const primaryNav: NavItem[] = [
  { to: "/", key: "nav.home", icon: () => null },
  { to: "/donors", key: "nav.donors", icon: Droplet },
  { to: "/doctors", key: "nav.consultations", icon: Stethoscope },
  { to: "/articles", key: "nav.articles", icon: Newspaper },
];

const secondaryNav: NavItem[] = [
  { to: "/register", key: "nav.register", icon: UserPlus },
  { to: "/settings", key: "nav.settings", icon: Settings },
];

/** Bilingual label under the logo. Rendered in both scripts, like the mark. */
function Wordmark() {
  const { t } = useAppShell();
  return (
    <span className="flex items-baseline gap-2">
      <span className="font-display text-[1.05rem] font-800 tracking-tight text-ink leading-none">
        {t("app.name")}
      </span>
      <span
        lang="bn"
        className="font-display text-[1.05rem] font-800 tracking-tight text-brand leading-none"
      >
        জীবন রক্ষা
      </span>
    </span>
  );
}

function LanguageToggle() {
  const { lang, toggleLang, t } = useAppShell();
  return (
    <button
      type="button"
      onClick={toggleLang}
      className="h-9 min-w-11 rounded-full border border-line bg-surface/70 px-3 text-xs font-semibold text-ink hover:border-line-strong transition-colors cursor-pointer"
      aria-label={t("lang.toggle")}
    >
      <span aria-hidden="true">{lang === "bn" ? "EN" : "বাং"}</span>
    </button>
  );
}

function NavLinks({
  items,
  onNavigate,
  className = "",
}: {
  items: NavItem[];
  onNavigate?: () => void;
  className?: string;
}) {
  const { t } = useAppShell();
  return (
    <ul className={className}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.to}>
            <NavLink
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  isActive ? "text-white bg-brand" : "text-muted hover:text-ink hover:bg-elevated"
                }`
              }
            >
              {Icon ? (
                <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
              ) : null}
              {t(item.key)}
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Constant left navigation rail — wide screens only                          */
/* -------------------------------------------------------------------------- */

/* In-flow sticky rail: the main column sits to its right, and the rail stays
   put as the page scrolls. Mirrors the primary destinations + account links. */
function LeftRail() {
  const { t } = useAppShell();
  const { pathname } = useLocation();

  return (
    <aside className="hidden lg:block w-64 shrink-0 border-r border-line bg-surface">
      <div className="px-3 py-4 flex flex-col gap-1 sticky top-[4.5rem] max-h-[calc(100dvh-5rem)] overflow-y-auto no-scrollbar">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
          {t("nav.menu")}
        </p>
        {primaryNav.map((item) => {
          const Icon = item.icon;
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                active ? "text-white bg-brand" : "text-muted hover:text-ink hover:bg-elevated"
              }`}
            >
              {Icon ? (
                <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
              ) : (
                <span className="h-5 w-5" aria-hidden="true" />
              )}
              {t(item.key)}
            </NavLink>
          );
        })}
        <div className="mt-2 pt-2 border-t border-line flex flex-col gap-1">
          {secondaryNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                    isActive ? "text-brand bg-brand-soft" : "text-muted hover:text-ink hover:bg-elevated"
                  }`
                }
              >
                <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                {t(item.key)}
              </NavLink>
            );
          })}
        </div>
        <div className="mt-4">
          <a
            href="tel:999"
            className="flex items-center gap-2 rounded-full bg-blood text-white px-3 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Phone className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            <span className="tnum">999</span>
          </a>
        </div>
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                      */
/* -------------------------------------------------------------------------- */

export function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useAppShell();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the drawer on navigation.
  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="min-h-dvh flex flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:text-ink focus:shadow-lg"
      >
        {t("nav.skipToContent")}
      </a>

      {/* Constant top bar: never hides on scroll. */}
      <header className="sticky top-0 z-50 border-b border-line bg-surface/90 backdrop-blur-md">
        <nav aria-label="Primary" className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center justify-between py-2.5">
            <Link to="/" className="flex items-center gap-2.5" aria-label={t("app.name")}>
              <img src="/logo.svg" alt="" className="h-8 w-8" width={32} height={32} />
              <Wordmark />
            </Link>

            {/* Desktop links (top bar) */}
            <NavLinks items={primaryNav} className="hidden md:flex items-center gap-1" />

            <div className="flex items-center gap-2">
              <LanguageToggle />
              <a
                href="tel:999"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-brand text-white px-4 py-2 text-sm font-semibold hover:bg-brand-deep transition-colors"
              >
                <Phone className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                <span className="tnum">999</span>
              </a>
              <button
                type="button"
                onClick={() => setMobileOpen((open) => !open)}
                className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink cursor-pointer lg:hidden"
                aria-expanded={mobileOpen}
                aria-label={mobileOpen ? t("nav.close") : t("nav.menu")}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </nav>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden lg:hidden mx-4 mt-2 rounded-2xl border border-line bg-surface/95 backdrop-blur-md p-2 shadow-xl">
            <NavLinks
              items={[...primaryNav, ...secondaryNav]}
              onNavigate={() => setMobileOpen(false)}
              className="flex flex-col"
            />
          </div>
        )}
      </header>

      <div className="flex flex-1 w-full">
        {/* Left rail on wide screens */}
        <LeftRail />

        <main id="main" className="flex-1 w-full min-w-0">
          {children}
        </main>
      </div>

      <Footer />
    </div>
  );
}

function Footer() {
  const { t } = useAppShell();
  return (
    <footer className="mt-24 border-t border-line bg-surface/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div className="max-w-md">
            <div className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="" className="h-9 w-9" width={36} height={36} />
              <Wordmark />
            </div>
            <p className="mt-4 text-sm text-muted leading-relaxed">{t("app.tagline")}</p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {(
              [
                ["footer.about", "/about"],
                ["footer.contact", "/contact"],
                ["footer.helpline", "/helpline"],
                ["footer.legal", "/legal"],
                ["nav.complain", "/complain"],
              ] as const
            ).map(([key, to]) => (
              <Link key={to} to={to} className="text-muted hover:text-ink transition-colors">
                {t(key)}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-line pt-6 text-xs text-subtle">
          <p>
            © {new Date().getFullYear()} {t("app.name")} · {t("footer.rights")}
          </p>
          <p lang="bn" className="text-muted">
            {t("app.gov")}
          </p>
        </div>
      </div>
    </footer>
  );
}