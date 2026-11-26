"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";

type Result<T> = { key: string; data?: T; error?: ApiError };

/** GET `path` (relative to /api). Pass null to skip. Refetches when the path changes. */
export function useApi<T>(path: string | null) {
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);
  const key = path === null ? null : `${path}#${nonce}`;

  useEffect(() => {
    if (path === null || key === null) return;
    let cancelled = false;
    api<T>(path).then(
      (data) => {
        if (!cancelled) setResult({ key, data });
      },
      (e) => {
        if (!cancelled) setResult({ key, error: e instanceof ApiError ? e : new ApiError(0, String(e)) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [path, key]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const fresh = result !== null && result.key === key;
  // During a reload of the same path, keep showing the previous data instead of a spinner.
  const samePath = result !== null && path !== null && result.key.startsWith(`${path}#`);
  return {
    data: samePath ? result.data : undefined,
    error: fresh ? result.error : undefined,
    loading: key !== null && !fresh,
    reload,
  };
}
