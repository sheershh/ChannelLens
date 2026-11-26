import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Video } from "@/lib/types";
import VideoTable, { sortVideos } from "./VideoTable";

vi.mock("next/image", () => ({
  default: () => <img alt="" />,
}));

const v = (id: string, views: number, published: string, rate: number | null): Video => ({
  id,
  title: `Video ${id}`,
  published_at: published,
  thumbnail_url: null,
  views,
  likes: rate == null ? null : 10,
  comments: 1,
  duration_seconds: 90,
  engagement_rate: rate,
});

const VIDEOS = [v("a", 100, "2026-11-01T00:00:00Z", 2), v("b", 300, "2026-11-20T00:00:00Z", null), v("c", 200, "2026-11-10T00:00:00Z", 5)];

describe("sortVideos", () => {
  it("sorts newest first", () => expect(sortVideos(VIDEOS, "published_at").map((x) => x.id)).toEqual(["b", "c", "a"]));
  it("sorts by views", () => expect(sortVideos(VIDEOS, "views").map((x) => x.id)).toEqual(["b", "c", "a"]));
  it("puts hidden engagement last", () =>
    expect(sortVideos(VIDEOS, "engagement_rate").map((x) => x.id)).toEqual(["c", "a", "b"]));
});

describe("VideoTable", () => {
  it("marks the top video, shows hidden likes and asks the parent to re-sort", async () => {
    const onSort = vi.fn();
    render(<VideoTable videos={VIDEOS} topId="b" sort="published_at" onSort={onSort} />);
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Top")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Hidden")).toBeInTheDocument();
    expect(within(rows[0]).getByRole("link")).toHaveAttribute("href", "https://www.youtube.com/watch?v=b");
    await userEvent.click(screen.getByRole("button", { name: /views/i }));
    expect(onSort).toHaveBeenCalledWith("views");
  });
});
