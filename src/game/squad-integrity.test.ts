// ============================================================================
//  squad-integrity.test.ts
//  Guarda de integridade da base de jogadores. Cada teste cobre uma falha que
//  já apareceu no jogo: elenco sem goleiro, jogador sem posição, idade/overall
//  fora de faixa, camisa repetida, elenco nomeado órfão e tela branca quando
//  o id do clube não existe no catálogo.
// ============================================================================

import { describe, expect, it } from "vitest";
import { CLUBS } from "./data/leagues";
import { NAMED_SQUADS } from "./data/squads";
import { buildSquad, MIN_GOALKEEPERS, SQUAD_SIZE, safeClub } from "./squad";
import { pickLineup } from "./career";
import type { FormationKey, Player } from "./types";

const POSITIONS = new Set(["GK", "DF", "MF", "FW"]);
const FORMATIONS: FormationKey[] = ["4-3-3", "4-4-2", "3-5-2", "4-2-3-1"];

describe("base de jogadores", () => {
  it("todo clube do catálogo gera elenco válido", () => {
    const ids = Object.keys(CLUBS);
    expect(ids.length).toBeGreaterThan(1000);
    for (const id of ids) {
      const squad = buildSquad(id);
      expect(squad.length, `elenco de ${id}`).toBe(SQUAD_SIZE);
      const numbers = new Set<number>();
      const names = new Set<string>();
      for (const p of squad) {
        expect(POSITIONS.has(p.pos), `${id}/${p.name} pos=${p.pos}`).toBe(true);
        expect(Number.isFinite(p.age) && p.age >= 16 && p.age <= 45, `${id}/${p.name} age`).toBe(
          true,
        );
        expect(Number.isFinite(p.ovr) && p.ovr >= 40 && p.ovr <= 99, `${id}/${p.name} ovr`).toBe(
          true,
        );
        for (const a of ["pace", "shooting", "passing", "defending", "physical"] as const) {
          expect(p[a] >= 35 && p[a] <= 99, `${id}/${p.name} ${a}`).toBe(true);
        }
        expect(p.number).toBeGreaterThanOrEqual(1);
        expect(p.number).toBeLessThanOrEqual(99);
        expect(numbers.has(p.number), `camisa repetida ${p.number} em ${id}`).toBe(false);
        numbers.add(p.number);
        expect(names.has(p.name), `nome repetido ${p.name} em ${id}`).toBe(false);
        names.add(p.name);
      }
    }
  });

  it("nenhum clube fica sem goleiro", () => {
    for (const id of Object.keys(CLUBS)) {
      const gks = buildSquad(id).filter((p) => p.pos === "GK");
      expect(gks.length, `goleiros em ${id}`).toBeGreaterThanOrEqual(MIN_GOALKEEPERS);
    }
  });

  it("a escalação nunca coloca jogador de linha no gol", () => {
    for (const id of ["fla", "pal", "vil_e", "cor", "rma", "bar", "bay", "psg"]) {
      const squad = buildSquad(id);
      const byId = new Map(squad.map((p) => [p.id, p]));
      for (const formation of FORMATIONS) {
        const { lineup } = pickLineup(squad, formation);
        expect(lineup.length, `${id} ${formation}`).toBe(11);
        expect(byId.get(lineup[0]!)!.pos, `${id} ${formation} camisa 1`).toBe("GK");
      }
    }
  });

  it("o banco sempre guarda um goleiro enquanto houver dois no elenco", () => {
    const squad = buildSquad("fla");
    const byId = new Map(squad.map((p) => [p.id, p]));
    for (const formation of FORMATIONS) {
      const { bench } = pickLineup(squad, formation);
      expect(bench.length).toBeGreaterThan(0);
      expect(
        bench.some((id) => byId.get(id)!.pos === "GK"),
        formation,
      ).toBe(true);
    }
  });

  it("segue escalando 11 mesmo com os dois goleiros indisponíveis", () => {
    const squad: Player[] = buildSquad("pal").map((p) =>
      p.pos === "GK" ? { ...p, suspended: true } : p,
    );
    const { lineup } = pickLineup(squad, "4-3-3");
    expect(lineup.length).toBe(11);
    expect(new Set(lineup).size).toBe(11);
  });

  it("não quebra com clube fora do catálogo", () => {
    const squad = buildSquad("nao-existe-123");
    expect(squad.length).toBe(SQUAD_SIZE);
    expect(squad.every((p) => POSITIONS.has(p.pos))).toBe(true);
    expect(squad.filter((p) => p.pos === "GK").length).toBeGreaterThanOrEqual(MIN_GOALKEEPERS);
    expect(safeClub("nao-existe-123").name.length).toBeGreaterThan(0);
    expect(safeClub("fla").id).toBe("fla");
  });

  it("nenhum elenco nomeado está órfão", () => {
    for (const id of Object.keys(NAMED_SQUADS)) {
      expect(CLUBS[id], `elenco nomeado sem clube: ${id}`).toBeDefined();
    }
  });

  it("entradas malformadas do catálogo não viram jogadores inválidos", () => {
    // `buildSquad` descarta entradas corrompidas; aqui garantimos o contrato
    // de que o resultado continua íntegro mesmo quando o dado vem torto.
    const squad = buildSquad("sao");
    expect(squad.length).toBe(SQUAD_SIZE);
    expect(squad.every((p) => p.name.trim().length > 0)).toBe(true);
  });

  it("a geração é determinística", () => {
    expect(buildSquad("bot")).toEqual(buildSquad("bot"));
  });
});
