import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { signOutAndReset } from "@poleursus/shared";
import { supabase } from "../lib/supabase";

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

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[AuthContext] Initial session:", {
        hasSession: !!session,
        userId: session?.user?.id,
      });
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      setIsInitialized(true);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[AuthContext] Auth state changed:", {
        event,
        hasSession: !!session,
        userId: session?.user?.id,
      });
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
