import { formatCurrencyParts, toMinor } from "./utils";

type ObjectiveStatus = "on-track" | "at-risk" | "off-track";

type ObjectiveData = {
  status: ObjectiveStatus;
  statusLabel: string;
  description: string;
  currentMinor: bigint | string | number;
  targetMinor: bigint | string | number;
  progressPercent: number;
  expectedPercent: number;
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
  if (!objective) return null;

  const statusConfig: Record<
    ObjectiveStatus,
    { icon: string; bgClass: string; progressClass: string }
  > = {
    "on-track": {
      icon: "✓",
      bgClass: "bg-green-500/15",
      progressClass: "bg-green-600",
    },
    "at-risk": {
      icon: "⚠",
      bgClass: "bg-amber-500/15",
      progressClass: "bg-amber-500",
    },
    "off-track": {
      icon: "✕",
      bgClass: "bg-red-500/15",
      progressClass: "bg-red-600",
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

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-foreground">Objetivo</h3>
        <button
          type="button"
          onClick={onNavigate}
          className="text-[13px] font-medium text-primary hover:underline"
        >
          Ver detalle →
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
        <div>
          <p className="text-sm font-semibold text-foreground">
            {objective.statusLabel}
          </p>
          <p className="text-xs text-muted-foreground">{objective.description}</p>
        </div>
      </div>

      <div className="mb-3">
        <div className="relative h-1.5 rounded-full bg-muted/50">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              config.progressClass
            }`}
            style={{ width: `${objective.progressPercent}%` }}
          />
          <div
            className="absolute -top-0.5 h-2.5 w-0.5 rounded-sm bg-muted-foreground"
            style={{ left: `${objective.expectedPercent}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between">
          <span className="text-xs text-muted-foreground">
            <strong
              className={`font-semibold text-foreground ${monoClassName ?? ""}`}
            >
              {current.full}
            </strong>{" "}
            ahorrado
          </span>
          <span className={`text-xs text-muted-foreground ${monoClassName ?? ""}`}>
            de {target.full}
          </span>
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
                month.hit ? "bg-green-600" : "bg-border"
              }`}
            />
          ))}
          <span className="ml-1 text-[11px] text-muted-foreground">
            {objective.streak.filter((m) => m.hit).length} de{" "}
            {objective.streak.length} meses
          </span>
        </div>
      ) : null}
    </div>
  );
}
