import { redirect } from "next/navigation";
import { isPasswordAuthed, getRevealUser } from "@/lib/auth";
import { CodeReveal } from "./code-reveal";

export default async function WelcomePage() {
  if (!(await isPasswordAuthed())) {
    redirect("/login");
  }

  // This screen exists only for a brand new user who has just registered and not
  // yet confirmed their code. A normal returning user (valid identity cookie, no
  // pending reveal) has no reveal cookie, so they are sent into the app instead
  // and never see this screen.
  const user = await getRevealUser();
  if (!user || !user.resumeCode) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-neutral-900">
        <h1 className="text-xl font-semibold">Welcome, {user.displayName}</h1>
        <p className="mt-1 mb-6 text-sm text-black/60 dark:text-white/60">
          This is your resume code. It is the only way back into your account from a
          new device.
        </p>
        <CodeReveal code={user.resumeCode} />
      </div>
    </main>
  );
}
