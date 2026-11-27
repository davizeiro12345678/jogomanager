# PR #132 | Validação visual, SEO e campanha física (14/11/2026)

**Branch:** `integration/release-2026-11-11`. **Estado:** Draft, sem aprovação de merge nem publicação em produção. Este documento descreve mudanças existentes e critérios verificáveis. Não é um certificado de FPS, SEO ou produção.

## Evidência realmente observada neste ciclo

- Requests públicos anônimos de 14/11/2026 (UTC ~21h): `/`, `/guia-de-scouting`, `/melhores-formacoes`, `/dicas-de-gestao`, `/tabelas`, `/robots.txt` e `/sitemap.xml` responderam HTTP 200. As páginas `/tabelas/brasileirao-serie-a` e `/tabelas/premier-league` retornaram **HTTP 500**, portanto o SEO de produção ainda falha. Os `HEAD` em `/guia-de-scouting` e `/melhores-formacoes` retornaram `x-robots-tag: noindex, follow` apesar de HTTP 200. Isso prova diferença entre o domínio publicado e os contratos esperados da branch: não declarar publicação concluída.
- `src/lib/public-page-inventory.ts` na branch contém as 34 URLs de sitemap e `src/lib/public-indexing.ts` as reconhece como públicas. Não remover `noindex` de rotas privadas nem "consertar" o problema abrindo páginas autenticadas a crawlers.
- Supabase SSR: o cliente `src/integrations/supabase/client.server.ts` consultava exclusivamente `process.env`. No Cloudflare a fonte nativa pode ser `cloudflare:workers`. O commit `f8e31229` adicionou leitura restrita aos dois bindings necessários com fallback Node; `caac9bcf` adicionou testes. O commit `85a1e05f` impede que falhas **opcionais** de lesões/artilharia derrubem uma classificação válida. A consulta principal de standings continua fail-closed, sem inventar dados.
- Shader warmup: `125b42f` submete os objetos do ator à travessia de `compileAsync` com visibilidade temporária restaurada sincronicamente antes de aguardar conclusão, para evitar flash. `3717b82` acrescenta testes de compilações e falhas. Ainda não comprovado em driver/GPU físicos.
- Comparador de FPS: `scripts/compare-frame-campaigns.mjs` e teste adjacente aceitam somente amostras cronológicas completas, mesmo hardware/software/cena, sem interrupção/frames descartados, vídeo ou browser headless; calculam p50/p95/p99, 1% low, stalls >50ms, tendência primeiro/último minuto e temperaturas **somente quando um sensor real as fornece**. O workflow `.github/workflows/quality.yml` executa os testes do contrato. O conjunto isolado de 5 testes rodou com sucesso em Node no dispositivo remoto autorizado; isso não é captura de FPS nem teste em GPU.
- A primeira execução do novo workflow falhou por 37 violações de formatação nos arquivos criados. Ambos foram formatados com Prettier 3.9.9 e novamente enviados nos commits `67529a1` e `6568a60`. As Quality Gates do último SHA precisam ser novamente consultadas; resultados de SHA anterior não contam.

## Campanha comparável de hardware físico, ainda não executada

1. Registrar SHA exato de baseline e candidato, lockfile, GPU, driver, OS/browser, backend WebGL/WebGPU, CPU, monitor/power mode, ventilação, temperatura ambiente, resolução/DPR, preset, câmera, condição de gramado/clima, iluminação, seed e revisão de regras.
2. Em **cada dispositivo físico**: executar três pares baseline/candidato alternados para cada cenário. Manter 30 segundos de warmup, no mínimo dez minutos de render ativo por execução, coletar `FrameCampaign.snapshot(true)` e telemetria independente de temperatura/frequência da GPU/CPU. Não misturar headless, gravação de vídeo ou mudança de preset com campanhas numéricas.
3. Cenários do plano: partida TV/close, gol/replay, dia/noite, seco/chuva, baixa/média/alta; sala de vestiário, chegada e negociação em cutscenes. Obrigatório noite + chuva e recuperação após troca WebGL context / reinício. Salvar screenshots separados dos ciclos de FPS para não alterar o benchmark.
4. Analisar p50/p95/p99, 1% e 0,1% lows, quadro >50ms, primeiro frame cold/warm, programas compilados, draws, triângulos, pressão de GPU/VRAM e memória após dez reaberturas. Identificar throttling com sensor, não com suposição de FPS. Sem evidência térmica de hardware, marcar `sensor-data-unavailable`.
5. Colocar manifestos `base.json` e `head.json` reproduzíveis e executar `node scripts/compare-frame-campaigns.mjs base.json head.json`. Reprovar diferenças de dispositivo/versão/cena e interrupções ocultas. O comparador resume medianas por execução, **não inventa um p95 global agregando percentis**.

