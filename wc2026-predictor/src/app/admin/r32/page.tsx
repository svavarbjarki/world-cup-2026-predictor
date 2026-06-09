import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminR32 } from "../admin-r32-client";

export const dynamic = "force-dynamic";

export default async function AdminR32Page() {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const [fixtures, teams, settings] = await Promise.all([
    prisma.knockoutFixture.findMany({ orderBy: { slot: "asc" } }),
    prisma.team.findMany({ orderBy: [{ group: "asc" }, { seed: "asc" }] }),
    prisma.settings.findUnique({ where: { id: 1 } }),
  ]);

  const rows = fixtures.map((f) => ({
    matchNumber: f.matchNumber,
    slot: f.slot,
    homeTeamId: f.homeTeamId,
    awayTeamId: f.awayTeamId,
  }));
  const teamOptions = teams.map((t) => ({
    id: t.id,
    label: `${t.name} (${t.group}${t.seed})`,
  }));

  return (
    <AdminR32
      initialRows={rows}
      teams={teamOptions}
      initiallyOpened={settings?.knockoutOpenedAt != null}
    />
  );
}
