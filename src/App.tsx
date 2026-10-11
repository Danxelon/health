/**
 * Routing shell.
 *
 * Every route plan.md §9.1 lists is wired here. Pages mount inside one layout
 * so the nav persists; the scrolling wrapper beneath it is where ScrollTrigger
 * measures heights, which is why `AppShell` renders both together.
 */

import { Route, Routes, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";

import { AppShellProvider, useAppShell } from "@/state/app-shell.tsx";
import { AuthProvider } from "@/state/auth-context.tsx";
import { Layout } from "@/components/layout.tsx";

/* Pages lazy-load so the first paint is the shell, not the world. */
const HomePage = lazy(() => import("@/pages/Home.tsx"));
const DonorsPage = lazy(() => import("@/pages/Donors.tsx"));
const RequestsNewPage = lazy(() => import("@/pages/RequestsNew.tsx"));
const RequestsMinePage = lazy(() => import("@/pages/RequestsMine.tsx"));
const RequestsDetailPage = lazy(() => import("@/pages/RequestsDetail.tsx"));
const DoctorsPage = lazy(() => import("@/pages/Doctors.tsx"));
const ConsultationsPage = lazy(() => import("@/pages/Consultations.tsx"));
const ConsultationsDetailPage = lazy(() => import("@/pages/ConsultationsDetail.tsx"));
const ArticlesPage = lazy(() => import("@/pages/Articles.tsx"));
const ArticleDetailPage = lazy(() => import("@/pages/ArticleDetail.tsx"));
const ArticleNewPage = lazy(() => import("@/pages/ArticleNew.tsx"));
const AdminPage = lazy(() => import("@/pages/Admin.tsx"));
const SettingsPage = lazy(() => import("@/pages/Settings.tsx"));
const ComplainPage = lazy(() => import("@/pages/Complain.tsx"));
const ComplaintsMinePage = lazy(() => import("@/pages/ComplaintsMine.tsx"));
const RegisterPage = lazy(() => import("@/pages/Register.tsx"));
const LoginPage = lazy(() => import("@/pages/Login.tsx"));
const AboutPage = lazy(() => import("@/pages/About.tsx"));
const ContactPage = lazy(() => import("@/pages/Contact.tsx"));
const HelplinePage = lazy(() => import("@/pages/Helpline.tsx"));
const LegalPage = lazy(() => import("@/pages/Legal.tsx"));
const NotFoundPage = lazy(() => import("@/pages/NotFound.tsx"));

/** Scrolls to the top on every navigation, so a deep link never lands mid-page. */
function ScrollToTop({ children }: { children: React.ReactNode }) {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, search]);
  return <>{children}</>;
}

/** A fallback that matches the page skeleton rather than flashing. */
function PageFallback() {
  const { t } = useAppShell();
  return (
    <div className="min-h-[60vh] grid place-items-center" role="status" aria-live="polite">
      <p className="text-muted text-sm">{t("common.loading")}</p>
    </div>
  );
}

export default function App() {
  return (
    <AppShellProvider>
      <ScrollToTop>
        <AuthProvider>
          <Layout>
            <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/donors" element={<DonorsPage />} />
              <Route path="/requests/new" element={<RequestsNewPage />} />
              <Route path="/requests/mine" element={<RequestsMinePage />} />
              <Route path="/requests/:id" element={<RequestsDetailPage />} />
              <Route path="/doctors" element={<DoctorsPage />} />
              <Route path="/consultations" element={<ConsultationsPage />} />
              <Route path="/consultations/:id" element={<ConsultationsDetailPage />} />
              <Route path="/articles" element={<ArticlesPage />} />
              <Route path="/articles/new" element={<ArticleNewPage />} />
              <Route path="/articles/:slug" element={<ArticleDetailPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/complain" element={<ComplainPage />} />
              <Route path="/complaints/mine" element={<ComplaintsMinePage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/helpline" element={<HelplinePage />} />
              <Route path="/legal" element={<LegalPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </Layout>
      </AuthProvider>
    </ScrollToTop>
  </AppShellProvider>
);
}