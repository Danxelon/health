/**
 * The layout: floating glass nav, page body, footer — plus the GSAP hook that
 * hides the nav on scroll down and reveals it on scroll up.
 */

import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Droplet, HeartPulse, Menu, Phone, Stethoscope, TriangleAlert, X } from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { DEMO_MODE } from "@/lib/supabase.ts";
import { useScrollNav } from "@/hooks/use-scroll-nav.ts";

const navItems = [
  { to: "/donors", key: "nav.donors", icon: Droplet },
  { to: "/doctors", key: "nav.consultations", icon: Stethoscope },
  { to: "/requests/new", key: "nav.request", icon: HeartPulse },
  { to: "/articles", key: "nav.articles", icon: null },
] as const;

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
        className="font-display text-[1.05rem] font-800 tracking-tight text-ink-brand leading-none"
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

export function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useAppShell();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useScrollNav(ref);

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

      {DEMO_MODE && (
        <div
          role="status"
          className="bg-warning-soft text-warning text-[11px] font-semibold text-center py-1 px-4 tracking-wide"
        >
          {t("common.demoMode")} — sample data, not live records
        </div>
      )}

      <header ref={ref} className="sticky top-0 z-50" data-scroll-nav>
        <nav
          aria-label="Primary"
          className="mx-auto max-w-7xl px-4 sm:px-6"
        >
          <div className="mt-3 flex items-center justify-between rounded-full border border-line bg-surface/80 px-4 py-2.5 backdrop-blur-md shadow-[0_1px_0_0_rgba(255,255,255,0.5)_inset]">
            <Link to="/" className="flex items-center gap-2.5" aria-label={t("app.name")}>
              <img src="/logo.svg" alt="" className="h-8 w-8" width={32} height={32} />
              <Wordmark />
            </Link>

            {/* Desktop links */}
            <ul className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors cursor-pointer ${
                          isActive
                            ? "text-ink bg-elevated"
                            : "text-muted hover:text-ink hover:bg-elevated/60"
                        }`
                      }
                    >
                      {Icon && <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />}
                      {t(item.key)}
                    </NavLink>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center gap-2">
              <LanguageToggle />
              <a
                href="tel:999"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-ink-brand text-white px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                <Phone className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                <span className="tnum">999</span>
              </a>
              <button
                type="button"
                onClick={() => setMobileOpen((open) => !open)}
                className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink cursor-pointer"
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
          <div className="md:hidden mx-4 mt-2 rounded-2xl border border-line bg-surface/95 backdrop-blur-md p-2 shadow-xl">
            <ul className="flex flex-col">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium transition-colors ${
                          isActive ? "text-ink bg-elevated" : "text-muted hover:text-ink"
                        }`
                      }
                    >
                      {Icon && <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />}
                      {t(item.key)}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </header>

      <main id="main" className="flex-1 w-full">
        {children}
      </main>

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
            <p className="mt-3 text-xs text-subtle flex items-start gap-1.5">
              <TriangleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              {t("footer.notice")}
            </p>
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
            সারাদেশে ৪৯৫ উপজেলা · একজন রক্তদাতা সবসময় পাওয়া যায়
          </p>
        </div>
      </div>
    </footer>
  );
}