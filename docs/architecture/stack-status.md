# Estado da stack técnica

Esta página separa o que já está no código, o que ganhou um gate de entrega e
o que ainda precisa de uma conta/infraestrutura externa. Ela evita que um nome
de tecnologia no `package.json` seja confundido com uma integração de produção.

## Runtime que já existe

| Camada | Implementação no projeto |
| --- | --- |
| UI/full-stack | React 19, TanStack Start, TanStack Router, Vite e TypeScript strict |
| Dados locais e validação | TanStack Query/Store, Zod, IndexedDB e PWA/service worker |
| Cena 3D | Three.js, React Three Fiber, Drei, pós-processamento, `three-mesh-bvh`, WebGPU experimental com fallback WebGL |
| Escala visual | crowd instanciada/LOD, grama chunked, Worker de simulação, quality governor com `detect-gpu` e resolução dinâmica |
| Dados/contas | PostgreSQL via Supabase, Auth, RLS, Realtime, Drizzle migrations e Stripe resolvida no servidor |
| Telemetria de produto | PostHog e GA4 já são inicializados pelo cliente quando configurados |
| Testes | Vitest, Playwright e contrato de benchmark de cena fixo |

## Adições desta evolução

| Necessidade | Entrega | Limite explícito |
| --- | --- | --- |
| Física | `@dimforge/rapier3d-compat` e `rapier-ball-authority.ts` calculam a bola canônica no Worker: gravidade, atrito, giro, gramado, trave, travessão e rede. O estado volta ao `MatchSim` a cada tick. | Regras de futebol, posse, placar, eventos e replay continuam deliberadamente fora do solver. O caminho compatível existe apenas para replay/skip ou indisponibilidade real de WASM. |
| Assets | `scripts/verify-game-assets.mjs` é o gate de intake: futuros glTF/GLB precisam declarar Meshopt ou Draco e, se tiverem imagens, KTX2/Basis. | Ainda não há modelos 3D de produção em `public/game-assets`; portanto não há como alegar que assets reais já foram comprimidos. |
| ETL | `football-ingestion-validation.ts` usa Zod antes de inserir atletas: normaliza dados, limita campos, exige HTTPS para fotos e remove ids duplicados por provider. | Cada fonte externa ainda precisa de observabilidade e de uma política de retries própria para operação em escala. |
| CI/CD | `.github/workflows/quality.yml` cria gates para lint, TypeScript, Vitest, build, auditoria de dependências, contrato 3D e intake de assets. `.lighthouserc.cjs` registra Lighthouse como auditoria de shell. | A primeira execução precisa acontecer no GitHub; nenhum resultado de CI remoto ou auditoria Lighthouse está sendo declarado como concluído localmente. |

## Próximas integrações que exigem infraestrutura

As linhas abaixo são intencionais: código local não pode transformar uma
integração externa ausente em um recurso de produção somente pelo nome.

| Tecnologia desejada | Próxima ação concreta |
| --- | --- |
| Sentry + OpenTelemetry | Provisionar DSN Sentry e endpoint/coletor OTLP, decidir retenção/amostragem e então ativar SDKs no cliente e servidor. |
| Multiplayer competitivo autoritativo | Hospedar processo de partida autoritativo e protocolo de snapshots; Supabase Realtime atual é transporte/social, não autoridade anti-cheat. |
| Cloudflare CDN, WAF e DDoS | Configurar zona/Pages ou Workers, regras WAF, rate limits e segredos no ambiente da conta Cloudflare. |
| glTF Meshopt/Draco + KTX2 | Colocar os modelos e texturas licenciados no intake; o gate de CI impedirá regressão de payload. |
| ECS/hybrid ECS | Migrar sistemas de entidades por fases, começando por jogadores/posse, sem quebrar saves e replays existentes. |
| WASM pesado | Medir custo antes de promover qualquer rotina além de Rapier; não adicionar WASM apenas por catálogo. |

## Certificação que ainda não ocorreu

Nenhuma alteração acima certifica FPS em Android físico, uma cobrança real da
Stripe, uma migração aplicada no Supabase, WAF em produção, servidor
autoritativo ou metas de Lighthouse em hospedagem pública. Esses itens exigem
ambiente configurado e medição fora desta árvore de código.
