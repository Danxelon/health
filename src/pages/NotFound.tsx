/**
 * 404. Calm, not alarming — a worried person who typed a broken link into a
 * health site should not be met with a flashing error. Just a way home.
 */

import { Link } from "react-router-dom";
import { Droplet } from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";

export default function NotFound() {
  const { t } = useAppShell();
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-7xl flex-col items-center justify-center px-4 text-center">
      <Droplet className="h-10 w-10 text-brand" strokeWidth={1.5} aria-hidden="true" />
      <h1 className="mt-5 text-3xl text-ink">{t("errors.notFound")}</h1>
      <Link
        to="/"
        className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-brand px-7 text-[15px] font-semibold text-white hover:bg-brand-deep hover:-translate-y-0.5 transition-all duration-300"
      >
        {t("errors.goHome")}
      </Link>
    </div>
  );
}