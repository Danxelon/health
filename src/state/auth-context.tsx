/**
 * Authentication Context and state provider.
 *
 * Email/password sign-in authenticates against the live Supabase project
 * (admin and verified doctors are seeded there). Phone/OTP identify the
 * citizen locally and provision a real Supabase session + profile row (see
 * `@/api/registration.ts`) so every account the UI creates exists in the
 * database. There are no built-in demo credentials.
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
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase.ts";

const AUTH_KEY = "jr.logged_in";
const USER_KEY = "jr.auth_user";

export interface AuthUser {
  phone: string;
  name?: string;
  email?: string;
  role?: string;
  bmdc?: string;
  specialty?: string;
}

export interface AuthContextType {
  isLoggedIn: boolean;
  user: AuthUser | null;
  isAdmin: boolean;
  isDoctor: boolean;
  login: (phone?: string, name?: string, role?: string, email?: string, bmdc?: string) => void;
  loginWithCredentials: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; role?: string; error?: string }>;
  logout: () => void;
  requireAuth: (targetPath?: string, onAuthenticated?: () => void) => boolean;
  loginModalOpen: boolean;
  openLoginModal: (redirectPath?: string) => void;
  closeLoginModal: () => void;
  redirectAfterLogin: string | null;
}

export const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  user: null,
  isAdmin: false,
  isDoctor: false,
  login: () => {},
  loginWithCredentials: async () => ({ success: false, error: "Not initialized" }),
  logout: () => {},
  requireAuth: () => false,
  loginModalOpen: false,
  openLoginModal: () => {},
  closeLoginModal: () => {},
  redirectAfterLogin: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(AUTH_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = window.localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [redirectAfterLogin, setRedirectAfterLogin] = useState<string | null>(null);

  // Sync with Supabase session if configured
  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setIsLoggedIn(true);
        try {
          window.localStorage.setItem(AUTH_KEY, "true");
        } catch {
          /* ignore */
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setIsLoggedIn(true);
        try {
          window.localStorage.setItem(AUTH_KEY, "true");
        } catch {
          /* ignore */
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(
    (phone: string = "01711000000", name: string = "Citizen", role?: string) => {
      const authUser: AuthUser = { phone, name, ...(role ? { role } : {}) };
      setIsLoggedIn(true);
      setUser(authUser);
      try {
        window.localStorage.setItem(AUTH_KEY, "true");
        window.localStorage.setItem(USER_KEY, JSON.stringify(authUser));
      } catch {
        /* ignore */
      }
      setLoginModalOpen(false);

      if (redirectAfterLogin) {
        const dest = redirectAfterLogin;
        setRedirectAfterLogin(null);
        navigate(dest);
      }
    },
    [redirectAfterLogin, navigate]
  );

  const loginWithCredentials = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{ success: boolean; role?: string; error?: string }> => {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail || !password) {
        return {
          success: false,
          error: "ইমেইল বা পাসওয়ার্ড সঠিক নয় / Invalid email or password",
        };
      }

      // Live Supabase authentication — the only credential path. Admin and
      // verified doctor accounts are seeded in auth.users by the database
      // setup script (see CREDENTIALS.md), so any account created in the
      // database signs in here with its real password.
      if (supabase) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          });
          if (error) {
            return { success: false, error: error.message };
          }
          if (data?.user) {
            const userRole = (data.user.user_metadata?.role as string) || "doctor";
            const authUser: AuthUser = {
              phone: data.user.phone || "01700000000",
              name: data.user.user_metadata?.full_name || data.user.email?.split("@")[0] || "Staff",
              email: data.user.email,
              role: userRole,
            };
            setIsLoggedIn(true);
            setUser(authUser);
            try {
              window.localStorage.setItem(AUTH_KEY, "true");
              window.localStorage.setItem(USER_KEY, JSON.stringify(authUser));
            } catch {
              /* ignore */
            }
            setLoginModalOpen(false);
            return { success: true, role: userRole };
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Authentication failed";
          return { success: false, error: message };
        }
      }

      return {
        success: false,
        error: "ইমেইল বা পাসওয়ার্ড সঠিক নয় / Invalid email or password",
      };
    },
    []
  );

  const logout = useCallback(() => {
    setIsLoggedIn(false);
    setUser(null);
    try {
      window.localStorage.removeItem(AUTH_KEY);
      window.localStorage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
    if (supabase) {
      supabase.auth.signOut().catch(() => {});
    }
    navigate("/");
  }, [navigate]);

  const openLoginModal = useCallback((redirectPath?: string) => {
    if (redirectPath) {
      setRedirectAfterLogin(redirectPath);
    }
    setLoginModalOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setLoginModalOpen(false);
  }, []);

  const requireAuth = useCallback(
    (targetPath?: string, onAuthenticated?: () => void): boolean => {
      if (isLoggedIn) {
        if (onAuthenticated) {
          onAuthenticated();
        } else if (targetPath) {
          navigate(targetPath);
        }
        return true;
      }

      // Not logged in: open the prompt modal or redirect
      if (targetPath) {
        setRedirectAfterLogin(targetPath);
      }
      setLoginModalOpen(true);
      return false;
    },
    [isLoggedIn, navigate]
  );

  const isAdmin = user?.role === "admin";
  const isDoctor = user?.role === "doctor";

  const value = useMemo<AuthContextType>(
    () => ({
      isLoggedIn,
      user,
      isAdmin,
      isDoctor,
      login,
      loginWithCredentials,
      logout,
      requireAuth,
      loginModalOpen,
      openLoginModal,
      closeLoginModal,
      redirectAfterLogin,
    }),
    [
      isLoggedIn,
      user,
      isAdmin,
      isDoctor,
      login,
      loginWithCredentials,
      logout,
      requireAuth,
      loginModalOpen,
      openLoginModal,
      closeLoginModal,
      redirectAfterLogin,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
