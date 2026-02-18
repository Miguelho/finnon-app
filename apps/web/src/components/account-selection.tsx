"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ActiveAccountSelector } from "@/components/settings/active-account-selector";

type Account = {
  id: string;
  name: string;
  base_currency: string;
  memberCount: number;
};

type AccountSelectionProps = {
  accounts: Account[];
  initialActiveAccountId: string;
};

export function AccountSelection({
  accounts,
  initialActiveAccountId,
}: AccountSelectionProps) {
  const router = useRouter();
  const t = useTranslations();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleSelected = () => {
    setIsRedirecting(true);
    router.replace("/home");
  };

  return (
    <div className="space-y-4">
      {isRedirecting && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("common.loading")}
        </p>
      )}
      <ActiveAccountSelector
        accounts={accounts}
        initialActiveAccountId={initialActiveAccountId}
        onAccountSelected={handleSelected}
      />
    </div>
  );
}
