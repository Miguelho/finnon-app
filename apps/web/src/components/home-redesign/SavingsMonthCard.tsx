import { ChevronRight } from "lucide-react";
import { formatMoneyWithSymbol } from "@poleursus/shared";

const toMinor = (value: bigint | number | string | null | undefined): bigint => {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.round(value));
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

type SavingsMonthCardProps = {
  title: string;
  monthLabel: string;
  message: string;
  baseCurrency: string;
  currencySymbol: string;
  objectiveMinor: bigint | number | string;
  savingsMinor: bigint | number | string;
  projectsMinor: bigint | number | string;
  huchaMinor: bigint | number | string;
  onPress: () => void;
  projectsLabel: string;
  huchaLabel: string;
  totalLabel: string;
  monoClassName?: string;
};

export function SavingsMonthCard({
  title,
  monthLabel,
  message,
  baseCurrency,
  currencySymbol,
  objectiveMinor,
  savingsMinor,
  projectsMinor,
  huchaMinor,
  onPress,
  projectsLabel,
  huchaLabel,
  totalLabel,
  monoClassName,
}: SavingsMonthCardProps) {
  const objective = toMinor(objectiveMinor);
  const savings = toMinor(savingsMinor);
  const projects = toMinor(projectsMinor);
  const hucha = toMinor(huchaMinor);
  const positiveSavings = savings > 0n ? savings : 0n;
  const scale = Number(
    positiveSavings > objective ? positiveSavings : objective > 0n ? objective : 1n
  );
  const projectsPercent =
    scale > 0 ? Math.max(0, Math.min(100, (Number(projects) / scale) * 100)) : 0;
  const huchaPercent =
    scale > 0 ? Math.max(0, Math.min(100, (Number(hucha) / scale) * 100)) : 0;
  const markerPercent =
    scale > 0 ? Math.max(0, Math.min(100, (Number(objective) / scale) * 100)) : 0;

  return (
    <button
      type="button"
      onClick={onPress}
      className="w-full rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/30"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>{monthLabel}</span>
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>

      <div className="relative mt-3 h-2.5 rounded-full bg-secondary">
        {positiveSavings > 0n ? (
          <>
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[#4ade80]"
              style={{ width: `${projectsPercent}%` }}
            />
            <div
              className="absolute inset-y-0 rounded-full bg-[#fb923c]"
              style={{ width: `${huchaPercent}%`, left: `${projectsPercent}%` }}
            />
            <div
              className="absolute -top-1 h-4 w-[2px] rounded bg-white"
              style={{ left: `${markerPercent}%` }}
            />
          </>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <p className={monoClassName ?? ""}>
          {projectsLabel} {formatMoneyWithSymbol(projects, baseCurrency, currencySymbol)}
        </p>
        <p className={monoClassName ?? ""}>
          {huchaLabel} {formatMoneyWithSymbol(hucha, baseCurrency, currencySymbol)}
        </p>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground">{message}</p>
        <p className={`text-xs font-semibold text-[#4ade80] ${monoClassName ?? ""}`}>
          {totalLabel} {formatMoneyWithSymbol(savings, baseCurrency, currencySymbol)}
        </p>
      </div>
    </button>
  );
}

