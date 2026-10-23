import fs from "node:fs";
import path from "node:path";
const root = path.resolve("verification/realism-data-20261022");
const read = (file) =>
  fs.existsSync(path.join(root, file))
    ? JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""))
    : null;
function unwrap(d) {
  if (!d?.content) return d;
  const o = JSON.parse(d.content.find((c) => c.type === "text").text);
  if (typeof o.result !== "string") return o.result ?? o;
  const m = o.result.match(
    /<untrusted-data-[^>]+>(?:\\n|\s)*(\[[\s\S]*?\])(?:\\n|\s)*<\/untrusted-data-/,
  );
  return m ? JSON.parse(m[1]) : o;
}
const value = (d) => {
  const v = unwrap(d);
  return Array.isArray(v) ? Object.values(v[0] ?? {})[0] : v;
};
const phases = ["before-native", "midpoint-native", "after-native"];
const native = phases.map((phase) => {
  const d = read(phase + "/browser-metrics.json");
  return { phase, last: d?.samples?.at(-1), errors: d?.errors, renderers: d?.renderers };
});
const longPhases = [
  "before-live-extended",
  "after-live-extended",
  "before-live-extended-nvidia",
  "after-live-extended-nvidia",
];
const long = longPhases.map((phase) => {
  const d = read(phase + "/browser-metrics.json");
  return {
    phase,
    last: d?.samples?.at(-1),
    errors: d?.errors,
    renderers: d?.renderers,
    runtime: d?.runtime,
    browser: d?.browser,
  };
});
const structure = [read("before/structure.json"), read("after/structure.json")];
const db = value(read("after/database-audit-final.json")) ?? {};
const clubs = value(read("after/club-enrichment-final.json")) ?? {};
const venueAudit = read("after/venue-audit-final.json") ?? {};
const planBefore = unwrap(read("before/database-plan.json"))?.[0]?.["QUERY PLAN"]?.[0];
const planAfter = unwrap(read("midpoint/database-plan.json"))?.[0]?.["QUERY PLAN"]?.[0];
const setup = read("after/match-setup/match-setup.json");
const tests = read("after/tests.json");
const bundle = JSON.parse(fs.readFileSync("bundle-impact.json", "utf8"));
const final = read("after/quality-final.json");
const quality = [
  ...(final?.checks ?? []),
  ...(read("after/quality-supplement.json")?.checks ?? []),
];
const lighthouse = read("after/lighthouse-status.json");
const app = read("after/app/checks.json");
const security = read("after/database-security-latest.json");
const performance = read("after/database-performance-latest.json");
const esc = (v) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const rows = [];
function add(group, label, before, mid, after, unit, dir, evidence, note, limit = null) {
  const delta =
    typeof before === "number" && typeof after === "number" && before !== 0
      ? ((after - before) / before) * 100
      : null;
  const state =
    dir === "neutral"
      ? "contexto"
      : delta === null
        ? "documentado"
        : Math.abs(delta) < 0.001
          ? "estável"
          : (delta > 0 && dir === "up") || (delta < 0 && dir === "down")
            ? "melhorou"
            : "regrediu";
  rows.push({ group, label, before, mid, after, unit, delta, state, evidence, note, limit });
}
for (const [label, key, unit, dir] of [
  ["FPS — ensaio curto estático", "fps", "FPS", "up"],
  ["p95 — ensaio curto estático", "p95", "ms", "down"],
  ["Primeiro frame — cenário isolado", "firstFrameMs", "ms", "down"],
  ["Draw calls — ensaio curto", "draws", "draws", "down"],
  ["Triângulos — ensaio curto", "triangles", "triângulos", "down"],
])
  add(
    "Visual",
    label,
    native[0].last?.[key],
    native[1].last?.[key],
    native[2].last?.[key],
    unit,
    dir,
    "after-native/browser-metrics.json",
    "5 s de aquecimento + 30 s. Fixture estática/manual; não equivale ao jogo ao vivo.",
  );
