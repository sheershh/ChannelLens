import { describe, expect, it } from "vitest";
import { compact, duration, full, leaderIndex, pct, percentChange, share, signed, timeAgo, usdRange } from "./format";

describe("number formatting", () => {
  it("compacts and handles missing values", () => {
    expect(compact(1_234_567)).toBe("1.2M");
    expect(compact(950)).toBe("950");
    expect(compact(null)).toBe("—");
    expect(full(1234567)).toBe("1,234,567");
  });

  it("formats percentages and shares", () => {
    expect(pct(5.333)).toBe("5.33%");
    expect(pct(undefined)).toBe("—");
    expect(share(0.25)).toBe("25%");
  });

  it("signs deltas with a real minus sign", () => {
    expect(signed(71_800)).toBe("+71.8K");
    expect(signed(-300)).toBe("−300");
    expect(signed(0)).toBe("0");
    expect(signed(null)).toBe("—");
  });

  it("formats a revenue range", () => {
    expect(usdRange({ low: 2900, high: 11600 })).toBe("$2.9K–$11.6K");
  });
});

describe("duration", () => {
  it.each([
    [58, "0:58"],
    [750, "12:30"],
    [3720, "1:02:00"],
    [0, "0:00"],
  ])("%i seconds -> %s", (secs, out) => expect(duration(secs)).toBe(out));
});

describe("timeAgo", () => {
  const now = Date.parse("2026-11-26T12:00:00Z");
  it.each([
    ["2026-11-26T11:59:30Z", "just now"],
    ["2026-11-26T09:00:00Z", "3 hours ago"],
    ["2026-11-25T12:00:00Z", "1 day ago"],
    ["2026-11-12T12:00:00Z", "2 weeks ago"],
    ["2025-11-01T12:00:00Z", "1 year ago"],
  ])("%s -> %s", (iso, out) => expect(timeAgo(iso, now)).toBe(out));

  it("treats an explicit UTC offset correctly (regression: naive timestamps showed '5 hours ago')", () => {
    expect(timeAgo("2026-11-26T11:59:00+00:00", now)).toBe("1 minute ago");
  });

  it("handles missing dates", () => expect(timeAgo(null, now)).toBe("—"));
});

describe("leaderIndex", () => {
  it("finds the highest value by default", () => expect(leaderIndex([3, 9, 5])).toBe(1));
  it("can prefer the lowest", () => expect(leaderIndex([3, 9, 5], false)).toBe(0));
  it("ignores missing values", () => expect(leaderIndex([null, 4, 2])).toBe(1));
  it("returns null on a tie or with fewer than two values", () => {
    expect(leaderIndex([7, 7, 1])).toBeNull();
    expect(leaderIndex([7, null])).toBeNull();
  });
});

describe("percentChange", () => {
  it("measures change from the first known point", () => {
    expect(percentChange([null, 200, 210, 250])).toEqual([null, 0, 5, 25]);
  });
  it("returns nulls when there is no base", () => {
    expect(percentChange([null, 0])).toEqual([null, null]);
  });
});