## Cutscenes e direção de arte que ainda necessitam de prova

- Primeiro ensaio de navegador: bloquear o download de `CinematicStage3D` antes do primeiro import, observar 2D/fallback acessível, restaurar rede, acionar `Tentar novamente`, confirmar desenho 3D real em nova tentativa sem flash branco nem diálogo travado. Repetir troca de cenas, skip, áudio indisponível, pause/resume, perda e restauração de contexto e dez reaberturas, com heap/VRAM/compilação monitorados. Não usar somente teste mockado de `React.lazy` para certificar falha de rede no navegador.
- Shader warmup não pode compilar cenas antes dos materiais/luzes finais nem mover o travamento para kickoff/replay. A/B cold/warm e HTML dataset `heroWarmup*` com `firstFrameMs`, `sceneVisibleMs` e recursos confirmam se houve benefício real.
- Anatomia: validar três atletas de identidades distintas com mesma luz/pose, pescoço, mãos, joelho, pelve, anatomia do rosto, uniformes e LOD. Movimento: corrida→parada→giro, recepção, chutes, tackles, defesa, continuidade de foot locking em troca de LOD. Os offsets de apresentação **não** podem modificar `MatchSim` ou replays.
- Estádio, gramado, iluminação, torcida e cinemática: comparar day/night/wet/crowd por preset, exposição, materiais PBR, volumes instanciados, população nas arquibancadas, linguagem de câmera e occlusão. A correção de dimensões de textura do gramado anterior não representa conclusão dessa direção visual.
- Física/IA: qualquer nova regra de colisão temporal ou decisão tática que altere eventos precisa de revisão **versionada e opt-in**, novos testes de determinismo/1.000 seeds, compatibilidade de checkpoints/replay e autorização de migrar salas. Não alterar a semântica já gravada como `contactPhysicsRevision=2` silenciosamente.

## SEO: correção e recrawl

- A correção em código da leitura de bindings e da tolerância a complementos opcionais ainda não está publicada. Confirmar no canário com variáveis server-only verdadeiras e isoladas, `/api/health` pronto e identidade de build, então reavaliar as **12** tabelas e as páginas editoriais. Uma página 200 com `noindex`, uma página 500 ou uma tabela sem dados reais continua sendo falha.
- Rastrear todas as 34 URLs do sitemap, canônicos, `X-Robots-Tag`/meta robots, redirecionamentos, links internos, conteúdo principal e proteção de rotas privadas. Comparar respostas anônimas de duas regiões quando possível. Não sugerir que cabeçalho seguro de erro 500 é o problema: corrigir o erro 500.
- Recrawl oficial Semrush não executado: o plugin informou **sem unidades de API** disponíveis em 14/11. Aguardar unidades para repetir no projeto Semrush. Fonte: https://www.semrush.com/mcp-access

## Bloqueios de release ainda abertos

- Supabase staging independente precisa de projeto/ref e consentimento específico do custo. Não vincular Worker de staging a chave de produção.
- Worker autoritativo de staging segue com bootstrap 404 desativado, sem autenticação privada do motor completo nem homologação WSS.
- Testes físicos com dois dispositivos e quatro jogadores 2×2 não ocorreram. O contrato atual do motor assina dois assentos; o 2×2 precisa de protocolo de quatro participantes versionado.
- GitHub `main` ainda sem confirmação de proteção e review humano independente. PR permanece Draft.
- Reexecutar todas as gates no **mesmo SHA final** depois de cada commit, sem enfraquecer lint/TypeScript, Lighthouse, segurança, SEO ou benchmarks. Somente então registrar decisão `go/no-go` e considerar canário e rollback aprovado.

Referências: `docs/superpowers/plans/2026-11-12-match3d-major-upgrade.md`, `docs/operations/pr132-release-gates-2026-11-14.md`, `verification/pr132-upgrade-20261112/seo-live.json`.