add(
  "Visual",
  "Erros JavaScript — ensaio curto",
  native[0].errors?.length,
  native[1].errors?.length,
  native[2].errors?.length,
  "erros",
  "down",
  "after-native/browser-metrics.json",
  "Mesma configuração nativa Intel nas três versões.",
);
for (const [gpu, a, b] of [
  ["Intel Iris Xe", long[0], long[1]],
  ["RTX 4060 Laptop", long[2], long[3]],
]) {
  for (const [label, key, unit, dir, target] of [
    ["FPS ao vivo", "fps", "FPS", "up", 45],
    ["p95 ao vivo", "p95", "ms", "down", 28],
    ["Primeiro frame", "firstFrameMs", "ms", "down", null],
    ["Draw calls", "draws", "draws", "down", 260],
    ["Triângulos", "triangles", "triângulos", "down", 850000],
    ["Memória JS observada", "heapUsedBytes", "bytes", "down", null],
  ])
    add(
      "Visual",
      gpu + " · " + label,
      a.last?.[key],
      null,
      b.last?.[key],
      unit,
      dir,
      b.phase + "/browser-metrics.json",
      "Alta · 1280×720 · DPR 1 · 60 s aquecimento + 300 s captura. Worker ao vivo; uma execução por versão e placa. Faltam três repetições para certificação.",
      target,
    );
}
add(
  "Visual",
  "Cabelo de alta definição",
  structure[0]?.hair.triangles,
  null,
  structure[1]?.hair.triangles,
  "triângulos",
  "down",
  "after/structure.json",
  "Mesmo seed e cabelo afro; redução de tesselação sem remover o cabelo.",
);
for (const part of ["head", "hair"])
  add(
    "Visual",
    (part === "head" ? "Cabeça" : "Cabelo") + " · construção CPU mediana",
    structure[0]?.[part].medianMs,
    null,
    structure[1]?.[part].medianMs,
    "ms",
    "down",
    "after/structure.json",
    "3 aquecimentos e 30 amostras. Microbenchmark de geometria; não é FPS.",
  );
for (const lang of ["pt", "en", "es"])
  add(
    "Narração",
    "Falas únicas · " + lang,
    structure[0]?.narration[lang].unique,
    null,
    structure[1]?.narration[lang].unique,
    "falas",
    "up",
    "after/structure.json",
    "Frases finais diferentes com o mesmo clube. As 225 repetições antigas não contam como variedade.",
  );
add(
  "Narração",
  "Entradas brutas, incluindo repetições",
  Object.values(structure[0]?.narration ?? {}).reduce((s, x) => s + x.total, 0),
  null,
  Object.values(structure[1]?.narration ?? {}).reduce((s, x) => s + x.total, 0),
  "entradas",
  "neutral",
  "after/structure.json",
  "225 duplicações removidas e 106 falas autorais acrescentadas; o total único aumenta.",
);
add(
  "Simulação",
  "CPU do construtor MatchSim",
  setup?.budget.baselineCpuMs,
  null,
  setup?.budget.candidateCpuMs,
  "ms",
  "down",
  "after/match-setup/match-setup.json",
  "ABBA, 62 amostras por versão e 21 checkpoints. IC de 99% inclui ausência de diferença; sem prova de ganho de velocidade.",
);
for (const r of [
  [
    "Categorias do importador",
    15,
    28,
    db.import_phases ?? 28,
    "categorias",
    "up",
    "28 fases pausadas; suporte não significa histórico completo importado.",
  ],
  [
    "Jogadores originais preservados",
    201677,
    201677,
    db.players_raw,
    "registros",
    "neutral",
    "Linhas originais preservadas; não equivale a pessoas únicas.",
  ],
  [
    "Atletas canônicos disponíveis",
    201245,
    201245,
    db.athletes_visible,
    "atletas",
    "neutral",
    "A redução representa reconciliação de identidades, sem staff ou aliases na lista.",
  ],
  [
    "Aliases de jogadores",
    5,
    5,
    db.player_aliases,
    "aliases",
    "up",
    "5 preexistentes + 5.010 novos pares por nome, nascimento e clube.",
  ],
  [
    "Datas API-Football preenchidas",
    0,
    0,
    db.api_birth_dates,
    "datas",
    "up",
    "109.102 datas do arquivo já existente; campos antes preenchidos preservados.",
  ],
  [
    "Clubes locais com vínculo ao provedor",
    0,
    0,
    db.club_links,
    "clubes",
    "up",
    "Correspondência biunívoca de nome e país; ID, liga, força e carreira mantidos.",
  ],
  [
    "Escudos preenchidos",
    0,
    0,
    clubs.crests_filled,
    "campos",
    "up",
    "Somente campos vazios; valores anteriores na trilha de auditoria.",
  ],
  ["Cidades preenchidas", 0, 0, clubs.cities_filled, "campos", "up", "Somente campos vazios."],
  [
    "Anos de fundação preenchidos",
    0,
    0,
    clubs.founded_filled,
    "campos",
    "up",
    "Somente campos vazios.",
  ],
  [
    "Equipes classificadas como futebol",
    0,
    0,
    db.football_classified,
    "equipes",
    "up",
    "Antes: Unknown. Depois: Soccer. 23 casos sem evidência suficiente continuam pendentes.",
  ],
  [
    "Eventos idênticos com alias",
    0,
    45,
    db.event_aliases,
    "aliases",
    "up",
    "Somente 45 cópias estritamente idênticas em 2026; conflitos de placar/status/estádio preservados.",
  ],
  [
    "Staff no catálogo de atletas",
    427,
    0,
    db.staff_visible,
    "registros",
    "down",
    "Antes: risco no leitor de elenco sem filtro. Depois: filtros nos leitores e na view.",
  ],
  [
    "Grupos com ID do provedor repetido",
    0,
    0,
    db.provider_id_duplicate_groups,
    "grupos",
    "neutral",
    "Chave única source/source_id continua protegida.",
  ],
  [
    "Referências canônicas quebradas",
    0,
    0,
    db.broken_aliases,
    "referências",
    "neutral",
    "Alvo existente e atleta válido; sem cadeia ou ciclo.",
  ],
  [
    "Estádios API-Football públicos",
    null,
    null,
    venueAudit.football_venues,
    "registros",
    "up",
    "13.224 IDs únicos, a partir de 13.246 operações de inclusão/atualização. Arquivo existente; namespace af: evita colisões. Contagem anterior não medida.",
  ],
])
  add(
    "Banco",
    r[0],
    r[1],
    r[2],
    r[3],
    r[4],
    r[5],
    r[0].includes("Estádios")
      ? "after/venue-audit-final.json"
      : /^(Escudos|Cidades|Anos de fundação)/.test(r[0])
        ? "after/club-enrichment-final.json"
        : "after/database-audit-final.json",
    r[6],
  );
