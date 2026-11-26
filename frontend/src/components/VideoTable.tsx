import Image from "next/image";
import { compact, duration, pct, timeAgo } from "@/lib/format";
import type { Video } from "@/lib/types";

type SortKey = "published_at" | "views" | "engagement_rate";

export function sortVideos(videos: Video[], key: SortKey): Video[] {
  return [...videos].sort((a, b) => {
    if (key === "published_at") return (b.published_at ?? "").localeCompare(a.published_at ?? "");
    return (b[key] ?? -1) - (a[key] ?? -1);
  });
}

export default function VideoTable({
  videos,
  topId,
  sort,
  onSort,
}: {
  videos: Video[];
  topId: string | null;
  sort: SortKey;
  onSort: (k: SortKey) => void;
}) {
  const header = (key: SortKey, label: string, align = "text-right") => (
    <th className={`px-3 py-2 font-medium ${align}`} aria-sort={sort === key ? "descending" : "none"}>
      <button
        className={`uppercase tracking-wide hover:text-zinc-200 ${sort === key ? "text-zinc-100" : ""}`}
        onClick={() => onSort(key)}
      >
        {label}
        {sort === key ? " ↓" : ""}
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-xs uppercase tracking-wide text-zinc-500">
          <tr className="border-b border-white/10">
            <th className="px-3 py-2 text-left font-medium">Video</th>
            {header("published_at", "Published")}
            <th className="px-3 py-2 text-right font-medium">Length</th>
            {header("views", "Views")}
            <th className="px-3 py-2 text-right font-medium">Likes</th>
            {header("engagement_rate", "Engagement")}
          </tr>
        </thead>
        <tbody>
          {sortVideos(videos, sort).map((v) => (
            <tr key={v.id} className="border-b border-white/5 hover:bg-white/[0.02]">
              <td className="px-3 py-2">
                <a
                  href={`https://www.youtube.com/watch?v=${v.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 hover:text-white"
                >
                  {v.thumbnail_url ? (
                    <Image
                      src={v.thumbnail_url}
                      alt=""
                      width={80}
                      height={45}
                      unoptimized
                      className="h-[45px] w-[80px] shrink-0 rounded-md bg-white/5 object-cover"
                    />
                  ) : null}
                  <span className="line-clamp-2 text-zinc-200">
                    {v.title}
                    {v.id === topId && (
                      <span className="ml-2 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-300">
                        Top
                      </span>
                    )}
                  </span>
                </a>
              </td>
              <td className="px-3 py-2 text-right text-zinc-400">{timeAgo(v.published_at)}</td>
              <td className="px-3 py-2 text-right text-zinc-400 tabular-nums">{duration(v.duration_seconds)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{compact(v.views)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{v.likes == null ? "Hidden" : compact(v.likes)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{pct(v.engagement_rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
