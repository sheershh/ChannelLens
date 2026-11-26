export default function StatCard({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: { text: string; positive: boolean | null };
}) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-zinc-50 tabular-nums">{value}</span>
        {delta && (
          <span
            className={`text-xs font-medium tabular-nums ${
              delta.positive === null ? "text-zinc-400" : delta.positive ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {delta.text}
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/5 ${className}`} />;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card flex items-center justify-between gap-4 border-red-500/30 p-4 text-sm text-red-200">
      <span>{message}</span>
      {onRetry && (
        <button className="btn btn-ghost" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
