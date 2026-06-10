"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/auth-actions";
import type { AuthActionState } from "@/lib/auth-types";

const initialState: AuthActionState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium">
          Shared password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          // Password managers may inject attributes onto this field before
          // hydration; ignore the resulting attribute mismatch.
          suppressHydrationWarning
          className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-blue-500 dark:border-white/20"
        />
      </div>

      {state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 px-3 py-2 font-medium text-[#0b0b0e] transition hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Checking..." : "Enter"}
      </button>
    </form>
  );
}
