/**
 * Layout — constant top navigation, page body, and footer.
 *
 * Designed with a clean, spacious healthcare UI:
 * - Uncluttered, modern sticky top navigation bar with blur backdrop
 * - Primary navigation with authentication guards for key features (Find Blood, Consult Doctor)
 * - Settings option strictly hidden until the citizen is logged in
 * - Quick action buttons smoothly present on scroll
 * - Integrated Login Prompt Modal for instant 1-click or mobile login
 */

import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Droplet,
  FileText,
  Home,
  LogOut,
  Menu,
  Moon,
  Newspaper,
  Phone,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Sun,
  User,
  X,
} from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { useAuth } from "@/state/auth-context.tsx";
import type { ComponentType } from "react";

// Re-export useAuth and context for backwards compatibility
export { useAuth } from "@/state/auth-context.tsx";

type NavItem = {
  to: string;
  key: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean | "true" | "false" }>;
  requiresAuth?: boolean;
};


/** Bilingual wordmark under the logo. */
function Wordmark() {
  const { t } = useAppShell();
  return (
    <span className="flex items-baseline gap-2 whitespace-nowrap shrink-0 select-none">
      <span className="font-display text-[1.125rem] font-800 tracking-tight text-ink leading-none">
        {t("app.name")}
      </span>
      <span
        lang="bn"
        className="font-display text-[1.125rem] font-800 tracking-tight text-brand leading-none hidden min-[400px]:inline"
      >
        জীবন রক্ষা
      </span>
    </span>
  );
}

function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useAppShell();
  return (
    <div
      role="radiogroup"
      aria-label={t("lang.toggle")}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setLang("bn");
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          setLang("en");
        }
      }}
      className={`relative inline-flex items-center rounded-full border border-line bg-surface p-1 shadow-2xs select-none shrink-0 ${className}`}
    >
      {/* Sliding thumb pill */}
      <span
        aria-hidden="true"
        className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-brand text-white shadow-xs transition-transform duration-300 ease-out pointer-events-none ${
          lang === "en" ? "translate-x-full" : "translate-x-0"
        }`}
      />

      {/* Bangla option */}
      <button
        type="button"
        role="radio"
        aria-checked={lang === "bn"}
        tabIndex={lang === "bn" ? 0 : -1}
        onClick={() => setLang("bn")}
        title="বাংলা"
        aria-label="বাংলা"
        className={`relative z-10 flex h-7 w-9 sm:w-10 items-center justify-center rounded-full text-xs font-bold transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
          lang === "bn" ? "text-white" : "text-muted hover:text-ink"
        }`}
      >
        বাং
      </button>

      {/* English option */}
      <button
        type="button"
        role="radio"
        aria-checked={lang === "en"}
        tabIndex={lang === "en" ? 0 : -1}
        onClick={() => setLang("en")}
        title="English"
        aria-label="English"
        className={`relative z-10 flex h-7 w-9 sm:w-10 items-center justify-center rounded-full text-xs font-bold transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
          lang === "en" ? "text-white" : "text-muted hover:text-ink"
        }`}
      >
        EN
      </button>
    </div>
  );
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme, toggleTheme, lang } = useAppShell();
  const isDark = theme === "dark";

  const handleToggle = () => {
    if (typeof toggleTheme === "function") {
      toggleTheme();
    } else {
      setTheme(isDark ? "light" : "dark");
    }
  };

  const label = isDark
    ? lang === "bn"
      ? "লাইট মোড চালু করুন"
      : "Switch to light mode"
    : lang === "bn"
    ? "ডার্ক মোড চালু করুন"
    : "Switch to dark mode";

  const title = isDark
    ? lang === "bn"
      ? "লাইট মোড"
      : "Light mode"
    : lang === "bn"
    ? "ডার্ক মোড"
    : "Dark mode";

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink hover:border-line-strong hover:bg-elevated transition-colors cursor-pointer shrink-0 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 overflow-hidden ${className}`}
      aria-label={label}
      title={title}
    >
      <span className="relative flex h-4 w-4 items-center justify-center pointer-events-none">
        {/* Sun icon for light mode */}
        <Sun
          className={`h-4 w-4 text-amber-500 absolute transition-all duration-300 ease-out transform ${
            !isDark
              ? "rotate-0 scale-100 opacity-100"
              : "-rotate-90 scale-0 opacity-0"
          }`}
          strokeWidth={2}
          aria-hidden="true"
        />
        {/* Moon icon for dark mode */}
        <Moon
          className={`h-4 w-4 text-brand dark:text-sky-300 absolute transition-all duration-300 ease-out transform ${
            isDark
              ? "rotate-0 scale-100 opacity-100"
              : "rotate-90 scale-0 opacity-0"
          }`}
          strokeWidth={2}
          aria-hidden="true"
        />
      </span>
    </button>
  );
}

