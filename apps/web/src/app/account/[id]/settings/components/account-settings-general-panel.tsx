"use client";

import { useMemo, useState } from "react";
import { CURRENCIES } from "@poleursus/shared";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import styles from "../settings-panels.module.css";

type AccountSettingsGeneralPanelProps = {
  accountId: string;
  initialName: string;
  initialCurrency: string;
  icon: string;
  canEdit: boolean;
};

export function AccountSettingsGeneralPanel({
  accountId,
  initialName,
  initialCurrency,
  icon,
  canEdit,
}: AccountSettingsGeneralPanelProps) {
  const t = useTranslations();
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState(initialName);
  const [currency, setCurrency] = useState(initialCurrency);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = name.trim() !== initialName || currency !== initialCurrency;

  const saveChanges = async () => {
    if (!canEdit || isSaving || !hasChanges) return;

    const normalizedName = name.trim();
    if (!normalizedName) {
      toast.error(t("categories.nameRequired"));
      return;
    }

    setIsSaving(true);
    const { error } = await supabase
      .from("accounts")
      .update({ name: normalizedName, base_currency: currency })
      .eq("id", accountId);

    if (error) {
      toast.error(t("accountSettings.general.saveError"));
      setIsSaving(false);
      return;
    }

    toast.success(t("accountSettings.general.saveSuccess"));
    setIsSaving(false);
  };

  return (
    <>
      <h2 className={styles.detailsSectionTitle}>
        {t("account.title")}
      </h2>

      <div className={styles.detailsCard}>
        <div className={styles.detailsRow}>
          <span className={styles.detailsLabel}>{t("common.iconLabel")}</span>
          <div className={styles.detailsControl}>
            <div className={styles.iconPreview}>{icon}</div>
          </div>
        </div>

        <div className={styles.detailsRow}>
          <span className={styles.detailsLabel}>{t("common.nameLabel")}</span>
          <div className={styles.detailsControl}>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={styles.input}
              maxLength={80}
              disabled={!canEdit || isSaving}
            />
          </div>
        </div>

        <div className={styles.detailsRow}>
          <span className={styles.detailsLabel}>{t("common.currencyLabel")}</span>
          <div className={styles.detailsControl}>
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className={styles.select}
              disabled={!canEdit || isSaving}
            >
              {CURRENCIES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code} · {option.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={styles.saveRow}>
        <button
          type="button"
          onClick={saveChanges}
          className={styles.saveButton}
          disabled={!canEdit || isSaving || !hasChanges}
        >
          {isSaving ? t("common.saving") : t("common.saveChanges")}
        </button>
        {!canEdit ? (
          <span className={styles.helperText}>{t("categories.readOnlyNotice")}</span>
        ) : null}
      </div>

      <section className={styles.dangerSection}>
        <h2 className={styles.dangerTitle}>{t("accountSettings.general.dangerTitle")}</h2>
        <div className={styles.dangerCard}>
          <div>
            <p className={styles.dangerInfoTitle}>{t("accountSettings.general.deleteTitle")}</p>
            <p className={styles.dangerInfoDescription}>
              {t("accountSettings.general.deleteDescription")}
            </p>
          </div>
          <button type="button" disabled className={styles.dangerButton}>
            {t("common.delete")}
          </button>
        </div>
      </section>
    </>
  );
}
