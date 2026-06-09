"use client";

import { useActionState } from "react";
import { loginAdminAction } from "@/lib/admin-actions";
import type { AuthActionState } from "@/lib/auth-types";

const initialState: AuthActionState = {};

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(
    loginAdminAction,
    initialState,
  );

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-neutral-900">
        <h1 className="text-xl font-semibold">Organizer admin</h1>
        <p className="mt-1 mb-6 text-sm text-black/60 dark:text-white/60">
          Enter the admin password to manage the tournament.
        </p>
        <form action={formAction} className="space-y-4">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            placeholder="Admin password"
            // Password managers (e.g. Keeper) inject attributes onto this field
            // before hydration; ignore the resulting attribute mismatch.
            suppressHydrationWarning
            className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-blue-500 dark:border-white/20"
          />
          {state.error ? (
            <p className="text-sm text-red-600">{state.error}</p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-blue-600 px-3 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "Checking..." : "Enter admin"}
          </button>
        </form>
      </div>
    </main>
  );
}
