# Supabase — leitura de capacidade e isolamento em 25/10/2026

Consulta de produção somente de leitura. O projeto respondeu `ACTIVE_HEALTHY`, com PostgreSQL 17.6.1.063 na região us-west-2. Nenhuma alteração de compute, índice, política, usuário ou dado de produção foi aplicada nesta inspeção.

| Medida | Leitura de 23/10 | Leitura de 25/10 | Interpretação |
| --- | ---: | ---: | --- |
| Tamanho SQL do banco | 11.608.321.171 B | 14.623.558.803 B | Aproximadamente 10,81 → 13,62 GiB; crescimento entre instantâneos, sem atribuir a causa |
| Conexões no SQL | 15 / 90 | 16 / 90 | Sem saturação no instante consultado |
| Esperas por lock | 0 | 0 | Não demonstra ausência de contenção em outros horários |
| Deadlocks registrados | 0 | 0 | `stats_reset` veio nulo; duração acumulada não confirmada |
| Compute selecionado no painel | Small, 2 GB, compartilhado | Small / t4g.small, 2 GB, compartilhado | Configuração observada; não houve redimensionamento nesta entrega |
| CPU no cartão do primário | 3% | 4% | Instantâneos; os gráficos históricos usam outra janela/agregação |
| RAM no cartão do primário | 59% | 53% | Não é uma campanha de carga |
| Conexões no cartão do primário | 10 / 90 | 9 / 90 | Janela distinta da consulta SQL |
| Disco usado no painel | 11,77 / 59 GB | 14,58 / 59 GB, cerca de 25% | Inclui componentes que não correspondem exatamente ao tamanho SQL do banco |
| Réplicas de leitura | Nenhuma | Nenhuma | Todas as leituras e escritas vão ao primário |
| IOPS / throughput configurados | 3.000 / 125 MB/s | 3.000 / 125 MB/s | Não são medidas de utilização efetiva |

O SQL foi executado em **25/10/2026 às 14:59:57 UTC**. O painel foi lido nesta mesma inspeção. A capacidade observada não justifica aumentar automaticamente uma cobrança recorrente. O crescimento do banco merece acompanhar a retenção e o ritmo de importação. Picos de CPU, memória, filas e latência de consultas continuam exigindo uma janela de carga representativa; o gráfico histórico do painel não identificou sua agregação nesta leitura.

As sete tabelas críticas consultadas — `careers`, `player_careers`, `entitlement_ledger`, `user_cosmetic_grants`, `wallet_item_log`, `checkout_session_owners` e `payment_webhook_events` — mantêm RLS e negam SELECT a anônimos. As cinco tabelas pessoais permitem leitura ao proprietário por `auth.uid() = user_id`, combinada com a política MFA **RESTRICTIVE**. As duas tabelas internas de checkout/webhook negam SELECT também ao papel autenticado. Metadados corretos não substituem uma campanha de tentativa de acesso em todas as rotas.

| Advisor em 25/10 | Nível | Quantidade | Tratamento |
| --- | --- | ---: | --- |
| Índice sem uso observado | INFO | 62 | Não remover índices apenas por este contador; alguns atendem integridade ou rotas pouco frequentes. [Critério do Advisor](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) |
| Auth com limite absoluto de conexões | INFO | 1 | Dimensionar em conjunto com a capacidade e a carga. [Orientação de produção](https://supabase.com/docs/guides/deployment/going-into-prod) |
| RLS sem política | INFO | 20 | Inclui tabelas internas com acesso de cliente negado. [Semântica](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) |
| Descoberta GraphQL por anônimos | WARN | 26 | Inclui catálogo público; requer revisar exposição por finalidade. [Orientação](https://supabase.com/docs/guides/database/database-linter?lint=0026_pg_graphql_anon_table_exposed) |
| Descoberta GraphQL por autenticados | WARN | 48 | Descoberta de esquema é distinta de acesso a linhas protegidas por RLS. [Orientação](https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed) |
| Função SECURITY DEFINER executável | WARN | 1 | `mutate_player_career` é uma RPC intencional; avaliar suas verificações internas, proprietário e permissões em conjunto. [Orientação](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) |

Esta rodada não leu dados pessoais de carreiras ou pagamentos, nem gerou tráfego de carga contra produção. O replay completo das migrações e os contratos com usuários sintéticos pertencem ao banco de teste do CI. A janela de logs HTTP de 23/10 continua sendo uma evidência histórica separada; ela não foi reapresentada como disponibilidade de 25/10.
