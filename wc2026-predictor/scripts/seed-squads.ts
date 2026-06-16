// Seed full World Cup 2026 squads into the Player table from the fetched data in
// prisma/data/wc2026-squads.json. Idempotent: safe to re-run as data is updated.
//
// Run it manually (dev or, once, in production):
//   npx tsx scripts/seed-squads.ts
//
// It does NOT touch award-contender rows destructively. Each squad player is:
//   1. updated in place if already seeded (matched by apiFootballId), else
//   2. merged into an existing award-contender row when the (name, team) matches
//      exactly (so award-prediction FKs stay valid and no duplicate is created),
//      else
//   3. created as a new row, disambiguating the name on the rare within-team
//      duplicate so the @@unique([name, teamId]) constraint holds.

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { TEAMS } from "../src/lib/data/teams";

const prisma = new PrismaClient();

interface SquadPlayer {
  id: number;
  name: string;
  age: number | null;
  number: number | null;
  position: string | null;
  photo: string | null;
}
interface SquadTeam {
  teamId: number;
  teamName: string;
  players: SquadPlayer[] | null;
}
interface SquadFile {
  teams: Record<string, SquadTeam>;
}

// API-Football uses full position words; the app stores GK/DF/MF/FW.
const POSITION: Record<string, string> = {
  Goalkeeper: "GK",
  Defender: "DF",
  Midfielder: "MF",
  Attacker: "FW",
};

async function main(): Promise<void> {
  const file = path.join(__dirname, "../prisma/data/wc2026-squads.json");
  const data: SquadFile = JSON.parse(fs.readFileSync(file, "utf8"));

  // App team name -> isoCode (which is Team.id, and Player.teamId).
  const isoByName = new Map(TEAMS.map((t) => [t.name, t.isoCode]));

  // Preload existing players so we decide create/update/merge in memory (no N+1).
  const existing = await prisma.player.findMany({
    select: { id: true, name: true, teamId: true, apiFootballId: true },
  });
  const byApiId = new Map<number, string>();
  const byNameTeam = new Map<string, { id: string; apiFootballId: number | null }>();
  const usedNameTeam = new Set<string>();
  for (const p of existing) {
    if (p.apiFootballId != null) byApiId.set(p.apiFootballId, p.id);
    const key = `${p.teamId}|${p.name}`;
    byNameTeam.set(key, { id: p.id, apiFootballId: p.apiFootballId });
    usedNameTeam.add(key);
  }

  let created = 0;
  let merged = 0;
  let updated = 0;
  const teamsMissing: string[] = [];

  for (const team of Object.values(data.teams)) {
    const iso = isoByName.get(team.teamName);
    if (!iso) {
      teamsMissing.push(team.teamName);
      continue;
    }

    for (const sp of team.players ?? []) {
      const position = sp.position ? (POSITION[sp.position] ?? sp.position) : "NA";
      const age = sp.age ?? 0;
      const number = sp.number ?? null;
      const photo = sp.photo ?? null;

      // 1) Already seeded (idempotent re-run): update in place.
      const seededId = byApiId.get(sp.id);
      if (seededId) {
        await prisma.player.update({
          where: { id: seededId },
          data: { number, photo, position, age },
        });
        updated++;
        continue;
      }

      // 2) Exact (name, team) match on a non-api row (award contender): merge,
      // keeping its id (and name) so award-prediction FKs remain valid.
      const exactKey = `${iso}|${sp.name}`;
      const match = byNameTeam.get(exactKey);
      if (match && match.apiFootballId == null) {
        await prisma.player.update({
          where: { id: match.id },
          data: { apiFootballId: sp.id, number, photo },
        });
        byApiId.set(sp.id, match.id);
        byNameTeam.set(exactKey, { id: match.id, apiFootballId: sp.id });
        merged++;
        continue;
      }

      // 3) Create, disambiguating the name only if it would collide in-team.
      let finalName = sp.name;
      if (usedNameTeam.has(`${iso}|${finalName}`)) {
        finalName =
          number != null ? `${sp.name} (#${number})` : `${sp.name} (${sp.id})`;
        if (usedNameTeam.has(`${iso}|${finalName}`)) {
          finalName = `${sp.name} (${sp.id})`;
        }
      }
      const row = await prisma.player.create({
        data: {
          name: finalName,
          teamId: iso,
          position,
          age,
          number,
          photo,
          apiFootballId: sp.id,
        },
      });
      created++;
      byApiId.set(sp.id, row.id);
      const newKey = `${iso}|${finalName}`;
      usedNameTeam.add(newKey);
      byNameTeam.set(newKey, { id: row.id, apiFootballId: sp.id });
    }
  }

  const total = await prisma.player.count();
  const withApi = await prisma.player.count({ where: { apiFootballId: { not: null } } });
  console.log(
    `Squad seed complete. created=${created}, merged=${merged}, updated=${updated}`,
  );
  if (teamsMissing.length) {
    console.log(`Teams not matched to an isoCode (skipped): ${teamsMissing.join(", ")}`);
  }
  console.log(`Player rows now: ${total} (with squad/apiFootballId: ${withApi})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
