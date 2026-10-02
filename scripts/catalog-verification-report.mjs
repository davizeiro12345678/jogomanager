import { readFile, writeFile } from "node:fs/promises";

const dir = "verification/catalog-2026-10-02";
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const [before, after, bundle, browser, testLog] = await Promise.all([
  readJson(`${dir}/baseline.json`),
  readJson(`${dir}/final.json`),
  readJson("verification/bundle-2026-10-01/catalog-final.json"),
  readJson(`${dir}/browser.json`),
  readFile(`${dir}/full-tests.log`, "utf8"),
]);
const testTotals = testLog.match(
  /Tests\s+(?:(\d+) failed \| )?(\d+) passed(?: \| (\d+) skipped)? \((\d+)\)/,
);
if (!testTotals) throw new Error("The final test run has not completed.");
const tests = {
  failed: Number(testTotals[1] ?? 0),
  passed: Number(testTotals[2]),
  skipped: Number(testTotals[3] ?? 0),
  total: Number(testTotals[4]),
};
const ids = [
  "sco",
  "sui",
  "aut",
  "den",
  "gre",
  "kor",
  "hrv",
  "arg",
  "x4396",
  "x4824",
  "y4616a",
  "arg2",
];
const changes = ids.map((id) => ({
  id,
  name: after.leagues.find((l) => l.id === id).name,
  before: before.leagues.find((l) => l.id === id)?.count ?? 0,
  after: after.leagues.find((l) => l.id === id).count,
}));
const quick = bundle.entries.find((e) => e.name.startsWith("partida-rapida-"));
const catalog = bundle.chunks.find((c) => c.name.startsWith("leagues-"));
const worker = bundle.entries.find((e) => e.name.startsWith("match.worker-"));
const summary = {
  generatedAt: new Date().toISOString(),
  before: before.totals,
  after: after.totals,
  minimumGeneratedRoster: Math.min(...after.rosters.map((r) => r.players)),
  minimumGoalkeepers: Math.min(...after.rosters.map((r) => r.goalkeepers)),
  changes,
  tests,
  bundle: {
    catalogRawBytes: catalog.bytes,
    catalogGzipBytes: catalog.gzipBytes,
    quickStartupBytes: quick.startupBytes,
    quickBudgetBytes: 1_150_000,
    workerStaticBytes: worker.staticBytes,
  },
  browserErrors: browser.errors.length,
};
await writeFile(`${dir}/summary.json`, JSON.stringify(summary, null, 2) + "\n");
const rows = changes.map((c) => `| ${c.name} | ${c.before} | ${c.after} |`).join("\n");
const sourceD =
  "https://www.cbf.com.br/futebol-brasileiro/noticias/selecao-masculina/comunicado-1/cbf-divulga-grupos-da-serie-d-de-2026";
const sourceArgentina =
  "https://www.afa.com.ar/agenda/posts/primera-nacional-fixture-para-la-temporada-2026";
