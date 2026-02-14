import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import * as Linking from "expo-linking";
import { Session, User } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { signOutAndReset } from "@poleursus/shared";
import { supabase } from "../lib/supabase";
import { getVerifiedUser } from "../lib/auth";

const SELECTED_ACCOUNT_KEY = "@finnon/selectedAccountId";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isInitialized: boolean;
  selectedAccountId: string | null;
  setSelectedAccountId: (accountId: string | null) => Promise<void>;
  clearSelectedAccount: () => Promise<void>;
  signOut: () => Promise<void>;
}

const fallbackAuthContext: AuthContextType = {
  session: null,
  user: null,
  loading: false,
  isInitialized: true,
  selectedAccountId: null,
  setSelectedAccountId: async () => {},
  clearSelectedAccount: async () => {},
  signOut: async () => {},
};

let hasWarnedMissingProvider = false;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedAccountId, setSelectedAccountIdState] = useState<string | null>(null);

  useEffect(() => {
    const parseParams = (value: string) => {
      const params: Record<string, string> = {};
      if (!value) return params;
      value.split("&").forEach((pair) => {
        if (!pair) return;
        const [rawKey, rawValue] = pair.split("=");
        if (!rawKey) return;
        const key = decodeURIComponent(rawKey);
        const val = rawValue ? decodeURIComponent(rawValue) : "";
        params[key] = val;
      });
      return params;
    };

    const handleAuthUrl = async (url: string) => {
      try {
        const [base, hash] = url.split("#");
        const query = (base ?? "").split("?")[1] ?? "";
        const queryParams = parseParams(query);
        const hashParams = parseParams(hash ?? "");
        const params = { ...queryParams, ...hashParams };

        const code = params.code;

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("[AuthContext] exchangeCodeForSession error:", error);
          }
        }
      } catch (err) {
        console.error("[AuthContext] Error handling auth URL:", err);
      }
    };

    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          void handleAuthUrl(url);
        }
      })
      .catch((err) => {
        console.error("[AuthContext] Error reading initial URL:", err);
      });

    const subscription = Linking.addEventListener("url", (event) => {
      if (event.url) {
        void handleAuthUrl(event.url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Load selectedAccountId from AsyncStorage on init
  useEffect(() => {
    const loadSelectedAccount = async () => {
      try {
        const stored = await AsyncStorage.getItem(SELECTED_ACCOUNT_KEY);
        if (stored) {
          console.log("[AuthContext] Loaded selectedAccountId from storage:", stored);
          setSelectedAccountIdState(stored);
        }
      } catch (err) {
        console.error("[AuthContext] Error loading selectedAccountId:", err);
      }
    };
    loadSelectedAccount();
  }, []);

  useEffect(() => {
    console.log("[AuthContext] Initializing...");

    let isMounted = true;

    const syncUser = async () => {
      try {
        const user = await getVerifiedUser();
        if (isMounted) {
          setUser(user);
        }
        return user;
      } catch (userError) {
        console.error("[AuthContext] getUser error:", userError);
        if (isMounted) {
          setUser(null);
        }
        return null;
      }
    };

    const initializeAuth = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("[AuthContext] getSession error:", sessionError);
      }

      const safeUser = await syncUser();

      if (!isMounted) return;

      console.log("[AuthContext] Initial session:", {
        hasSession: !!session,
        userId: safeUser?.id,
      });
      setSession(session);
      setLoading(false);
      setIsInitialized(true);
    };

    void initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[AuthContext] Auth state changed:", {
        event,
        hasSession: !!session,
      });
      if (!isMounted) return;
      setSession(session);
      setLoading(false);

      if (!session || event === "SIGNED_OUT") {
        setUser(null);
        return;
      }

      void syncUser();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const setSelectedAccountId = async (accountId: string | null) => {
    console.log("[AuthContext] Setting selectedAccountId:", accountId);
    setSelectedAccountIdState(accountId);
    try {
      if (accountId) {
        await AsyncStorage.setItem(SELECTED_ACCOUNT_KEY, accountId);
      } else {
        await AsyncStorage.removeItem(SELECTED_ACCOUNT_KEY);
      }
    } catch (err) {
      console.error("[AuthContext] Error saving selectedAccountId:", err);
    }
  };

  const clearSelectedAccount = async () => {
    console.log("[AuthContext] Clearing selectedAccountId");
    await setSelectedAccountId(null);
  };

  const signOut = async () => {
    await signOutAndReset({
      signOut: () => supabase.auth.signOut(),
      clearLocalSessionArtifacts: clearSelectedAccount,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        isInitialized,
        selectedAccountId,
        setSelectedAccountId,
        clearSelectedAccount,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    if (__DEV__) {
      if (!hasWarnedMissingProvider) {
        hasWarnedMissingProvider = true;
        console.warn(
          "[AuthContext] useAuth used outside AuthProvider; falling back.",
          new Error().stack
        );
      }
    }
    return fallbackAuthContext;
  }
  return context;
}
