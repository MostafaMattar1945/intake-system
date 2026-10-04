"use client";

import { useActionState } from "react";
import { loginAction } from "@/server/auth/actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Sign in</h1>

        {state?.error ? (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {state.error}
          </p>
        ) : null}

        <form action={formAction} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-700">Email</span>
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-700">Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="mt-2 w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