add(
  "Banco",
  "Consulta de calendário · execução",
  planBefore?.["Execution Time"],
  planAfter?.["Execution Time"],
  planAfter?.["Execution Time"],
  "ms",
  "down",
  "midpoint/database-plan.json",
  "Uma execução antes/depois; cache quente e consulta específica. Não mede o Supabase inteiro.",
);
add(
  "Banco",
  "Consulta de calendário · blocos em cache",
  planBefore?.Plan?.["Shared Hit Blocks"],
  planAfter?.Plan?.["Shared Hit Blocks"],
  planAfter?.Plan?.["Shared Hit Blocks"],
  "blocos",
  "down",
  "midpoint/database-plan.json",
  "Liga 4569, ORDER BY starts_at DESC, source_id LIMIT 30; índice evita ordenar milhares de linhas.",
);
for (const r of bundle.rows)
  add(
    "Carregamento",
    r.label,
    r.before,
    null,
    r.after,
    "bytes",
    "down",
    "bundle-impact.json",
    "Builds no mesmo Node/dependências. Gzip e Brotli Q6 são estimativas offline; qualquer crescimento reprova o gate.",
  );
for (const run of lighthouse?.runs ?? []) {
  const reports = fs
    .readdirSync(path.join(root, run.folder))
    .filter((file) => file.endsWith(".json") && file !== "manifest.json")
    .map((file) => read(run.folder + "/" + file))
    .filter((report) => report?.lighthouseVersion && !report.runtimeError);
  if (!reports.length) continue;
  for (const [label, get, unit, dir, target] of [
    [
      "Performance mínima",
      (r) => r.categories.performance.score * 100,
      "pontos",
      "up",
      run.id === "desktop" ? 45 : 98,
    ],
    ["Acessibilidade mínima", (r) => r.categories.accessibility.score * 100, "pontos", "up", 90],
    [
      "LCP máximo",
      (r) => r.audits["largest-contentful-paint"].numericValue,
      "ms",
      "down",
      run.id === "desktop" ? null : 2500,
    ],
    [
      "TBT máximo",
      (r) => r.audits["total-blocking-time"].numericValue,
      "ms",
      "down",
      run.id === "desktop" ? null : 200,
    ],
    [
      "CLS máximo",
      (r) => r.audits["cumulative-layout-shift"].numericValue,
      "",
      "down",
      run.id === "desktop" ? null : 0.1,
    ],
  ]) {
    const values = reports.map(get);
    add(
      "Carregamento",
      "Lighthouse " + run.id + " · " + label,
      null,
      null,
      dir === "up" ? Math.min(...values) : Math.max(...values),
      unit,
      dir,
      run.evidence,
      reports.length +
        " execução(ões) do shell público em Worker compilado local. Nenhuma amostra antes equivalente; não mede FPS de partida, backend autenticado ou CWV de usuários reais.",
      target,
    );
  }
}
const gallery = [
  ["match-broadcast", "Estádio e torcida"],
  ["player-face", "Rosto e cabelo"],
  ["player-full", "Corpo inteiro"],
  ["player-kit", "Uniforme"],
  ["player-legs", "Bermuda e pernas"],
  ["player-boots", "Chuteiras"],
  ["player-hands", "Mãos e luvas"],
  ["player-shot", "Finalização"],
  ["match-measured", "Cena medida"],
  ["cutscene", "Cutscene"],
];
const data = {
  generatedAt: new Date().toISOString(),
  baseline: "93c3144",
  rows,
  native,
  long,
  structure,
  db,
  clubs,
  venueAudit,
  setup,
  quality,
  bundle,
  security,
  performance,
  app,
  lighthouse,
  gallery,
};
fs.writeFileSync(path.join(root, "metrics.json"), JSON.stringify(data, null, 2));
const csv = [
  [
    "area",
    "metrica",
    "antes",
    "metade",
    "depois",
    "unidade",
    "variacao_percentual",
    "avaliacao",
    "limite",
    "evidencia",
    "contexto",
  ],
  ...rows.map((r) => [
    r.group,
    r.label,
    r.before ?? "",
    r.mid ?? "",
    r.after ?? "",
    r.unit,
    r.delta ?? "",
    r.state,
    r.limit ?? "",
    r.evidence,
    r.note,
  ]),
]
  .map((r) => r.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(";"))
  .join("\r\n");
