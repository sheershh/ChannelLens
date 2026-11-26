"use client";

import Link from "next/link";
import { useState } from "react";
import { api, explain } from "@/lib/api";
import type { WatchItem } from "@/lib/types";
import { useApi } from "@/lib/useApi";
import { useAuth } from "./AuthProvider";

export default function WatchButton({ channelId }: { channelId: string }) {
  const { user, ready } = useAuth();
  const list = useApi<{ items: WatchItem[] }>(user ? "/watchlist" : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) return null;
  if (!user) {
    return (
      <Link href={`/login?next=/channel/${channelId}`} className="btn btn-ghost">
        Sign in to track growth
      </Link>
    );
  }

  const watching = list.data?.items.some((i) => i.channel_id === channelId) ?? false;

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (watching) await api(`/watchlist/${channelId}`, { method: "DELETE" });
      else await api("/watchlist", { method: "POST", body: JSON.stringify({ channel_id: channelId }) });
      list.reload();
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex flex-col items-start gap-1">
      <button
        className={watching ? "btn btn-ghost" : "btn btn-primary"}
        onClick={toggle}
        disabled={busy || list.loading}
        aria-pressed={watching}
      >
        {watching ? "✓ On your watchlist" : "+ Add to watchlist"}
      </button>
      {error && <span className="text-xs text-red-300">{error}</span>}
    </span>
  );
}
