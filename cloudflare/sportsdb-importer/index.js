import {
  pauseSportsDbImporter,
  pruneSportsDbApiRequests,
  readSportsDbPause,
  recordSportsDbApiResponse,
  reserveSportsDbApiRequest,
  retryAtFromResponse,
} from "./api-quota.mjs";
const API_BASE = "https://www.thesportsdb.com/api/v1/json";
const SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS sportsdb_leagues(idLeague INTEGER PRIMARY KEY,strLeague TEXT,strSport TEXT,strLeagueAlternate TEXT,strCountry TEXT,strLogo TEXT,strCurrentSeason TEXT,intFormedYear INTEGER,strWebsite TEXT,strFacebook TEXT,strTwitter TEXT,strInstagram TEXT,strYoutube TEXT,strDescriptionEN TEXT,strBanner TEXT,strBadge TEXT,strPoster TEXT,strTrophy TEXT,strNamingS TEXT,strLocked TEXT,imported_at TEXT DEFAULT(datetime('now')));
CREATE TABLE IF NOT EXISTS sportsdb_teams(idTeam INTEGER PRIMARY KEY,strTeam TEXT,strTeamShort TEXT,strAlternate TEXT,intFormedYear INTEGER,strSport TEXT,strLeague TEXT,idLeague INTEGER,strStadium TEXT,strKeywords TEXT,strStadiumThumb TEXT,strStadiumLocation TEXT,intStadiumCapacity INTEGER,strWebsite TEXT,strFacebook TEXT,strTwitter TEXT,strInstagram TEXT,strDescriptionEN TEXT,strCountry TEXT,strTeamBadge TEXT,strTeamJersey TEXT,strTeamLogo TEXT,strTeamBanner TEXT,strTeamPoster TEXT,strYoutube TEXT,strLocked TEXT,imported_at TEXT DEFAULT(datetime('now')));
CREATE TABLE IF NOT EXISTS sportsdb_players(idPlayer INTEGER PRIMARY KEY,strPlayer TEXT,strTeam TEXT,strSport TEXT,dateBorn TEXT,strNumber TEXT,dateSigned TEXT,strSigning TEXT,strWage TEXT,strPosition TEXT,strPositionNumber TEXT,strNationality TEXT,strHeight TEXT,strWeight TEXT,strThumb TEXT,strCutout TEXT,strBanner TEXT,strFanart1 TEXT,strFanart2 TEXT,strFanart3 TEXT,strFanart4 TEXT,strDescriptionEN TEXT,strDescriptionPT TEXT,strStatus TEXT,strGender TEXT,strSide TEXT,strKitColor1 TEXT,strKitColor2 TEXT,strKitColor3 TEXT,strKitColor4 TEXT,strFacebook TEXT,strTwitter TEXT,strInstagram TEXT,strYoutube TEXT,strLocked TEXT,idTeam INTEGER,imported_at TEXT DEFAULT(datetime('now')));
CREATE TABLE IF NOT EXISTS sportsdb_events(idEvent INTEGER PRIMARY KEY,strEvent TEXT,strEventAlternate TEXT,strFilename TEXT,strSport TEXT,idLeague INTEGER,strLeague TEXT,strSeason TEXT,strDescriptionEN TEXT,strHomeTeam TEXT,strAwayTeam TEXT,intHomeScore INTEGER,intAwayScore INTEGER,intRound INTEGER,intSpectators INTEGER,strOfficial TEXT,strTimestamp TEXT,dateEvent TEXT,dateEventLocal TEXT,strTime TEXT,strTimeLocal TEXT,strTVStation TEXT,idHomeTeam INTEGER,idAwayTeam INTEGER,strResult TEXT,strVenue TEXT,strCountry TEXT,strCity TEXT,strPoster TEXT,strThumb TEXT,strBanner TEXT,strMap TEXT,strTweet1 TEXT,strTweet2 TEXT,strTweet3 TEXT,strVideo TEXT,strLock TEXT,strSection TEXT,strPostponed TEXT,strLocked TEXT,strStatus TEXT,imported_at TEXT DEFAULT(datetime('now')));
CREATE TABLE IF NOT EXISTS sportsdb_standings(id INTEGER PRIMARY KEY AUTOINCREMENT,idLeague INTEGER,strLeague TEXT,strSeason TEXT,idTeam INTEGER,strTeam TEXT,intRank INTEGER,intPlayed INTEGER,intWin INTEGER,intLoss INTEGER,intDraw INTEGER,intGoalsFor INTEGER,intGoalsAgainst INTEGER,intGoalDifference INTEGER,intPoints INTEGER,strForm TEXT,strDescription TEXT,strBadge TEXT,imported_at TEXT DEFAULT(datetime('now')),UNIQUE(idLeague,strSeason,idTeam));
CREATE TABLE IF NOT EXISTS sportsdb_import_log(id INTEGER PRIMARY KEY AUTOINCREMENT,endpoint TEXT,status TEXT,records INTEGER,message TEXT,imported_at TEXT DEFAULT(datetime('now')));
CREATE TABLE IF NOT EXISTS sportsdb_import_state(phase TEXT PRIMARY KEY,offset_val INTEGER,last_error TEXT,updated_at TEXT DEFAULT(datetime('now')));
CREATE INDEX IF NOT EXISTS idx_tl ON sportsdb_teams(idLeague);CREATE INDEX IF NOT EXISTS idx_pt ON sportsdb_players(idTeam);CREATE INDEX IF NOT EXISTS idx_el ON sportsdb_events(idLeague);CREATE INDEX IF NOT EXISTS idx_es ON sportsdb_events(strSeason);CREATE INDEX IF NOT EXISTS idx_eh ON sportsdb_events(idHomeTeam);CREATE INDEX IF NOT EXISTS idx_ea ON sportsdb_events(idAwayTeam);CREATE INDEX IF NOT EXISTS idx_sl ON sportsdb_standings(idLeague,strSeason);
CREATE TABLE IF NOT EXISTS sportsdb_api_request_log(id INTEGER PRIMARY KEY AUTOINCREMENT,requested_at_ms INTEGER NOT NULL,response_status INTEGER,source_log_id INTEGER,attempt_no INTEGER,UNIQUE(source_log_id,attempt_no));
CREATE INDEX IF NOT EXISTS idx_api_request_log_time ON sportsdb_api_request_log(requested_at_ms);
CREATE TABLE IF NOT EXISTS sportsdb_api_budget_state(singleton INTEGER PRIMARY KEY CHECK(singleton=1),legacy_log_cutoff INTEGER NOT NULL);
INSERT OR IGNORE INTO sportsdb_api_budget_state(singleton,legacy_log_cutoff) SELECT 1,COALESCE(MAX(id),0) FROM sportsdb_import_log;
INSERT OR IGNORE INTO sportsdb_api_request_log(requested_at_ms,response_status,source_log_id,attempt_no) SELECT CAST(strftime('%s',l.imported_at) AS INTEGER)*1000,CASE WHEN l.status='ok' THEN 200 WHEN l.message LIKE '%429%' THEN 429 WHEN l.message LIKE '%503%' THEN 503 ELSE 0 END,l.id,attempts.attempt_no FROM sportsdb_import_log l CROSS JOIN (SELECT 1 AS attempt_no UNION ALL SELECT 2 UNION ALL SELECT 3) attempts JOIN sportsdb_api_budget_state b ON b.singleton=1 WHERE l.id<=b.legacy_log_cutoff AND l.imported_at>=datetime('now','-24 hours');`;
function n(v) {
  return v === undefined ? null : v;
}
async function fa(p, env) {
  const db = env.SPORTS_DB;
  const apiKey = String(env.THESPORTSDB_API_KEY || "").trim();
  if (!apiKey) {
    const retryAt = Date.now() + 60 * 60 * 1000;
    await pauseSportsDbImporter(db, "TheSportsDB API key is not configured", retryAt);
    const error = new Error("TheSportsDB API key is not configured");
    error.code = "SPORTSDB_CONFIG";
    error.retryAt = retryAt;
    throw error;
  }
  const paused = await readSportsDbPause(db);
  if (paused) {
    const error = new Error(paused.reason || "TheSportsDB requests are paused");
    error.code = "SPORTSDB_UPSTREAM_PAUSED";
    error.retryAt = paused.retryAt;
    throw error;
  }
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    let requestId = 0;
    let responseSeen = false;
    try {
      try {
        requestId = await reserveSportsDbApiRequest(db);
      } catch (error) {
        if (error && error.code === "SPORTSDB_QUOTA")
          await pauseSportsDbImporter(db, error.message, error.retryAt);
        else if (error && typeof error === "object") error.code = "SPORTSDB_LEDGER";
        throw error;
      }
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 15000);
      let response;
      try {
        const url = API_BASE + "/" + encodeURIComponent(apiKey) + "/" + p;
        response = await fetch(url, { signal: ctrl.signal, cf: { cacheTtl: 60 } });
      } finally {
        clearTimeout(timeout);
      }
      responseSeen = true;
      try {
        await recordSportsDbApiResponse(db, requestId, response.status);
      } catch (error) {
        const ledgerError = new Error("Could not record TheSportsDB response");
        ledgerError.code = "SPORTSDB_LEDGER";
        throw ledgerError;
      }
      if (response.status === 404) return null;
      if (response.status === 429 || response.status === 503) {
        const fallback = response.status === 429 ? 15 * 60 * 1000 : 5 * 60 * 1000;
        const retryAt = retryAtFromResponse(
          response.headers.get("Retry-After"),
          Date.now(),
          fallback,
        );
        const message = "TheSportsDB returned HTTP " + response.status;
        await pauseSportsDbImporter(db, message, retryAt);
        const error = new Error(message);
        error.code = "SPORTSDB_UPSTREAM_PAUSED";
        error.retryAt = retryAt;
        throw error;
      }
      if (response.status >= 500) {
        lastErr = new Error("TheSportsDB returned HTTP " + response.status);
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
          continue;
        }
        break;
      }
      if (!response.ok) {
        const retryAt = Date.now() + 60 * 60 * 1000;
        const message = "TheSportsDB returned HTTP " + response.status;
        await pauseSportsDbImporter(db, message, retryAt);
        const error = new Error(message);
        error.code =
          response.status === 401 || response.status === 403
            ? "SPORTSDB_CONFIG"
            : "SPORTSDB_UPSTREAM_PAUSED";
        error.retryAt = retryAt;
        throw error;
      }
      return await response.json();
    } catch (error) {
      if (error && typeof error.code === "string" && error.code.startsWith("SPORTSDB_"))
        throw error;
      if (requestId && !responseSeen) {
        try {
          await recordSportsDbApiResponse(db, requestId, 0);
        } catch (ledgerError) {
          const failedLedger = new Error("Could not record TheSportsDB request");
          failedLedger.code = "SPORTSDB_LEDGER";
          throw failedLedger;
        }
      }
      lastErr = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  const retryAt = Date.now() + 5 * 60 * 1000;
  await pauseSportsDbImporter(db, "TheSportsDB request failed after retries", retryAt);
  const error = new Error("TheSportsDB request failed after retries");
  error.code = "SPORTSDB_UPSTREAM_PAUSED";
  error.retryAt = retryAt;
  error.cause = lastErr;
  throw error;
}
function j(d, s = 200) {
  return new Response(JSON.stringify(d, null, 2), {
    status: s,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
async function logI(d, e, s, r, m) {
  try {
    await d
      .prepare("INSERT INTO sportsdb_import_log(endpoint,status,records,message)VALUES(?,?,?,?)")
      .bind(n(e), n(s), n(r), n(m) || "")
      .run();
  } catch (x) {}
}
async function uL(d, l) {
  await d
    .prepare(
      "INSERT OR REPLACE INTO sportsdb_leagues(idLeague,strLeague,strSport,strLeagueAlternate,strCountry,strLogo,strCurrentSeason,intFormedYear,strWebsite,strFacebook,strTwitter,strInstagram,strYoutube,strDescriptionEN,strBanner,strBadge,strPoster,strTrophy,strNamingS,strLocked,imported_at)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))",
    )
    .bind(
      n(l.idLeague),
      n(l.strLeague),
      n(l.strSport),
      n(l.strLeagueAlternate),
      n(l.strCountry),
      n(l.strLogo),
      n(l.strCurrentSeason),
      n(l.intFormedYear),
      n(l.strWebsite),
      n(l.strFacebook),
      n(l.strTwitter),
      n(l.strInstagram),
      n(l.strYoutube),
      n(l.strDescriptionEN),
      n(l.strBanner),
      n(l.strBadge),
      n(l.strPoster),
      n(l.strTrophy),
      n(l.strNamingS),
      n(l.strLocked),
    )
    .run();
}
async function uT(d, t) {
  await d
    .prepare(
      "INSERT OR REPLACE INTO sportsdb_teams(idTeam,strTeam,strTeamShort,strAlternate,intFormedYear,strSport,strLeague,idLeague,strStadium,strKeywords,strStadiumThumb,strStadiumLocation,intStadiumCapacity,strWebsite,strFacebook,strTwitter,strInstagram,strDescriptionEN,strCountry,strTeamBadge,strTeamJersey,strTeamLogo,strTeamBanner,strTeamPoster,strYoutube,strLocked,imported_at)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))",
    )
    .bind(
      n(t.idTeam),
      n(t.strTeam),
      n(t.strTeamShort),
      n(t.strAlternate),
      n(t.intFormedYear),
      n(t.strSport),
      n(t.strLeague),
      n(t.idLeague),
      n(t.strStadium),
      n(t.strKeywords),
      n(t.strStadiumThumb),
      n(t.strStadiumLocation),
      n(t.intStadiumCapacity),
      n(t.strWebsite),
      n(t.strFacebook),
      n(t.strTwitter),
      n(t.strInstagram),
      n(t.strDescriptionEN),
      n(t.strCountry),
      n(t.strTeamBadge),
      n(t.strTeamJersey),
      n(t.strTeamLogo),
      n(t.strTeamBanner),
      n(t.strTeamPoster),
      n(t.strYoutube),
      n(t.strLocked),
    )
    .run();
}
async function uP(d, p) {
  await d
    .prepare(
      "INSERT OR REPLACE INTO sportsdb_players(idPlayer,strPlayer,strTeam,strSport,dateBorn,strNumber,dateSigned,strSigning,strWage,strPosition,strPositionNumber,strNationality,strHeight,strWeight,strThumb,strCutout,strBanner,strFanart1,strFanart2,strFanart3,strFanart4,strDescriptionEN,strDescriptionPT,strStatus,strGender,strSide,strKitColor1,strKitColor2,strKitColor3,strKitColor4,strFacebook,strTwitter,strInstagram,strYoutube,strLocked,idTeam,imported_at)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))",
    )
    .bind(
      n(p.idPlayer),
      n(p.strPlayer),
      n(p.strTeam),
      n(p.strSport),
      n(p.dateBorn),
      n(p.strNumber),
      n(p.dateSigned),
      n(p.strSigning),
      n(p.strWage),
      n(p.strPosition),
      n(p.strPositionNumber),
      n(p.strNationality),
      n(p.strHeight),
      n(p.strWeight),
      n(p.strThumb),
      n(p.strCutout),
      n(p.strBanner),
      n(p.strFanart1),
      n(p.strFanart2),
      n(p.strFanart3),
      n(p.strFanart4),
      n(p.strDescriptionEN),
      n(p.strDescriptionPT),
      n(p.strStatus),
      n(p.strGender),
      n(p.strSide),
      n(p.strKitColor1),
      n(p.strKitColor2),
      n(p.strKitColor3),
      n(p.strKitColor4),
      n(p.strFacebook),
      n(p.strTwitter),
      n(p.strInstagram),
      n(p.strYoutube),
      n(p.strLocked),
      n(p.idTeam),
    )
    .run();
}
async function uE(d, e) {
  await d
    .prepare(
      "INSERT OR REPLACE INTO sportsdb_events(idEvent,strEvent,strEventAlternate,strFilename,strSport,idLeague,strLeague,strSeason,strDescriptionEN,strHomeTeam,strAwayTeam,intHomeScore,intAwayScore,intRound,intSpectators,strOfficial,strTimestamp,dateEvent,dateEventLocal,strTime,strTimeLocal,strTVStation,idHomeTeam,idAwayTeam,strResult,strVenue,strCountry,strCity,strPoster,strThumb,strBanner,strMap,strTweet1,strTweet2,strTweet3,strVideo,strLock,strSection,strPostponed,strLocked,strStatus,imported_at)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))",
    )
    .bind(
      n(e.idEvent),
      n(e.strEvent),
      n(e.strEventAlternate),
      n(e.strFilename),
      n(e.strSport),
      n(e.idLeague),
      n(e.strLeague),
      n(e.strSeason),
      n(e.strDescriptionEN),
      n(e.strHomeTeam),
      n(e.strAwayTeam),
      n(e.intHomeScore),
      n(e.intAwayScore),
      n(e.intRound),
      n(e.intSpectators),
      n(e.strOfficial),
      n(e.strTimestamp),
      n(e.dateEvent),
      n(e.dateEventLocal),
      n(e.strTime),
      n(e.strTimeLocal),
      n(e.strTVStation),
      n(e.idHomeTeam),
      n(e.idAwayTeam),
      n(e.strResult),
      n(e.strVenue),
      n(e.strCountry),
      n(e.strCity),
      n(e.strPoster),
      n(e.strThumb),
      n(e.strBanner),
      n(e.strMap),
      n(e.strTweet1),
      n(e.strTweet2),
      n(e.strTweet3),
      n(e.strVideo),
      n(e.strLock),
      n(e.strSection),
      n(e.strPostponed),
      n(e.strLocked),
      n(e.strStatus),
    )
    .run();
}
async function uS(d, s, l, lg, se) {
  await d
    .prepare(
      "INSERT OR REPLACE INTO sportsdb_standings(idLeague,strLeague,strSeason,idTeam,strTeam,intRank,intPlayed,intWin,intLoss,intDraw,intGoalsFor,intGoalsAgainst,intGoalDifference,intPoints,strForm,strDescription,strBadge,imported_at)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))",
    )
    .bind(
      n(l),
      n(lg),
      n(se),
      n(s.idTeam),
      n(s.strTeam),
      n(s.intRank),
      n(s.intPlayed),
      n(s.intWin),
      n(s.intLoss),
      n(s.intDraw),
      n(s.intGoalsFor),
      n(s.intGoalsAgainst),
      n(s.intGoalDifference),
      n(s.intPoints),
      n(s.strForm),
      n(s.strDescription),
      n(s.strBadge),
    )
    .run();
}
async function iL(e) {
  const d = await fa("all_leagues.php", e);
  if (!d) return { imported: 0 };
  const ls = d.leagues || [];
  let c = 0;
  for (const l of ls)
    if (l.strSport === "Soccer") {
      await uL(e.SPORTS_DB, l);
      c++;
    }
  await logI(e.SPORTS_DB, "all_leagues", "ok", c, c + " leagues");
  return { imported: c };
}
async function iT(e, li) {
  try {
    const d = await fa("lookup_all_teams.php?id=" + li, e);
    if (!d) {
      await logI(e.SPORTS_DB, "teams", "empty", 0, "league " + li);
      return { imported: 0 };
    }
    const ts = d.teams || [];
    if (ts.length === 0) {
      await logI(e.SPORTS_DB, "teams", "empty", 0, "league " + li);
      return { imported: 0 };
    }
    for (const t of ts) {
      try {
        await uT(e.SPORTS_DB, t);
      } catch (insErr) {
        await logI(e.SPORTS_DB, "teams_insert", "error", 0, "league " + li + ": " + insErr.message);
        throw insErr;
      }
    }
    await logI(e.SPORTS_DB, "teams", "ok", ts.length, "league " + li);
    return { imported: ts.length };
  } catch (err) {
    await logI(e.SPORTS_DB, "teams", "error", 0, "league " + li + ": " + err.message);
    throw err;
  }
}
async function iP(e, ti) {
  const d = await fa("lookup_all_players.php?id=" + ti, e);
  if (!d) return { imported: 0 };
  const ps = d.player || [];
  for (const p of ps) {
    p.idTeam = ti;
    await uP(e.SPORTS_DB, p);
  }
  await logI(e.SPORTS_DB, "players", "ok", ps.length, "team " + ti);
  return { imported: ps.length };
}
async function iEN(e, li) {
  const d = await fa("eventsnextleague.php?id=" + li, e);
  if (!d) return { imported: 0 };
  const ev = d.events || [];
  for (const v of ev) await uE(e.SPORTS_DB, v);
  await logI(e.SPORTS_DB, "enl", "ok", ev.length, "league " + li);
  return { imported: ev.length };
}
async function iEP(e, li) {
  const d = await fa("eventspastleague.php?id=" + li, e);
  if (!d) return { imported: 0 };
  const ev = d.events || [];
  for (const v of ev) await uE(e.SPORTS_DB, v);
  await logI(e.SPORTS_DB, "epl", "ok", ev.length, "league " + li);
  return { imported: ev.length };
}
async function iS(e, li, se) {
  const d = await fa("lookuptable.php?l=" + li + "&s=" + se, e);
  if (!d) return { imported: 0 };
  const tb = d.table || [];
  const li2 = await e.SPORTS_DB.prepare("SELECT strLeague FROM sportsdb_leagues WHERE idLeague=?")
    .bind(li)
    .first();
  const lg = li2?.strLeague || "";
  for (const s of tb) await uS(e.SPORTS_DB, s, li, lg, se);
  await logI(e.SPORTS_DB, "standings", "ok", tb.length, "league " + li);
  return { imported: tb.length };
}
async function getS(e, ph) {
  try {
    const r = await e.SPORTS_DB.prepare(
      "SELECT offset_val FROM sportsdb_import_state WHERE phase=?",
    )
      .bind(ph)
      .first();
    return r?.offset_val || 0;
  } catch (x) {
    return 0;
  }
}
async function setS(e, ph, v) {
  try {
    await e.SPORTS_DB.prepare(
      "INSERT OR REPLACE INTO sportsdb_import_state(phase,offset_val,updated_at)VALUES(?,?,datetime('now'))",
    )
      .bind(ph, v)
      .run();
  } catch (x) {}
}
async function iAll(e, st = 1) {
  const R = [];
  const failFast = (x) => {
    if (x && typeof x.code === "string" && x.code.startsWith("SPORTSDB_")) throw x;
  };
  if (st <= 1) R.push(await iL(e));
  if (st <= 2) {
    const ls = await e.SPORTS_DB.prepare(
      "SELECT idLeague FROM sportsdb_leagues ORDER BY idLeague",
    ).all();
    let c = 0;
    for (const l of ls.results)
      try {
        c += (await iT(e, l.idLeague)).imported;
      } catch (x) {
        failFast(x);
        R.push({ err: "Team import failed" });
      }
    R.push({ stage: "teams", total: c });
  }
  if (st <= 3) {
    const ls = await e.SPORTS_DB.prepare(
      "SELECT idLeague FROM sportsdb_leagues ORDER BY idLeague",
    ).all();
    let c = 0;
    for (const l of ls.results) {
      try {
        c += (await iEN(e, l.idLeague)).imported;
      } catch (x) {
        failFast(x);
      }
      try {
        c += (await iEP(e, l.idLeague)).imported;
      } catch (x) {
        failFast(x);
      }
    }
    R.push({ stage: "events", total: c });
  }
  if (st <= 4) {
    const ls = await e.SPORTS_DB.prepare(
      "SELECT idLeague,strCurrentSeason FROM sportsdb_leagues WHERE strCurrentSeason IS NOT NULL",
    ).all();
    let c = 0;
    for (const l of ls.results)
      try {
        c += (await iS(e, l.idLeague, l.strCurrentSeason || "2025-2026")).imported;
      } catch (x) {
        failFast(x);
      }
    R.push({ stage: "standings", total: c });
  }
  if (st <= 5) {
    const ts = await e.SPORTS_DB.prepare(
      "SELECT idTeam FROM sportsdb_teams ORDER BY idTeam LIMIT 500",
    ).all();
    let c = 0;
    for (const t of ts.results)
      try {
        c += (await iP(e, t.idTeam)).imported;
      } catch (x) {
        failFast(x);
      }
    R.push({ stage: "players", total: c });
  }
  return { stages: R, completed: true };
}
async function iCron(e) {
  const db = e.SPORTS_DB;
  const paused = await readSportsDbPause(db);
  if (paused)
    return {
      status: "paused",
      reason: paused.reason,
      retry_at: new Date(paused.retryAt).toISOString(),
    };
  const now = Date.now();
  await pruneSportsDbApiRequests(db, now);
  const R = [];
  const leagueRefresh = await db
    .prepare("SELECT updated_at FROM sportsdb_import_state WHERE phase='leagues_refreshed'")
    .first();
  const refreshedAt = leagueRefresh?.updated_at
    ? Date.parse(String(leagueRefresh.updated_at).replace(" ", "T") + "Z")
    : 0;
  if (!refreshedAt || now - refreshedAt >= 24 * 60 * 60 * 1000) {
    try {
      R.push(await iL(e));
      await setS(e, "leagues_refreshed", 0);
    } catch (error) {
      await logI(db, "all_leagues", "error", 0, error.message);
      if (!error?.code || !String(error.code).startsWith("SPORTSDB_")) {
        const retryAt = Date.now() + 5 * 60 * 1000;
        await pauseSportsDbImporter(db, "League import stopped after an error", retryAt);
        return {
          status: "paused",
          reason: "League import stopped after an error",
          retry_at: new Date(retryAt).toISOString(),
        };
      }
      return {
        status: "paused",
        reason: error.message,
        retry_at: error.retryAt ? new Date(error.retryAt).toISOString() : undefined,
      };
    }
  }
  const ls = await db.prepare("SELECT idLeague FROM sportsdb_leagues ORDER BY idLeague").all();
  let off = await getS(e, "teams");
  const lsArr = ls.results || [];
  if (lsArr.length === 0) return { status: "stalled", stages: R };
  const batch = lsArr.slice(off, off + 5);
  let tc = 0;
  for (const l of batch) {
    try {
      tc += (await iT(e, l.idLeague)).imported;
    } catch (error) {
      if (!error?.code || !String(error.code).startsWith("SPORTSDB_")) {
        const retryAt = Date.now() + 5 * 60 * 1000;
        await pauseSportsDbImporter(db, "Team import stopped after an error", retryAt);
        return {
          status: "paused",
          reason: "Team import stopped after an error",
          retry_at: new Date(retryAt).toISOString(),
        };
      }
      return {
        status: "paused",
        reason: error.message,
        retry_at: error.retryAt ? new Date(error.retryAt).toISOString() : undefined,
      };
    }
  }
  off += batch.length;
  if (off >= lsArr.length) off = 0;
  await setS(e, "teams", off);
  R.push({ stage: "teams", batch: batch.length, offset: off, total: tc });
  return { status: "active", stages: R };
}
async function initSchema(e) {
  const st = SCHEMA_SQL.trim()
    .split(";")
    .filter((s) => s.trim())
    .map((s) => e.SPORTS_DB.prepare(s));
  await e.SPORTS_DB.batch(st);
  return { schema: "ok" };
}
export default {
  async fetch(req, e, ctx) {
    const u = new URL(req.url),
      ph = u.pathname,
      p = u.searchParams;
    if (req.method === "OPTIONS")
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    const sec = p.get("secret") || req.headers.get("X-Import-Secret");
    if ((ph.startsWith("/import") || ph === "/init") && sec !== e.THESPORTSDB_IMPORT_SECRET)
      return j({ error: "Unauthorized" }, 401);
    try {
      if (ph === "/" || ph === "")
        return new Response("<h1>TheSportsDB Importer</h1>", {
          headers: { "Content-Type": "text/html" },
        });
      if (ph === "/init") return j(await initSchema(e));
      if (ph.startsWith("/import")) await initSchema(e);
      if (ph === "/import/leagues") return j(await iL(e));
      if (ph === "/import/teams") return j(await iT(e, p.get("leagueId")));
      if (ph === "/import/players") return j(await iP(e, p.get("teamId")));
      if (ph === "/import/events/next") return j(await iEN(e, p.get("leagueId")));
      if (ph === "/import/events/past") return j(await iEP(e, p.get("leagueId")));
      if (ph === "/import/standings") return j(await iS(e, p.get("leagueId"), p.get("season")));
      if (ph === "/import/all") return j(await iAll(e, parseInt(p.get("stage") || "1")));
      if (ph === "/api/status") {
        await initSchema(e);
        const c = {};
        for (const t of ["leagues", "teams", "players", "events", "standings"]) {
          const r = await e.SPORTS_DB.prepare("SELECT COUNT(*) as c FROM sportsdb_" + t).first();
          c[t] = r?.c || 0;
        }
        const now = Date.now();
        const usage = await e.SPORTS_DB.prepare(
          "SELECT SUM(CASE WHEN requested_at_ms>?-60000 THEN 1 ELSE 0 END) AS requests_last_minute,SUM(CASE WHEN requested_at_ms>?-86400000 THEN 1 ELSE 0 END) AS requests_last_24h,MAX(requested_at_ms) AS last_request_at_ms,MAX(CASE WHEN response_status BETWEEN 200 AND 299 THEN requested_at_ms END) AS last_successful_response_at_ms FROM sportsdb_api_request_log",
        )
          .bind(now, now)
          .first();
        const pause = await readSportsDbPause(e.SPORTS_DB, now);
        const progress = await e.SPORTS_DB.prepare(
          "SELECT offset_val,updated_at FROM sportsdb_import_state WHERE phase='teams'",
        ).first();
        const asMs = (v) => {
          if (!v) return 0;
          const value = String(v).replace(" ", "T");
          return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : value + "Z") || 0;
        };
        const lastSuccess = Number(usage?.last_successful_response_at_ms) || 0;
        const progressAt = asMs(progress?.updated_at);
        const active =
          !pause && lastSuccess > now - 10 * 60 * 1000 && progressAt > now - 10 * 60 * 1000;
        const importer = {
          status: pause ? "paused" : active ? "active" : "stalled",
          reason: pause?.reason || null,
          retry_at: pause ? new Date(pause.retryAt).toISOString() : null,
          cursor: {
            entity: "teams",
            offset: progress?.offset_val ?? null,
            updated_at: progress?.updated_at ?? null,
          },
          api_requests: {
            last_minute: Number(usage?.requests_last_minute) || 0,
            last_24_hours: Number(usage?.requests_last_24h) || 0,
            limit_per_minute: 450,
            limit_per_24_hours: 75000,
            last_request_at: usage?.last_request_at_ms
              ? new Date(Number(usage.last_request_at_ms)).toISOString()
              : null,
            last_successful_response_at: lastSuccess ? new Date(lastSuccess).toISOString() : null,
          },
        };
        const lg = await e.SPORTS_DB.prepare(
          "SELECT * FROM sportsdb_import_log ORDER BY id DESC LIMIT 20",
        ).all();
        return j({ counts: c, importer, recent_imports: lg.results });
      }
      if (ph === "/api/leagues")
        return j(
          (await e.SPORTS_DB.prepare("SELECT * FROM sportsdb_leagues ORDER BY strLeague").all())
            .results,
        );
      if (ph === "/api/teams")
        return j(
          (
            await e.SPORTS_DB.prepare(
              "SELECT * FROM sportsdb_teams WHERE idLeague=? ORDER BY strTeam",
            )
              .bind(p.get("leagueId"))
              .all()
          ).results,
        );
      if (ph === "/api/players")
        return j(
          (
            await e.SPORTS_DB.prepare(
              "SELECT * FROM sportsdb_players WHERE idTeam=? ORDER BY strPlayer",
            )
              .bind(p.get("teamId"))
              .all()
          ).results,
        );
      if (ph === "/api/events/next")
        return j(
          (
            await e.SPORTS_DB.prepare(
              "SELECT * FROM sportsdb_events WHERE idLeague=? AND dateEvent>=date('now') ORDER BY dateEvent",
            )
              .bind(p.get("leagueId"))
              .all()
          ).results,
        );
      if (ph === "/api/events/past")
        return j(
          (
            await e.SPORTS_DB.prepare(
              "SELECT * FROM sportsdb_events WHERE idLeague=? AND dateEvent<date('now') ORDER BY dateEvent DESC",
            )
              .bind(p.get("leagueId"))
              .all()
          ).results,
        );
      if (ph === "/api/standings")
        return j(
          (
            await e.SPORTS_DB.prepare(
              "SELECT * FROM sportsdb_standings WHERE idLeague=? AND strSeason=? ORDER BY intRank",
            )
              .bind(p.get("leagueId"), p.get("season"))
              .all()
          ).results,
        );
      if (ph === "/api/team")
        return j(
          await e.SPORTS_DB.prepare("SELECT * FROM sportsdb_teams WHERE idTeam=?")
            .bind(p.get("id"))
            .first(),
        );
      if (ph === "/api/player")
        return j(
          await e.SPORTS_DB.prepare("SELECT * FROM sportsdb_players WHERE idPlayer=?")
            .bind(p.get("id"))
            .first(),
        );
      if (ph === "/api/search/teams")
        return j(
          (
            await e.SPORTS_DB.prepare(
              "SELECT * FROM sportsdb_teams WHERE strTeam LIKE ? ORDER BY strTeam",
            )
              .bind("%" + p.get("name") + "%")
              .all()
          ).results,
        );
      if (ph === "/api/search/players")
        return j(
          (
            await e.SPORTS_DB.prepare(
              "SELECT * FROM sportsdb_players WHERE strPlayer LIKE ? ORDER BY strPlayer",
            )
              .bind("%" + p.get("name") + "%")
              .all()
          ).results,
        );
      return j({ error: "Not found", path: ph }, 404);
    } catch (err) {
      const status =
        err?.code === "SPORTSDB_QUOTA"
          ? 429
          : err?.code === "SPORTSDB_LEDGER"
            ? 503
            : err?.code === "SPORTSDB_CONFIG" || err?.code === "SPORTSDB_UPSTREAM_PAUSED"
              ? 503
              : 500;
      const message = String(err?.message || "Import failed").slice(0, 180);
      return j(
        {
          error: message,
          retry_at: err?.retryAt ? new Date(err.retryAt).toISOString() : undefined,
        },
        status,
      );
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        try {
          await initSchema(env);
          const r = await iCron(env);
          console.log("Cron result:", JSON.stringify(r));
        } catch (err) {
          console.error("Scheduled import error:", err.message);
          try {
            await logI(env.SPORTS_DB, "cron", "error", 0, err.message);
          } catch (x) {}
        }
      })(),
    );
  },
};
