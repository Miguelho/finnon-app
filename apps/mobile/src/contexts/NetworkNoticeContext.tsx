import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { themeTokens } from "@poleursus/shared";
import { useCopy, t } from "../lib/i18n";

type NetworkNotice = {
  message: string;
  onRetry?: () => void;
  persistent?: boolean;
};

type NetworkNoticeContextValue = {
  reportNetworkIssue: (options?: { message?: string; onRetry?: () => void }) => void;
};

const NetworkNoticeContext = createContext<NetworkNoticeContextValue>({
  reportNetworkIssue: () => {},
});

export function useNetworkNotice() {
  return useContext(NetworkNoticeContext);
}

const tokens = themeTokens.light;
const colors = tokens.colors;

export function NetworkNoticeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { dictionary } = useCopy();
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);
  const [notice, setNotice] = useState<NetworkNotice | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(offline);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isOffline) {
      setNotice({
        message: t(dictionary, "network.offlineMessage"),
        persistent: true,
      });
      return;
    }

    if (notice?.persistent) {
      setNotice(null);
    }
  }, [dictionary, isOffline, notice?.persistent]);

  const reportNetworkIssue = useMemo(
    () => (options?: { message?: string; onRetry?: () => void }) => {
      setNotice({
        message: options?.message ?? t(dictionary, "network.offlineMessage"),
        onRetry: options?.onRetry,
      });

      setTimeout(() => {
        setNotice((current) => (current?.persistent ? current : null));
      }, 6000);
    },
    [dictionary]
  );

  const handleRetry = async () => {
    if (notice?.onRetry) {
      notice.onRetry();
      return;
    }

    try {
      const state = await NetInfo.fetch();
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(offline);
    } catch (error) {
      console.error("[NetworkNotice] Retry failed:", error);
    }
  };

  return (
    <NetworkNoticeContext.Provider value={{ reportNetworkIssue }}>
      <View style={styles.root}>
        {children}
        {notice && (
          <View style={[styles.banner, { bottom: insets.bottom + tokens.spacing.md }]}>
            <Text style={styles.bannerText}>{notice.message}</Text>
            <Button
              title={t(dictionary, "network.retry")}
              onPress={handleRetry}
              variant="secondary"
            />
          </View>
        )}
      </View>
    </NetworkNoticeContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  banner: {
    position: "absolute",
    left: tokens.spacing.lg,
    right: tokens.spacing.lg,
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    gap: tokens.spacing.sm,
  },
  bannerText: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.primary,
  },
});
