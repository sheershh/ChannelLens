"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { explain } from "@/lib/api";
import { safeNext } from "@/lib/url";
import { useAuth } from "./AuthProvider";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLogin = mode === "login";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await (isLogin ? login : register)(email, password);
      router.push(next);
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mx-auto w-full max-w-sm p-6">
      <h1 className="text-xl font-semibold text-zinc-50">{isLogin ? "Sign in" : "Create your account"}</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {isLogin ? "Welcome back." : "Free. Save channels and track their growth every day."}
      </p>
      <form className="mt-5 space-y-3" onSubmit={onSubmit}>
        <label className="block text-sm">
          <span className="text-zinc-300">Email</span>
          <input
            className="input mt-1"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-300">Password</span>
          <input
            className="input mt-1"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
            minLength={8}
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {!isLogin && <span className="mt-1 block text-xs text-zinc-500">At least 8 characters.</span>}
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-zinc-400">
        {isLogin ? "New here? " : "Already have an account? "}
        <Link
          href={`${isLogin ? "/register" : "/login"}?next=${encodeURIComponent(next)}`}
          className="text-red-300 hover:text-red-200"
        >
          {isLogin ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </div>
  );
}
