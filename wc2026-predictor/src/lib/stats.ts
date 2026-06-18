// Pure aggregation for the /stats page, separated from any Prisma loading or UI
// (the page loads rows and passes them in, mirroring leaderboard-compute.ts).
// Every function takes already-loaded data and returns a typed, chart-ready
// object. No fetching, no React, no Prisma imports here, so each is unit-testable
// in isolation. Scoring always goes through the engine so /stats can never drift
// from the leaderboard.

import { matchOutcome } from "./engine/outcome";
import {
  scoreGroupMatch,
  scoreKnockoutMatch,
  type GroupScoringConfig,
  type KnockoutScoringConfig,
} from "./engine/scoring";
import type { AwardPicks } from "./leaderboard-compute";

// ---------------------------------------------------------------------------
// Input shapes (loaded by the page, then handed to these pure functions)
// ---------------------------------------------------------------------------

/** A participant plus the three independent submission flags used for gating. */
export interface StatsPlayer {
  userId: string;
  displayName: string;
  groupSubmitted: boolean;
  knockoutSubmitted: boolean;
  awardsSubmitted: boolean;
}

/** Everything the six aggregations need, already loaded and lightly shaped. */
export interface StatsData {
  /**
   * All participants with their three submission flags. Each chart filters this
   * to the population it should reveal: performance and accuracy charts use the
   * group-submitted players, the champion chart the knockout-submitted ones, and
   * the award charts the awards-submitted ones. The whole /stats page is already
   * gated on the VIEWER having submitted (handled in the page), so this set is
   * only about which players' own data each chart is allowed to surface.
   */
  players: StatsPlayer[];

  // Group stage.
  /** Matchday (1-3) per group fixture id, for bucketing predictions into rounds. */
  groupFixtureMatchday: Map<string, number>;
  /** Actual group scorelines, keyed by fixture id. Absent = not played yet. */
  groupResults: Map<string, { homeGoals: number; awayGoals: number }>;
  groupPredictions: {
    userId: string;
    fixtureId: string;
    homeGoals: number;
    awayGoals: number;
  }[];
  groupConfig: GroupScoringConfig;

  // Knockout.
  knockoutPredictions: {
    userId: string;
    matchNumber: number;
    /** Schema round label: "R32" | "R16" | "QF" | "SF" | "FINAL". */
    round: string;
    predictedWinnerTeamId: string;
  }[];
  /** Actual knockout winners, keyed by official match number. */
  knockoutResults: Map<number, string>;
  knockoutConfig: KnockoutScoringConfig;

  // Awards.
  /** Each participant's award picks (team + four players), nulls allowed. */
  awardPredictions: AwardPicks[];
  /** The actual award winners, or null if not entered yet. */
  awardResult: AwardPicks | null;
  awardPoints: number;

  // Real goal events (facts, not predictions): one row per goal entered by the
  // organizer. Own goals have a null scorer; unassisted goals a null assister.
  goalEvents: GoalEventRow[];
  /** Display info (name + flag iso) for every player referenced by a goal event. */
  statPlayers: Map<string, StatPlayerInfo>;

  // Display lookups.
  teamNames: Map<string, string>;
  playerNames: Map<string, string>;
}

/** One real goal, reduced to the fields the player-stats charts need. */
export interface GoalEventRow {
  scorerId: string | null;
  assisterId: string | null;
  minute: number | null;
}

/** Name + flag iso for a player, used to label the goal/assist charts. */
export interface StatPlayerInfo {
  name: string;
  isoCode: string;
}

// ---------------------------------------------------------------------------
// Round model: group matchdays, then knockout rounds, then awards. A round is
// "active" once at least one of its real results has been entered; charts only
// show active rounds so an in-progress tournament reads cleanly.
// ---------------------------------------------------------------------------

const FINAL_MATCH_NUMBER = 104;

/** Internal round descriptor: a stable key plus the human label shown on axes. */
interface RoundDef {
  key: string;
  label: string;
}

