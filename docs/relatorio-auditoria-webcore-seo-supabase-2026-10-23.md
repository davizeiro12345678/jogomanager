# Auditoria de otimização, SEO, infraestrutura e evidências do Pro Football Manager 3D
**Data:** 23/10/2026 · **Alvo:** `jogomanager.com` · **PR:** #61 (`perf/public-startup-css-2026-10-23`) · **Situação:** ganhos de bundle demonstrados em CI, mas Lighthouse mobile segue fora da meta; pendente revalidar o commit mais recente. **Não aprovado para deploy.**

## 1. Critério de veracidade
Há três conjuntos de evidências separados: **produção**, capturada antes do merge; **baseline GitHub main**, compilada no mesmo runner e nas mesmas condições; **candidato da PR**, compilado no mesmo runner. Um sucesso em build não prova um ganho no Core Web Vitals reais. Nenhum número abaixo de CPU, RAM física ou disco físico Oracle foi inventado. O PR não foi implantado no domínio durante a auditoria. Sem screenshots comparáveis da versão candidata no mesmo ambiente, não declarar comparação visual de antes/depois.

## 2. Alterações implementadas na PR
| Eixo | Modificação em código | Motivo | Evidência técnica |
|---|---|---|---|
| CSS por rota | `public-styles.css` com `@source` de componentes públicos; `src/routes/__root.tsx` seleciona CSS leve | Evitar regras Tailwind do simulador nas páginas editoriais | Build CI compara estilos comprimidos |
| Runtime em rota pública | `RootLayout.tsx` só ativa `applyWorld()` em rotas do jogo; `public-content-routes.ts` define limite exato | Evitar catálogo mutável e processamento na home/SEO | Testes `public-content-routes.test.ts` |
| Partida rápida | `isLightweightCssPath` separado de `isPublicContentPath` | CSS leve sem perder inicialização do mundo da partida | Testes específicos |
| Home | `HomeDetails` e configurações de acessibilidade lazy, preload responsivo AVIF/WebP do hero, player antigo só carrega dados de clubes quando encontra save | Menor trabalho antes da primeira pintura | Fontes + logs da build |
| Sobre | Sai import estático de `@/game/data/leagues` para contar clubes; entram blocos explicativos de escolha de modo | Evitar dados volumosos e números que confundem catálogo com jogabilidade | `src/pages/sobre.tsx` |
| Conteúdo | Instruções sobre cinco rodadas e subseções H2/H3/H4/H5, comparações e FAQ mais concretos | Melhoria semântica e informativa | `src/pages/jogo-de-manager-de-futebol.tsx`, `HomeDetails.tsx` |
| Identidade | `CREATOR` separado do changelog, ambos emails e Discord `davizeiro10` / `Davi` divulgados nas páginas de contato/criador | Evitar cópias divergentes e conter import de changelog do footer | `src/content/creator.ts`, páginas e testes |
| Qualidade editorial | Rodapé revisado para data 23/10/2026; removida afirmação de uma década de experiência sem comprovação | Acurácia do conteúdo | `src/components/SiteFooter.tsx` |
| OCI | Runbook seguro sem segredos, separado de produção | Pré-requisitos, identidade, Cloudflare Tunnel e gates de rollback | `docs/oracle-cloud-cloudflare-supabase-runbook-2026-10-23.md` |

## 3. Bundle CI: comparação de mesmo runner e revisão mais recente

**O primeiro build falhou no gate de JS**, mas a revisão de 23/10 incorporou um ajuste adicional: substituir duas pequenas validações eagerly importadas de `zod/mini` por parsers restritos sem runtime de schemas. O job **120579175736** da execução **#40001638347** no commit **`d060825`** confirmou a reversão de todas as regressões de JavaScript e **passou** nos critérios de bundle gzip e Brotli Q6. A última alteração de rotas de SEO/i18n após esse commit ainda requer uma compilação de validação independente.