fs.writeFileSync(path.join(root, "metrics.csv"), "\uFEFF" + csv);
const css = [
  ":root{color-scheme:dark;--bg:#0b1110;--panel:#142019;--line:#304637;--ink:#eef4eb;--muted:#a9bbac;--lime:#ccff7b;--red:#ffb3a6;--gold:#f4d18c;font:15px/1.55 system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink)}a{color:var(--lime)}button,select,input{font:inherit}button{cursor:pointer}.wrap{max-width:1500px;margin:auto;padding:32px}.eyebrow{font-size:11px;letter-spacing:.17em;text-transform:uppercase;color:var(--lime);font-weight:700}.top{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid var(--line);padding-bottom:20px}.top a{margin-left:18px;font-size:13px}.hero{padding:50px 0 32px;max-width:1050px}h1{font-size:clamp(36px,5.1vw,72px);line-height:1.04;font-weight:620;letter-spacing:-.05em;margin:18px 0 24px}h2{font-size:29px;letter-spacing:-.025em;line-height:1.15;margin:8px 0 20px}h3{font-size:17px;margin:0 0 10px}p{color:var(--muted);max-width:950px}.lede{font-size:19px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.card,.block{border:1px solid var(--line);border-radius:13px;background:var(--panel);padding:23px}.card strong{display:block;font-size:38px;letter-spacing:-.04em;font-weight:620}.card p{font-size:13px;margin:5px 0 0}.notice{margin:22px 0;padding:18px 22px;border-left:3px solid var(--gold);background:#282319;color:#f0dfc4}.notice p{color:inherit;margin:0}.section{padding-top:52px}.section-head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:18px}.gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}figure{margin:0;background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden}figcaption{font-size:13px;padding:14px 16px;font-weight:650}figcaption small{display:block;font-size:11px;color:var(--muted);font-weight:400}.image-button{padding:0;border:0;background:#090e0a;width:100%;display:block}.gallery img{width:100%;height:340px;object-fit:contain;display:block}.compare{display:grid;grid-template-columns:1.45fr 1fr;gap:20px;border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:20px;margin-top:18px}.compare-frame{position:relative;aspect-ratio:16/9;background:#090e0a;overflow:hidden}.compare-frame img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}.compare-frame .over{clip-path:inset(0 50% 0 0)}.compare-frame .line{position:absolute;left:50%;top:0;bottom:0;border-left:2px solid var(--lime)}input[type=range]{width:100%;accent-color:var(--lime)}select,input[type=search]{background:#17271d;color:var(--ink);border:1px solid var(--line);border-radius:7px;padding:10px 12px}.controls{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0}input[type=search]{flex:1;min-width:230px}.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:12px;max-height:740px}table{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}th{position:sticky;top:0;background:#15241a;color:var(--muted);text-transform:uppercase;font-size:10px;letter-spacing:.05em;text-align:left;padding:13px 12px;border-bottom:1px solid var(--line)}td{padding:13px 12px;border-bottom:1px solid #28392d;vertical-align:top}td:first-child{font-weight:600}td small{display:block;color:var(--muted);font-weight:400;max-width:460px;margin-top:5px;line-height:1.45}.metric-table{min-width:1140px}.metric-table td:first-child{min-width:290px}.metric-table td:nth-child(n+2):nth-child(-n+5){white-space:nowrap}.melhorou,.ok{color:var(--lime)}.regrediu,.bad{color:var(--red)}.documentado,.pending{color:var(--gold)}.estável,.contexto{color:var(--muted)}.tag{display:inline-block;border:1px solid var(--line);padding:5px 10px;border-radius:30px;text-transform:uppercase;font-size:10px;letter-spacing:.04em}.grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.block p,.block li{font-size:13px;color:var(--muted)}.block ul{padding-left:20px}.block li{margin-bottom:10px}.bar-row{display:grid;grid-template-columns:170px 1fr 75px;gap:12px;align-items:center;margin:14px 0;font-size:12px}.bar{height:12px;background:#253d2c;overflow:hidden;border-radius:3px}.bar i{display:block;height:100%;background:var(--lime)}.bar-row.base i{background:#638c70}.app-images{display:grid;grid-template-columns:2fr 1fr;gap:16px}.app-images img{width:100%;height:500px;object-fit:contain;object-position:top;background:#090e0a}.timeline{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.timeline article{padding-top:18px;border-top:2px solid var(--line)}.timeline p,.footnote{font-size:12px}.footer{margin-top:54px;padding:24px 0;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}dialog{max-width:96vw;max-height:95vh;background:var(--bg);border:1px solid var(--line);border-radius:10px;color:var(--ink)}dialog::backdrop{background:#000d}dialog img{max-width:90vw;max-height:84vh;object-fit:contain;display:block}dialog button{float:right;background:var(--panel);color:var(--ink);border:0;padding:10px}",
  "@media(max-width:850px){.wrap{padding:20px}.hero{padding:32px 0 20px}h1{font-size:44px}.cards{grid-template-columns:repeat(2,1fr)}.gallery,.compare,.grid2,.app-images,.timeline{grid-template-columns:1fr}.section-head{display:block}.top a{display:block;margin:0 0 4px}.gallery img{height:400px}.bar-row{grid-template-columns:130px 1fr 70px}.section{padding-top:40px}}",
].join("\n");
const section = (number, title, body) =>
  '<section class="section"><span class="eyebrow">' +
  number +
  "</span><h2>" +
  title +
  "</h2>" +
  body +
  "</section>";
