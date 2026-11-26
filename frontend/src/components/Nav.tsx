"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useHealth } from "@/lib/useHealth";

const LINKS = [
  { href: "/", label: "Search" },
  { href: "/compare", label: "Compare" },
  { href: "/watchlist", label: "Watchlist" },
];

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight text-zinc-50">
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
        <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="#ef4444" strokeWidth="2.4" />
        <path d="M15.5 15.5 21 21" stroke="#ef4444" strokeWidth="2.6" strokeLinecap="round" />
        <path d="m9 8 3.6 2.5L9 13z" fill="#fafafa" />
      </svg>
      ChannelLens
    </span>
  );
}

/** Static header shown in the prerendered shell until the client nav (which reads the URL) loads. */
export function NavFallback() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/70 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center px-4 py-3">
        <Link href="/" aria-label="ChannelLens home">
          <Logo />
        </Link>
      </nav>
    </header>
  );
}

export default function Nav() {
  const { user, ready, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const health = useHealth();

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/70 backdrop-blur">
      {health?.demo && (
        <div className="bg-amber-500/15 px-4 py-1.5 text-center text-xs text-amber-200">
          Demo mode: the channels here are fictional and no YouTube API calls are made.
        </div>
      )}
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" aria-label="ChannelLens home">
          <Logo />
        </Link>
        <div className="flex gap-1 text-sm">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 transition ${active ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-100"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {!ready ? null : user ? (
            <>
              <span className="hidden text-zinc-400 sm:inline">{user.email}</span>
              <button
                className="btn btn-ghost py-1.5"
                onClick={async () => {
                  await logout();
                  router.push("/");
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-zinc-300 hover:text-white">
                Sign in
              </Link>
              <Link href="/register" className="btn btn-primary py-1.5">
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
