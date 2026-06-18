import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { hasSubmitted } from "@/lib/visibility";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_GROUP_SCORING,
  DEFAULT_KNOCKOUT_SCORING,
  type GroupScoringConfig,
  type KnockoutScoringConfig,
} from "@/lib/engine/scoring";
import {
  pointsPerRound,
  cumulativePoints,
  accuracyBreakdown,
  championPickDistribution,
  awardPickDistribution,
  predictedVsActualGoals,
  topScorers,
  topAssisters,
  topInvolvements,
  goalsByMinute,
  type StatsData,
} from "@/lib/stats";
import { PointsPerRoundChart } from "@/components/stats/points-per-round-chart";
import { CumulativePointsChart } from "@/components/stats/cumulative-points-chart";
import { AccuracyChart } from "@/components/stats/accuracy-chart";
import { ChampionDistributionChart } from "@/components/stats/champion-distribution-chart";
import { AwardDistributionChart } from "@/components/stats/award-distribution-chart";
import { PredictedGoalsChart } from "@/components/stats/predicted-goals-chart";
import { PlayerRankChart } from "@/components/stats/player-rank-chart";
import { InvolvementsChart } from "@/components/stats/involvements-chart";
import { GoalsByMinuteChart } from "@/components/stats/goals-by-minute-chart";
import { SERIES_COLORS } from "@/components/stats/chart-kit";

// Stats are derived live from predictions + results, which the organizer edits,
// so never cache this route.
export const dynamic = "force-dynamic";

/**
 * Load every row the six aggregations need and shape it into StatsData. Mirrors
 * the leaderboard loader: all reads happen here, the math stays pure in stats.ts.
 */
async function loadStatsData(): Promise<StatsData> {
  const [
    users,
    groupFixtures,
    groupResults,
    groupPreds,
    koPreds,
    koResults,
    awardPreds,
    awardResult,
    settings,
    teams,
    goalEvents,
  ] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        displayName: true,
        groupStatus: true,
        knockoutStatus: true,
        awardsStatus: true,
      },
    }),
    prisma.groupFixture.findMany({ select: { id: true, matchday: true } }),
    prisma.groupResult.findMany({
      select: { groupFixtureId: true, homeGoals: true, awayGoals: true },
    }),
    prisma.groupPrediction.findMany({
      select: {
        userId: true,
        groupFixtureId: true,
        homeGoals: true,
        awayGoals: true,
      },
    }),
    prisma.knockoutPrediction.findMany({
      select: {
        userId: true,
        matchNumber: true,
        round: true,
        predictedWinnerTeamId: true,
      },
    }),
    prisma.knockoutResult.findMany({
      select: { matchNumber: true, actualWinnerTeamId: true },
    }),
    prisma.awardPrediction.findMany({
      select: {
        userId: true,
        winnerTeamId: true,
        goldenBallPlayerId: true,
        goldenBootPlayerId: true,
        goldenGlovePlayerId: true,
        youngPlayerId: true,
      },
    }),
    prisma.awardResult.findUnique({ where: { id: 1 } }),
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.team.findMany({ select: { id: true, name: true } }),
    prisma.goalEvent.findMany({
      select: { scorerId: true, assisterId: true, minute: true },
    }),
  ]);

  // Player names only for players actually picked for an award (a handful), not
  // the full squad table.
  const pickedPlayerIds = new Set<string>();
  for (const a of awardPreds) {
    for (const id of [
      a.goldenBallPlayerId,
      a.goldenBootPlayerId,
      a.goldenGlovePlayerId,
      a.youngPlayerId,
    ]) {
      if (id) pickedPlayerIds.add(id);
    }
  }
  const pickedPlayers = pickedPlayerIds.size
    ? await prisma.player.findMany({
        where: { id: { in: [...pickedPlayerIds] } },
        select: { id: true, name: true },
      })
    : [];

  // Names + flag iso for every scorer / assister referenced by a goal event
  // (teamId is the team's iso code, as elsewhere). One batched lookup, no N+1.
  const statPlayerIds = new Set<string>();
  for (const g of goalEvents) {
    if (g.scorerId) statPlayerIds.add(g.scorerId);
    if (g.assisterId) statPlayerIds.add(g.assisterId);
  }
  const statPlayerRows = statPlayerIds.size
    ? await prisma.player.findMany({
        where: { id: { in: [...statPlayerIds] } },
        select: { id: true, name: true, teamId: true },
      })
    : [];

  const groupConfig: GroupScoringConfig = settings
    ? {
        exact: settings.groupExactPoints,
        result: settings.groupResultPoints,
        wrong: settings.groupWrongPoints,
      }
    : DEFAULT_GROUP_SCORING;
  const knockoutConfig: KnockoutScoringConfig = settings
    ? {
        correct: settings.knockoutCorrectPoints,
        wrong: settings.knockoutWrongPoints,
      }
    : DEFAULT_KNOCKOUT_SCORING;

  return {
    players: users.map((u) => ({
      userId: u.id,
      displayName: u.displayName,
      groupSubmitted: hasSubmitted(u.groupStatus),
      knockoutSubmitted: hasSubmitted(u.knockoutStatus),
      awardsSubmitted: hasSubmitted(u.awardsStatus),
    })),
    groupFixtureMatchday: new Map(groupFixtures.map((f) => [f.id, f.matchday])),
    groupResults: new Map(
      groupResults.map((r) => [
        r.groupFixtureId,
        { homeGoals: r.homeGoals, awayGoals: r.awayGoals },
      ]),
    ),
    groupPredictions: groupPreds.map((p) => ({
      userId: p.userId,
      fixtureId: p.groupFixtureId,
      homeGoals: p.homeGoals,
      awayGoals: p.awayGoals,
    })),
    groupConfig,
    knockoutPredictions: koPreds,
    knockoutResults: new Map(
      koResults.map((r) => [r.matchNumber, r.actualWinnerTeamId]),
    ),
    knockoutConfig,
    awardPredictions: awardPreds,
    awardResult: awardResult
      ? {
          winnerTeamId: awardResult.winnerTeamId,
          goldenBallPlayerId: awardResult.goldenBallPlayerId,
          goldenBootPlayerId: awardResult.goldenBootPlayerId,
          goldenGlovePlayerId: awardResult.goldenGlovePlayerId,
          youngPlayerId: awardResult.youngPlayerId,
        }
      : null,
    awardPoints: settings ? settings.awardPoints : 5,
    goalEvents,
    statPlayers: new Map(
      statPlayerRows.map((p) => [p.id, { name: p.name, isoCode: p.teamId }]),
    ),
    teamNames: new Map(teams.map((t) => [t.id, t.name])),
    playerNames: new Map(pickedPlayers.map((p) => [p.id, p.name])),
  };
}

