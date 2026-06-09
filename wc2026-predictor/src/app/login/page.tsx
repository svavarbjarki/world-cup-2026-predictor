import { redirect } from "next/navigation";
import { isPasswordAuthed, getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // If already past the gate, skip ahead instead of asking again.
  if (await isPasswordAuthed()) {
    const user = await getCurrentUser();
    redirect(user ? "/" : "/name");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-neutral-900">
        <h1 className="text-xl font-semibold">World Cup 2026 Predictor</h1>
        <p className="mt-1 mb-6 text-sm text-black/60 dark:text-white/60">
          Enter the password the organizer gave you to join the pool.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
