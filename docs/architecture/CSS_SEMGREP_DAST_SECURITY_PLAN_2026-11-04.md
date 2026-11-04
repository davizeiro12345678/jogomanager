# Plano integrado: CSS crítico, SAST Semgrep e DAST controlado

Data: 2026-11-04 | Projeto: Pro Football Manager 3D | Estado: **proposto em PR, não implantado em produção**

## 1. Arquitetura CSS e carregamento sob demanda

**Diagnóstico real:** o projeto já distingue CSS público e CSS do jogo em `src/routes/__root.tsx` usando `isLightweightCssPath(matches.at(-1)?.pathname)`, `src/public-styles.css?url` e `src/styles.css?url`. Portanto o objetivo é **refinar** essa divisão, não substituir o sistema por uma injeção pós-render que atrasaria SSR e criaria FOUC.

| Camada | Fonte | Regra |
|---|---|---|
| Base crítica | `src/critical-base.css` | Fundo e casca mínimos, orçamento <12 KiB bruto; importado nos bundles para evitar requisição extra |
| Público | `src/public-styles.css` | Home, loja, SEO, guias, termos, privacidade, tabelas, componentes públicos |
| Jogo/3D | `src/styles.css`, `src/game-presentation.css` | Dashboard, criação de carreira, HUD, partida, cenas 3D |

**Implementação da PR:** o helper `prefetchGameStylesheet` somente agenda `<link rel=prefetch as=style>` quando o usuário manifesta intenção de ir para `/new`, `/dashboard` ou `/match` via mouse, teclado ou toque. Não aumenta a prioridade de download do jogo na primeira visita à home. A folha do jogo usada no SSR continua a ser descoberta pelo `head()` do TanStack Start.

**Observação:** CSS importado em componentes `React.lazy` não é automaticamente CSS crítico do primeiro SSR. Evitar trocar a folha inicial por um `useEffect` sem medições e testes de flash. `server.build.inlineCss` existe, mas é experimental, aumenta HTML e exige nonce CSP; não ativar globalmente sem análise.

### Aceite de desempenho

- Testar primeiro acesso, refresh direto e navegação SPA em `/`, `/produtos`, `/tabelas`, `/termos`, `/privacidade`, `/new`, `/dashboard`, `/match`.
- Guardrail `node --test scripts/css-route-gates.test.mjs`: base crítica abaixo de 12 KiB, nenhum import de game CSS no stylesheet público e seleção de CSS SSR preservada.
- Comparar 5+ execuções por rota com rede móvel e CPU controladas: CSS transferido, FCP, LCP, CLS, TBT e ausência de FOUC. Não declarar melhoria percentual até medir.
- Reverter o PR se CSS de alguma rota falhar, se o SSR quebrar ou se houver regressão de LCP superior à tolerância da equipe.

## 2. SAST com Semgrep

O CI `.github/workflows/security-semgrep-dast.yml` executa Semgrep OWASP Top 10 mais `security/semgrep-rules.yml` em `src`, `cloudflare`, `supabase`, gerando JSON auditável. A PR é o primeiro ciclo de triagem; separar legado de regressão, validar manualmente achados, evoluir até bloquear novos achados graves.

Examinar: SQL/RPC e `createServerFn` com validação Zod; XSS via `dangerouslySetInnerHTML`, URLs e redirects; parsers de carreira e prototype pollution; segredos em `VITE_*`; permissões de rotas; Stripe webhook; autorizadores; caminhos protegidos pelo Supabase.

**Achados do inventário (04/11/2026):** NPMScan conferiu 949 dependências quanto a vulnerabilidades, seis com avisos: `follow-redirects 1.16.1`, `re2js 2.8.6`, `seroval 1.6.7`, `@hono/node-server 1.19.17`, `minimatch 10.2.6`, `deepmerge 4.3.1`. A inspeção detalhada foi parcial (100/949), e os upgrades requerem CI/compatibilidade e lockfile coerente.

**Segredos no Git:** `.env`, `.env.development` e `.env.production` aparecem versionados em um repositório público. Verificar sem publicar os valores, rotacionar credenciais se comprometidas, remover do controle de versão conforme estratégia e investigar histórico. Nunca imprimir tokens nos logs ou na PR.

## 3. DAST e políticas de borda

O workflow ZAP passivo é **manual** e limitado à página inicial pública, com spider curto e artefato. Não executar scan ativo contra produção: pode causar falhas, alterar estado ou elevar carga.

