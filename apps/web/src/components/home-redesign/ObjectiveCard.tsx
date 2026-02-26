import { formatCurrencyParts, toMinor } from "./utils";
import { useTranslations } from "next-intl";

type ObjectiveStatus = "on-track" | "at-risk" | "off-track";

type ObjectiveData = {
  status: ObjectiveStatus;
  currentMinor: bigint | string | number;
  targetMinor: bigint | string | number;
  messageHtml: string;
  streak: Array<{ hit: boolean }>;
};

type ObjectiveCardProps = {
  objective: ObjectiveData | null;
  onNavigate: () => void;
  currencySymbol: string;
  locale?: string;
  monoClassName?: string;
};

export function ObjectiveCard({
  objective,
  onNavigate,
  currencySymbol,
  locale = "es-ES",
  monoClassName,
}: ObjectiveCardProps) {
  const t = useTranslations();
  if (!objective) return null;

  const statusConfig: Record<
    ObjectiveStatus,
    { icon: string; bgClass: string; progressClass: string }
  > = {
    "on-track": {
      icon: "✓",
      bgClass: "bg-[var(--account-income-bg)] text-[var(--account-income)]",
      progressClass: "bg-[var(--account-income)]",
    },
    "at-risk": {
      icon: "⚠",
      bgClass: "bg-amber-500/15",
      progressClass: "bg-amber-500",
    },
    "off-track": {
      icon: "✕",
      bgClass: "bg-[var(--account-expense-bg)] text-[var(--account-expense)]",
      progressClass: "bg-[var(--account-expense)]",
    },
  };

  const config = statusConfig[objective.status] ?? statusConfig["at-risk"];
  const current = formatCurrencyParts(
    toMinor(objective.currentMinor),
    currencySymbol,
    locale
  );
  const target = formatCurrencyParts(
    toMinor(objective.targetMinor),
    currencySymbol,
    locale
  );

  const savedNum = Number(toMinor(objective.currentMinor));
  const targetNum = Number(toMinor(objective.targetMinor));
  const barScale = Math.max(savedNum, targetNum, 1);
  const clampPercent = (v: number) => Math.min(100, Math.max(0, v));
  const fillPercent = clampPercent(Math.round((Math.max(0, savedNum) / barScale) * 100));
  const markerPercent = clampPercent(Math.round((targetNum / barScale) * 100));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-foreground">
          {t("mobile.home.objectiveTitle")}
        </h3>
        <button
          type="button"
          onClick={onNavigate}
          className="text-[13px] font-medium text-primary hover:underline"
        >
          {t("mobile.home.objectiveViewDetail")}
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-base ${
            config.bgClass
          }`}
        >
          {config.icon}
        </div>
        <p className="text-sm font-semibold text-foreground">
          {t("mobile.home.objectiveHeadlineLabel", {
            amount: target.full,
          })}
        </p>
      </div>

      <div className="mb-3">
        <div className="relative h-1.5 rounded-full bg-muted/50">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              config.progressClass
            }`}
            style={{ width: `${fillPercent}%` }}
          />
          <div
            className="absolute -top-0.5 h-2.5 w-0.5 rounded-sm bg-foreground"
            style={{ left: `${markerPercent}%` }}
          />
        </div>
        <div className="mt-1.5 flex text-xs">
          {savedNum > targetNum ? (
            <>
              <span className={`text-right text-muted-foreground ${monoClassName ?? ""}`} style={{ flex: markerPercent }}>
                {target.full}
              </span>
              <strong className={`text-right text-foreground ${monoClassName ?? ""}`} style={{ flex: 100 - markerPercent }}>
                {current.full}
              </strong>
            </>
          ) : savedNum < targetNum ? (
            <>
              <strong className={`text-foreground ${monoClassName ?? ""}`}>
                {current.full}
              </strong>
              <span className={`flex-1 text-right text-muted-foreground ${monoClassName ?? ""}`}>
                {target.full}
              </span>
            </>
          ) : (
            <>
              <span className="flex-1" />
              <strong
                className={monoClassName ?? ""}
                style={{ color: "var(--account-income)" }}
              >
                {current.full} ✓
              </strong>
            </>
          )}
        </div>
      </div>

      <div className="rounded-lg bg-muted/40 px-3 py-2.5">
        <p
          className="text-[13px] leading-relaxed text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: objective.messageHtml }}
        />
      </div>

      {objective.streak?.length ? (
        <div className="mt-3.5 flex items-center gap-1">
          {objective.streak.map((month, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full ${
                month.hit ? "bg-[var(--account-income)]" : "bg-border"
              }`}
            />
          ))}
          <span className="ml-1 text-[11px] text-muted-foreground">
            {t("mobile.home.objectiveStreak", {
              hit: objective.streak.filter((m) => m.hit).length,
              total: objective.streak.length,
            })}
          </span>
        </div>
      ) : null}
    </div>
  );
}
