import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import {
  getInvalidationTagsForMutation,
  getInvalidationTagsForTable,
  type CacheClient,
  type MutationAction,
  type MutationEntity,
} from "@poleursus/shared";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { mobileDataCacheClient } from "./client";

type DataCacheContextValue = {
  cache: CacheClient;
  userId: string | null;
  accountId: string | null;
  emitMutation: (entity: MutationEntity, action: MutationAction) => Promise<void>;
};

const DataCacheContext = createContext<DataCacheContextValue | undefined>(undefined);

const REALTIME_TABLES: MutationEntity[] = [
  "transactions",
  "obligations",
  "recurring_items",
  "categories",
  "financial_goals",
  "projects",
  "project_contributions",
];

export function DataCacheProvider({ children }: { children: ReactNode }) {
  const { user, selectedAccountId } = useAuth();
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
      void mobileDataCacheClient.invalidateByTags(tagsToInvalidate);
    }, 350);
  };

  useEffect(() => {
    const previous = previousUserIdRef.current;
    const current = user?.id ?? null;

    if (previous && previous !== current) {
      void mobileDataCacheClient.clearByUser(previous);
    }

    previousUserIdRef.current = current;
  }, [user?.id]);

  useEffect(() => {
    if (!selectedAccountId) return;

    const channel = supabase.channel(`data-cache:${selectedAccountId}`);

    REALTIME_TABLES.forEach((table) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `account_id=eq.${selectedAccountId}`,
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
      pendingTagsRef.current.clear();
      void supabase.removeChannel(channel);
    };
  }, [selectedAccountId]);

  const value = useMemo<DataCacheContextValue>(
    () => ({
      cache: mobileDataCacheClient,
      userId: user?.id ?? null,
      accountId: selectedAccountId,
      emitMutation: async (entity, action) => {
        const tags = getInvalidationTagsForMutation(entity, action);
        if (tags.length === 0) return;
        await mobileDataCacheClient.invalidateByTags(tags);
      },
    }),
    [user?.id, selectedAccountId]
  );

  return (
    <DataCacheContext.Provider value={value}>{children}</DataCacheContext.Provider>
  );
}

export function useDataCache() {
  const context = useContext(DataCacheContext);
  if (!context) {
    throw new Error("useDataCache must be used within DataCacheProvider");
  }
  return context;
}
