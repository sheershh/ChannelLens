const compactFmt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const fullFmt = new Intl.NumberFormat("en");

export const compact = (n: number | null | undefined) => (n == null ? "—" : compactFmt.format(n));
export const full = (n: number | null | undefined) => (n == null ? "—" : fullFmt.format(n));
export const pct = (n: number | null | undefined, digits = 2) => (n == null ? "—" : `${n.toFixed(digits)}%`);
export const share = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n * 100)}%`);

export function signed(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n === 0) return "0";
  return (n > 0 ? "+" : "−") + compactFmt.format(Math.abs(n));
}

export function duration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const ss = String(seconds % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function timeAgo(iso: string | null, now: number = Date.now()): string {
  if (!iso) return "—";
  const secs = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  const units: [number, string][] = [
    [365 * 86400, "year"],
    [30 * 86400, "month"],
    [7 * 86400, "week"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];
  for (const [size, name] of units) {
    const n = Math.floor(secs / size);
    if (n >= 1) return `${n} ${name}${n === 1 ? "" : "s"} ago`;
  }
  return "just now";
}

export const usdRange = (r: { low: number; high: number }) => `$${compact(r.low)}–$${compact(r.high)}`;

/** Index of the best value among channels, or null when there's no clear leader. */
export function leaderIndex(values: (number | null | undefined)[], higherIsBetter = true): number | null {
  const known = values
    .map((v, i) => [v, i] as const)
    .filter((p): p is readonly [number, number] => p[0] != null);
  if (known.length < 2) return null;
  const sorted = [...known].sort((a, b) => (higherIsBetter ? b[0] - a[0] : a[0] - b[0]));
  return sorted[0][0] === sorted[1][0] ? null : sorted[0][1];
}

/** Percent change of each point from the first known point, so channels of different sizes share one chart. */
export function percentChange(values: (number | null)[]): (number | null)[] {
  const base = values.find((v) => v != null && v !== 0);
  if (base == null) return values.map(() => null);
  return values.map((v) => (v == null ? null : ((v - base) / base) * 100));
}
