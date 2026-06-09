import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getKnockoutResultsState } from "@/lib/predictions";
import { AdminResults } from "./admin-results-client";

export const dynamic = "force-dynamic";

export default async function AdminResultsPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const [fixtures, results, knockoutState, teams] = await Promise.all([
    prisma.groupFixture.findMany({
      orderBy: { matchNumber: "asc" },
      include: { homeTeam: true, awayTeam: true },
    }),
    prisma.groupResult.findMany(),
    getKnockoutResultsState(),
    prisma.team.findMany({ select: { id: true, isoCode: true } }),
  ]);

  const resultByFixture = new Map(results.map((r) => [r.groupFixtureId, r]));
  const teamFlags: Record<string, string> = {};
  for (const t of teams) teamFlags[t.id] = t.isoCode;

  // Order by kickoff time when present (unscheduled last), then match number.
  const ordered = [...fixtures].sort((a, b) => {
    const at = a.kickoffAt ? a.kickoffAt.getTime() : Number.POSITIVE_INFINITY;
    const bt = b.kickoffAt ? b.kickoffAt.getTime() : Number.POSITIVE_INFINITY;
    return at - bt || a.matchNumber - b.matchNumber;
  });

  const groupFixtures = ordered.map((f) => {
    const r = resultByFixture.get(f.id);
    return {
      id: f.id,
      matchNumber: f.matchNumber,
      group: f.group,
      matchday: f.matchday,
      kickoffLabel: f.kickoffAt ? f.kickoffAt.toLocaleString() : null,
      home: { id: f.homeTeam.id, name: f.homeTeam.name, isoCode: f.homeTeam.isoCode },
      away: { id: f.awayTeam.id, name: f.awayTeam.name, isoCode: f.awayTeam.isoCode },
      result: r ? { homeGoals: r.homeGoals, awayGoals: r.awayGoals } : null,
    };
  });

  return (
    <AdminResults
      groupFixtures={groupFixtures}
      knockoutState={knockoutState}
      teamFlags={teamFlags}
    />
  );
}