const qrows = quality
  .map(
    (r) =>
      "<tr><td>" +
      esc(r.name) +
      '</td><td><span class="tag ' +
      (r.status === "aprovado" ? "ok" : r.status === "falhou" ? "bad" : "pending") +
      '">' +
      esc(r.status) +
      "</span></td><td>" +
      esc(r.detail) +
      '</td><td><a href="' +
      esc(r.evidence) +
      '">prova ↗</a></td></tr>',
  )
  .join("");
const advisorRows = [...(security?.lints ?? []), ...(performance?.lints ?? [])]
  .map(
    (r) =>
      "<tr><td>" +
      esc(r.title) +
      "</td><td>" +
      esc(r.level) +
      "</td><td>" +
      r.count +
      '</td><td><a href="' +
      esc(r.remediation) +
      '" target="_blank" rel="noreferrer">documentação ↗</a></td></tr>',
  )
  .join("");
const photos = phases
  .map(
    (phase, i) =>
      "<figure><figcaption>" +
      ["Antes", "Metade", "Depois"][i] +
      "<small>" +
      ["base intacta", "etapa intermediária", "candidato local"][i] +
      '</small></figcaption><button class="image-button" data-image="' +
      i +
      '"><img id="photo-' +
      i +
      '" src="' +
      phase +
      '/match-broadcast.png" alt="' +
      ["Antes", "Metade", "Depois"][i] +
      ' — estádio e torcida" loading="lazy"></button></figure>',
  )
  .join("");
let html =
  '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JogoManager · Realismo e integridade · Evidências</title><style>' +
  css +
  '</style><body><main class="wrap"><header class="top"><div class="eyebrow">JogoManager / Caderno de verificação</div><nav aria-label="Arquivos"><a href="metrics.csv" download>Tabela CSV ↓</a><a href="metrics.json" download>Dados JSON ↓</a><a href="#gates">Critérios de entrega</a></nav></header>';
html +=
  '<section class="hero"><span class="tag pending">Publicação bloqueada pelos critérios obrigatórios</span><h1>Mais futebol visível.<br>Identidades preservadas.<br>Resultados verificáveis.</h1><p class="lede">Comparativo do jogador, estádio, narração e base esportiva: antes, durante e depois. As fotos são capturas reais do navegador. As medições incluem ganhos, regressões e limites ainda não atingidos.</p><p>Base Git <code>93c3144</code> · candidato em worktree isolado · ' +
  esc(data.generatedAt) +
  ".</p></section>";
