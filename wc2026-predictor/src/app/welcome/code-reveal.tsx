"use client";

import { useState } from "react";
import { confirmCodeAction } from "@/lib/auth-actions";

export function CodeReveal({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (permissions, insecure context). The code is
      // shown in full above, so the user can still copy it by hand.
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-black/10 bg-black/[0.03] p-5 text-center dark:border-white/10 dark:bg-white/[0.04]">
        <div className="font-mono text-3xl font-bold tracking-[0.25em] text-gold">
          {code}
        </div>
      </div>

      <button
        type="button"
        onClick={copy}
        className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
      >
        {copied ? "Copied" : "Copy code"}
      </button>

      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        Save this code. You will need it to log in from a new device or browser. We
        cannot recover it for you.
      </p>

      <form action={confirmCodeAction}>
        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 px-3 py-2 font-medium text-[#0b0b0e] transition hover:bg-blue-700"
        >
          I have saved my code, continue
        </button>
      </form>
    </div>
  );
}
