import { t } from "@poleursus/shared";
import { getAccountSettingsContext } from "../_lib/account-settings";
import { AccountSettingsGeneralPanel } from "../components/account-settings-general-panel";
import styles from "../settings-panels.module.css";
import { JSX } from "react";

type AccountSettingsGeneralPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AccountSettingsGeneralPage({
  params,
}: AccountSettingsGeneralPageProps): Promise<JSX.Element> {
  const { id } = await params;
  const context = await getAccountSettingsContext(id);

  return (
    <div>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t(context.dictionary, "accountSettings.general.title")}</h1>
        <p className={styles.pageDescription}>
          {t(context.dictionary, "accountSettings.general.subtitle")}
        </p>
      </header>

      <AccountSettingsGeneralPanel
        accountId={context.account.id}
        initialName={context.account.name}
        initialCurrency={context.account.baseCurrency}
        icon={context.account.icon}
        canEdit={context.role !== "viewer"}
      />
    </div>
  );
}
