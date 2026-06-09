import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { getAwardOptions, getAwardResultPicks } from "@/lib/awards-server";
import { AdminAwards } from "./admin-awards-client";

export const dynamic = "force-dynamic";

export default async function AdminAwardsPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const [options, picks] = await Promise.all([
    getAwardOptions(),
    getAwardResultPicks(),
  ]);

  return (
    <AdminAwards
      teams={options.teams}
      players={options.players}
      initialPicks={picks}
    />
  );
}