| Métrica | Main comparado no mesmo runner | Candidato `d060825` | Variação estimada | Gate daquele commit |
|---|---:|---:|---:|---|
| JS total bruto incluindo chunks lazy | 6.827,4 KiB | **6.820,2 KiB** | -0,11% | PASSOU |
| JS total gzip | 2.235,2 KiB | **2.232,5 KiB** | -0,12% | PASSOU |
| JS total Brotli Q6 | 2.109,2 KiB | **2.107,0 KiB** | -0,11% | PASSOU |
| Home JS startup gzip | 172,8 KiB | **167,3 KiB** | -3,17% | PASSOU |
| Home JS startup Brotli Q6 | 163,6 KiB | **158,6 KiB** | -3,05% | PASSOU |
| Nova carreira startup gzip | 435,3 KiB | **430,4 KiB** | -1,12% | PASSOU |
| Partida rápida startup gzip | 302,5 KiB | **297,5 KiB** | -1,62% | PASSOU |
| Match 3D startup gzip | 564,1 KiB | **559,0 KiB** | -0,90% | PASSOU |
| Cinemática startup gzip | 529,5 KiB | **524,3 KiB** | -0,97% | PASSOU |
| Editor startup gzip | 179,7 KiB | **174,7 KiB** | -2,76% | PASSOU |
| Simulação Worker startup gzip | 27,8 KiB | 27,8 KiB | 0,00% | Sem mudança |

O build intermediário anterior, **#39999319320**, teve regressão de 2.687 bytes de JS gzip e foi corrigido; **não é o resultado mais recente**. O CSS editorial fora medido naquele build: 67,40 → 59,43 kB brutos (-11,8%) e 13,24 → 11,90 kB gzip (-10,1%). Depois foi implementado `server.build.inlineCss`, que pode mudar o tamanho transferido do HTML e necessita de nova inspeção de `Content-Length`, folhas e cascata visual. O JS startup comprimido é estimativa de payload; não é LCP, INP nem FPS.

A home passou a fornecer CSS público como import de componente, extraível pelo TanStack Start no SSR. A revisão também centralizou em `isPublicContentPath` o reconhecimento das páginas editoriais pela camada de idiomas, removendo mais uma tabela de strings eagerly carregada (redução de 723 bytes de código-fonte antes de minificação). O teste de compressão desse ajuste ainda precisa confirmar o efeito real.

Arquivos grandes gerados pelo SSR do servidor como `stripe`, `posthog-js`, `three`, `rapier`, `@lovable.dev/mcp-js` **não são automaticamente importados pela primeira pintura do navegador**. Inspecionar o manifesto e o waterfall no cliente antes de afirmar que são download inicial. A otimização adicional deve priorizar as dependências de fato presentes na closure de inicialização e preservar os fluxos de gameplay.

## 4. Lighthouse Mobile (laboratório, não campo)
Fonte: mesmo GitHub Actions #39999319320, job `120571501524`, Chromium em `localhost:4173`, com perfis Lighthouse. Os limiares da CI eram **score >= 0,98** e **LCP <= 2.500 ms**.

| URL | Score mobile | LCP identificado | Contra o alvo |
|---|---:|---:|---|
| `/` | **0,87** | **3.431,57 ms** | FALHA |
| `/guias` | **0,94** | LCP não apontado na falha | FALHA (score) |
| `/guia-de-scouting` | **0,93** | **2.662,95 ms** | FALHA |
| `/melhores-formacoes` | **0,89** | **2.986,36 ms** | FALHA |
| `/partida-rapida` | **0,85** | **3.218,68 ms** | FALHA |

A ausência de falha de LCP em `/guias` não significa LCP = 0 ou LCP excelente. Dados de **INP real p75, CLS real p75 e LCP real p75** dependem de coleta em campo (CrUX/RUM) e não foram obtidos nesta auditoria. Nenhum desses resultados satisfaz o alvo 98 mobile.

## 5. Produção e SEO
Capturas de HTML renderizado da produção pelo Firecrawl/Context.dev em 23/10 mostram página inicial com um H1, diversos H2 e H3, sem H4/H5. **Não criar H4/H5 artificiais em toda página**: níveis inferiores devem existir apenas para subdivisões reais. No novo conteúdo, `/jogo-de-manager-de-futebol` utiliza H2–H5 para um exemplo de análise por rodadas, com hierarquia. A home mantém títulos de acesso rápido e perguntas FAQ. O conteúdo da PR **não foi publicado** no domínio durante estes checks.