const GROUP_ROUNDS: { matchday: number; def: RoundDef }[] = [
  { matchday: 1, def: { key: "MD1", label: "Matchday 1" } },
  { matchday: 2, def: { key: "MD2", label: "Matchday 2" } },
  { matchday: 3, def: { key: "MD3", label: "Matchday 3" } },
];

const KNOCKOUT_ROUNDS: { round: string; def: RoundDef }[] = [
  { round: "R32", def: { key: "R32", label: "Round of 32" } },
  { round: "R16", def: { key: "R16", label: "Round of 16" } },
  { round: "QF", def: { key: "QF", label: "Quarter-finals" } },
  { round: "SF", def: { key: "SF", label: "Semi-finals" } },
  { round: "FINAL", def: { key: "FINAL", label: "Final" } },
];

const AWARDS_ROUND: RoundDef = { key: "AWARDS", label: "Awards" };

/** The players whose performance/accuracy is shown: those who submitted groups. */
function groupParticipants(data: StatsData): StatsPlayer[] {
  return data.players.filter((p) => p.groupSubmitted);
}

/** Count correct award categories times the flat points value (mirrors the engine). */
function scoreAwardPicks(
  prediction: AwardPicks,
  result: AwardPicks | null,
  points: number,
): number {
  if (!result) return 0;
  const pairs: [string | null, string | null][] = [
    [prediction.winnerTeamId, result.winnerTeamId],
    [prediction.goldenBallPlayerId, result.goldenBallPlayerId],
    [prediction.goldenBootPlayerId, result.goldenBootPlayerId],
    [prediction.goldenGlovePlayerId, result.goldenGlovePlayerId],
    [prediction.youngPlayerId, result.youngPlayerId],
  ];
  let total = 0;
  for (const [pick, actual] of pairs) {
    if (actual != null && pick != null && pick === actual) total += points;
  }
  return total;
}

/**
 * Per-player points for every active round, in tournament order. Shared by the
 * points-per-round and cumulative-race charts so both agree on the round set and
 * the per-round numbers. Returns the ordered round labels and, per player, a
 * points array aligned to those rounds.
 */
function computePerRoundPoints(data: StatsData): {
  rounds: RoundDef[];
  participants: StatsPlayer[];
  perPlayer: Map<string, number[]>;
} {
  const participants = groupParticipants(data);
  // Index predictions by user for cheap per-round summation.
  const groupByUser = new Map<string, StatsData["groupPredictions"]>();
  for (const p of data.groupPredictions) {
    const list = groupByUser.get(p.userId) ?? [];
    list.push(p);
    groupByUser.set(p.userId, list);
  }
  const koByUser = new Map<string, StatsData["knockoutPredictions"]>();
  for (const p of data.knockoutPredictions) {
    const list = koByUser.get(p.userId) ?? [];
    list.push(p);
    koByUser.set(p.userId, list);
  }
  const awardByUser = new Map<string, AwardPicks>();
  for (const a of data.awardPredictions) {
    if (a.userId) awardByUser.set(a.userId, a);
  }

  // Which group matchdays / knockout rounds have at least one entered result.
  const playedMatchdays = new Set<number>();
  for (const [fixtureId] of data.groupResults) {
    const md = data.groupFixtureMatchday.get(fixtureId);
    if (md != null) playedMatchdays.add(md);
  }
  const playedKoRounds = new Set<string>();
  for (const koPred of data.knockoutPredictions) {
    if (data.knockoutResults.has(koPred.matchNumber)) {
      playedKoRounds.add(koPred.round);
    }
  }
  const awardsActive = data.awardResult != null;

  const rounds: RoundDef[] = [];
  for (const g of GROUP_ROUNDS) {
    if (playedMatchdays.has(g.matchday)) rounds.push(g.def);
  }
  for (const k of KNOCKOUT_ROUNDS) {
    if (playedKoRounds.has(k.round)) rounds.push(k.def);
  }
  if (awardsActive) rounds.push(AWARDS_ROUND);

  const perPlayer = new Map<string, number[]>();
  for (const player of participants) {
    const row: number[] = [];
    for (const round of rounds) {
      row.push(roundPointsForPlayer(round, player.userId, data, {
        groupByUser,
        koByUser,
        awardByUser,
      }));
    }
    perPlayer.set(player.userId, row);
  }

  return { rounds, participants, perPlayer };
}

