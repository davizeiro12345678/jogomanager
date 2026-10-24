import fs from "node:fs";
import path from "node:path";
const root = path.resolve("verification/realism-data-20261022");
const read = (file) =>
  fs.existsSync(path.join(root, file))
    ? JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""))
    : null;
const checks = [];
const add = (name, status, detail, evidence) => checks.push({ name, status, detail, evidence });
const setup = read("after/match-setup/match-setup.json");
add(
  "MatchSim no mesmo computador",
  setup?.budget?.failed === false ? "aprovado" : "pendente",
  "ABBA, 62 amostras por versão e 21 checkpoints iguais. O IC de 99% inclui ausência de diferença; não comprova ganho de velocidade.",
  "after/match-setup/match-setup.json",
);
const app = read("after/app/checks.json");
const appPassed =
  app?.checks?.length === 9 &&
  app.errors.length === 0 &&
  !app.failures.some((r) => !r.url.includes("/__l5e/assets-v1/")) &&
  app.checks.some((r) => r.route === "club-mobile" && r.overflow === false) &&
  app.checks.some((r) => r.route === "match-camera" && r.changed === true);
add(
  "Navegação e celular",
  appPassed ? "aprovado" : "falhou",
  "Carreira isolada: clube, elenco, táticas, transferências, câmera, formação persistida e largura de 390 px. Texturas 3D usam fallback controlado igual ao dos ensaios.",
  "after/app/checks.json",
);
for (const [label, folder] of [
  ["Intel Iris Xe", "after-live-extended"],
  ["RTX 4060 Laptop", "after-live-extended-nvidia"],
]) {
  const sample = read(folder + "/browser-metrics.json")?.samples?.at(-1);
  const passed = sample && sample.fps >= 45 && sample.p95 <= 28;
  add(
    "Alta ao vivo · " + label,
    sample ? (passed ? "parcial" : "falhou") : "pendente",
    sample
      ? `${sample.fps.toFixed(2)} FPS; p95 ${sample.p95} ms. 60 s aquecimento + 300 s captura; uma execução. Meta 45 FPS/p95 ≤ 28 ms; faltam as três repetições e assets publicados.`
      : "Amostra ausente.",
    folder + "/browser-metrics.json",
  );
}
const catalog = read("after/catalog-readonly-final.json");
add(
  "Contrato SQL esportivo em produção",
  catalog?.result?.isError === false ? "aprovado" : "pendente",
  "Transação somente leitura: 28 fases, aliases válidos, RLS/views invoker, payloads privados e RPCs restritas ao servidor.",
  "after/catalog-readonly-final.json",
);
const release = read("after/release-contracts.json");
add(
  "Contrato de segurança preexistente",
  release?.existingProductionSecurityContract?.passed ? "aprovado" : "falhou",
  "A versão canônica 20261020101601 não consta no histórico remoto. Diagnóstico separado também encontrou 8 cupons previsíveis ativos; não houve alteração em comércio, carteira ou autenticação nesta atualização esportiva.",
  "after/security-diagnostic-latest.json",
);
add(
  "Replay SQL e fixtures descartáveis",
  "pendente",
  "Docker, PostgreSQL e Supabase CLI indisponíveis neste computador. Fixtures de perfis/aliases/estádios preparadas e adicionadas ao workflow; não executadas contra produção.",
  "after/release-contracts.json",
);
add(
  "Audição das vozes do provedor",
  "pendente",
  "Rotação, papéis, fallback e deadlines testados com transporte simulado. Não foi feita audição de áudio sintetizado real.",
  "after/voice-club-tests.log",
);
add(
  "Publicação e SHA exato",
  "pendente",
  "Aplicativo e Edge Function locais ainda não entregues. O health observado estava pronto em outra revisão; não confirma esta atualização no site.",
  "after/release-contracts.json",
);
const lh = read("after/lighthouse-status.json");
for (const stage of ["desktop", "mobile-0", "mobile-1", "mobile-2", "mobile-3", "mobile-4"]) {
  const run = lh?.runs?.find((r) => r.id === stage);
  add(
    "Lighthouse · " + stage,
    run ? (run.exitCode === 0 && run.completed ? "aprovado" : "falhou") : "pendente",
    run
      ? `${run.urls.join(", ")} · ${run.reports}/${run.expected} relatórios. Mesmas asserções originais; páginas móveis com três execuções e avaliação pessimista.`
      : "Auditoria ainda não concluída.",
    run?.evidence ?? "after/lighthouse-status.json",
  );
}
const result = { generatedAt: new Date().toISOString(), checks };
fs.writeFileSync(path.join(root, "after/quality-supplement.json"), JSON.stringify(result, null, 2));
console.log(
  JSON.stringify({
    checks: checks.length,
    states: checks.reduce(
      (counts, r) => ({ ...counts, [r.status]: (counts[r.status] ?? 0) + 1 }),
      {},
    ),
  }),
);