html +=
  '<div class="cards">' +
  [
    ["Importador", "15 → 28", "categorias suportadas; 13 novas. Fases pausadas."],
    ["Identidades", "5.010", "novos pares reconciliados; registros originais preservados."],
    ["Dados recuperados", "109.102", "datas de nascimento já disponíveis no arquivo."],
    ["Escudos", "2.341", "clubes locais ligados a identidades verificadas."],
  ]
    .map(
      (r) =>
        '<article class="card"><span class="eyebrow">' +
        r[0] +
        "</span><strong>" +
        r[1] +
        "</strong><p>" +
        r[2] +
        "</p></article>",
    )
    .join("") +
  "</div>";
html +=
  '<aside class="notice"><p><strong>Escopo:</strong> os ensaios 3D usam o mesmo fallback procedural de texturas nas versões, pois os assets publicados não ficaram disponíveis neste ambiente. Ensaios curtos e longos ficam separados. Uma execução por GPU e versão não certifica a campanha de três repetições. O aplicativo e a Edge Function desta atualização não foram publicados.</p></aside>';
html += section(
  "01 / Evidência visual",
  "A mesma cena, em três etapas.",
  '<label>Enquadramento <select id="shot">' +
    gallery.map((r) => '<option value="' + r[0] + '">' + r[1] + "</option>").join("") +
    '</select></label><div class="gallery" style="margin-top:18px">' +
    photos +
    '</div><div class="compare"><div><div class="compare-frame"><img id="compare-before" src="before-native/match-broadcast.png" alt="Antes"><img id="compare-after" class="over" src="after-native/match-broadcast.png" alt="Depois"><div class="line" id="compare-line"></div></div><label for="wipe">Arraste para comparar antes e depois</label><input id="wipe" type="range" min="0" max="100" value="50"></div><div><h3>O que examinar</h3><p>O cabelo preserva a cor sem faixas claras de aliasing. A torcida acompanha a inclinação das arquibancadas e mantém os corredores. Corpo, mãos, uniforme e chuteiras podem ser inspecionados individualmente.</p><p>As fotos mostram o estilo procedural existente. Não foi introduzido um novo asset humano fotogramétrico. Clique em uma foto para ver o arquivo original em maior escala.</p></div></div>',
);
html += section(
  "02 / Medições",
  "O que melhorou, o que regrediu e o que falta.",
  '<div class="controls"><label>Área <select id="group"><option value="">Todas</option>' +
    [...new Set(rows.map((r) => r.group))].map((g) => "<option>" + esc(g) + "</option>").join("") +
    '</select></label><label>Avaliação <select id="state"><option value="">Todas</option>' +
    ["melhorou", "regrediu", "estável", "documentado", "contexto"]
      .map((s) => "<option>" + s + "</option>")
      .join("") +
    '</select></label><input type="search" id="search" aria-label="Buscar métrica" placeholder="Buscar cabelo, FPS, cache, escudo…"></div><div class="table-wrap"><table class="metric-table"><thead><tr><th>Métrica e contexto</th><th>Antes</th><th>Metade</th><th>Depois</th><th>Variação</th><th>Avaliação</th><th>Alvo</th><th>Prova</th></tr></thead><tbody id="metrics-body"></tbody></table></div><p class="footnote">' +
    rows.length +
    " linhas exportáveis. “Não medido” significa ausência de amostra equivalente; não há valores interpolados na coluna da metade. Gzip/Brotli são estimativas offline.</p>",
);
html += section(
  "03 / Jogo ao vivo",
  "Qualidade visual e certificação de FPS são verificadas separadamente.",
  '<div class="grid2"><article class="block"><h3>Intel Iris Xe · 300 segundos</h3><div id="chart-intel"></div><p>Alta · 1280×720 · DPR 1 · 60 s de aquecimento. Meta: 45 FPS e p95 ≤ 28 ms. Uma execução por revisão.</p></article><article class="block"><h3>RTX 4060 Laptop · 300 segundos</h3><div id="chart-nvidia"></div><p>A placa é confirmada pelo renderer WebGL. Mesma fixture, ferramentas e dependências. A campanha completa requer três repetições.</p></article></div>',
);
html += section(
  "04 / Dados na interface",
  "O catálogo armazenado chega à tela do clube.",
  '<div class="app-images"><figure><figcaption>Clube · desktop<small>Escudo, metadados, estádio, atletas e resultados reais.</small></figcaption><img src="after/app/club-desktop.png" loading="lazy" alt="Clube no desktop"></figure><figure><figcaption>Clube · 390×844<small>Verificação da largura e rolagem no celular.</small></figcaption><img src="after/app/club-mobile.png" loading="lazy" alt="Clube em tela de celular"></figure></div><p>Carreira local isolada: clube, elenco, táticas, transferências e Match 3D. Dados esportivos públicos usam chave publicável e RLS. Arquivos privados do provedor permanecem no servidor.</p><div class="grid2"><article class="block"><h3>As 13 novas categorias</h3><p>Perfis e temporadas dos jogadores, transferências, títulos, afastamentos, artilheiros, assistências, cartões amarelos e vermelhos, eventos, escalações, estatísticas das equipes e estatísticas dos jogadores na partida.</p><p>IDs estáveis, lotes limitados, reserva de quota, validação de paginação e checkpoints. As fases pausadas não foram ativadas.</p></article><article class="block"><h3>Identidades e histórico</h3><p>Os 201.677 registros originais de jogadores são preservados. Os leitores usam o atleta canônico e recebem aliases para reconhecer IDs antigos. A importação histórica continua usando todos os IDs do provedor, inclusive os ocultos como duplicados.</p><p>Dados conflitantes de eventos permanecem para revisão. Estádios recebem um namespace do provedor; a identidade da carreira é preservada.</p></article></div>',
);
html += section(
  "05 / Implementação",
  "Da base intacta ao candidato verificável.",
  '<div class="timeline"><article><span class="eyebrow">Antes</span><h3>Base isolada</h3><p>Mesmo commit inicial, dependências e protocolo. Catálogo, plano SQL e fotos preservados. Capturas iniciais por software ficam apenas como diagnóstico.</p></article><article><span class="eyebrow">Metade</span><h3>Primeira integração</h3><p>28 fases e 45 aliases de eventos. Cabelo e materiais inspecionados. A amostra intermediária documenta também a regressão de p95.</p></article><article><span class="eyebrow">Depois</span><h3>Correções e limites</h3><p>Clubes e atletas reconciliados, datas e estádios recuperados, torcida ajustada aos degraus. Física visual sem tempo artificial e 106 falas autorais com rotação sem repetir no ciclo.</p></article></div>',
);
html +=
  '<section class="section" id="gates"><span class="eyebrow">06 / Critérios obrigatórios</span><h2>A publicação depende de resolver as falhas.</h2><div class="table-wrap"><table><thead><tr><th>Verificação</th><th>Estado</th><th>Resultado e limite</th><th>Evidência</th></tr></thead><tbody>' +
  qrows +
  '</tbody></table></div><div class="grid2" style="margin-top:18px"><article class="block"><h3>Correções necessárias</h3><ul><li>Eliminar o crescimento dos bundles e reduzir o Rapier abaixo de 180.000 bytes, preservando os limites.</li><li>Investigar o custo de GPU e overdraw na Intel antes de repetir a campanha completa.</li><li>Executar o replay SQL e as fixtures em banco descartável.</li><li>Resolver a divergência da migração canônica de segurança e os cupons previsíveis ativos pelo fluxo autorizado.</li><li>Completar Lighthouse, audição das vozes reais e verificação de assets publicados.</li><li>Após aprovação dos critérios, entregar aplicativo/Edge Function e confirmar o SHA exato publicado.</li></ul></article><article class="block"><h3>Limites das conclusões</h3><ul><li>Ensaio curto não equivale ao FPS de uma partida ao vivo.</li><li>Uma consulta mais rápida não mede o Supabase inteiro.</li><li>28 categorias suportadas não significam 28 importações concluídas.</li><li>Testes de áudio usam transportes simulados; não certificam o timbre real.</li><li>Fotos locais não comprovam publicação desta revisão em jogomanager.com.</li></ul></article></div></section>';
