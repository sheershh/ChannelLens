"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import type { Health } from "./types";

let cached: Promise<Health | null> | null = null;

/** /api/health, fetched once per page load and shared by every caller. */
export function useHealth(): Health | null {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    cached ??= api<Health>("/health").catch(() => null);
    let alive = true;
    cached.then((h) => {
      if (alive) setHealth(h);
    });
    return () => {
      alive = false;
    };
  }, []);
  return health;
}
