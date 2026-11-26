export type User = { id: number; email: string };

export type SearchResult = {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
};

export type Channel = {
  id: string;
  title: string;
  handle: string | null;
  description: string;
  thumbnail_url: string | null;
  country: string | null;
  published_at: string | null;
  subscribers: number | null; // null when the creator hides it
  views: number;
  videos: number;
};

export type Video = {
  id: string;
  title: string;
  published_at: string | null;
  thumbnail_url: string | null;
  views: number;
  likes: number | null;
  comments: number | null;
  duration_seconds: number;
  engagement_rate: number | null;
};

export type Summary = {
  sample_size: number;
  avg_views: number;
  median_views: number;
  engagement_rate: number | null;
  uploads_per_week: number | null;
  short_form_share: number | null;
  top_video_id: string | null;
  est_revenue_usd: { low: number; high: number };
};

export type Delta = { from: string; subscribers: number | null; views: number; videos: number };

export type Growth = { days_tracked: number; since: string | null; d7: Delta | null; d30: Delta | null };

export type ChannelReport = { channel: Channel; summary: Summary; growth: Growth; videos: Video[] };

export type Snapshot = { day: string; subscribers: number | null; views: number; videos: number };

export type WatchItem = {
  channel_id: string;
  title: string;
  handle: string | null;
  thumbnail_url: string | null;
  added_at: string;
  latest: Snapshot | null;
};

export type Health = { status: string; demo: boolean; quota_used_today: number; quota_limit: number };
