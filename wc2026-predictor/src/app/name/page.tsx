import { redirect } from "next/navigation";
import {
  isPasswordAuthed,
  getCurrentUser,
  isRevealPending,
} from "@/lib/auth";
import { NameForm } from "./name-form";
import { ResumeForm } from "./resume-form";

export default async function NamePage() {
  // Must be past the password gate, but not yet identified.
  if (!(await isPasswordAuthed())) {
    redirect("/login");
  }
  if (await getCurrentUser()) {
    redirect("/");
  }
  // A user mid-registration (code generated but not yet confirmed) belongs on the
  // reveal screen, so back-navigation here bounces them to save their code first.
  if (await isRevealPending()) {
    redirect("/welcome");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-5">
        <section className="rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-neutral-900">
          <h1 className="text-xl font-semibold">I am new</h1>
          <p className="mt-1 mb-6 text-sm text-black/60 dark:text-white/60">
            Pick the name you will show up as on the leaderboard. We will give you
            a resume code so you can log in from any device.
          </p>
          <NameForm />
        </section>

        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-black/40 dark:text-white/40">
          <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
          or
          <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
        </div>

        <section className="rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-neutral-900">
          <h2 className="text-xl font-semibold">I am returning</h2>
          <p className="mt-1 mb-6 text-sm text-black/60 dark:text-white/60">
            Enter the resume code you saved when you first signed up. No name needed.
          </p>
          <ResumeForm />
        </section>
      </div>
    </main>
  );
}
