"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { explain } from "@/lib/api";
import { compact, full, pct, share, signed, usdRange } from "@/lib/format";
import type { ChannelReport, Delta, Snapshot } from "@/lib/types";
import { useApi } from "@/lib/useApi";
import Avatar from "./Avatar";
import { EngagementChart, GrowthChart, type GrowthMetric, UploadViewsChart } from "./Charts";
import StatCard, { ErrorBox, Skeleton } from "./StatCard";
import VideoTable from "./VideoTable";
import WatchButton from "./WatchButton";

function deltaBadge(d: Delta | null, key: "subscribers" | "views", label: string) {
  const n = d?.[key];
  if (n == null) return undefined;
  return { text: `${signed(n)} ${label}`, positive: n === 0 ? null : n > 0 };
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export default function ChannelDashboard() {
  const { id } = useParams<{ id: string }>();
  const report = useApi<ChannelReport>(`/channels/${id}`);
  const history = useApi<{ snapshots: Snapshot[] }>(`/channels/${id}/history?days=90`);
  const [metric, setMetric] = useState<GrowthMetric>("subscribers");
  const [sort, setSort] = useState<"published_at" | "views" | "engagement_rate">("published_at");

  const title = report.data?.channel.title;
  useEffect(() => {
    if (title) document.title = `${title} · ChannelLens`;
  }, [title]);

  if (report.error) {
    return (
      <div className="space-y-4">
        <ErrorBox message={explain(report.error)} onRetry={report.reload} />
        <Link href="/" className="text-sm text-zinc-400 hover:text-white">
          ← Back to search
        </Link>
      </div>
    );
  }
  if (!report.data) return <DashboardSkeleton />;

  const { channel, summary, growth, videos } = report.data;
  const snaps = history.data?.snapshots ?? [];
  const joined = channel.published_at ? new Date(channel.published_at).getFullYear() : null;

  return (
    <div className="space-y-6">
      {/* header */}
      <section className="card flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <Avatar src={channel.thumbnail_url} name={channel.title} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold text-zinc-50">{channel.title}</h1>
          <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-zinc-400">
            {channel.handle && <span>{channel.handle}</span>}
            {channel.country && <span>{channel.country}</span>}
            {joined && <span>On YouTube since {joined}</span>}
            <a
              className="text-red-300 hover:text-red-200"
              href={`https://www.youtube.com/channel/${channel.id}`}
              target="_blank"
              rel="noreferrer"
            >
              Open on YouTube ↗
            </a>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <WatchButton channelId={channel.id} />
          <Link href={`/compare?ids=${channel.id}`} className="btn btn-ghost">
            Compare
          </Link>
        </div>
      </section>

      {/* stats */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Subscribers"
          value={channel.subscribers == null ? "Hidden" : compact(channel.subscribers)}
          hint={channel.subscribers == null ? "The creator hides this" : full(channel.subscribers)}
          delta={deltaBadge(growth.d30, "subscribers", "in 30d")}
        />
        <StatCard
          label="Total views"
          value={compact(channel.views)}
          hint={full(channel.views)}
          delta={deltaBadge(growth.d30, "views", "in 30d")}
        />
        <StatCard label="Videos" value={full(channel.videos)} hint={`Stats below use the last ${summary.sample_size}`} />
        <StatCard label="Avg views / upload" value={compact(summary.avg_views)} hint={`Median ${compact(summary.median_views)}`} />
        <StatCard label="Engagement" value={pct(summary.engagement_rate)} hint="(Likes + comments) ÷ views" />
        <StatCard
          label="Upload pace"
          value={summary.uploads_per_week == null ? "—" : `${summary.uploads_per_week}/wk`}
          hint="Across recent uploads"
        />
        <StatCard label="Short-form" value={share(summary.short_form_share)} hint="Uploads of 3 minutes or less" />
        <StatCard
          label="Est. revenue"
          value={usdRange(summary.est_revenue_usd)}
          hint="Recent uploads at $1–4 per 1,000 views"
        />
      </section>

      {/* growth */}
      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-zinc-100">Growth</h2>
            <p className="text-xs text-zinc-500">
              {growth.days_tracked} daily snapshot{growth.days_tracked === 1 ? "" : "s"}
              {growth.since ? ` since ${growth.since}` : ""}
              {growth.d7 ? ` · 7 days: ${signed(growth.d7.subscribers)} subs, ${signed(growth.d7.views)} views` : ""}
            </p>
          </div>
          <div className="flex rounded-lg border border-white/10 p-0.5 text-xs" role="tablist">
            {(["subscribers", "views"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={metric === m}
                onClick={() => setMetric(m)}
                className={`rounded-md px-3 py-1 capitalize ${metric === m ? "bg-white/10 text-white" : "text-zinc-400"}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        {!history.data && history.loading ? (
          <Skeleton className="h-[260px]" />
        ) : snaps.length >= 2 ? (
          <GrowthChart snapshots={snaps} metric={metric} />
        ) : (
          <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-400">
            Tracking started today. YouTube&apos;s API only reports current totals, so ChannelLens saves a snapshot
            every day for channels on someone&apos;s watchlist. Add this one and the chart fills in from tomorrow.
          </p>
        )}
      </section>

      {videos.length > 0 && (
        <>
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="font-semibold text-zinc-100">Views on the last {videos.length} uploads</h2>
              <p className="mb-3 text-xs text-zinc-500">Oldest to newest. The best performer is highlighted.</p>
              <UploadViewsChart videos={videos} topId={summary.top_video_id} />
            </div>
            <div className="card p-5">
              <h2 className="font-semibold text-zinc-100">Engagement by upload</h2>
              <p className="mb-3 text-xs text-zinc-500">Dashed line is the channel average.</p>
              <EngagementChart videos={videos} average={summary.engagement_rate} />
            </div>
          </section>
          <section className="card p-2 sm:p-4">
            <h2 className="px-3 pt-2 font-semibold text-zinc-100">Recent uploads</h2>
            <VideoTable videos={videos} topId={summary.top_video_id} sort={sort} onSort={setSort} />
          </section>
        </>
      )}
    </div>
  );
}
