// Fetch World Cup 2026 squad data via national-team lookup, in two phases, and
// write the result to data/wc2026-squads.json. Stays within the 100 requests/day
// free tier with a session call cap and a resume mode.
//
// Usage:
//   First run:   API_FOOTBALL_KEY=your_key node fetch-squads.js
//   Resume:      API_FOOTBALL_KEY=your_key node fetch-squads.js --resume
//   Output:      data/wc2026-squads.json
//                data/team-id-map.json
//                data/call-log.json
//
// The key is read from API_FOOTBALL_KEY and never hardcoded. To load it from a
// local .env (git-ignored), run with Node's flag: node --env-file=.env ...
// Standalone script, not part of the Next.js app. Built-in fetch only (Node 18+).

"use strict";

const fs = require("fs");
const path = require("path");

// ---- Node version guard -------------------------------------------------
const NODE_MAJOR = Number(process.versions.node.split(".")[0]);
console.log(`Node ${process.versions.node}`);
if (NODE_MAJOR < 18) {
  console.error("This script needs Node 18 or newer (built-in fetch). Aborting.");
  process.exit(1);
}

// ---- Config -------------------------------------------------------------
const BASE_URL = "https://v3.football.api-sports.io";
const API_KEY = process.env.API_FOOTBALL_KEY;
// The free tier also caps at 10 requests/MINUTE, so a short delay trips a 429
// storm. 6.5s spacing keeps us under that (about 9 per minute).
const DELAY_MS = 6500; // pause between every API call
const DAILY_LIMIT = 100; // free tier daily cap
const CALL_CAP = 95; // stop here, leaving a 5-call safety buffer

const OUTPUT_DIR = path.join(__dirname, "data");
const SQUADS_FILE = path.join(OUTPUT_DIR, "wc2026-squads.json");
const ID_MAP_FILE = path.join(OUTPUT_DIR, "team-id-map.json");
const CALL_LOG_FILE = path.join(OUTPUT_DIR, "call-log.json");

// The 48 teams, copied from the app's src/lib/data/teams.ts (the source of
// truth). The provided prompt list had duplicates and wrong names, so these win.
const TEAMS = [
  "Mexico", "South Africa", "South Korea", "Czechia",
  "Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland",
  "Brazil", "Morocco", "Haiti", "Scotland",
  "United States", "Paraguay", "Australia", "Turkey",
  "Germany", "Curacao", "Cote d'Ivoire", "Ecuador",
  "Netherlands", "Japan", "Sweden", "Tunisia",
  "Belgium", "Egypt", "Iran", "New Zealand",
  "Spain", "Cabo Verde", "Saudi Arabia", "Uruguay",
  "France", "Senegal", "Iraq", "Norway",
  "Argentina", "Algeria", "Austria", "Jordan",
  "Portugal", "DR Congo", "Uzbekistan", "Colombia",
  "England", "Croatia", "Ghana", "Panama",
];

// API-Football names some national teams differently from teams.ts. The search
// uses the alias; the output keeps the canonical (app) name so it matches the app.
const SEARCH_ALIAS = {
  "United States": "USA",
  "South Korea": "Korea Republic",
  "Cote d'Ivoire": "Ivory Coast",
  "Cabo Verde": "Cape Verde",
  "DR Congo": "Congo DR",
  "Czechia": "Czech Republic",
  "Bosnia and Herzegovina": "Bosnia & Herzegovina",
};

