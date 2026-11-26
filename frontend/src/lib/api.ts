export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** FastAPI returns {detail: string} or {detail: [{msg}]} for validation errors. */
export function errorDetail(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("detail" in body)) return null;
  const detail = (body as { detail: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length && typeof detail[0]?.msg === "string") {
    return String(detail[0].msg).replace(/^Value error, /, "");
  }
  return null;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(`/api${path}`, { credentials: "same-origin", ...init, headers });
  if (res.status === 204) return undefined as T;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // empty or non-JSON body
  }
  if (!res.ok) throw new ApiError(res.status, errorDetail(body) ?? `Request failed (${res.status})`);
  return body as T;
}

/** A friendlier line for the errors people will actually hit. */
export function explain(err: unknown): string {
  if (!(err instanceof ApiError)) return "Something went wrong. Check your connection and try again.";
  if (err.status === 429) return "The daily YouTube API quota is used up. It resets at midnight Pacific time.";
  if (err.status === 503) return err.message || "The server isn't configured yet.";
  if (err.status === 0 || err.status >= 500) return "The server had a problem talking to YouTube. Try again in a minute.";
  return err.message;
}
