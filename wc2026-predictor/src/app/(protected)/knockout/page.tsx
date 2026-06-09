import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getKnockoutBracketState } from "@/lib/predictions";
import { KnockoutFlow } from "./knockout-flow";

export default async function KnockoutPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const state = await getKnockoutBracketState(user.id);

  // The knockout flow is available only once the organizer opens the phase (after
  // the real group stage finishes and the real Round of 32 is entered). This is
  // independent of the user's own group predictions.
  if (!state) {
    return (
      <main className="mx-auto w-full max-w-2xl p-6">
        <div className="rounded-2xl border border-black/10 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-neutral-900">
          <h1 className="text-xl font-semibold">Knockout predictions</h1>
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">
            Knockout predictions open once the real group stage finishes and the
            Round of 32 is set. Check back then.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Back home
          </Link>
        </div>
      </main>
    );
  }

  return <KnockoutFlow initialState={state} />;
}
