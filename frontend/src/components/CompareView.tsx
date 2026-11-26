"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, explain } from "@/lib/api";
import { compact, leaderIndex, pct, share, signed } from "@/lib/format";
import type { ChannelReport, Snapshot } from "@/lib/types";
import { parseIds } from "@/lib/url";
import { useApi } from "@/lib/useApi";
import Avatar from "./Avatar";
import { CompareBarChart, CompareGrowthChart, SERIES_COLORS } from "./Charts";
import SearchBox from "./SearchBox";
import { ErrorBox, Skeleton } from "./StatCard";

type Report = Omit<ChannelReport, "videos">;

const ROWS: { label: string; get: (r: Report) => number | null; fmt: (n: number | null) => string; neutral?: boolean }[] = [
  { label: "Subscribers", get: (r) => r.channel.subscribers, fmt: compact },
  { label: "Total views", get: (r) => r.channel.views, fmt: compact },
  { label: "Videos", get: (r) => r.channel.videos, fmt: compact },
  { label: "Avg views / upload", get: (r) => r.summary.avg_views, fmt: compact },
  { label: "Median views / upload", get: (r) => r.summary.median_views, fmt: compact },
  { label: "Engagement", get: (r) => r.summary.engagement_rate, fmt: (n) => pct(n) },
  { label: "Uploads per week", get: (r) => r.summary.uploads_per_week, fmt: (n) => (n == null ? "—" : String(n)) },
  { label: "Short-form share", get: (r) => r.summary.short_form_share, fmt: share, neutral: true },
  { label: "Subscribers, last 30 days", get: (r) => r.growth.d30?.subscribers ?? null, fmt: signed },
  { label: "Views per subscriber", get: (r) => (r.channel.subscribers ? r.channel.views / r.channel.subscribers : null), fmt: (n) => (n == null ? "—" : n.toFixed(0)) },
];

export default function CompareView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const ids = parseIds(params.get("ids"));
  const ready = ids.length >= 2;
  const result = useApi<{ channels: Report[] }>(ready ? `/compare?ids=${ids.join(",")}` : null);
  const [histories, setHistories] = useState<Record<string, Snapshot[]>>({});
  // Names for the chips while fewer than 2 are picked (the compare call needs 2).
  const [names, setNames] = useState<Record<string, string>>({});

  const setIds = (next: string[]) =>
    router.replace(next.length ? `${pathname}?ids=${next.join(",")}` : pathname, { scroll: false });

  const idsKey = ids.join(",");
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    Promise.all(
      idsKey.split(",").map((id) =>
        api<{ snapshots: Snapshot[] }>(`/channels/${id}/history?days=90`).then((h) => [id, h.snapshots] as const),
      ),
    ).then(
      (pairs) => {
        if (alive) setHistories(Object.fromEntries(pairs));
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [idsKey, ready]);

  const reports = result.data?.channels ?? [];
  const nameOf = (id: string) => reports.find((r) => r.channel.id === id)?.channel.title ?? names[id] ?? id.slice(0, 10) + "…";
  const growthSeries = reports
    .map((r) => ({ name: r.channel.title, snapshots: histories[r.channel.id] ?? [] }))
    .filter((s) => s.snapshots.length >= 2);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Compare channels</h1>
        <p className="mt-1 text-sm text-zinc-400">Pick 2 to 4 channels. Their stats come back in a single YouTube API call.</p>
      </div>

      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          {ids.map((id, i) => (
            <span
              key={id}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 py-1 pl-3 pr-1 text-sm"
              style={{ borderColor: SERIES_COLORS[i] + "80" }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[i] }} />
              {nameOf(id)}
              <button
                aria-label={`Remove ${nameOf(id)}`}
                className="rounded-full px-2 text-zinc-400 hover:bg-white/10 hover:text-white"
                onClick={() => setIds(ids.filter((x) => x !== id))}
              >
                ×
              </button>
            </span>
          ))}
          {ids.length === 0 && <span className="text-sm text-zinc-500">No channels picked yet.</span>}
        </div>
        {ids.length < 4 && (
          <SearchBox
            pickSingle
            exclude={ids}
            buttonLabel="Add"
            placeholder={ids.length ? "Add another channel" : "Search for the first channel"}
            onSelect={(r) => {
              setNames((n) => ({ ...n, [r.id]: r.title }));
              setIds([...ids, r.id]);
            }}
          />
        )}
      </section>

      {!ready && ids.length === 1 && <p className="text-sm text-zinc-400">Add one more channel to compare.</p>}
      {result.error && <ErrorBox message={explain(result.error)} onRetry={result.reload} />}
      {ready && !result.data && !result.error && <Skeleton className="h-96" />}

      {reports.length >= 2 && (
        <>
          <section className="card overflow-x-auto p-2 sm:p-4">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Metric</th>
                  {reports.map((r, i) => (
                    <th key={r.channel.id} className="px-3 py-3 text-right">
                      <Link href={`/channel/${r.channel.id}`} className="inline-flex items-center gap-2 hover:text-white">
                        <Avatar src={r.channel.thumbnail_url} name={r.channel.title} size={24} />
                        <span className="font-medium" style={{ color: SERIES_COLORS[i] }}>
                          {r.channel.title}
                        </span>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const values = reports.map(row.get);
                  const lead = row.neutral ? null : leaderIndex(values);
                  return (
                    <tr key={row.label} className="border-b border-white/5">
                      <td className="px-3 py-2.5 text-zinc-400">{row.label}</td>
                      {values.map((v, i) => (
                        <td
                          key={i}
                          className={`px-3 py-2.5 text-right tabular-nums ${i === lead ? "font-semibold text-emerald-300" : "text-zinc-200"}`}
                        >
                          {row.fmt(v)}
                          {i === lead && <span className="sr-only"> (leader)</span>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="mb-2 font-semibold text-zinc-100">Average views per upload</h2>
              <CompareBarChart rows={reports.map((r) => ({ name: r.channel.title, value: r.summary.avg_views }))} />
            </div>
            <div className="card p-5">
              <h2 className="mb-2 font-semibold text-zinc-100">Engagement rate</h2>
              <CompareBarChart
                rows={reports.map((r) => ({ name: r.channel.title, value: r.summary.engagement_rate }))}
                format={(n) => `${n.toFixed(1)}%`}
              />
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-semibold text-zinc-100">Subscriber growth, last 90 days</h2>
            <p className="mb-3 text-xs text-zinc-500">
              Percent change from each channel&apos;s first snapshot, so big and small channels fit on one chart.
            </p>
            {growthSeries.length >= 1 ? (
              <CompareGrowthChart series={growthSeries} />
            ) : (
              <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-400">
                No history yet. Growth appears once these channels have been on a watchlist for a couple of days.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
