"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { themeTokens } from "@poleursus/shared";
import { Button } from "@/components/ui/button";

type NetworkNotice = {
  message: string;
  onRetry?: () => void;
  persistent?: boolean;
};

type NetworkNoticeContextValue = {
  reportNetworkIssue: (options?: { onRetry?: () => void }) => void;
};

const NetworkNoticeContext = createContext<NetworkNoticeContextValue>({
  reportNetworkIssue: () => {},
});

export function useNetworkNotice() {
  return useContext(NetworkNoticeContext);
}

export function NetworkNoticeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const [isOffline, setIsOffline] = useState(false);
  const [notice, setNotice] = useState<NetworkNotice | null>(null);
  const colors = themeTokens.light.colors;

  useEffect(() => {
    const updateStatus = () => {
      if (typeof navigator === "undefined") return;
      setIsOffline(!navigator.onLine);
    };

    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  useEffect(() => {
    if (isOffline) {
      setNotice({
        message: t("network.offlineMessage"),
        persistent: true,
      });
      return;
    }

    if (notice?.persistent) {
      setNotice(null);
    }
  }, [isOffline, notice?.persistent, t]);

  const reportNetworkIssue = useMemo(
    () => (options?: { onRetry?: () => void }) => {
      setNotice({
        message: t("network.offlineMessage"),
        onRetry: options?.onRetry,
        persistent: false,
      });

      window.setTimeout(() => {
        setNotice((current) => (current?.persistent ? current : null));
      }, 6000);
    },
    [t]
  );

  const handleRetry = () => {
    if (notice?.onRetry) {
      notice.onRetry();
      return;
    }

    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <NetworkNoticeContext.Provider value={{ reportNetworkIssue }}>
      {children}
      {notice && (
        <div className="fixed bottom-4 left-4 right-4 z-50 flex justify-center">
          <div
            className="flex w-full max-w-2xl items-center justify-between gap-3 rounded-lg border px-4 py-3 shadow-sm"
            style={{
              backgroundColor: colors.bg.surface,
              borderColor: colors.state.neutral,
              color: colors.text.primary,
            }}
            role="status"
            aria-live="polite"
          >
            <p className="text-sm">{notice.message}</p>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              {t("network.retry")}
            </Button>
          </div>
        </div>
      )}
    </NetworkNoticeContext.Provider>
  );
}
