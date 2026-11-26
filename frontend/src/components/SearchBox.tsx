"use client";

import { useState } from "react";
import { api, explain } from "@/lib/api";
import type { SearchResult } from "@/lib/types";
import Avatar from "./Avatar";

type Props = {
  onSelect: (result: SearchResult) => void;
  /** When a lookup returns exactly one channel (an @handle, ID or link), select it straight away. */
  pickSingle?: boolean;
  examples?: string[];
  exclude?: string[];
  placeholder?: string;
  buttonLabel?: string;
};

/**
 * Searches only on submit, never on each keystroke: a name search costs 100 of the
 * 10,000 daily YouTube quota units, so search-as-you-type would burn the budget fast.
 */
export default function SearchBox({
  onSelect,
  pickSingle = false,
  examples = [],
  exclude = [],
  placeholder = "Channel name, @handle or YouTube link",
  buttonLabel = "Search",
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ results: SearchResult[] }>(`/channels/search?q=${encodeURIComponent(trimmed)}`);
      const found = res.results.filter((r) => !exclude.includes(r.id));
      if (pickSingle && found.length === 1 && !trimmed.includes(" ")) {
        setResults(null);
        onSelect(found[0]);
      } else {
        setResults(found);
      }
    } catch (e) {
      setError(explain(e));
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
      >
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Search YouTube channels"
          maxLength={200}
        />
        <button className="btn btn-primary shrink-0" disabled={loading || !query.trim()}>
          {loading ? "Searching…" : buttonLabel}
        </button>
      </form>

      {examples.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          Try
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              className="rounded-full border border-white/10 px-2.5 py-1 text-zinc-300 hover:border-red-400/50 hover:text-white"
              onClick={() => {
                setQuery(ex);
                run(ex);
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {results && (
        <ul className="mt-3 divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-zinc-950/80">
          {results.length === 0 && <li className="px-4 py-3 text-sm text-zinc-400">No channels found.</li>}
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5"
                onClick={() => {
                  setResults(null);
                  onSelect(r);
                }}
              >
                <Avatar src={r.thumbnail_url} name={r.title} size={36} />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-zinc-100">{r.title}</span>
                  {r.description && <span className="block truncate text-xs text-zinc-500">{r.description}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
