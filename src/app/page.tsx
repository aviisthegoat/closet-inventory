"use client";

import { useState } from "react";

export default function Home() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password === "AviRocks!") {
      setSubmitting(true);
      window.location.href = "/dashboard";
    } else {
      setError("Incorrect password. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-zinc-900">
            Closet Inventory Dashboard
          </h1>
          <p className="text-xs text-zinc-500">
            This page is password-protected for Student Life staff. Enter the
            shared password to continue.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
            />
          </div>
          {error && (
            <p className="text-[11px] text-rose-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {submitting ? "Unlocking…" : "Enter dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}