As capturas de imagem antes foram inicialmente solicitadas ao Firecrawl, mas a transferência/captura posterior apresentou falha de DNS/túnel no provedor. Não há screenshot validado da versão após deploy. O Lighthouse guarda artefatos por run; exigir um par de imagens mobile e desktop no mesmo viewport, URL, commit, data e configuração para fechamento.

O Search Console no GSC Wizard recusou consulta por assinatura expirada; Semrush recusou auditoria por falta de unidades API. **Não inventar crescimento de cliques, impressões, posicionamento, cobertura de indexação ou auditoria externa**.

## 6. Postgres/Supabase: fotografia factual, não antes/depois
Fonte: `mcp__Supabase__execute_sql` projeto `lguqnwvsfeefxamzeyos`, instante **2026-10-23 17:58:30 UTC**.
| Indicador Postgres | Valor | O que mede e limitações |
|---|---:|---|
| Tamanho da database | **11.608.116.371 bytes** (10,81 GiB) | Banco total, não disco físico de VM |
| Conexões observadas | **18** | Instantâneo; não pico nem limite |
| Conexões ativas observadas | **1** | Instantâneo |
| Cache hit de blocos | **92,35%** | Contador `pg_stat_database` acumulado, não RAM usada |
| Temp bytes acumulados | **53 GB** | Bytes temporários *acumulados*, não arquivos em disco atualmente |
| `shared_buffers` | **512 MB** | Tamanho do buffer configurado, **não** memória física total/usada |
| Alertas de índices não usados | **63** | Advisor informativo, **não** apagar índices sem analisar plans e integridade referencial |
| `players` linhas estimadas | **201.677** | Estatística aproximada `n_live_tup`, não número de jogadores jogáveis |
| `clubs` linhas estimadas | **38.854** | Registros aproximados, não clubes de modo carreira |

Caminho RPC mais caro identificado por `pg_stat_statements`: ~**309.702 chamadas**, tempo médio **90,26 ms**, tempo total acumulado **27.952.663,9 ms**; a variante RPC de paginação ~439.630 chamadas e 20,46 ms médios. Esses contadores são acumulados e podem misturar períodos com volume de requisições diferente. Medir `delta` de chamadas, blocos e tempos em janelas iguais e examinar `EXPLAIN (ANALYZE, BUFFERS)` cuidadosamente em ambiente seguro antes de otimizar índices, batch ou concorrência. A métrica de CPU%, IOPS e RAM do compute exige **Supabase Reports/Observability** nos mesmos intervalos e carga normalizada.

**Nenhuma melhoria mensurada de CPU%, RAM física ou IOPS da Supabase pode ser afirmada aqui.** A PR não foi publicada no Worker da Cloudflare.

## 6A. Intervenção reversível em produção: cron desnecessário desligado

Em **23/10/2026 às ~18:20 UTC** foi confirmado que `public.sportsdb_bridge_control` está com `enabled = false`, `status = paused_capacity` e data de atualização de 18/10. Apesar disso, o job `cron.job` **`sportsdb-supabase-import`**, ID 1, continuava chamando um Edge Function **a cada minuto**, registrando 1.439 execuções na janela anterior de 24 horas. Foi aplicado **`cron.alter_job(job_id := 1, active := false)`**, sob guarda SQL que exige que o importador continue desabilitado e pausado. A verificação posterior retornou **`active = false`**. Nenhuma tabela, registro de jogo ou fila foi excluído.

Efeito mensurável: o agendamento repetitivo está desligado. **Potencial de evitar até ~1.440 chamadas agendadas/dia**, não medição de redução de CPU física. Caso a importação TheSportsDB seja retomada, **reativar o agendamento conscientemente** e atualizar o controle de capacidade antes de esperar nova execução; apenas alterar `enabled` da tabela não retoma o cron.

