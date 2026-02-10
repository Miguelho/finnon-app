import { t } from "@poleursus/shared";
import { getAccountSettingsContext } from "../_lib/account-settings";
import { AccountSettingsCategoriesPanel } from "../components/account-settings-categories-panel";
import styles from "../settings-panels.module.css";

type AccountSettingsCategoriesPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AccountSettingsCategoriesPage({
  params,
}: AccountSettingsCategoriesPageProps) {
  const { id } = await params;
  const context = await getAccountSettingsContext(id);

  return (
    <div>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t(context.dictionary, "accountSettings.categories.title")}</h1>
        <p className={styles.pageDescription}>
          {t(context.dictionary, "accountSettings.categories.subtitle")}
        </p>
      </header>

      <AccountSettingsCategoriesPanel
        accountId={context.account.id}
        canEdit={context.role !== "viewer"}
      />
    </div>
  );
}
