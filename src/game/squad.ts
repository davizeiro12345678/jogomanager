import { CLUBS } from "./data/leagues";
import { NAMED_SQUADS } from "./data/squads";
import { poolForLeague } from "./data/names";
import { makeRng } from "./rng";
import type { Club, Player, Position } from "./types";

const SHAPE: Position[] = [
  "GK",
  "DF",
  "DF",
  "DF",
  "DF",
  "MF",
  "MF",
  "MF",
  "FW",
  "FW",
  "FW",
  "MF",
  "DF",
  "GK",
  "FW",
  "MF",
];

function attrsFor(pos: Position, ovr: number, rnd: () => number) {
  const j = (v: number) => Math.max(35, Math.min(99, Math.round(v + (rnd() * 8 - 4))));
  switch (pos) {
    case "GK":
      return {
        pace: j(ovr - 20),
        shooting: j(ovr - 40),
        passing: j(ovr - 12),
        defending: j(ovr),
        physical: j(ovr - 4),
      };
    case "DF":
      return {
        pace: j(ovr - 4),
        shooting: j(ovr - 25),
        passing: j(ovr - 8),
        defending: j(ovr + 4),
        physical: j(ovr + 3),
      };
    case "MF":
      return {
        pace: j(ovr - 2),
        shooting: j(ovr - 6),
        passing: j(ovr + 4),
        defending: j(ovr - 5),
        physical: j(ovr - 2),
      };
    default:
      return {
        pace: j(ovr + 3),
        shooting: j(ovr + 4),
        passing: j(ovr - 4),
        defending: j(ovr - 22),
        physical: j(ovr - 2),
      };
  }
}

function makePlayer(
  club: Club,
  index: number,
  name: string,
  pos: Position,
  age: number,
  ovr: number,
  rnd: () => number,
): Player {
  return {
    id: `${club.id}-${index}`,
    clubId: club.id,
    name,
    pos,
    age,
    number: index === 0 ? 1 : index + 1,
    ovr,
    ...attrsFor(pos, ovr, rnd),
    condition: 88 + Math.floor(rnd() * 12),
    morale: 70 + Math.floor(rnd() * 25),
    goals: 0,
    assists: 0,
    apps: 0,
  };
}

export function buildSquad(clubId: string): Player[] {
  const club = CLUBS[clubId]!;
  const rnd = makeRng(`squad-${clubId}`);
  const named = NAMED_SQUADS[clubId];
  const players: Player[] = [];

  if (named) {
    named.split(";").forEach((entry, i) => {
      const [pos, name, age, ovr] = entry.split("|");
      players.push(
        makePlayer(club, i, name!, pos as Position, Number(age), Number(ovr), rnd),
      );
    });
  }

  const pool = poolForLeague(club.league);
  const used = new Set(players.map((p) => p.name));
  let i = players.length;
  while (players.length < 18) {
    const pos = SHAPE[players.length % SHAPE.length]!;
    let name = "";
    let guard = 0;
    do {
      name = `${pool.first[Math.floor(rnd() * pool.first.length)]} ${pool.last[Math.floor(rnd() * pool.last.length)]}`;
      guard++;
    } while (used.has(name) && guard < 40);
    used.add(name);
    const base = club.strength - 6 - Math.floor(rnd() * 9);
    players.push(
      makePlayer(club, i, name, pos, 19 + Math.floor(rnd() * 15), Math.max(58, base), rnd),
    );
    i++;
  }

  return players;
}
