import { getCurrentUser } from "@/lib/auth";
import { getAwardOptions, getUserAwardState } from "@/lib/awards-server";
import { AwardsFlow } from "./awards-flow";

export const dynamic = "force-dynamic";

export default async function AwardsPage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout guarantees a user

  const [options, state] = await Promise.all([
    getAwardOptions(),
    getUserAwardState(user.id),
  ]);

  return (
    <AwardsFlow
      teams={options.teams}
      players={options.players}
      initialState={state}
    />
  );
}