html += section(
  "07 / Supabase Advisors",
  "Avisos disponíveis para avaliação.",
  '<div class="table-wrap"><table><thead><tr><th>Observação</th><th>Nível</th><th>Ocorrências</th><th>Referência</th></tr></thead><tbody>' +
    advisorRows +
    "</tbody></table></div><p>O catálogo esportivo é público por intenção. Visibilidade de esquema GraphQL não prova leitura irrestrita de linhas protegidas por RLS. Índices sem uso observado não foram removidos em massa. O índice temporário desta atualização que ficou redundante foi retirado após verificar o plano que usa a chave existente.</p>",
);
html +=
  '<footer class="footer">Relatório local gerado de JSON, logs e capturas reais. Nenhum segredo ou dado de carreira pessoal foi incluído. <a href="metrics.json">Abrir dados completos</a> · <a href="metrics.csv" download>Exportar CSV</a>.</footer></main><dialog id="image-dialog"><button id="close-dialog">Fechar ×</button><img id="large-image" alt="Captura original em maior escala"></dialog><script id="report-data" type="application/json">' +
  JSON.stringify(data).replaceAll("<", "\\u003c") +
  "</script>";
function client() {
  const d = JSON.parse(document.getElementById("report-data").textContent);
  const e = (v) =>
    String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const fmt = (v, u) =>
    v == null
      ? "não medido"
      : typeof v === "number"
        ? u === "bytes"
          ? (v / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " KiB"
          : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + (u ? " " + u : "")
        : e(v);
  function table() {
    const g = document.getElementById("group").value,
      s = document.getElementById("state").value,
      q = document.getElementById("search").value.toLocaleLowerCase("pt-BR");
    document.getElementById("metrics-body").innerHTML = d.rows
      .filter(
        (r) =>
          (!g || r.group === g) &&
          (!s || r.state === s) &&
          (!q || (r.label + " " + r.note).toLocaleLowerCase("pt-BR").includes(q)),
      )
      .map(
        (r) =>
          "<tr><td>" +
          e(r.label) +
          "<small>" +
          e(r.group) +
          " · " +
          e(r.note) +
          "</small></td><td>" +
          fmt(r.before, r.unit) +
          "</td><td>" +
          fmt(r.mid, r.unit) +
          "</td><td>" +
          fmt(r.after, r.unit) +
          "</td><td>" +
          (r.delta == null
            ? "—"
            : (r.delta > 0 ? "+" : "") +
              r.delta.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) +
              "%") +
          "</td><td class='" +
          r.state +
          "'>" +
          e(r.state) +
          "</td><td>" +
          (r.limit == null ? "—" : fmt(r.limit, r.unit)) +
          "</td><td><a href='" +
          e(r.evidence) +
          "'>JSON ↗</a></td></tr>",
      )
      .join("");
  }
  for (const id of ["group", "state", "search"])
    document.getElementById(id).addEventListener("input", table);
  table();
  const shot = document.getElementById("shot");
  shot.addEventListener("change", () => {
    d.native.forEach((p, i) => {
      const photo = document.getElementById("photo-" + i);
      photo.src = p.phase + "/" + shot.value + ".png";
      photo.alt = ["Antes", "Metade", "Depois"][i] + " — " + shot.selectedOptions[0].textContent;
    });
    document.getElementById("compare-before").src = "before-native/" + shot.value + ".png";
    document.getElementById("compare-after").src = "after-native/" + shot.value + ".png";
  });
  document.getElementById("wipe").addEventListener("input", (v) => {
    document.getElementById("compare-after").style.clipPath =
      "inset(0 " + (100 - v.target.value) + "% 0 0)";
    document.getElementById("compare-line").style.left = v.target.value + "%";
  });
  const modal = document.getElementById("image-dialog");
  document.querySelectorAll("[data-image]").forEach((b) =>
    b.addEventListener("click", () => {
      document.getElementById("large-image").src = document.getElementById(
        "photo-" + b.dataset.image,
      ).src;
      modal.showModal();
    }),
  );
  document.getElementById("close-dialog").addEventListener("click", () => modal.close());
  for (const [id, a, b] of [
    ["chart-intel", d.long[0], d.long[1]],
    ["chart-nvidia", d.long[2], d.long[3]],
  ])
    document.getElementById(id).innerHTML =
      [a, b]
        .map(
          (x, i) =>
            "<div class='bar-row " +
            (i ? "" : "base") +
            "'><span>" +
            (i ? "Depois" : "Antes") +
            " · " +
            (x.last
              ? x.last.p95.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " ms p95"
              : "em execução") +
            "</span><div class='bar'><i style='width:" +
            Math.min(100, x.last?.fps ?? 0) +
            "%'></i></div><strong>" +
            (x.last
              ? x.last.fps.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " FPS"
              : "—") +
            "</strong></div>",
        )
        .join("") +
      "<p class='footnote'>" +
      e((b.renderers ?? a.renderers ?? []).join(", ")) +
      "</p>";
}
html += "<script>(" + client.toString() + ")();</script></body></html>";
html = html.replace(
  "Completar Lighthouse, audição das vozes reais e verificação de assets publicados.",
  "Corrigir performance e LCP nas cinco páginas móveis reprovadas; repetir as auditorias. Fazer audição das vozes reais e verificar os assets publicados.",
);
fs.writeFileSync(path.join(root, "report.html"), html);
fs.copyFileSync("bundle-impact.json", path.join(root, "bundle-impact.json"));
console.log(
  JSON.stringify({
    report: path.join(root, "report.html"),
    rows: rows.length,
    quality: quality.length,
    photos: 30,
    longRuns: long.filter((x) => x.last).length,
  }),
);