/** Login Prompt Modal triggered when an unauthenticated citizen attempts an action */
function LoginPromptModal() {
  const { t, lang } = useAppShell();
  const { loginModalOpen, closeLoginModal, login, redirectAfterLogin } = useAuth();
  const navigate = useNavigate();

  if (!loginModalOpen) return null;

  const targetPath = redirectAfterLogin || "/donors";

  const handleDemoLogin = () => {
    login("01711000000", "Demo User");
  };

  const handlePhoneLogin = () => {
    closeLoginModal();
    navigate(`/login?next=${encodeURIComponent(targetPath)}`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-fade-in"
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={closeLoginModal}
          className="absolute right-5 top-5 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-elevated hover:text-ink transition-colors cursor-pointer"
          aria-label={t("nav.close")}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand shadow-xs">
            <ShieldCheck className="h-7 w-7" strokeWidth={2} />
          </div>

          <h2 id="login-modal-title" className="mt-4 text-2xl font-extrabold text-ink">
            {lang === "bn" ? "লগ ইন প্রয়োজন" : "Login Required"}
          </h2>

          <p className="mt-2 text-sm text-muted leading-relaxed">
            {lang === "bn"
              ? "রক্তদাতা অনুসন্ধান বা স্বাস্থ্য সেবা ব্যবহারের জন্য অনুগ্রহ করে আপনার অ্যাকাউন্টে লগ ইন করুন।"
              : "Please log in to your account to search blood donors or consult with verified doctors."}
          </p>

          <div className="mt-6 w-full space-y-3">
            {/* Quick 1-Click Demo Login */}
            <button
              type="button"
              onClick={handleDemoLogin}
              className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white shadow-md hover:bg-brand-deep hover:shadow-lg transition-all cursor-pointer active:scale-98"
            >
              <Sparkles className="h-4 w-4 fill-white" />
              <span>
                {lang === "bn" ? "১-ক্লিকে তাৎক্ষণিক লগ ইন (ডেমো)" : "One-Click Instant Demo Login"}
              </span>
            </button>

            {/* Regular Phone Login */}
            <button
              type="button"
              onClick={handlePhoneLogin}
              className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 text-sm font-bold text-ink hover:bg-elevated hover:border-line-strong transition-all cursor-pointer"
            >
              <Phone className="h-4 w-4 text-muted" />
              <span>
                {lang === "bn" ? "মোবাইল নম্বর দিয়ে লগ ইন" : "Log in with Mobile Number"}
              </span>
            </button>
          </div>

          <p className="mt-4 text-xs text-subtle">
            {lang === "bn"
              ? "অ্যাকাউন্ট নেই? "
              : "Don't have an account? "}
            <Link
              to="/register"
              onClick={closeLoginModal}
              className="font-bold text-brand hover:underline"
            >
              {lang === "bn" ? "নতুন নিবন্ধন করুন" : "Register here"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { t, lang } = useAppShell();
  const { isLoggedIn, user, logout, requireAuth } = useAuth();
  const { pathname } = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(() =>
    typeof window !== "undefined" ? window.scrollY > 140 : false
  );

  // Scroll listener for sticky header state (threshold: 140px)
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 140);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile drawer on navigation
  useEffect(() => setMobileOpen(false), [pathname]);

  const handleNavClick = (item: NavItem, e: React.MouseEvent) => {
    if (item.requiresAuth && !isLoggedIn) {
      e.preventDefault();
      requireAuth(item.to);
    }
  };

  const isItemActive = (to: string) => {
    if (to === "/") return pathname === "/";
    if (to === "/articles") {
      return (
        pathname === "/articles" ||
        (pathname.startsWith("/articles/") && !pathname.startsWith("/articles/new"))
      );
    }
    return pathname.startsWith(to);
  };

  // Primary navigation links shown when unscrolled at top (scrollY <= 140)
  // Settings strictly hidden until logged in!
  const primaryNavItems: NavItem[] = [
    { to: "/", key: "nav.home", icon: Home },
    { to: "/articles", key: "nav.articles", icon: Newspaper },
    ...(user?.role === "admin"
      ? [{ to: "/admin", key: "nav.admin", icon: Shield, requiresAuth: true }]
      : []),
    ...(user?.role === "doctor"
      ? [{ to: "/articles/new", key: "nav.doctorPortal", icon: FileText, requiresAuth: true }]
      : []),
    ...(isLoggedIn
      ? [{ to: "/settings", key: "nav.settings", icon: Settings, requiresAuth: true }]
      : []),
  ];

  // Full navigation links for mobile drawer
  // Settings strictly hidden until logged in!
  const mobileNavItems: NavItem[] = [
    { to: "/", key: "nav.home", icon: Home },
    { to: "/donors", key: "nav.donors", icon: Droplet, requiresAuth: true },
    { to: "/doctors", key: "nav.consultations", icon: Stethoscope, requiresAuth: true },
    { to: "/articles", key: "nav.articles", icon: Newspaper },
    ...(user?.role === "admin"
      ? [{ to: "/admin", key: "nav.admin", icon: Shield, requiresAuth: true }]
      : []),
    ...(user?.role === "doctor"
      ? [{ to: "/articles/new", key: "nav.doctorPortal", icon: FileText, requiresAuth: true }]
      : []),
    ...(isLoggedIn
      ? [{ to: "/settings", key: "nav.settings", icon: Settings, requiresAuth: true }]
      : []),
  ];

  return (
    <div className="min-h-dvh flex flex-col bg-bg text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:text-ink focus:shadow-lg"
      >
        {t("nav.skipToContent")}
      </a>

      {/* Login Prompt Modal */}
      <LoginPromptModal />

      {/* Modern, clean top navigation bar */}
      <header className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur-md transition-shadow">
        <nav aria-label="Primary" className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center justify-between h-[4.5rem] gap-3 sm:gap-6">
            {/* Logo: shrink-0 min-w-max prevents squishing/overlapping */}
            <Link
              to="/"
              className="flex items-center gap-2.5 shrink-0 min-w-max"
              aria-label={t("app.name")}
            >
              <img src="/logo.svg" alt="" className="h-8 w-8 shrink-0" width={32} height={32} />
              <Wordmark />
            </Link>

            {/* Center Area: Primary NavLinks when at top, Quick Action buttons when scrolled */}
            <div className="flex-1 flex items-center justify-center px-2 min-w-0">
              <div className="relative flex items-center justify-center w-full max-w-lg h-10">
                {/* Clean primary navigation links (Home, Articles/Health, and Settings if logged in) */}
                <div
                  className={`absolute inset-0 hidden md:flex items-center justify-center gap-1 transition-all duration-300 ease-out ${
                    isScrolled
                      ? "opacity-0 pointer-events-none -translate-y-2 scale-95 invisible"
                      : "opacity-100 pointer-events-auto translate-y-0 scale-100 visible"
                  }`}
                  aria-hidden={isScrolled}
                >
                  <nav aria-label="Desktop Primary" className="flex items-center gap-1">
                    <ul className="flex items-center gap-1">
                      {primaryNavItems.map((item) => {
                        const Icon = item.icon;
                        const active = isItemActive(item.to);
                        return (
                          <li key={item.to}>
                            <NavLink
                              to={item.to}
                              onClick={(e) => handleNavClick(item, e)}
                              tabIndex={isScrolled ? -1 : 0}
                              className={`flex items-center gap-2 rounded-full px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                                active
                                  ? "text-white bg-brand shadow-xs"
                                  : "text-muted hover:text-ink hover:bg-elevated"
                              }`}
                            >
                              <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                              {t(item.key)}
                            </NavLink>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>
                </div>

                {/* Scrolled Quick Action Buttons: "Find a donor" & "Consult a doctor" */}
                <div
                  className={`absolute inset-0 flex items-center justify-center gap-2 sm:gap-3 transition-all duration-300 ease-out ${
                    isScrolled
                      ? "opacity-100 pointer-events-auto translate-y-0 scale-100 visible"
                      : "opacity-0 pointer-events-none translate-y-2 scale-95 invisible"
                  }`}
                  aria-hidden={!isScrolled}
                >
                  <button
                    type="button"
                    onClick={() => requireAuth("/donors")}
                    tabIndex={isScrolled ? 0 : -1}
                    className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-[#4c061d] text-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold shadow-xs hover:bg-[#380715] hover:shadow-md transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95"
                    aria-label={t("nav.donors")}
                  >
                    <Droplet className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 fill-current" strokeWidth={1.8} aria-hidden="true" />
                    <span className="hidden sm:inline">{t("nav.donors")}</span>
                    <span className="sm:hidden">{lang === "bn" ? "রক্তদাতা" : "Donor"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => requireAuth("/doctors?guide=open")}
                    tabIndex={isScrolled ? 0 : -1}
                    className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-[#006d6f] text-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold shadow-xs hover:bg-[#005759] hover:shadow-md transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95"
                    aria-label={t("nav.consultations")}
                  >
                    <Stethoscope className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                    <span className="hidden sm:inline">{t("nav.consultations")}</span>
                    <span className="sm:hidden">{lang === "bn" ? "ডাক্তার" : "Doctor"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2 shrink-0 min-w-max">
              <ThemeToggle />
              <LanguageToggle />

              {/* Emergency Hotline 999 */}
              <a
                href="tel:999"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-blood text-white px-3.5 py-2 text-xs sm:text-sm font-bold hover:bg-blood-deep transition-colors shadow-xs"
              >
                <Phone className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                <span className="tnum">999</span>
              </a>

              {/* Auth Controls */}
              {isLoggedIn ? (
                <div className="hidden sm:flex items-center gap-1.5">
                  {user?.role === "admin" && (
                    <Link
                      to="/admin"
                      className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-3 py-1.5 text-xs font-bold hover:bg-amber-500/20 transition-colors shadow-2xs whitespace-nowrap"
                      title={lang === "bn" ? "অ্যাডমিন প্যানেল" : "Admin Panel"}
                    >
                      <Shield className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="hidden md:inline">{lang === "bn" ? "অ্যাডমিন প্যানেল" : "Admin Panel"}</span>
                      <span className="md:hidden">{lang === "bn" ? "অ্যাডমিন" : "Admin"}</span>
                    </Link>
                  )}
                  {user?.role === "doctor" && (
                    <Link
                      to="/articles/new"
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold hover:bg-emerald-500/20 transition-colors shadow-2xs whitespace-nowrap"
                      title={user?.name || (lang === "bn" ? "ডাক্তার পোর্টাল" : "Dr. Portal")}
                    >
                      <Stethoscope className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span className="hidden lg:inline truncate max-w-[130px]">
                        {user?.name ? (user.name.split("(")[0]?.trim() || user.name) : (lang === "bn" ? "ডাক্তার পোর্টাল" : "Dr. Portal")}
                      </span>
                      <span className="lg:hidden">
                        {lang === "bn" ? "ডাঃ পোর্টাল" : "Dr. Portal"}
                      </span>
                    </Link>
                  )}
                  <Link
                    to="/settings"
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-bold text-ink hover:bg-elevated transition-colors"
                  >
                    <User className="h-3.5 w-3.5 text-brand" />
                    <span>{t("nav.settings")}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="inline-flex items-center gap-1 rounded-full border border-line bg-surface p-2 text-xs text-muted hover:text-blood hover:bg-blood-soft transition-colors cursor-pointer"
                    title={lang === "bn" ? "লগ আউট" : "Log out"}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-2">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-xs sm:text-sm font-bold text-ink hover:border-brand/40 hover:bg-brand-soft/40 transition-colors"
                  >
                    {t("auth.login")}
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand text-white px-4 py-2 text-xs sm:text-sm font-bold hover:bg-brand-deep transition-colors shadow-xs"
                  >
                    {t("auth.register")}
                  </Link>
                </div>
              )}

              {/* Mobile hamburger menu */}
              <button
                type="button"
                onClick={() => setMobileOpen((open) => !open)}
                className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink cursor-pointer hover:bg-elevated transition-colors"
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
          <div className="md:hidden mx-4 mb-3 rounded-2xl border border-line bg-surface/98 backdrop-blur-md p-4 shadow-xl">
            <ul className="flex flex-col gap-1.5">
              {mobileNavItems.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.to);
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={(e) => {
                        handleNavClick(item, e);
                        setMobileOpen(false);
                      }}
                      className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors cursor-pointer ${
                        active
                          ? "text-white bg-brand shadow-xs"
                          : "text-muted hover:text-ink hover:bg-elevated"
                      }`}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                      <span>{t(item.key)}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 pt-3 border-t border-line flex flex-col gap-2.5">
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-elevated/40">
                <span className="text-xs font-bold text-muted">
                  {lang === "bn" ? "থিম ও ভাষা" : "Theme & Language"}
                </span>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <LanguageToggle />
                </div>
              </div>

              {isLoggedIn ? (
                <>
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-elevated/60 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <User className="h-4 w-4 text-brand shrink-0" />
                      <span className="font-bold text-ink truncate">
                        {user?.name ? (user.name.split("(")[0]?.trim() || user.name) : (user?.phone || (lang === "bn" ? "ব্যবহারকারী" : "User"))}
                      </span>
                    </div>
                    {user?.role === "admin" && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-[10px]">
                        {lang === "bn" ? "অ্যাডমিন" : "Admin"}
                      </span>
                    )}
                    {user?.role === "doctor" && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                        {lang === "bn" ? "ডাক্তার" : "Doctor"}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setMobileOpen(false);
                    }}
                    className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface py-2.5 text-sm font-bold text-blood hover:bg-blood-soft transition-colors cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>{lang === "bn" ? "লগ আউট" : "Log out"}</span>
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center rounded-xl border border-line bg-surface py-2.5 text-sm font-bold text-ink hover:bg-elevated text-center"
                  >
                    {t("auth.login")}
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center rounded-xl bg-brand text-white py-2.5 text-sm font-bold hover:bg-brand-deep text-center shadow-xs"
                  >
                    {t("auth.register")}
                  </Link>
                </div>
              )}

              <a
                href="tel:999"
                className="flex items-center justify-center gap-2 rounded-xl bg-blood text-white py-2.5 text-sm font-bold hover:bg-blood-deep transition-colors shadow-xs"
              >
                <Phone className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                <span>{lang === "bn" ? "জরুরি সেবা (৯৯৯)" : "Emergency (999)"}</span>
              </a>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area - Full width, clean, uncluttered layout */}
      <main id="main" className="flex-1 w-full min-w-0">
        {children}
      </main>

      <Footer />
    </div>
  );
}

function Footer() {
  const { t } = useAppShell();
  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div className="max-w-md">
            <div className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="" className="h-8 w-8" width={32} height={32} />
              <Wordmark />
            </div>
            <p className="mt-3 text-sm text-muted leading-relaxed">{t("app.tagline")}</p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium">
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
