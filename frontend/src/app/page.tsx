import HomeSearch from "@/components/HomeSearch";

const FEATURES = [
  {
    title: "Any channel, one search",
    body: "Paste a name, an @handle or a YouTube link. See subscribers, views, upload pace, engagement and the last 20 uploads.",
  },
  {
    title: "Side-by-side comparison",
    body: "Put up to four channels next to each other. The leader on every metric is highlighted.",
  },
  {
    title: "Growth you can't get from YouTube",
    body: "The API only reports today's totals. ChannelLens saves a snapshot every day, so your watchlist builds real history.",
  },
];

export default function Home() {
  return (
    <div className="space-y-14 py-6">
      <section className="mx-auto max-w-2xl text-center">
        <p className="mb-3 inline-block rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-200">
          YouTube channel analytics
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
          See how a channel is <span className="text-red-400">really</span> doing.
        </h1>
        <p className="mt-4 text-zinc-400">
          Stats, engagement, upload habits and growth over time, for any public channel.
        </p>
        <div className="mt-8 text-left">
          <HomeSearch />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="card p-5">
            <h2 className="font-semibold text-zinc-100">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
