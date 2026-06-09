"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteUserAction, logoutAdminAction } from "@/lib/admin-actions";

interface AdminUser {
  id: string;
  displayName: string;
  groupStatus: string;
  knockoutStatus: string;
  awardsStatus: string;
  createdAt: string;
}

const TOOLS = [
  { href: "/admin/r32", title: "Round of 32 setup", desc: "Enter the real R32 matchups and open the knockout phase." },
  { href: "/admin/results", title: "Enter results", desc: "Record real group and knockout results as matches finish." },
  { href: "/admin/awards", title: "Award winners", desc: "Set the actual winner of each award." },
];

export function AdminDashboard({ users }: { users: AdminUser[] }) {
  const [list, setList] = useState(users);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteUserAction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setConfirmId(null);
      setList((prev) => prev.filter((u) => u.id !== id));
    });
  }

  return (
    <main className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <header className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Admin dashboard</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            Organizer tools and player management.
          </p>
        </div>
        <form action={logoutAdminAction}>
          <button className="rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
            Log out
          </button>
        </form>
      </header>

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TOOLS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm transition hover:border-blue-400 dark:border-white/10 dark:bg-neutral-900"
          >
            <div className="font-semibold">{t.title}</div>
            <div className="mt-1 text-xs text-black/55 dark:text-white/55">
              {t.desc}
            </div>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Players ({list.length})
        </h2>
        {error ? (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        ) : null}
        {list.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            No players yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-900"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{u.displayName}</div>
                  <div className="mt-0.5 text-xs text-black/45 dark:text-white/45">
                    Groups {u.groupStatus} | KO {u.knockoutStatus} | Awards{" "}
                    {u.awardsStatus}
                  </div>
                </div>
                {confirmId === u.id ? (
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => setConfirmId(null)}
                      disabled={pending}
                      className="rounded-lg border border-black/15 px-2.5 py-1.5 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => remove(u.id)}
                      disabled={pending}
                      className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {pending ? "..." : "Delete"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setError(null);
                      setConfirmId(u.id);
                    }}
                    className="shrink-0 rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/40"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
