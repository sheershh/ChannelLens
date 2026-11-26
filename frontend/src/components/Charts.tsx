"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { compact, percentChange } from "@/lib/format";
import type { Snapshot, Video } from "@/lib/types";

export const SERIES_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"];

// Two decimals on axes so a 2.1M→2.3M range doesn't render as "2.2M, 2.2M, 2.3M".
const axisFmt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 });
const axisNum = (v: number) => axisFmt.format(v);

const axis = { stroke: "#52525b", fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: { background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#a1a1aa" },
  itemStyle: { color: "#f4f4f5" },
};
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short", timeZone: "UTC" });

/** Views per upload, oldest to newest; the best performer is highlighted. */
export function UploadViewsChart({ videos, topId }: { videos: Video[]; topId: string | null }) {
  const data = [...videos].reverse().map((v) => ({ id: v.id, title: v.title, views: v.views, date: v.published_at ?? "" }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axis} minTickGap={16} />
        <YAxis tickFormatter={axisNum} {...axis} width={48} />
        <Tooltip
          {...tooltipStyle}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          labelFormatter={(_, payload) => String(payload?.[0]?.payload?.title ?? "")}
          formatter={(v) => [compact(Number(v)), "Views"]}
        />
        <Bar dataKey="views" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.id} fill={d.id === topId ? "#ef4444" : "rgba(239,68,68,0.45)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function EngagementChart({ videos, average }: { videos: Video[]; average: number | null }) {
  const data = [...videos]
    .reverse()
    .map((v) => ({ title: v.title, date: v.published_at ?? "", rate: v.engagement_rate, avg: average }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axis} minTickGap={16} />
        <YAxis tickFormatter={(v) => `${v}%`} {...axis} width={48} />
        <Tooltip
          {...tooltipStyle}
          labelFormatter={(_, payload) => String(payload?.[0]?.payload?.title ?? "")}
          formatter={(v, name) => [`${Number(v).toFixed(2)}%`, name === "avg" ? "Channel average" : "Engagement"]}
        />
        <Line type="monotone" dataKey="rate" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
        <Line type="monotone" dataKey="avg" stroke="#71717a" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export type GrowthMetric = "subscribers" | "views";

export function GrowthChart({ snapshots, metric }: { snapshots: Snapshot[]; metric: GrowthMetric }) {
  const data = snapshots.map((s) => ({ day: s.day, value: s[metric] }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="day" tickFormatter={shortDate} {...axis} minTickGap={24} />
        <YAxis tickFormatter={axisNum} {...axis} width={56} domain={["auto", "auto"]} />
        <Tooltip
          {...tooltipStyle}
          labelFormatter={(d) => shortDate(String(d))}
          formatter={(v) => [compact(Number(v)), metric === "subscribers" ? "Subscribers" : "Total views"]}
        />
        <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2.2} dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CompareBarChart({
  rows,
  format = compact,
}: {
  rows: { name: string; value: number | null }[];
  format?: (n: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
        <XAxis type="number" tickFormatter={(v) => format(v)} {...axis} />
        <YAxis type="category" dataKey="name" {...axis} width={110} />
        <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(v) => [format(Number(v)), ""]} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {rows.map((r, i) => (
            <Cell key={r.name} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Subscriber growth as % change from each channel's first snapshot, so a 50K and a 5M channel fit one chart. */
export function CompareGrowthChart({ series }: { series: { name: string; snapshots: Snapshot[] }[] }) {
  const days = [...new Set(series.flatMap((s) => s.snapshots.map((x) => x.day)))].sort();
  const lookups = series.map((s) => {
    const byDay = new Map(s.snapshots.map((x) => [x.day, x.subscribers]));
    const changes = percentChange(days.map((d) => byDay.get(d) ?? null));
    return new Map(days.map((d, i) => [d, changes[i]]));
  });
  const data = days.map((day) => {
    const row: Record<string, string | number | null> = { day };
    series.forEach((s, i) => (row[s.name] = lookups[i].get(day) ?? null));
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="day" tickFormatter={shortDate} {...axis} minTickGap={24} />
        <YAxis tickFormatter={(v) => `${Number(v).toFixed(1)}%`} {...axis} width={52} />
        <Tooltip
          {...tooltipStyle}
          labelFormatter={(d) => shortDate(String(d))}
          formatter={(v, name) => [`${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(2)}%`, String(name)]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Line
            key={s.name}
            type="monotone"
            dataKey={s.name}
            stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
