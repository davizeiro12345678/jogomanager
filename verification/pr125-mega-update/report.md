# JogoManager — evidências da atualização do PR #125

- **Repositório:** `davizeiro12345678/jogomanager`
- **PR existente:** [#125 — Consolida carreira, estádio, Firebase e importador Custom450](https://github.com/davizeiro12345678/jogomanager/pull/125)
- **Branch:** `codex/career-tutorial-css-20261107`
- **Baseline:** `7760bdd426ef0298b4d52440985d145845e6b28f`
  **Ambiente candidato:** sandbox local, Node 24.22.0 e Vite do lockfile; nenhum deploy ou merge foi feito.

Este relatório registra o que foi implementado e medido nesta branch. **Não afirma que toda a solicitação original esteja concluída**, que o site foi publicado ou que o multiplayer já seja plenamente autoritativo.

## Evidências visuais

Os pares `before/after` de home e seleção de partida rápida preservam o mesmo tamanho (230 × 498 px); as capturas `before` vieram do artefato Lighthouse do baseline. As imagens novas em 390 × 844 px foram capturadas no preview local final. A captura Match 3D veio do Chromium gerenciado com WebGL2 habilitado; não há imagem baseline equivalente no artefato original.

| Home — antes                   | Home — depois                  |
| ------------------------------ | ------------------------------ |
| ![Home antes](before/home.jpg) | ![Home depois](after/home.jpg) |

| Partida rápida — antes                          | Partida rápida — depois                         |
| ----------------------------------------------- | ----------------------------------------------- |
| ![Partida rápida antes](before/quick-match.jpg) | ![Partida rápida depois](after/quick-match.jpg) |

**Capturas finais em 390 × 844 px:**

![Home final no preview local](after/home-final-390x844.png)

![Seleção de partida rápida final no preview local](after/quick-match-final-390x844.png)

**Match 3D renderizado no preview local (893 × 768 px):**

![Campo, estádio e jogadores 3D](after/match-3d.webp)

O console Playwright da tela de partida rápida final não apresentou erros nem avisos. O Firefox disponível no runner não habilitou WebGL2; por isso a evidência 3D vem do Chromium, que criou o contexto e renderizou a cena. Não foi encontrada ferramenta de gravação contínua de browser: **nenhum vídeo de gameplay foi fabricado ou apresentado como gravação completa**.

## Escopo implementado nesta branch

O trabalho selecionado das 29 frentes inclui validação de protocolo e estados de conexão multiplayer; validação/normalização de mensagens e moderação automática no chat; retry/idempotência em fluxos de carreira e temporada; validação de ofertas e valores financeiros; elegibilidade de escalação e feedback de salvamento de táticas; correções no batching/ownership do estádio; melhorias selecionadas de atmosfera, torcida, clima, cutscenes e acessibilidade; separação de módulos/client startup; scanner de configuração pública e correção do preview padrão.

### Limitações funcionais importantes

- A tela de Match 3D **ainda não está ligada a um backend de simulação/estado autoritativo**. As validações e o antiexploit adicionados nesta etapa melhoram contratos e controles do cliente, mas não impedem um cliente modificado de falsificar estado. Não declarar o multiplayer totalmente autoritativo ou o anticheat completo.
- A deduplicação durável de mensagens por `client_message_id` e a aplicação persistente de penalidades ainda dependem de backend, migration/RPC e revisão de autorização.
- A solicitação de tradução integral de todos os idiomas **continua pendente**; a contagem real está na seção de i18n.
- Não foi feito teste ativo de intensidade média em `jogomanager.com`: o domínio informado é produção e não há staging/telemetria de impacto com condição de parada confiável. O domínio foi apenas navegado passivamente; a validação técnica foi local.

## Métricas de bundle e política de performance

Os relatórios completos de baseline/candidato e o comparativo máquina-legível estão em [`bundle/`](bundle/). A comparação usa builds do mesmo runner/toolchain; total de JavaScript inclui chunks lazy e exclui os arquivos WASM. Gzip é nível 9. Brotli Q6 é estimativa offline e só corresponde a entrega do navegador se a CDN responder com `Content-Encoding: br`. Nenhuma dessas medidas é LCP, TBT, INP, FPS ou latência real de rede.

| JavaScript emitido |    Baseline | Build final |           Variação |
| ------------------ | ----------: | ----------: | -----------------: |
| Total raw          | 7.341.649 B | 7.251.245 B | −90.404 B (−1,23%) |
| Total gzip         | 2.389.550 B | 2.366.489 B | −23.061 B (−0,97%) |
| Total Brotli Q6    | 2.254.273 B | 2.235.357 B | −18.916 B (−0,84%) |

| Superfície de startup |         Raw: baseline → final (Δ) |    Gzip: baseline → final (Δ) | Brotli Q6: baseline → final (Δ) |
| --------------------- | --------------------------------: | ----------------------------: | ------------------------------: |
| Home                  |     539.444 → 523.994 (−15.450) B |  179.911 → 175.741 (−4.170) B |    170.635 → 166.746 (−3.889) B |
| Nova carreira         | 1.344.640 → 1.283.464 (−61.176) B | 451.168 → 431.785 (−19.383) B |   426.737 → 409.132 (−17.605) B |
| Partida rápida        |      915.739 → 907.139 (−8.600) B |  311.994 → 309.932 (−2.062) B |    295.749 → 293.910 (−1.839) B |
| Match 3D              | 1.737.195 → 1.686.597 (−50.598) B | 594.783 → 578.966 (−15.817) B |   563.247 → 549.089 (−14.158) B |
| Palco cinematográfico |  1.805.357 → 1.797.527 (−7.830) B |  546.856 → 544.973 (−1.883) B |    513.671 → 512.071 (−1.600) B |
| Editor                |      565.221 → 555.789 (−9.432) B |  188.943 → 186.464 (−2.479) B |    179.051 → 176.824 (−2.227) B |
| Worker de simulação   |             89.540 → 89.540 (0) B |        29.958 → 29.956 (−2) B |          28.857 → 28.858 (+1) B |

**Orçamentos atuais:** o comparador já permitia crescimento agregado de até **400.000 bytes por representação** (raw, gzip e Brotli); esse teto não foi aumentado neste lote. Conforme pedido, foi adicionada uma margem explícita máxima de **2.048 bytes para cada métrica gzip/Brotli de startup por rota**. O Worker Brotli cresce 1 byte, dentro dessa margem. Tetos absolutos de `bundle:check`, rotas obrigatórias e medições ausentes continuam bloqueantes. O comparador final passou sem violações.

## Lighthouse e preview

O baseline Lighthouse do CI (run `42429874392`) tinha três execuções móveis por rota. Home: score [0,95; 0,98; 0,98], TBT [195; 27,5; 41] ms, LCP ~2.002–2.040 ms e CLS 0. Partida rápida: score [0,96; 0,98; 0,98], TBT [201; 157; 145] ms, LCP ~1.408–1.567 ms e CLS ~0,00496. Ainda não há amostra Lighthouse **depois** desta atualização; ela depende do workflow do GitHub após o push e não foi estimada por screenshot.

O comando `npm run preview` foi corrigido para servir o Worker/Nitro local produzido em `.output`, em vez de procurar `dist/server/server.js`. No build final, o preview respondeu HTTP 200 e verificou 5 rotas (`/`, `/guias`, `/guia-de-scouting`, `/melhores-formacoes`, `/partida-rapida`) em `identity` e `gzip`: **10/10 representações**.

## Testes e gates finais

| Verificação                                                          | Resultado final                                           |
| -------------------------------------------------------------------- | --------------------------------------------------------- |
| Suíte completa (`npm test`)                                          | PASS — 335 arquivos, 1.786/1.786 testes                   |
| Regressão focada de batching do estádio                              | PASS — 6/6 testes                                         |
| Lint (`npm run lint`)                                                | PASS — zero avisos                                        |
| TypeScript (`npx tsc --noEmit --pretty false`)                       | PASS                                                      |
| Performance gates                                                    | PASS — 24/24; inclui a fronteira exata de +2.048/+2.049 B |
| Build de produção local e `bundle:check`                             | PASS                                                      |
| Comparação bundle baseline/candidato                                 | PASS — 0 violações                                        |
| Validação de ambiente público e scanner de credenciais privilegiadas | PASS                                                      |
| Preview SSR, cinco rotas × duas codificações                         | PASS — 10/10                                              |
| Console Playwright da partida rápida final                           | PASS — 0 erros, 0 avisos                                  |

O scanner não encontrou credenciais privilegiadas no bundle. A URL e chave publishable do Supabase foram usadas somente em processo/build local previamente validado; nenhuma service-role key, arquivo `.env` ou configuração remota foi incluída/alterada nesta atualização.

## Cobertura i18n medida

| Medida                               | Contagem | Estado                     |
| ------------------------------------ | -------: | -------------------------- |
| Identificadores de locale anunciados |       98 | Catálogo atualizado        |
| Idiomas-fonte                        |        2 | `pt-BR` e `en`             |
| Packs JSON existentes                |       24 | Ainda em draft/incompletos |
| Locales sem pack próprio             |       72 | Fallback em inglês         |
| Revisão nativa completa              |      Não | Pendente                   |

Os metadados e testes deixam explícito o fallback; **não houve tradução integral dos 98 idiomas nem revisão nativa**. A captura de partida rápida também mostra alguns textos em inglês, evidenciando a pendência.

## Segurança, produção e pendências

Não houve ataque ativo, carga/stress test, escrita de carreira/partida, alteração de banco/configuração remota, publicação ou deploy em produção. Os testes de segurança executados foram estáticos/determinísticos e no ambiente local. Para DAST de média intensidade, usar um staging autorizado com limite de taxa, monitoramento e condição de parada explícita.

Pendências antes de considerar o pedido original concluído:

1. Implementar autoridade real de partidas no servidor (validação de comandos, snapshots assinados/validados e estado online persistente) e testar com clientes adversariais em staging.
2. Completar deduplicação/moderação persistentes no backend com RLS/migration/RPC e retentativas seguras.
3. Completar, revisar nativamente e publicar as traduções pendentes.
4. Gravar um vídeo contínuo de uma partida completa quando houver ferramenta de captura contínua disponível; as evidências atuais são screenshots reais.
5. Aguardar e revisar Lighthouse/CI do SHA final no GitHub.

O PR #125 continua sendo o PR existente desta branch; não houve merge nem publicação em `jogomanager.com`.
