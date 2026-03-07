"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getInvalidationTagsForMutation,
  getInvalidationTagsForTable,
  type CacheClient,
  type MutationAction,
  type MutationEntity,
} from "@poleursus/shared";
import { createClient } from "@/lib/supabase/client";
import { webDataCacheClient } from "./client";

const ACTIVE_ACCOUNT_STORAGE_KEY = "finnon:activeAccountId";

type WebDataCacheContextValue = {
  cache: CacheClient;
  userId: string | null;
  accountId: string | null;
  emitMutation: (entity: MutationEntity, action: MutationAction) => Promise<void>;
};

const WebDataCacheContext = createContext<WebDataCacheContextValue | undefined>(
  undefined
);

const REALTIME_TABLES: MutationEntity[] = [
  "transactions",
  "obligations",
  "recurring_items",
  "categories",
  "projects",
  "reserve_containers",
  "monthly_project_funding_plans",
  "month_closes",
  "month_close_allocations",
  "reserve_transfers",
];

export function WebDataCacheProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const pendingTagsRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousUserIdRef = useRef<string | null>(null);

  const queueTags = (tags: string[]) => {
    tags.forEach((tag) => pendingTagsRef.current.add(tag));

    if (flushTimerRef.current) return;

    flushTimerRef.current = setTimeout(() => {
      const tagsToInvalidate = Array.from(pendingTagsRef.current);
      pendingTagsRef.current.clear();
      flushTimerRef.current = null;
      if (tagsToInvalidate.length === 0) return;
      void webDataCacheClient.invalidateByTags(tagsToInvalidate);
    }, 350);
  };

  useEffect(() => {
    let mounted = true;

    const syncUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      setUserId(user?.id ?? null);
    };

    void syncUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    const previous = previousUserIdRef.current;
    if (previous && previous !== userId) {
      void webDataCacheClient.clearByUser(previous);
    }
    previousUserIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    const syncAccount = () => {
      const next = window.localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);
      setAccountId(next);
    };

    syncAccount();
    window.addEventListener("storage", syncAccount);
    const pollId = window.setInterval(syncAccount, 1000);

    return () => {
      window.removeEventListener("storage", syncAccount);
      window.clearInterval(pollId);
    };
  }, []);

  useEffect(() => {
    if (!accountId) return;

    const channel = supabase.channel(`web-data-cache:${accountId}`);
    const pendingTags = pendingTagsRef.current;

    REALTIME_TABLES.forEach((table) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `account_id=eq.${accountId}`,
        },
        () => {
          queueTags(getInvalidationTagsForTable(table));
        }
      );
    });

    channel.subscribe();

    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      pendingTags.clear();
      void supabase.removeChannel(channel);
    };
  }, [accountId, supabase]);

  const value = useMemo<WebDataCacheContextValue>(
    () => ({
      cache: webDataCacheClient,
      userId,
      accountId,
      emitMutation: async (entity, action) => {
        const tags = getInvalidationTagsForMutation(entity, action);
        if (tags.length === 0) return;
        await webDataCacheClient.invalidateByTags(tags);
      },
    }),
    [accountId, userId]
  );

  return (
    <WebDataCacheContext.Provider value={value}>
      {children}
    </WebDataCacheContext.Provider>
  );
}

export function useWebDataCache() {
  const context = useContext(WebDataCacheContext);
  if (!context) {
    throw new Error("useWebDataCache must be used within WebDataCacheProvider");
  }
  return context;
}
