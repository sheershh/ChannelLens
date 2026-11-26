import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold text-zinc-50">Page not found</h1>
      <p className="mt-2 text-sm text-zinc-400">That page doesn&apos;t exist.</p>
      <Link href="/" className="btn btn-primary mt-5">
        Back to search
      </Link>
    </div>
  );
}
