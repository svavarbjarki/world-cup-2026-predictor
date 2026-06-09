import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { TEAMS } from "../src/lib/data/teams";
import { GROUP_SCHEDULE, KNOCKOUT_SCHEDULE } from "../src/lib/data/schedule";
import { PLAYERS } from "../src/lib/data/players";

const prisma = new PrismaClient();

const GROUP_LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
] as const;

// Round-robin schedule for a group of four teams (indices 0-3), circle method.
// The six pairings cover every distinct pair exactly once across three matchdays.
// Indices refer to the group's teams in deterministic order (by pot, then name).
const ROUND_ROBIN_SCHEDULE: { matchday: number; pairs: [number, number][] }[] = [
  { matchday: 1, pairs: [[0, 1], [2, 3]] },
  { matchday: 2, pairs: [[0, 2], [3, 1]] },
  { matchday: 3, pairs: [[3, 0], [1, 2]] },
];

/** The four teams of a group in deterministic order (pot ascending, then name). */
function groupTeamsInOrder(letter: string) {
  return TEAMS.filter((t) => t.group === letter).sort(
    (a, b) => a.pot - b.pot || a.name.localeCompare(b.name),
  );
}

interface SeedFixture {
  matchNumber: number;
  group: string;
  matchday: number;
  homeTeamId: string;
  awayTeamId: string;
}

/** Build the 72 group fixtures deterministically (id = team isoCode). */
function buildFixtures(): SeedFixture[] {
  const fixtures: SeedFixture[] = [];
  let matchNumber = 1;
  for (const group of GROUP_LETTERS) {
    const teams = groupTeamsInOrder(group);
    for (const { matchday, pairs } of ROUND_ROBIN_SCHEDULE) {
      for (const [home, away] of pairs) {
        fixtures.push({
          matchNumber: matchNumber++,
          group,
          matchday,
          homeTeamId: teams[home].isoCode,
          awayTeamId: teams[away].isoCode,
        });
      }
    }
  }
  return fixtures;
}

async function main() {
  // Teams. Idempotent: upsert by id (the isoCode, unique per team). seed = pot.
  for (const t of TEAMS) {
    const data = {
      name: t.name,
      group: t.group,
      seed: t.pot,
      isoCode: t.isoCode,
      pot: t.pot,
    };
    await prisma.team.upsert({
      where: { id: t.isoCode },
      update: data,
      create: { id: t.isoCode, ...data },
    });
  }

  // Group fixtures. Idempotent: upsert by matchNumber (deterministic 1-72).
  const fixtures = buildFixtures();
  for (const f of fixtures) {
    await prisma.groupFixture.upsert({
      where: { matchNumber: f.matchNumber },
      update: {
        group: f.group,
        matchday: f.matchday,
        homeTeamId: f.homeTeamId,
        awayTeamId: f.awayTeamId,
      },
      create: f,
    });
  }

  // Single settings row with engine-default point values. Safe to re-run.
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  // The 16 real Round-of-32 fixture rows (teams left empty for the organizer to
  // fill on /admin). Match numbers 73-88, slots 1-16. Idempotent.
  for (let slot = 1; slot <= 16; slot++) {
    await prisma.knockoutFixture.upsert({
      where: { matchNumber: 72 + slot },
      update: {},
      create: { matchNumber: 72 + slot, slot },
    });
  }

  await mergeSchedule(fixtures);
  await seedPlayers();

  // Ensure the single award-result row exists (winners entered by admin later).
  await prisma.awardResult.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  await printSummary();
}

/**
 * Seed award-contender players from src/lib/data/players.ts. Links each to a
 * seeded Team by exact name match (team id is the isoCode). Idempotent: upsert by
 * [name, teamId]. Reports any player whose team name does not match a Team rather
 * than dropping it silently.
 */
async function seedPlayers(): Promise<void> {
  const teamIdByName = new Map(TEAMS.map((t) => [t.name, t.isoCode]));
  const unmatched: string[] = [];
  let seeded = 0;

  for (const p of PLAYERS) {
    const teamId = teamIdByName.get(p.team);
    if (!teamId) {
      unmatched.push(`${p.name} (team "${p.team}")`);
      continue;
    }
    await prisma.player.upsert({
      where: { name_teamId: { name: p.name, teamId } },
      update: { position: p.position, age: p.age, birthYear: p.birthYear ?? null },
      create: {
        name: p.name,
        teamId,
        position: p.position,
        age: p.age,
        birthYear: p.birthYear ?? null,
      },
    });
    seeded += 1;
  }

  console.log(`Seeded ${seeded} of ${PLAYERS.length} award-contender players.`);
  if (unmatched.length > 0) {
    console.error(
      "UNMATCHED PLAYERS (team name not in teams.ts):\n  " +
        unmatched.join("\n  "),
    );
    throw new Error(
      `${unmatched.length} player(s) had a team name that did not match a Team. See above.`,
    );
  }
}

/** Key for matching a schedule entry to a fixture: group plus the unordered pair. */
function pairKey(group: string, a: string, b: string): string {
  return `${group}|${[a, b].sort().join("|")}`;
}

