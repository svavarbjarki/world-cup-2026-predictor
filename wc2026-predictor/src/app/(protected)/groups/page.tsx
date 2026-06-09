import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getGroupStageState } from "@/lib/predictions";
import { GroupStageFlow } from "./group-stage-flow";

export default async function GroupsPage() {
  // The (protected) layout already guarantees a user; this is a belt-and-braces
  // check so the page never renders without one.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const state = await getGroupStageState(user.id);
  return <GroupStageFlow initialState={state} />;
}
