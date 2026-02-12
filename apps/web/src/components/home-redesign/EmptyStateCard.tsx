type EmptyStateCardProps = {
  icon: string;
  title: string;
  description: string;
  buttonLabel: string;
  onAction: () => void;
};

export function EmptyStateCard({
  icon,
  title,
  description,
  buttonLabel,
  onAction,
}: EmptyStateCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-5 py-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-xl">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-[13px] font-semibold text-primary-foreground transition-transform hover:-translate-y-px hover:bg-primary/90"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