/**
 * Merge the published schedule onto the fixtures. Group entries are matched to
 * GroupFixtures by group + unordered team pair (the seed's home/away orientation
 * is arbitrary and may differ from the schedule, so we ignore order and set only
 * kickoffAt + venue). The 16 Round-of-32 time slots are written onto the
 * KnockoutFixture rows in chronological order (exact team pairings are entered by
 * the organizer later, so these are just time anchors). Times are stored as UTC.
 *
 * Reports any fixture left unscheduled or any schedule entry that did not match,
 * and throws unless all 72 group fixtures end up with a kickoffAt.
 */
async function mergeSchedule(fixtures: SeedFixture[]): Promise<void> {
  const nameById = new Map(TEAMS.map((t) => [t.isoCode, t.name]));

  const scheduleByPair = new Map<string, (typeof GROUP_SCHEDULE)[number]>();
  for (const m of GROUP_SCHEDULE) {
    if (m.homeTeam && m.awayTeam) {
      scheduleByPair.set(pairKey(m.stage, m.homeTeam, m.awayTeam), m);
    }
  }

  const unmatchedFixtures: string[] = [];
  const usedKeys = new Set<string>();
  for (const f of fixtures) {
    const homeName = nameById.get(f.homeTeamId);
    const awayName = nameById.get(f.awayTeamId);
    const key =
      homeName && awayName ? pairKey(f.group, homeName, awayName) : null;
    const entry = key ? scheduleByPair.get(key) : undefined;
    if (!entry || !key) {
      unmatchedFixtures.push(
        `M${f.matchNumber} Group ${f.group}: ${homeName ?? f.homeTeamId} v ${awayName ?? f.awayTeamId}`,
      );
      continue;
    }
    usedKeys.add(key);
    await prisma.groupFixture.update({
      where: { matchNumber: f.matchNumber },
      data: { kickoffAt: new Date(entry.kickoffUtc), venue: entry.venue },
    });
  }

  const unmatchedSchedule = GROUP_SCHEDULE.filter(
    (m) =>
      m.homeTeam &&
      m.awayTeam &&
      !usedKeys.has(pairKey(m.stage, m.homeTeam, m.awayTeam)),
  );

  // Round-of-32 time slots onto the 16 KnockoutFixture rows, chronological order.
  // (Later rounds have no per-match model rows, so their times are not stored.)
  const r32Slots = KNOCKOUT_SCHEDULE.filter((m) => m.stage === "R32").sort(
    (a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc),
  );
  const koFixtures = await prisma.knockoutFixture.findMany({
    orderBy: { slot: "asc" },
  });
  for (let i = 0; i < koFixtures.length && i < r32Slots.length; i++) {
    await prisma.knockoutFixture.update({
      where: { matchNumber: koFixtures[i].matchNumber },
      data: { kickoffAt: new Date(r32Slots[i].kickoffUtc) },
    });
  }

  const scheduled = await prisma.groupFixture.count({
    where: { NOT: { kickoffAt: null } },
  });
  console.log(`Scheduled ${scheduled} of 72 group fixtures, 16 R32 time slots.`);
  if (unmatchedFixtures.length > 0) {
    console.error(
      "UNMATCHED FIXTURES (no schedule entry):\n  " +
        unmatchedFixtures.join("\n  "),
    );
  }
  if (unmatchedSchedule.length > 0) {
    console.error(
      "UNMATCHED SCHEDULE ENTRIES (no fixture):\n  " +
        unmatchedSchedule
          .map((m) => `Group ${m.stage}: ${m.homeTeam} v ${m.awayTeam}`)
          .join("\n  "),
    );
  }
  if (scheduled !== 72) {
    throw new Error(
      `Only ${scheduled} of 72 group fixtures got a kickoffAt. See the unmatched report above.`,
    );
  }
}

/** Print a short sanity summary and assert the structural invariants. */
async function printSummary() {
  const teamCount = await prisma.team.count();
  const fixtureCount = await prisma.groupFixture.count();

  const problems: string[] = [];
  for (const group of GROUP_LETTERS) {
    const teams = await prisma.team.count({ where: { group } });
    const fixtures = await prisma.groupFixture.findMany({ where: { group } });
    if (teams !== 4) problems.push(`Group ${group} has ${teams} teams (expected 4).`);
    if (fixtures.length !== 6) {
      problems.push(`Group ${group} has ${fixtures.length} fixtures (expected 6).`);
    }
    const pairKeys = new Set<string>();
    for (const f of fixtures) {
      if (f.homeTeamId === f.awayTeamId) {
        problems.push(`Group ${group} fixture ${f.matchNumber} plays a team itself.`);
      }
      pairKeys.add([f.homeTeamId, f.awayTeamId].sort().join("|"));
    }
    if (pairKeys.size !== fixtures.length) {
      problems.push(`Group ${group} has duplicate pairings.`);
    }
  }

  console.log(`Seeded ${teamCount} teams and ${fixtureCount} group fixtures.`);
  console.log("Each group: 4 teams, 6 fixtures, no self-play, no duplicate pairs.");
  if (problems.length > 0) {
    console.error("VALIDATION PROBLEMS:\n  " + problems.join("\n  "));
    throw new Error("Seed validation failed.");
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
