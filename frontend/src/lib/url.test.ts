import { describe, expect, it } from "vitest";
import { parseIds, safeNext } from "./url";

describe("parseIds", () => {
  it("dedupes, trims and caps at four", () => {
    expect(parseIds(" a, b,a,,c,d,e")).toEqual(["a", "b", "c", "d"]);
  });
  it("handles a missing param", () => expect(parseIds(null)).toEqual([]));
});

describe("safeNext", () => {
  it("allows same-site paths", () => expect(safeNext("/channel/UC123")).toBe("/channel/UC123"));
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", null])(
    "blocks open redirects: %s",
    (raw) => expect(safeNext(raw)).toBe("/watchlist"),
  );
});
