import { redirect } from "next/navigation";
import { isPasswordAuthed, getCurrentUser } from "@/lib/auth";
import { NameForm } from "./name-form";

export default async function NamePage() {
  // Must be past the password gate, but not yet identified.
  if (!(await isPasswordAuthed())) {
    redirect("/login");
  }
  if (await getCurrentUser()) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-neutral-900">
        <h1 className="text-xl font-semibold">Pick your name</h1>
        <p className="mt-1 mb-6 text-sm text-black/60 dark:text-white/60">
          This is how you will show up on the leaderboard. We will remember you on
          this device.
        </p>
        <NameForm />
      </div>
    </main>
  );
}
