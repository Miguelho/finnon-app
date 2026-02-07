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
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="px-5 py-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-gray-400">
          {description}
        </p>
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-5 py-2 text-[13px] font-semibold text-white transition-transform hover:-translate-y-px"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