// ---- State --------------------------------------------------------------
let callCount = 0;
const callLog = [];
let stopped = false; // set when the call cap or daily quota is reached
let stopReason = "";
let dailyRemaining = null; // from the x-ratelimit-requests-remaining header

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// One throttled, logged API call. Returns { ok, body }. Every call (success or
// failure) is appended to the call log. Caller must check capReached() first.
async function apiCall(endpoint, teamName) {
  await sleep(DELAY_MS);
  callCount += 1;
  const entry = {
    callNumber: callCount,
    timestamp: nowIso(),
    endpoint,
    teamName,
    status: "success",
    httpStatus: null,
    error: null,
  };

  try {
    const res = await fetch(BASE_URL + endpoint, {
      headers: { "x-apisports-key": API_KEY },
    });
    entry.httpStatus = res.status;
    // Daily requests remaining, reported by the API on every response.
    const remHeader = res.headers.get("x-ratelimit-requests-remaining");
    if (remHeader !== null && remHeader !== "") dailyRemaining = Number(remHeader);
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      entry.status = "failed";
      entry.error = `HTTP ${res.status} ${res.statusText}`;
      callLog.push(entry);
      return { ok: false, body };
    }

    const errors = body && body.errors;
    const hasErrors = Array.isArray(errors)
      ? errors.length > 0
      : errors && typeof errors === "object" && Object.keys(errors).length > 0;
    if (hasErrors) {
      entry.status = "failed";
      entry.error = JSON.stringify(errors);
      callLog.push(entry);
      return { ok: false, body };
    }

    callLog.push(entry);
    return { ok: true, body };
  } catch (err) {
    entry.status = "failed";
    entry.error = err.message;
    callLog.push(entry);
    return { ok: false, body: null };
  }
}

// True once the daily quota is exhausted or the session safety cap is reached.
function capReached() {
  if (dailyRemaining !== null && dailyRemaining <= 0) {
    stopped = true;
    stopReason = "daily quota exhausted";
    return true;
  }
  if (callCount >= CALL_CAP) {
    stopped = true;
    stopReason = `reached the ${CALL_CAP}-call session cap`;
    return true;
  }
  return false;
}

// ---- Phase 1: resolve team IDs by national-team name ---------------------
// idMap: canonical name -> { teamId, teamName }. Already-resolved names are
// skipped, so on --resume this reuses saved IDs and only resolves stragglers.
// A search can return youth/women national sides (e.g. "... U21", "... W") whose
// `national` flag is also true. Prefer the senior team by skipping those markers.
function isYouthOrWomen(name) {
  return /\bU-?\d{2}\b|\bW\b|\bWomen\b/i.test(name || "");
}

function pickNational(body) {
  const rows = body && Array.isArray(body.response) ? body.response : [];
  const nationals = rows.map((r) => r.team).filter((t) => t && t.national === true);
  const senior = nationals.filter((t) => !isYouthOrWomen(t.name));
  return senior[0] || nationals[0] || null;
}

async function resolveIds(idMap) {
  for (const name of TEAMS) {
    if (idMap[name] && idMap[name].teamId != null) continue;
    if (capReached()) return;

    // Try the exact name (alias first). If that succeeds but matches no national
    // team, fall back to a fuzzy search so a wrong exact name still resolves.
    const exactQuery = SEARCH_ALIAS[name] || name;
    let res = await apiCall(`/teams?name=${encodeURIComponent(exactQuery)}`, name);
    if (!res.ok) {
      console.log(`  [id] ${name}: lookup failed`);
      continue;
    }
    let team = pickNational(res.body);

    if (!team) {
      if (capReached()) return;
      res = await apiCall(`/teams?search=${encodeURIComponent(name)}`, name);
      if (!res.ok) {
        console.log(`  [id] ${name}: lookup failed`);
        continue;
      }
      team = pickNational(res.body);
    }

    if (!team) {
      console.log(`  [id] ${name}: no national team match found`);
      continue;
    }
    idMap[name] = { teamId: team.id, teamName: name };
    console.log(`  [id] ${name} -> ${team.id}`);
  }
}

// ---- Phase 2: fetch squads ---------------------------------------------
async function fetchSquads(idMap, teamsOut) {
  for (const name of TEAMS) {
    const resolved = idMap[name];
    if (!resolved || resolved.teamId == null) continue; // unresolved, skip
    const teamId = resolved.teamId;

    const existing = teamsOut[teamId];
    if (existing && Array.isArray(existing.players)) continue; // already fetched

    if (capReached()) return;

    const { ok, body } = await apiCall(`/players/squads?team=${teamId}`, name);
    if (!ok) {
      teamsOut[teamId] = { teamId, teamName: name, players: null };
      console.log(`  [squad] ${name}: failed -> null`);
      continue;
    }
    const players =
      (body.response && body.response[0] && body.response[0].players) || [];
    if (players.length === 0) {
      teamsOut[teamId] = { teamId, teamName: name, players: null };
      console.log(`  [squad] ${name}: empty -> null`);
      continue;
    }
    teamsOut[teamId] = {
      teamId,
      teamName: name,
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        age: p.age ?? null,
        number: p.number ?? null,
        position: p.position ?? null,
        photo: p.photo ?? null,
      })),
    };
    console.log(`  [squad] ${name}: ${players.length} players`);
  }
}