Foi detectado separadamente que `football_import_private.settings.enabled = true`; portanto o cron `api-football-history` foi **mantido ativo**. Esse pipeline tem **3.740.905 jobs pendentes** e aproximadamente **1.263 MB em heap+índices**, e demanda revisão própria de retenção, prioridades, throughput e critérios de encerramento; **nenhum job pendente foi apagado**. A tabela `api_football_data` contém **5.153.909 linhas** e ocupa **8.302 MB**, ~75% do banco. Essas observações são mais relevantes ao disco que tentativas cegas de excluir índices pouco utilizados. Jobs de Stripe e limpeza de OTP permaneceram inalterados.

## 7. Cloudflare atual e preparação da Oracle
Na zona `jogomanager.com`, o Worker `jogomanager-web` atende a rota principal. Brotli, HTTP/3, HTTPS forçado e Early Hints estão habilitados; Rocket Loader está desligado, assim como a minificação suplementar (o build Vite faz a principal). `browser_cache_ttl=0`, `cache_level=aggressive`. Aumentar TTL global sem isentar login, compras e saves pode ser perigoso; priorizar somente assets com hash de build.

**OCI não provisionada** nesta sessão: falta acesso a tenancy Oracle conectada, compartment, quotas e VM. Recomenda-se primeiro piloto em serviço isolado, limitando a conta Always Free e evitando consumir recursos pagos, depois Cloudflare Tunnel + Access e conexão segura de serviço ao Supabase. Não houve mudança DNS/Worker de produção nem migração de banco. A topologia completa, requisitos de segredos, healthchecks e rollback estão no runbook OCI na mesma PR.

## 8. Portas de aceitação e bloqueios
| Gate | Exigência objetiva | Situação verificada |
|---|---|---|
| Segurança de produção e migrations | Npm production audit; contratos Supabase | PASSOU no run #39999319320 |
| Simulação, Rust, assets 3D | Testes e contratos críticos | PASSOU no run #39999319320 |
| CSS editorial reduzido | Raw/gzip menores na compilação comparativa | PASSOU (-11,8% raw, -10,1% gzip) |
| Total JS e fluxos do jogo | Nenhum aumento em gzip/Brotli | **PASSOU no d060825; revalidar SHA atual** |
| Mobile 98 em 5 rotas | Lighthouse >= 0,98 e LCP <=2,5s | **FALHA** |
| Typecheck e testes | Todos os testes + typecheck sem erro | **REVALIDAR SHA ATUAL** (ajustes de testes já enviados) |
| CPU/RAM/IOPS | Comparação antes/depois com mesmo tráfego | **PENDENTE** |
| Screenshots antes/depois | Duas imagens por viewport, mesma origem, mesmos parâmetros | **PENDENTE** |
| Cloudflare + Oracle | VM/túnel privado/ACL/healthcheck e rollback provados | **PENDENTE** |
| Deploy em produção | PR aprovada com gates, backup e verificação pós | **BLOQUEADO** |

**Decisão editorial/técnica:** não aprovar, não publicar e não declarar o pedido encerrado. CSS público e JS total tiveram melhora em CI comparativa; Lighthouse, validação final da PR e infraestrutura OCI continuam pendentes.

## 9. Referências auditáveis
- [Comparação com gate do bundle aprovado em d060825](https://github.com/davizeiro12345678/jogomanager/actions/runs/40001638347)
- [CI da última alteração de rotas SEO (pode ainda estar em andamento)](https://github.com/davizeiro12345678/jogomanager/pull/61/checks)
- [Pull request #61](https://github.com/davizeiro12345678/jogomanager/pull/61)
- [Execução base comparativa](https://github.com/davizeiro12345678/jogomanager/actions/runs/39999319320)
- [Artefato bundle antes/depois](https://github.com/davizeiro12345678/jogomanager/actions/runs/39999319320/artifacts/12520904508)
- [Resultados Lighthouse](https://github.com/davizeiro12345678/jogomanager/actions/runs/39999319320/artifacts/12520969124)
- [Nova validação após ajustes dos testes](https://github.com/davizeiro12345678/jogomanager/actions/runs/40000153137)
- [Manual Oracle/Cloudflare/Supabase](./oracle-cloud-cloudflare-supabase-runbook-2026-10-23.md)
