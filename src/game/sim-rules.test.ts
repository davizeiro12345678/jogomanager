import { describe, expect, it } from "vitest";

import { buildTeamSetup } from "./quickMatch";
import { makeRng } from "./rng";
import {
  LIVE_MATCH_CLOCK_SCALE,
  MATCH_SIMULATION_STEP,
  MATCH_SIMULATION_TICK_LIMIT,
  MatchSim,
} from "./sim";
import {
  aiMentalityTweak,
  aiSubPick,
  cardForFoul,
  clockText,
  defensiveLineX,
  duelMult,
  isOffside,
  REFEREES,
  shootoutWinner,
  solveCornerDuel,
  solveDirectFK,
  solvePenalty,
  xgForShot,
} from "./sim-rules";

describe("xgForShot", () => {
  it("valoriza perto e livre, pune longe e marcado", () => {
    const near = xgForShot({ dist: 8, wide: 2, bodyPart: "foot", pressDist: 6, onRun: true });
    const far = xgForShot({ dist: 28, wide: 10, bodyPart: "foot", pressDist: 1, onRun: false });
    expect(near).toBeGreaterThan(0.2);
    expect(far).toBeLessThan(0.08);
    expect(near).toBeGreaterThan(far);
  });
});

describe("impedimento", () => {
  it("marca além da linha só no campo de ataque", () => {
    const line = defensiveLineX(
      [
        { x: 40, side: "away", pos: "GK", sentOff: false },
        { x: 20, side: "away", pos: "DF", sentOff: false },
        { x: 18, side: "away", pos: "DF", sentOff: false },
      ],
      "home",
    );
    expect(line).toBe(20);
    expect(isOffside(25, line, 1)).toBe(true);
    expect(isOffside(15, line, 1)).toBe(false);
    expect(isOffside(-5, line, 1)).toBe(false);
  });
});

describe("árbitro", () => {
  it("expulsa quem nega gol claro e amarela mais com rigor", () => {
    const rnd = makeRng("ref");
    let reds = 0;
    for (let i = 0; i < 100; i++) {
      if (
        cardForFoul({
          slide: true,
          tactical: false,
          goalDenied: true,
          rapSheet: 0,
          ref: REFEREES[1]!,
          rnd,
        }) === "red"
      )
        reds++;
    }
    expect(reds).toBeGreaterThan(40);
    const soft = cardForFoul({
      slide: false,
      tactical: false,
      goalDenied: false,
      rapSheet: 0,
      ref: REFEREES[0]!,
      rnd: () => 0.5,
    });
    const hard = cardForFoul({
      slide: true,
      tactical: true,
      goalDenied: false,
      rapSheet: 2,
      ref: REFEREES[3]!,
      rnd: () => 0.4,
    });
    expect(soft).toBe("none");
    expect(hard).toBe("yellow");
  });
});

describe("bolas paradas", () => {
  it("pênalti converte ~75% e pressão derruba", () => {
    const rnd = makeRng("pen");
    let scored = 0;
    for (let i = 0; i < 600; i++) {
      if (solvePenalty({ taker: 75, gk: 75, pressure: 0.25, rnd }).scored) scored++;
    }
    expect(scored / 600).toBeGreaterThan(0.6);
    expect(scored / 600).toBeLessThan(0.9);
  });

  it("falta direta raramente entra e às vezes explode na barreira", () => {
    const rnd = makeRng("fk");
    let goals = 0;
    let walls = 0;
    for (let i = 0; i < 400; i++) {
      const out = solveDirectFK({ dist: 20, central: true, taker: 80, wall: 3, gk: 75, rnd });
      if (out.result === "goal") goals++;
      if (out.result === "wall") walls++;
    }
    expect(goals / 400).toBeLessThan(0.2);
    expect(walls).toBeGreaterThan(20);
  });

  it("escanteio divide entre ataque, defesa e goleiro", () => {
    const rnd = makeRng("corner");
    const wins = { attack: 0, defense: 0, gk: 0 };
    for (let i = 0; i < 400; i++) {
      wins[solveCornerDuel({ attack: 300, defense: 320, gkComes: true, gk: 75, rnd }).winner]++;
    }
    expect(wins.attack).toBeGreaterThan(40);
    expect(wins.defense).toBeGreaterThan(100);
    expect(wins.gk).toBeGreaterThan(20);
  });
});

describe("shootoutWinner", () => {
  it("encerra cedo no inalcançável e decide na morte súbita", () => {
    const k = (side: "home" | "away", scored: boolean, n: number) =>
      Array.from({ length: n }, (_, i) => ({ side, name: `${side}${i}`, scored }));
    expect(shootoutWinner([...k("home", true, 3), ...k("away", false, 3)])).toBe("home");
    const tied5 = [...k("home", true, 4), ...k("away", true, 4)];
    expect(shootoutWinner(tied5)).toBe(null);
    expect(
      shootoutWinner([
        ...tied5,
        { side: "home", name: "h5", scored: true } as const,
        { side: "away", name: "a5", scored: false } as const,
      ]),
    ).toBe("home");
  });
});

