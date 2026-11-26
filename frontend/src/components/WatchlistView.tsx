"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, explain } from "@/lib/api";
import { compact, timeAgo } from "@/lib/format";
import type { WatchItem } from "@/lib/types";
import { useApi } from "@/lib/useApi";
import { useAuth } from "./AuthProvider";
import Avatar from "./Avatar";
import SearchBox from "./SearchBox";
import { ErrorBox, Skeleton } from "./StatCard";

export default function WatchlistView() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const list = useApi<{ items: WatchItem[] }>(user ? "/watchlist" : null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!ready) return <Skeleton className="h-64" />;
  if (!user) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-semibold text-zinc-50">Your watchlist</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Sign in to save channels. ChannelLens records their subscribers and views every day so you can see how they
          grow.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link href="/login?next=/watchlist" className="btn btn-ghost">
            Sign in
          </Link>
          <Link href="/register?next=/watchlist" className="btn btn-primary">
            Create an account
          </Link>
        </div>
      </div>
    );
  }

  async function add(channelId: string) {
    setError(null);
    try {
      await api("/watchlist", { method: "POST", body: JSON.stringify({ channel_id: channelId }) });
      list.reload();
    } catch (e) {
      setError(explain(e));
    }
  }

  async function remove(channelId: string) {
    setError(null);
    try {
      await api(`/watchlist/${channelId}`, { method: "DELETE" });
      setSelected((s) => s.filter((x) => x !== channelId));
      list.reload();
    } catch (e) {
      setError(explain(e));
    }
  }

  const items = list.data?.items ?? [];
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 4 ? [...s, id] : s));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Watchlist</h1>
          <p className="mt-1 text-sm text-zinc-400">Refreshed automatically once a day. Tick 2 to 4 channels to compare them.</p>
        </div>
        <button
          className="btn btn-primary"
          disabled={selected.length < 2}
          onClick={() => router.push(`/compare?ids=${selected.join(",")}`)}
        >
          Compare selected ({selected.length})
        </button>
      </div>

      <div className="card p-5">
        <SearchBox
          pickSingle
          buttonLabel="Add"
          placeholder="Add a channel to your watchlist"
          exclude={items.map((i) => i.channel_id)}
          onSelect={(r) => add(r.id)}
        />
      </div>

      {error && <ErrorBox message={error} />}
      {list.error && <ErrorBox message={explain(list.error)} onRetry={list.reload} />}
      {!list.data && !list.error && <Skeleton className="h-40" />}
      {list.data && items.length === 0 && (
        <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-400">
          Nothing here yet. Add a channel above, or use &quot;Add to watchlist&quot; on any channel page.
        </p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.channel_id} className={`card p-4 ${selected.includes(item.channel_id) ? "border-red-400/50" : ""}`}>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-red-500"
                checked={selected.includes(item.channel_id)}
                onChange={() => toggle(item.channel_id)}
                aria-label={`Select ${item.title} for comparison`}
              />
              <Avatar src={item.thumbnail_url} name={item.title} size={44} />
              <div className="min-w-0 flex-1">
                <Link href={`/channel/${item.channel_id}`} className="block truncate font-medium text-zinc-100 hover:text-white">
                  {item.title}
                </Link>
                <div className="text-xs text-zinc-500">{item.handle}</div>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              {(
                [
                  ["Subs", item.latest?.subscribers],
                  ["Views", item.latest?.views],
                  ["Videos", item.latest?.videos],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="rounded-lg bg-white/[0.03] py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-zinc-500">{k}</dt>
                  <dd className="font-semibold tabular-nums text-zinc-100">{v === null && k === "Subs" ? "Hidden" : compact(v)}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
              <span>Added {timeAgo(item.added_at)}</span>
              <button className="text-zinc-400 hover:text-red-300" onClick={() => remove(item.channel_id)}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
