"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const {
      error: signInError,
      data,
    } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(
                redirectTo,
              )}`
            : undefined,
      },
    });

    if (signInError || !data) {
      setError(signInError?.message ?? "Something went wrong.");
      setStatus("error");
      return;
    }

    setStatus("sent");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight text-zinc-900">
          Closet Inventory
        </h1>
        <p className="mb-6 text-sm text-zinc-500">
          Sign in with your school email to access the inventory dashboard.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none ring-0 transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
            />
          </div>
          <button
            type="submit"
            disabled={status === "loading"}
            className="flex w-full items-center justify-center rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {status === "loading" ? "Sending magic link..." : "Send magic link"}
          </button>
        </form>
        {status === "sent" && (
          <p className="mt-4 text-xs text-emerald-600">
            Check your email for a magic sign-in link.
          </p>
        )}
        {error && (
          <p className="mt-4 text-xs text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

