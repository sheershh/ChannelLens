import { describe, expect, it, vi } from "vitest";
import { api, ApiError, errorDetail, explain } from "./api";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("errorDetail", () => {
  it("reads FastAPI string details", () => expect(errorDetail({ detail: "Channel not found." })).toBe("Channel not found."));
  it("reads the first validation message", () =>
    expect(errorDetail({ detail: [{ msg: "Value error, Password is too long" }] })).toBe("Password is too long"));
  it("returns null for anything else", () => {
    expect(errorDetail(null)).toBeNull();
    expect(errorDetail({ message: "x" })).toBeNull();
  });
});

describe("explain", () => {
  it("turns a 429 into a quota message", () => expect(explain(new ApiError(429, "x"))).toMatch(/quota/i));
  it("passes through 4xx details", () => expect(explain(new ApiError(404, "Channel not found."))).toBe("Channel not found."));
  it("hides raw 5xx errors", () => expect(explain(new ApiError(502, "YouTube API error 403"))).toMatch(/try again/i));
  it("handles non-API errors", () => expect(explain(new TypeError("boom"))).toMatch(/connection/i));
});

describe("api()", () => {
  it("prefixes /api, sends JSON and returns the body", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(201, { ok: true }));
    await expect(api("/watchlist", { method: "POST", body: JSON.stringify({ a: 1 }) })).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/watchlist");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(init?.credentials).toBe("same-origin");
  });

  it("returns undefined for 204", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api("/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });

  it("throws ApiError with the server's detail", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(409, { detail: "An account with this email already exists." }));
    await expect(api("/auth/register")).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/already exists/) });
  });
});
