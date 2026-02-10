import { t } from "@poleursus/shared";
import { getAccountSettingsContext } from "../_lib/account-settings";
import { AccountSettingsMembersPanel } from "../components/account-settings-members-panel";
import styles from "../settings-panels.module.css";

type AccountSettingsMembersPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AccountSettingsMembersPage({
  params,
}: AccountSettingsMembersPageProps) {
  const { id } = await params;
  const context = await getAccountSettingsContext(id);

  return (
    <div>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t(context.dictionary, "accountSettings.members.title")}</h1>
        <p className={styles.pageDescription}>
          {t(context.dictionary, "accountSettings.members.subtitle")}
        </p>
      </header>

      <AccountSettingsMembersPanel
        accountId={context.account.id}
        currentUserId={context.userId}
        canManageMembers={context.role === "admin"}
      />
    </div>
  );
}