describe("IA do treinador", () => {
  const lineup = (over: Partial<{ stamina: number; injuryWeeks: number }> = {}) =>
    Array.from({ length: 11 }, (_, i) => ({
      id: `h-p${i}`,
      pid: `p${i}`,
      pos: i === 0 ? "GK" : i < 5 ? "DF" : i < 8 ? "MF" : "FW",
      stamina: 80,
      injuryWeeks: 0,
      sentOff: false,
      yellows: 0,
      ovr: 75,
      ...over,
    }));
  const bench = () => [
    { id: "b1", pos: "FW", ovr: 74, condition: 90, injuryWeeks: 0, suspended: false },
    { id: "b2", pos: "MF", ovr: 73, condition: 90, injuryWeeks: 0, suspended: false },
  ];

  it("não mexe antes dos 50' e tira lesionado na hora", () => {
    const rnd = makeRng("ai");
    expect(aiSubPick(lineup(), bench(), 0, 40, 0, rnd)).toBe(null);
    const hurt = lineup();
    hurt[9]!.injuryWeeks = 2;
    const pick = aiSubPick(hurt, bench(), 0, 60, 0, rnd);
    expect(pick?.outPid).toBe("p9");
  });

  it("perdendo põe atacante, com 10 fecha o time", () => {
    const rnd = makeRng("ai2");
    const pick = aiSubPick(lineup(), bench(), -1, 70, 1, () => 0.1);
    expect(pick?.inId).toBe("b1");
    expect(aiMentalityTweak(-1, 65, 0)).toMatchObject({ mentality: 1 });
    expect(aiMentalityTweak(1, 75, 0)).toMatchObject({ mentality: -1 });
    expect(aiMentalityTweak(0, 60, 1)).toMatchObject({ mentality: -1 });
    expect(aiMentalityTweak(0, 40, 0)).toBe(null);
    expect(rnd()).toBeDefined();
  });
});

describe("contexto e relógio", () => {
  it("mando e moral ajudam no duelo", () => {
    expect(duelMult({ home: true, morale: 80 })).toBeGreaterThan(
      duelMult({ home: false, morale: 80 }),
    );
    expect(duelMult({ home: true, morale: 90 })).toBeGreaterThan(
      duelMult({ home: true, morale: 40 }),
    );
  });

  it("formata 45+2', 90+3' e PEN", () => {
    expect(clockText("first", 47 * 60, 3, 4, 0)).toBe("45+2'");
    expect(clockText("second", 93 * 60, 2, 4, 0)).toBe("90+3'");
    expect(clockText("et1", 100 * 60, 2, 4, 1)).toBe("100'");
    expect(clockText("shootout", 0, 0, 0, 0)).toBe("PEN");
  });
});

describe("integração do motor (Ciclo 2)", () => {
  function play(seed: string, knockout = false) {
    const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), seed, { knockout });
    let guard = 0;
    while (!sim.finished && guard++ < MATCH_SIMULATION_TICK_LIMIT)
      sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
    return sim;
  }

  it("joga 1º, intervalo e 2º tempo até o apito", () => {
    const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "full-phases");
    const seen = new Set<string>();
    let guard = 0;
    while (!sim.finished && guard++ < 20_000) {
      seen.add(sim.phase);
      sim.step(0.5);
    }
    expect(sim.finished).toBe(true);
    expect(sim.phase).toBe("done");
    expect([...seen]).toEqual(expect.arrayContaining(["first", "half", "second"]));
  });

  it("mata-mata empatado vai à prorrogação ou aos pênaltis", () => {
    let sawET = false;
    for (let i = 0; i < 6; i++) {
      const sim = play(`ko-${i}`, true);
      expect(sim.finished).toBe(true);
      if (sim.shootout.length > 0 || sim.events.some((e) => e.text.includes("prorrogação")))
        sawET = true;
    }
    expect(sawET).toBe(true);
  });

  it("disputa forçada sempre encontra um vencedor", () => {
    const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "shootout-force");
    sim.phase = "shootout";
    let guard = 0;
    while (!sim.finished && guard++ < 500) sim.step(0.4);
    expect(sim.finished).toBe(true);
    expect(sim.shootout.length).toBeGreaterThanOrEqual(6);
    expect(shootoutWinner(sim.shootout)).not.toBe(null);
  });

  it("calibração: números da partida dentro do plausível", () => {
    let goals = 0;
    let shots = 0;
    let fouls = 0;
    let xg = 0;
    for (let i = 0; i < 6; i++) {
      const sim = play(`calib-${i}`);
      goals += sim.stats.home.goals + sim.stats.away.goals;
      shots += sim.stats.home.shots + sim.stats.away.shots;
      fouls += sim.stats.home.fouls + sim.stats.away.fouls;
      xg += sim.stats.home.xg + sim.stats.away.xg;
      // xG acompanha os chutes; cartões e pênaltis contam nos dois lados
      expect(sim.stats.home.xg).toBeGreaterThanOrEqual(0);
      expect(sim.stats.home.shots).toBeGreaterThanOrEqual(sim.stats.home.goals);
    }
    expect(goals / 6).toBeGreaterThan(0.5);
    expect(goals / 6).toBeLessThan(7);
    expect(shots / 6).toBeGreaterThan(goals / 6);
    expect(fouls / 6).toBeGreaterThan(2);
    expect(xg / 6).toBeGreaterThan(0.5);
  });
});
