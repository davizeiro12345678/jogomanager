# Cache, segurança e integrações — 21/10/2026

Observação: 15:37 BRT. Produção Supabase: lguqnwvsfeefxamzeyos. Este relatório distingue alterações verificadas, configuração documentada no repositório e recursos inacessíveis nesta sessão.

## Alterações aplicadas e verificadas

Migração: `20261021183605_stripe_webhook_fk_and_query_diagnostics.sql`.
Commit: https://github.com/davizeiro12345678/jogomanager/commit/9c189c40474252310a10b60d3e8b37c7eaa16f01

| Item | Antes | Depois | Validação | Limitação |
| --- | --- | --- | --- | --- |
| FK de stripe._managed_webhooks.account_id | Sem índice com account_id na primeira posição | Índice B-tree válido e pronto | pg_index: indisvalid=true, indisready=true | Não mede latência de pagamentos |
| Avisos de FK sem índice | 1 | 0 | Supabase performance advisors | Índice novo aparece como ainda não utilizado |
| HypoPG | Não instalado | 1.4.1, esquema extensions | pg_extension | Diagnóstico sob demanda; não cria índices físicos automaticamente |
| Index Advisor | Não instalado | 0.2.0, esquema extensions | Consulta real retornou errors=[] | Teste da tabela pequena: custo 1.01 antes/depois, sem recomendação adicional |
| Segurança após DDL | Avisos existentes | Mesmas categorias/quantidades | Advisors security | Não representa auditoria completa de autorização |

Não foram criados projetos, réplicas, agendamentos, exportações externas ou assinaturas. As extensões usam o compute e armazenamento existentes. Não foi prometida ausência de cobrança futura de uso do plano Pro.

## Métricas observadas

Snapshot SQL às 15:37:08 BRT, não uma comparação de desempenho.

| Métrica | Valor | Interpretação |
| --- | --- | --- |
| Plano da organização | Pro / pay-as-you-go | Confirmado pelo conector |
| Estado do projeto | ACTIVE_HEALTHY | Estado informado pelo serviço |
| PostgreSQL | 17.6.1.063 | Versão informada pelo projeto |
| Tamanho do banco | 6.079.917.203 bytes | Aproximadamente 5,66 GiB; não é capacidade provisionada |
| Cache de blocos PostgreSQL | 92,19% | Cumulativo, não é cache hit do CDN e não inclui todo cache do SO |
| Conexões | 10 | Snapshot do banco atual |
| Ativas / idle / idle in transaction | 1 / 7 / 0 | A consulta de auditoria participa do snapshot; estados restantes podem ser nulos |
| Deadlocks registrados | 0 | Acumulado; stats_reset retornou null, janela não determinada |
| Chamadas em pg_stat_statements | 4.942.438 | Agregado disponível, inclui operações internas e administrativas |
| Média ponderada de execução SQL | 9,400 ms | Não é p95, latência HTTP ou tempo de partida |
| Temporários acumulados | 25.212 arquivos / 51.059.083.734 bytes | Não é espaço temporário atualmente ocupado; janela não determinada |
| Tamanho do novo índice | 16.384 bytes | 16 KiB |
| Tabelas public com RLS | 68 / 68 | RLS habilitada não prova correção de todas as políticas |
| Web Vitals no PostHog para o domínio, últimos 7 dias | 0 eventos | Não permite calcular LCP/INP/CLS/FCP nem deltas |
| Lighthouse mobile/desktop | Não executado | Nenhuma nota atribuída |

Permanecem 62 avisos informativos de índice ainda sem uso (61 antes + índice novo) e 1 de conexões Auth fixadas em 10. Não remover índices sem estudar a carga e o período de coleta. Segurança: 16 tabelas com RLS sem políticas, 20 avisos de visibilidade GraphQL anon, 42 authenticated e 1 função SECURITY DEFINER disponível a authenticated. Visibilidade de esquema não comprova leitura indevida de linhas; tabelas internas podem estar corretamente fechadas.

## Fastly e Cloudflare

O conector Cloudflare retornou erro interno em search/docs/whoami. Nenhuma configuração Cloudflare foi alterada. Não havia ferramentas Fastly de administração no registro desta sessão, CLI instalado ou token/configuração local. Nenhuma configuração Fastly foi alterada ou revalidada ao vivo.