/** Points one player earned in a single round (group matchday, KO round, awards). */
function roundPointsForPlayer(
  round: RoundDef,
  userId: string,
  data: StatsData,
  idx: {
    groupByUser: Map<string, StatsData["groupPredictions"]>;
    koByUser: Map<string, StatsData["knockoutPredictions"]>;
    awardByUser: Map<string, AwardPicks>;
  },
): number {
  if (round.key === AWARDS_ROUND.key) {
    const picks = idx.awardByUser.get(userId);
    return picks ? scoreAwardPicks(picks, data.awardResult, data.awardPoints) : 0;
  }

  const groupRound = GROUP_ROUNDS.find((g) => g.def.key === round.key);
  if (groupRound) {
    let total = 0;
    for (const pred of idx.groupByUser.get(userId) ?? []) {
      if (data.groupFixtureMatchday.get(pred.fixtureId) !== groupRound.matchday) {
        continue;
      }
      const result = data.groupResults.get(pred.fixtureId);
      if (!result) continue;
      total += scoreGroupMatch(
        { homeGoals: pred.homeGoals, awayGoals: pred.awayGoals },
        result,
        data.groupConfig,
      );
    }
    return total;
  }

  // Otherwise a knockout round.
  let total = 0;
  for (const pred of idx.koByUser.get(userId) ?? []) {
    if (pred.round !== round.key) continue;
    const actualWinner = data.knockoutResults.get(pred.matchNumber);
    if (actualWinner === undefined) continue;
    total += scoreKnockoutMatch(
      pred.predictedWinnerTeamId,
      actualWinner,
      data.knockoutConfig,
    );
  }
  return total;
}

// ---------------------------------------------------------------------------
// Chart 1 - Points earned per round (grouped bar: one group per round, one bar
// per player within each group).
// ---------------------------------------------------------------------------

export interface PointsPerRoundChart {
  /** "waiting" until at least one real result has been entered. */
  state: "ready" | "waiting";
  /** Display names of the player series, in leaderboard-friendly order. */
  players: string[];
  /**
   * One row per round, shaped for Recharts: { round: <label>, [player]: points }.
   * Player display names are unique, so they are safe series keys; the axis field
   * is named `round` (no player can collide with the reserved chart keys here).
   */
  rows: Record<string, string | number>[];
}

export function pointsPerRound(data: StatsData): PointsPerRoundChart {
  const { rounds, participants, perPlayer } = computePerRoundPoints(data);
  if (rounds.length === 0) {
    return { state: "waiting", players: [], rows: [] };
  }
  const players = participants.map((p) => p.displayName);
  const rows = rounds.map((round, i) => {
    const row: Record<string, string | number> = { round: round.label };
    for (const player of participants) {
      row[player.displayName] = perPlayer.get(player.userId)![i];
    }
    return row;
  });
  return { state: "ready", players, rows };
}

// ---------------------------------------------------------------------------
// Chart 2 - Cumulative points race (line: one line per player, x = round,
// y = running total).
// ---------------------------------------------------------------------------

export interface CumulativePointsChart {
  state: "ready" | "waiting";
  players: string[];
  /** One row per round with each player's running total up to that round. */
  rows: Record<string, string | number>[];
}

export function cumulativePoints(data: StatsData): CumulativePointsChart {
  const { rounds, participants, perPlayer } = computePerRoundPoints(data);
  if (rounds.length === 0) {
    return { state: "waiting", players: [], rows: [] };
  }
  const players = participants.map((p) => p.displayName);
  const running = new Map<string, number>(participants.map((p) => [p.userId, 0]));
  const rows = rounds.map((round, i) => {
    const row: Record<string, string | number> = { round: round.label };
    for (const player of participants) {
      const next = (running.get(player.userId) ?? 0) + perPlayer.get(player.userId)![i];
      running.set(player.userId, next);
      row[player.displayName] = next;
    }
    return row;
  });
  return { state: "ready", players, rows };
}

