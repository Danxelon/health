import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";

/* -----------------------------------------------------------------------------
   Boot guards.
   These run before React mounts and throw loudly. A health platform that
   silently runs in a misconfigured state is worse than one that refuses to
   start — a leaked service key or a live OTP backdoor is not a "warning".
   -------------------------------------------------------------------------- */

const DEV_OTP_MODE = import.meta.env.VITE_DEV_OTP_MODE === "true";

if (DEV_OTP_MODE && import.meta.env.MODE === "production") {
  throw new Error(
    "Refusing to start: VITE_DEV_OTP_MODE is enabled in a production build. " +
      "The dev OTP backdoor accepts a fixed code for any phone number. " +
      "Unset it and redeploy."
  );
}

if (import.meta.env.MODE === "production") {
  const url = import.meta.env.VITE_SUPABASE_URL ?? "";
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

  if (!url || !anon) {
    throw new Error(
      "Refusing to start: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must both be set."
    );
  }

  // The anon key is a JWT whose payload carries the role. A service_role key
  // shipped to the browser bypasses RLS entirely — this is the one mistake that
  // would expose every citizen record, so it is checked at boot, not reviewed.
  try {
    const payload = JSON.parse(atob(anon.split(".")[1] ?? ""));
    if (payload?.role === "service_role") {
      throw new Error(
        "Refusing to start: VITE_SUPABASE_ANON_KEY contains a service_role key. " +
          "This key bypasses row-level security and must never reach a browser."
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Refusing")) throw err;
    throw new Error("Refusing to start: VITE_SUPABASE_ANON_KEY is not a decodable JWT.");
  }
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element in index.html");

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
