/** Up to 4 unique channel IDs from a "?ids=a,b,c" value. */
export function parseIds(raw: string | null): string[] {
  return [...new Set((raw ?? "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 4);
}

/** Only allow same-site relative redirects after sign-in (no open redirect via ?next=). */
export function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/watchlist";
}