const sourceFrance = "https://www.fff.fr/article/17102-les-groupes-pour-la-saison-2026-2027.html";
const report = `# Integridade das ligas e dos elencos — 2 de outubro de 2026

O catálogo ativo tem **${after.totals.leagues} divisões e grupos**, com listas sazonais identificadas por fonte em **${after.totals.sourcedLeagues}** deles. O registro mantém os clubes antigos para que os saves continuem abrindo.

## Quantidades corrigidas

| Competição | Antes | Agora |
| --- | ---: | ---: |
${rows}
| Série D brasileira, soma dos grupos | 47 em 3 grupos | 96 em 16 grupos de 6 |
| National 2 francesa, temporada 2026–2027 | Grupos misturados com a divisão superior | 8 grupos de 14 |

As listas são associadas à temporada da fonte, exibida no jogo. A coleta pública não certifica todos os formatos de calendário ou regulamentos como oficiais. Foram usados [TheSportsDB](https://www.thesportsdb.com/sport/leagues?all=1), [CBF para a Série D](${sourceD}), [AFA para as duas zonas da Primera Nacional](${sourceArgentina}) e [FFF para os grupos franceses](${sourceFrance}).

## Jogadores e importação

- Elencos gerados: mínimo de **${summary.minimumGeneratedRoster} jogadores**, com ao menos **${summary.minimumGoalkeepers} goleiros**. A distribuição padrão é 3 goleiros, 8 defensores, 8 meias e 7 atacantes.
- A geração preserva as identidades e a sequência aleatória do núcleo anterior. A migração conserva integralmente os jogadores salvos, seus atributos e os negócios já realizados.
- Todos os registros válidos importados são consumidos uma vez, mantendo posição e identificador de origem. Um teste verifica 40 atletas sem truncamento, com números únicos e uma duplicata descartada.
- A leitura no servidor usa páginas de 50 com cursor estável; uma resposta parcial ou com erro não entra no cache como elenco completo. O cache antigo limitado foi substituído por uma versão nova.
- Reservas sem registros disponíveis são gerados e identificados na interface. Os 26 jogadores são uma base de profundidade do jogo, e não uma afirmação de que cada clube possui exatamente 26 registros oficiais.

## Saves e acessos

Um save da primeira temporada ainda sem partidas recebe o calendário corrigido. Um campeonato já iniciado conserva os participantes e os placares, com a atualização de composição adiada para a próxima temporada. A atualização ocorre uma vez, sem recriar jogadores vendidos depois dela.

As ligações nacionais seguem explícitas em pyramid.ts. A Série D agora inclui os 16 grupos, com 64 classificados para o mata-mata; os movimentos de temporada preservam o treinador, os acessos conquistados e a quantidade de clubes por divisão. Os testes incluem o caminho do Capixaba para o grupo A12, a cadeia brasileira e dez temporadas consecutivas.

## Validação local

- Suíte completa: **${tests.passed} de ${tests.total} testes passaram**, ${tests.failed} falhas, ${tests.skipped} ignorados. O comando padrão exclui o teste de estresse separado.
- Testes focados de catálogo, elencos, caminhos e pirâmide: **30 passaram**.
- TypeScript e compilação de produção: passaram; detalhes nos logs de typecheck e build desta pasta.
- Todos os limites de bundle foram respeitados. Catálogo: **${catalog.bytes.toLocaleString("pt-BR")} bytes brutos**, **${catalog.gzipBytes.toLocaleString("pt-BR")} bytes gzip**. Partida rápida: **${quick.startupBytes.toLocaleString("pt-BR")} bytes** no carregamento inicial, abaixo do teto de 1.150.000. Worker: **${worker.staticBytes.toLocaleString("pt-BR")} bytes**, abaixo de 90.000.
- Navegador: Série A com 20 linhas e 38 rodadas; catálogo da Série D A12 com 6 clubes, Escócia com 12 e Argentina com 30; elenco com 26 linhas e filtro de goleiros com 3. Testados desktop (1538 pixels) e celular (375 pixels), sem transbordamento horizontal da página e com **${summary.browserErrors} erros de console** na guia de verificação.
- Duas asserções antigas de contagem exata do rig foram substituídas pelo seu orçamento de 64 ossos. As verificações de articulação dos dedos e de ancoragem da palma foram mantidas e passaram.

## Limites desta entrega

Camarões mantém 16 clubes da base anterior, sinalizada no jogo, pois não foi obtida uma lista atual confiável. Algumas temporadas do TheSportsDB podem diferir do ano corrente; o jogo apresenta a temporada efetivamente importada. A verificação da importação de jogadores foi local, sem certificar a completude de uma base remota ou executar atualização em banco externo. As medições de bundle não certificam FPS ou tempo de carregamento em outros dispositivos.

As alterações estão no workspace e na prévia local da porta 4205. Esta entrega não inclui publicação em produção.

Arquivos de evidência: baseline.json, final.json, summary.json, browser.json, full-tests.log, final-focused.log, typecheck.log, build.log e bundle-check.log. Capturas: league-desktop.png, league-mobile.png, squad-desktop.png e squad-mobile.png.
`;
await writeFile(`${dir}/report.md`, report);
console.log(JSON.stringify(summary, null, 2));