// ---------------------------------------------------------------------------
// Chart 3 - Per-player accuracy breakdown (stacked bar: exact / correct result
// wrong score / wrong). Based on group predictions that have a real result;
// knockout picks are excluded because they have no scoreline to grade.
// ---------------------------------------------------------------------------

export interface AccuracyRow {
  player: string;
  exact: number;
  result: number;
  wrong: number;
}

export interface AccuracyChart {
  /** "waiting" until at least one group result exists to grade against. */
  state: "ready" | "waiting";
  rows: AccuracyRow[];
}

export function accuracyBreakdown(data: StatsData): AccuracyChart {
  if (data.groupResults.size === 0) {
    return { state: "waiting", rows: [] };
  }
  const participants = groupParticipants(data);
  const counts = new Map<string, AccuracyRow>();
  for (const player of participants) {
    counts.set(player.userId, {
      player: player.displayName,
      exact: 0,
      result: 0,
      wrong: 0,
    });
  }
  for (const pred of data.groupPredictions) {
    const row = counts.get(pred.userId);
    if (!row) continue; // prediction from a non-participant; ignore.
    const actual = data.groupResults.get(pred.fixtureId);
    if (!actual) continue; // match not played yet.
    const prediction = { homeGoals: pred.homeGoals, awayGoals: pred.awayGoals };
    if (
      prediction.homeGoals === actual.homeGoals &&
      prediction.awayGoals === actual.awayGoals
    ) {
      row.exact += 1;
    } else if (matchOutcome(prediction) === matchOutcome(actual)) {
      row.result += 1;
    } else {
      row.wrong += 1;
    }
  }
  return { state: "ready", rows: participants.map((p) => counts.get(p.userId)!) };
}

// ---------------------------------------------------------------------------
// Chart 4 - Champion pick distribution (bar: one bar per team that got at least
// one champion pick). The champion is each player's final-match (104) winner
// pick; only knockout-submitted players contribute, matching the existing
// champion-carousel reveal rule.
// ---------------------------------------------------------------------------

export interface ChampionDistributionRow {
  team: string;
  count: number;
}

export interface ChampionDistributionChart {
  /** "empty" until at least one champion pick exists. */
  state: "ready" | "empty";
  rows: ChampionDistributionRow[];
}

