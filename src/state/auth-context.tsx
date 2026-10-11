/**
 * Authentication Context and state provider.
 *
 * Provides reactive login/logout state, user profile, and protected navigation
 * gates. Works seamlessly across demo mode and live Supabase sessions.
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
}

export interface AuthContextType {
  isLoggedIn: boolean;
  user: AuthUser | null;
  login: (phone?: string, name?: string) => void;
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
  login: () => {},
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
    (phone: string = "01711000000", name: string = "Demo User") => {
      const authUser: AuthUser = { phone, name };
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

  const value = useMemo<AuthContextType>(
    () => ({
      isLoggedIn,
      user,
      login,
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
      login,
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