Validar respostas HTTP: HSTS, CSP (`script-src`, `connect-src`, nonce), `Permissions-Policy`, `X-Content-Type-Options: nosniff`, COOP, CORS, redirects e TLS. Não habilitar `preload` HSTS até confirmar todos os subdomínios. Rastrear `Cache-Control: private, no-store` em respostas personalizadas de `/auth`, `/checkout`, `/_serverFn`, `/api` e Workers; confirmar `CF-Cache-Status` e `Age`. Não impedir cache em catálogo público intencional.

## 4. Testes ativos somente em staging

Consultar `security/ACTIVE_TESTS_STAGING_ONLY.md`. Necessário: projeto/banco isolados, duas contas fictícias A/B, Stripe Test Mode, backups descartáveis, limite de requisições e relatório.

1. **Replay Stripe:** repetir `event.id` e mesma sessão com `event.id` distinto; esperar um único crédito/entitlement, assinatura obrigatória, logs sem segredos.
2. **Anticheat:** rejeitar saves com timestamps retroativos, revisão CAS antiga, moedas infladas, `user_id` adulterado; nenhum efeito no progresso do usuário B.
3. **RLS/BOLA:** autenticar A e tentar SELECT/UPDATE de dados B em `careers`, `player_careers` e `user_wallet`; zero linhas alteradas/lidas; repetir B→A. Não usar service_role nessa simulação, pois contorna RLS.

### Supabase: auditoria somente-leitura realizada

Em 04/11/2026: 22 avisos de RLS sem policy, 26 objetos GraphQL visíveis para `anon`, 48 para `authenticated`, 1 função SECURITY DEFINER autorizada a authenticated. Uma tabela com RLS sem políticas pode estar intencionalmente fechada; distinguir os casos antes de mudanças. Nas tabelas `careers`, `player_careers`, `user_wallet` as políticas de propriedade verificadas exigem `auth.uid()=user_id`, com MFA adicional de natureza **RESTRICTIVE**, mas sem substituição dos testes A/B. O inventário atual inclui `careers`/`player_careers`; não presumir a tabela `career_saves`.

## 5. Regras de publicação

- CI: CSS gates, TypeScript, lint, Vitest, build, Semgrep, auditoria de dependências e segurança dos segredos.
- Staging: navegação mobile/desktop, SSR, estilos e 3D, RLS A/B, Stripe TEST e anticheat, respostas no-store.
- Produção: canário, monitorar Web Vitals e 4xx/5xx, rollback claro. Bloquear deploy diante de vazamento de segredo, falha RLS ou cobrança duplicada.
- O plano de SSH FIDO2/certificados de 15 minutos é independente. Nunca desativar SSH root antes de validar uma nova sessão `jmadmin`, o `sudo`, a chave de reserva e o acesso Contabo VNC.

## Fontes

- TanStack Start CSS: https://tanstack.com/start/latest/docs/framework/react/guide/css-styling
- Semgrep CI: https://semgrep.dev/docs/semgrep-ci/sample-ci-configs
- ZAP baseline: https://www.zaproxy.org/docs/docker/baseline-scan/
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- API protection: https://supabase.com/docs/guides/api/securing-your-api

## 6. Resultado real dos pipelines na PR #119

- **Semgrep PASS:** 84 regras OWASP + personalizadas em 1.490 arquivos, **0 achados** e artefato JSON disponível [no workflow](https://github.com/davizeiro12345678/jogomanager/actions/runs/41894792552). Isso não comprova ausência de vulnerabilidades.
- **CSS gates PASS:** verificação de base crítica <12 KiB, isolamento público/jogo e prefetch acionado por intenção.
- **ZAP DAST:** passo explicitamente **SKIPPED**, pois requer execução manual e não deve testar produção agressivamente.
- **Quality gates FAIL:** aumento de **265 bytes gzip / ~228 bytes Brotli** no startup JS, bloqueado pelo orçamento estrito de *zero regressão*. Precisa otimizar o prefetch ou revisar abordagem antes do merge.
- **Lint FAIL:** 41 erros no lint global. Um separador extra na alteração de `game-stylesheet.ts` foi corrigido; não assumir que todos os demais erros são provocados por este PR sem comparação com a base.
- **Dependency audit FAIL:** o job `npm audit --omit=dev --audit-level=high` identifica vulnerabilidades. Corrigir de maneira compatível com os locks, sem desligar o gate.
- **Ativo em staging:** Stripe TEST, adulteração de carreira e RLS A/B ainda **não executados**. Nenhuma alteração no Supabase produtivo foi feita.
- **Função sensível para inspeção:** `public.mutate_player_career`, SECURITY DEFINER exposta ao papel autenticado, com search_path configurado. Revisão de autorização é necessária antes da liberação.

A PR permanece **draft, sem merge**. O fluxo de sucesso seguro é corrigir CI, medir FCP/LCP/CLS, executar testes em staging e só então considerar deploy.
