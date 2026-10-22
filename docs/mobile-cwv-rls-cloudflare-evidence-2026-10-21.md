# JogoManager: rollout de desempenho móvel, cache e segurança
Data: 21/10/2026. Branch: `perf/mobile-lcp-rls-20261021`.

## Escopo / estado
Esta alteração é **um PR de código, ainda sem deploy de produção**. Uma pequena melhoria de privacidade no banco de **produção** foi aplicada separadamente via Supabase MCP; verificação abaixo. Nenhuma assinatura ou pagamento foi realizado.

### Baseline (PageSpeed Insights, captura enviada pelo proprietário)
| Métrica de laboratório móvel | Baseline visível | Meta de validação |
|---|---:|---:|
| FCP | 3,5 s | <= 1,8 s |
| LCP | 3,9 s | <= 2,5 s |
| TBT | 0 ms | manter baixo |
| CLS | 0,024 | <= 0,1 |
| Speed Index | 3,6 s | <= 3 s |

Não existe **after** medido ainda. As metas não são previsões de melhoria garantida. Uma execução anterior do PSI teve números diferentes; não misturar execuções de laboratório com campo CrUX.

## Alterações de frontend e backend neste PR
1. `src/components/home/FootballHome.tsx`: componentes secundários `HomeLeaguePulse` e `HomeDetails` passam a ser divididos em chunks com `React.lazy` + `Suspense`. Evita exigir o código dessas seções abaixo da dobra para a hidratação inicial. Mantém rota, navegação, menu e hero intactos.
2. `src/server.ts`: header `Server-Timing: app;dur=<ms>` calculado por requisição; inclui apenas criação da resposta/handler inicial, **não** duração total da resposta streamed nem TTFB completo. Não publica segredos nem muda cache/CSP.
3. `src/lib/security-headers.test.ts`: teste para duração SSR e `no-store` em /auth.

**Revisão de código existente:** A home já usa AVIF/WebP e `srcset`, priority alta na imagem hero, preload no head; `getLeagueDigests` é deferred. Não duplicar essas otimizações. Para decidir o próximo patch, usar waterfall real com elemento LCP e `Server-Timing`.

## Cache/Cloudflare, leitura de estado (sem alterações de regras)
Zona `jogomanager.com`: **Free Website**, active. Brotli=on, HTTP/3=on, Early Hints=on, Always HTTPS=on. Rocket Loader=off (propositadamente, não ligar em app TanStack sem smoke); Auto Minify=off (build Vite já pode minificar). `browser_cache_ttl=0` significa respeitar cabeçalhos da origem. Cache rules `http_request_cache_settings` versão 18:
- bypass geral de HTML dinâmico e API;
- permitir cache de extensões públicas sem URL query, respeitando origem;
- `/assets/` GET/HEAD sem query, cache edge 30 dias/navegador 1 dia, status 3xx-4xx TTL 0 e 5xx não armazenar;
- bypass restrito de rotas sensíveis, métodos de escrita;
- bypass com header Authorization.

**Não habilitar HTML SSR em cache compartilhado:** o `src/server.ts` produz CSP nonce por requisição e outras páginas podem ter sessão. Sem estratégia comprovada de substituição de nonce, cachear SSR em edge seria bug de segurança.

## Supabase produção: resultados verificados
Projeto `lguqnwvsfeefxamzeyos`:
- Tabelas em `public`: **68/68 RLS enabled**, **0 RLS disabled**.
- `auth_safety`: `USAGE` para `anon=false`, `authenticated=false`, `service_role=true`.
- `auth_safety.phone_otp_attempts`: RLS enabled, sem acesso direto do cliente e atualmente 0 linhas.
- Migration aplicada: `schedule_private_phone_otp_retention_72h`. Job `cron.jobname=jgm_prune_phone_otp_attempts_72h`, **active=true**, `17 3 * * *` (UTC no servidor, verificar timezone do pg_cron), remove somente tentativas com `requested_at` mais antigas que 72h. Limites móveis do rate limiter usam janela até 24h; 72h preserva os registros necessários.
- **Atenção:** o limitador de OTP continua sem integração com o provedor de SMS/WhatsApp; não declarar SMS/MFA em produção.
- RLS Enabled No Policy e GraphQL exposure podem ser intencionais. Revisar objeto e contrato da API antes de revogar grants; 20 objetos legíveis por `anon` incluem catálogos esportivos públicos, e 42 por `authenticated` incluem dados do jogo. Não revogar em lote. ÍNDICES: `profiles.user_id` e `player_careers.user_id` já indexados, não criar duplicatas.
- `unused_index` não prova índice dispensável; checar `pg_stat_statements` e EXPLAIN antes de DROP.

## Dependências
NPMScan parcial: **686/686** entradas verificadas quanto a vulnerabilidades; apenas **100** passaram pela auditoria detalhada de licença/install scripts. Detectado `hono@4.13.8` com `GHSA-5r4p-p66f-jhc7`, moderate, corrigido em >=4.13.11. O PR Dependabot #58 já propõe `hono@4.13.13`; revisar CI e merge separadamente, preservando lockfile. Não chamar a auditoria de completa.

## Checklist de validação antes de merge/deploy
- CI: build, TypeScript, lint e testes, em particular `security-headers.test.ts`, home SSR e rotas autenticadas.
- Visitar página home com cache vazio, abrir DevTools: Response `Server-Timing` aparece; a primeira pintura não espera `HomeDetails`; LCP element é identificado sem chute.
- Testar em 3 perfis: desktop, celular 4G lento, navegador com CPU limitada; coletar 5 medições e mediana para PSI de laboratório.
- Verificar landing/SEO com view-source, cabeçalhos `Cache-Control` em `/auth`, `/dashboard`, `/api/` (devem continuar `no-store`) e assets versionados, além de CSP Report-Only sem regressões.
- Comparar Lab FCP/LCP/TBT/CLS/Speed Index antes/depois e CrUX de 28 dias quando disponível; nada disso foi re-medido após deploy (não houve deploy).
- Medir TTFB via waterfall `Server-Timing`; se app dur menor que TTFB, investigar origem, rede, CDN e cold start. Não cachear HTML autenticado para encobrir o atraso.
- Rever advertências Supabase com foco em privilégio real e índice necessário, sem RLS genérica.
- Verificar `cron.job_run_details` após a primeira execução agendada para conferir sucesso; estar `active` não prova execução.
- Cloudflare DNS/TLS/Fastly: sem cutover e sem contratação paga neste PR.