function fetchedTeamNames(teamsOut) {
  const names = new Set();
  for (const t of Object.values(teamsOut)) {
    if (t && Array.isArray(t.players)) names.add(t.teamName);
  }
  return names;
}

async function main() {
  if (!API_KEY) {
    console.error(
      "API_FOOTBALL_KEY is not set. Run with:\n" +
        "  API_FOOTBALL_KEY=your_key node fetch-squads.js\n" +
        "or load a local .env: node --env-file=.env fetch-squads.js",
    );
    process.exit(1);
  }

  const resume = process.argv.includes("--resume");
  console.log(resume ? "Mode: resume" : "Mode: fresh run");

  // Load prior state. A saved id map is reused when present (required on resume,
  // and a harmless optimization on a fresh run since resolved teams are skipped).
  const idMap = readJson(ID_MAP_FILE) || {};
  const prior = readJson(SQUADS_FILE);
  const teamsOut = (prior && prior.teams) || {};

  if (resume) {
    console.log(
      `Loaded ${Object.keys(idMap).length} resolved IDs and ` +
        `${fetchedTeamNames(teamsOut).size} fetched squads from disk.`,
    );
  }

  // Phase 1
  console.log("\nPhase 1: resolving team IDs...");
  await resolveIds(idMap);
  writeJson(ID_MAP_FILE, idMap); // persist IDs even if we stop mid-run

  // Phase 2 (only if we have budget left)
  if (!stopped) {
    console.log("\nPhase 2: fetching squads...");
    await fetchSquads(idMap, teamsOut);
  }

  // ---- Write outputs ----
  const fetched = fetchedTeamNames(teamsOut);
  const output = {
    fetchedAt: nowIso(),
    totalTeams: TEAMS.length,
    teamsWithData: fetched.size,
    teams: teamsOut,
  };
  writeJson(SQUADS_FILE, output);
  writeJson(CALL_LOG_FILE, callLog);

  // ---- Summary ----
  const successful = callLog.filter((c) => c.status === "success").length;
  const failed = callLog.filter((c) => c.status === "failed").length;
  const notFetched = TEAMS.filter((n) => !fetched.has(n));

  console.log("\n=== Run Summary ===");
  console.log(`Total calls made: ${callCount}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
  console.log(
    `Calls remaining (estimated): ${dailyRemaining !== null ? dailyRemaining : Math.max(0, DAILY_LIMIT - callCount)}`,
  );
  console.log(`Teams with IDs resolved: ${Object.keys(idMap).length}/${TEAMS.length}`);
  console.log(`Teams with squads fetched: ${fetched.size}/${TEAMS.length}`);

  const failedCalls = callLog.filter((c) => c.status === "failed");
  if (failedCalls.length > 0) {
    console.log("\nFailed calls:");
    for (const c of failedCalls) {
      console.log(`  - Call #${c.callNumber}: ${c.endpoint} (${c.teamName}) - ${c.error}`);
    }
  }

  if (stopped) {
    console.log(`\n⚠️  Stopping: ${stopReason || "limit reached"}.`);
    console.log("Resume tomorrow by running the script with --resume flag.");
    console.log("Teams not yet fetched: " + (notFetched.length ? notFetched.join(", ") : "none"));
  } else if (notFetched.length > 0) {
    console.log("\nTeams not yet fetched (run with --resume tomorrow):");
    for (const n of notFetched) console.log(`  - ${n}`);
  } else {
    console.log("\nAll teams fetched.");
  }

  const sizeKb = (fs.statSync(SQUADS_FILE).size / 1024).toFixed(1);
  console.log(`\nWrote ${SQUADS_FILE} (${sizeKb} KB)`);
  console.log(`Wrote ${ID_MAP_FILE} and ${CALL_LOG_FILE}`);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