export function championPickDistribution(
  data: StatsData,
): ChampionDistributionChart {
  const submitted = new Set(
    data.players.filter((p) => p.knockoutSubmitted).map((p) => p.userId),
  );
  const counts = new Map<string, number>();
  for (const pred of data.knockoutPredictions) {
    if (pred.matchNumber !== FINAL_MATCH_NUMBER) continue;
    if (!submitted.has(pred.userId)) continue;
    counts.set(
      pred.predictedWinnerTeamId,
      (counts.get(pred.predictedWinnerTeamId) ?? 0) + 1,
    );
  }
  if (counts.size === 0) return { state: "empty", rows: [] };
  const rows = [...counts.entries()]
    .map(([teamId, count]) => ({
      team: data.teamNames.get(teamId) ?? teamId,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.team.localeCompare(b.team));
  return { state: "ready", rows };
}

// ---------------------------------------------------------------------------
// Chart 5 - Award pick distribution (one horizontal bar chart per individual
// award: Golden Ball, Golden Boot, Golden Glove, Young Player). Players who
// skipped a given award are simply excluded from that award's distribution.
// Only awards-submitted players contribute, matching the awards reveal rule.
// ---------------------------------------------------------------------------

export interface AwardDistributionRow {
  nominee: string;
  count: number;
}

export interface AwardDistribution {
  award: string;
  /** "empty" when nobody picked anyone for this award. */
  state: "ready" | "empty";
  rows: AwardDistributionRow[];
}

export interface AwardDistributionChart {
  awards: AwardDistribution[];
}

export function awardPickDistribution(data: StatsData): AwardDistributionChart {
  const submittedIds = new Set(
    data.players.filter((p) => p.awardsSubmitted).map((p) => p.userId),
  );
  const picksByUser = new Map<string, AwardPicks>();
  for (const a of data.awardPredictions) {
    if (a.userId && submittedIds.has(a.userId)) picksByUser.set(a.userId, a);
  }

  const definitions: { award: string; pick: (a: AwardPicks) => string | null }[] = [
    { award: "Golden Ball", pick: (a) => a.goldenBallPlayerId },
    { award: "Golden Boot", pick: (a) => a.goldenBootPlayerId },
    { award: "Golden Glove", pick: (a) => a.goldenGlovePlayerId },
    { award: "Young Player", pick: (a) => a.youngPlayerId },
  ];

  const awards = definitions.map(({ award, pick }) => {
    const counts = new Map<string, number>();
    for (const picks of picksByUser.values()) {
      const playerId = pick(picks);
      if (!playerId) continue; // skipped this award.
      counts.set(playerId, (counts.get(playerId) ?? 0) + 1);
    }
    if (counts.size === 0) {
      return { award, state: "empty" as const, rows: [] };
    }
    const rows = [...counts.entries()]
      .map(([playerId, count]) => ({
        nominee: data.playerNames.get(playerId) ?? playerId,
        count,
      }))
      .sort((a, b) => b.count - a.count || a.nominee.localeCompare(b.nominee));
    return { award, state: "ready" as const, rows };
  });

  return { awards };
}

// ---------------------------------------------------------------------------
// Chart 6 - Predicted goals vs actual (bar: each player's total predicted goals
// across all their group-stage scorelines, with a reference line for the real
// total goals scored so far). Knockout picks carry no scoreline, so both sides
// are group-stage goals, keeping the comparison like-for-like.
// ---------------------------------------------------------------------------

export interface PredictedGoalsRow {
  player: string;
  predicted: number;
}

export interface PredictedGoalsChart {
  /** "waiting" until at least one group result exists for the reference line. */
  state: "ready" | "waiting";
  rows: PredictedGoalsRow[];
  /** Real group goals scored so far (sum of entered group results). */
  actualTotal: number;
}

export function predictedVsActualGoals(data: StatsData): PredictedGoalsChart {
  if (data.groupResults.size === 0) {
    return { state: "waiting", rows: [], actualTotal: 0 };
  }
  const participants = groupParticipants(data);
  const predicted = new Map<string, number>(
    participants.map((p) => [p.userId, 0]),
  );
  for (const pred of data.groupPredictions) {
    if (!predicted.has(pred.userId)) continue;
    predicted.set(
      pred.userId,
      predicted.get(pred.userId)! + pred.homeGoals + pred.awayGoals,
    );
  }
  let actualTotal = 0;
  for (const [, result] of data.groupResults) {
    actualTotal += result.homeGoals + result.awayGoals;
  }
  const rows = participants.map((p) => ({
    player: p.displayName,
    predicted: predicted.get(p.userId) ?? 0,
  }));
  return { state: "ready", rows, actualTotal };
}

// ===========================================================================
// Real tournament player stats (goals & assists). These are facts derived from
// the entered goal events, so unlike the prediction charts above they do not
// filter by any player's submission. The whole /stats page is still gated on the
// VIEWER having submitted, so these only ever render for a submitted viewer.
// ===========================================================================

/** Default number of players shown in a ranked player-stat chart. */
const PLAYER_STAT_LIMIT = 10;

export interface PlayerRankRow {
  name: string;
  isoCode: string;
  value: number;
}

export interface PlayerRankChart {
  /** "empty" until at least one matching goal event exists. */
  state: "ready" | "empty";
  rows: PlayerRankRow[];
}

/** Tally a goal-event id field (scorer or assister) into a ranked player list. */
function rankByGoalField(
  data: StatsData,
  field: "scorerId" | "assisterId",
  limit: number,
): PlayerRankChart {
  const counts = new Map<string, number>();
  for (const e of data.goalEvents) {
    const id = e[field];
    if (!id) continue; // own goal / unassisted.
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  if (counts.size === 0) return { state: "empty", rows: [] };
  const rows = [...counts.entries()]
    .map(([id, value]) => {
      const info = data.statPlayers.get(id);
      return { name: info?.name ?? id, isoCode: info?.isoCode ?? "", value };
    })
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .slice(0, limit);
  return { state: "ready", rows };
}

/** Top goal scorers across the tournament. */
export function topScorers(
  data: StatsData,
  limit = PLAYER_STAT_LIMIT,
): PlayerRankChart {
  return rankByGoalField(data, "scorerId", limit);
}

/** Top assist providers across the tournament. */
export function topAssisters(
  data: StatsData,
  limit = PLAYER_STAT_LIMIT,
): PlayerRankChart {
  return rankByGoalField(data, "assisterId", limit);
}

// ---------------------------------------------------------------------------
// Goal involvements: goals + assists per player, as a stacked ranking. Surfaces
// the players most directly involved in goals, which neither single list shows.
// ---------------------------------------------------------------------------

export interface InvolvementRow {
  name: string;
  isoCode: string;
  goals: number;
  assists: number;
  total: number;
}

export interface InvolvementsChart {
  state: "ready" | "empty";
  rows: InvolvementRow[];
}

export function topInvolvements(
  data: StatsData,
  limit = PLAYER_STAT_LIMIT,
): InvolvementsChart {
  const goals = new Map<string, number>();
  const assists = new Map<string, number>();
  for (const e of data.goalEvents) {
    if (e.scorerId) goals.set(e.scorerId, (goals.get(e.scorerId) ?? 0) + 1);
    if (e.assisterId) {
      assists.set(e.assisterId, (assists.get(e.assisterId) ?? 0) + 1);
    }
  }
  const ids = new Set([...goals.keys(), ...assists.keys()]);
  if (ids.size === 0) return { state: "empty", rows: [] };
  const rows = [...ids]
    .map((id) => {
      const g = goals.get(id) ?? 0;
      const a = assists.get(id) ?? 0;
      const info = data.statPlayers.get(id);
      return {
        name: info?.name ?? id,
        isoCode: info?.isoCode ?? "",
        goals: g,
        assists: a,
        total: g + a,
      };
    })
    .sort(
      (a, b) => b.total - a.total || b.goals - a.goals || a.name.localeCompare(b.name),
    )
    .slice(0, limit);
  return { state: "ready", rows };
}

// ---------------------------------------------------------------------------
// Goals by minute: when goals are scored across the tournament, in 15-minute
// buckets. Every goal event counts (own goals included); events with no recorded
// minute are skipped. Empty until at least one goal has a minute.
// ---------------------------------------------------------------------------

export interface MinuteBucketRow {
  bucket: string;
  goals: number;
}

export interface GoalsByMinuteChart {
  state: "ready" | "empty";
  rows: MinuteBucketRow[];
}

const MINUTE_BUCKETS: { label: string; max: number }[] = [
  { label: "1-15", max: 15 },
  { label: "16-30", max: 30 },
  { label: "31-45", max: 45 },
  { label: "46-60", max: 60 },
  { label: "61-75", max: 75 },
  { label: "76-90", max: 90 },
  { label: "90+", max: Infinity },
];

export function goalsByMinute(data: StatsData): GoalsByMinuteChart {
  const counts = new Array(MINUTE_BUCKETS.length).fill(0);
  let withMinute = 0;
  for (const e of data.goalEvents) {
    if (e.minute == null) continue;
    withMinute += 1;
    const idx = MINUTE_BUCKETS.findIndex((b) => e.minute! <= b.max);
    counts[idx >= 0 ? idx : MINUTE_BUCKETS.length - 1] += 1;
  }
  if (withMinute === 0) return { state: "empty", rows: [] };
  const rows = MINUTE_BUCKETS.map((b, i) => ({ bucket: b.label, goals: counts[i] }));
  return { state: "ready", rows };
}