O documento preexistente `docs/security-fastly-supabase-twilio-2026-10-21.md` registra serviço Fastly `bhEs3I9sbvxlCzr9kb0IBQ`, versão 2, cache de GET/HEAD anônimos em /assets/, pass para cookies/Authorization/demais caminhos, DDoS Blocking e certificado pendente de DNS. Isso é evidência documental, não consulta atual do painel. O documento registra que o domínio principal ainda não havia sido migrado ao Fastly.

O código atual de `src/lib/security-headers.ts` já prevê cache de um ano para determinados assets, um dia para estáticos comuns e no-store para APIs, Authorization, Set-Cookie e outras rotas privadas. Regras de CDN precisam respeitar essas restrições. Não foi adicionado Cache Everything a páginas privadas.

Um GET do domínio por este ambiente recebeu HTTP 503 com server envoy, TTFB 6,875 s. Resultado inconclusivo devido à rede intermediária; não é medição válida de experiência dos visitantes ou prova de indisponibilidade pública.

## Disponibilidade e cobrança: documentação pública atual

| Recurso | Disponibilidade pública | Aplicação nesta sessão |
| --- | --- | --- |
| Fastly CDN | Franquia de 100 GB e 1 milhão de requests/mês; excedentes cobrados | Não alterado; franquia da conta não consultada |
| Fastly Compute | 10 milhões de requests e 100 milhões de vCPU-ms/mês gratuitos; outros componentes e excedentes devem ser conferidos | Não implantado |
| Fastly NGWAF / Bot Management / API Security / Edge Rate Limiting | Recursos comerciais; confirmar contrato/entitlement | Não contratados ou ativados |
| Cloudflare WAF Free Managed Ruleset | Disponível no Free; conjunto limitado | Estado da zona não consultado |
| Cloudflare Rate Limiting | Free inclui uma regra, com limitações | Não configurado por falha do conector |
| Cloudflare Bot Fight Mode | Incluído no Free; não equivale a Bot Management Enterprise | Não configurado |
| Cloudflare Bot Management Enterprise | Produto Enterprise | Não contratado |
| Cloudflare API schema validation | Free: até 5 schemas habilitados, 200 KiB combinados e ação Block | Não configurado; exige contrato de API validado |
| Cloudflare API Shield completo / Discovery | Acesso depende de produto/entitlements; limites de endpoints não significam Discovery completo gratuito | Não ativado |

## Integrações Supabase

Já presentes: Stripe (esquema e funções), pg_net, pg_cron, pgmq, Vault, pg_stat_statements, pg_trgm e pg_graphql. Funções Edge ativas: sportsdb-bridge, lovable-backup-restore, api-football-import, stripe-setup, stripe-webhook, stripe-worker. Estado ACTIVE não comprova execução ponta a ponta ou autenticação correta no código.

Adicionados agora: HypoPG e Index Advisor, extensões de diagnóstico de consultas. Não foi criada nova integração externa com Stripe, PostHog ou Fastly, nem alegada sincronização ponta a ponta. verify_jwt=false exige examinar autenticação no handler; não prova isoladamente acesso público indevido, especialmente para webhooks assinados.

PostHog acessível: projeto 603692, nome Default project. A taxonomia confirma ausência recente de $web_vitals; o código de analytics tem consentimento e não configura capture_performance explicitamente. Diagnosticar captura/chave/projeto antes de atribuir a ausência a uma causa única. Não ativada coleta adicional que possa consumir cota sem verificar faturamento.

## Fontes

- https://www.fastly.com/pricing
- https://developers.cloudflare.com/waf/
- https://developers.cloudflare.com/bots/plans/free/
- https://developers.cloudflare.com/api-shield/plans/
- https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0001_unindexed_foreign_keys
- https://supabase.com/docs/guides/database/extensions/index_advisor
- https://posthog.com/docs/web-analytics/web-vitals

Para completar CDN e segurança: restaurar o conector Cloudflare e um acesso administrativo autenticado ao Fastly; verificar TLS/DNS, franquias e configuração atual antes da ativação. Testar login, saves, checkout, webhooks e cache privado após mudanças. Só então comparar métricas antes/depois com dispositivo, região e janela equivalentes.