export default async function StatsPage() {
  const viewer = await getCurrentUser();
  if (!viewer) return null;

  // Whole-page gate, reusing the same "you must submit your own first" rule that
  // governs seeing other players' predictions. Group submission is the
  // foundational one, so it unlocks the stats. No chart renders until then.
  if (!hasSubmitted(viewer.groupStatus)) {
    return (
      <main className="mx-auto w-full max-w-5xl p-4 sm:p-6">
        <BackLink />
        <h1 className="mt-2 mb-4 text-xl font-semibold">Stats</h1>
        <div className="rounded-xl border border-dashed border-border bg-surface/50 p-6 text-sm text-text-muted">
          Submit your own group predictions to unlock the stats. They compare
          everyone&apos;s picks and results, so they stay locked until you have
          made yours.
        </div>
      </main>
    );
  }

  const data = await loadStatsData();
  const perRound = pointsPerRound(data);
  const cumulative = cumulativePoints(data);
  const accuracy = accuracyBreakdown(data);
  const champions = championPickDistribution(data);
  const awards = awardPickDistribution(data);
  const predictedGoals = predictedVsActualGoals(data);
  const scorers = topScorers(data);
  const assisters = topAssisters(data);
  const involvements = topInvolvements(data);
  const minutes = goalsByMinute(data);

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <BackLink />
      <h1 className="mt-2 mb-1 text-xl font-semibold">Stats</h1>
      <p className="mb-6 text-sm text-text-muted">
        How everyone&apos;s predictions are playing out as results come in.
      </p>

      <Section title="Performance">
        <ChartSlot title="Points earned per round">
          <PointsPerRoundChart data={perRound} />
        </ChartSlot>
        <ChartSlot title="Cumulative points race">
          <CumulativePointsChart data={cumulative} />
        </ChartSlot>
      </Section>

      <Section title="Accuracy">
        <ChartSlot title="Prediction accuracy breakdown">
          <AccuracyChart data={accuracy} />
        </ChartSlot>
      </Section>

      <Section title="Players">
        <ChartSlot title="Top scorers">
          <PlayerRankChart
            data={scorers}
            color={SERIES_COLORS[0]}
            valueName="Goals"
            emptyLabel="No goals recorded yet"
          />
        </ChartSlot>
        <ChartSlot title="Top assisters">
          <PlayerRankChart
            data={assisters}
            color={SERIES_COLORS[1]}
            valueName="Assists"
            emptyLabel="No assists recorded yet"
          />
        </ChartSlot>
        <ChartSlot title="Goal involvements (goals + assists)">
          <InvolvementsChart data={involvements} />
        </ChartSlot>
        <ChartSlot title="Goals by minute">
          <GoalsByMinuteChart data={minutes} />
        </ChartSlot>
      </Section>

      <Section title="Consensus">
        <ChartSlot title="Champion pick distribution">
          <ChampionDistributionChart data={champions} />
        </ChartSlot>
        <ChartSlot title="Award pick distribution">
          <AwardDistributionChart data={awards} />
        </ChartSlot>
      </Section>

      <Section title="Fun">
        <ChartSlot title="Predicted goals vs actual">
          <PredictedGoalsChart data={predictedGoals} />
        </ChartSlot>
      </Section>
    </main>
  );
}

/** A category heading with its responsive two-column grid of chart cards. */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

/** A single chart card: a titled surface that will hold one Recharts chart. */
function ChartSlot({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-medium text-text">{title}</h3>
      {children}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/" className="text-sm text-blue-600">
      &larr; Back to home
    </Link>
  );
}
