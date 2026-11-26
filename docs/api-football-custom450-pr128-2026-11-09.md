# Continuação do PR #128: API-Football Custom450 (09/11/2026)

## Estado de produção confirmado

- Projeto Supabase: `lguqnwvsfeefxamzeyos`.
- Migração de produção aplicada: `increase_api_football_custom450_rate_limits_20261109` (histórico gerenciado pelo Supabase MCP, não repetir como migração Drizzle).
- Parâmetros verificados em `football_import_private.settings`: habilitado, 450.000/dia UTC, 1.200/minuto.
- `reserve_provider_call(integer,integer)`: bloqueio transacional e limites de 20 reservas/segundo, 1.200/janela de minuto e 450.000/dia. A reserva continua compartilhada entre instâncias.
- Execuções recentes do cron `api-football-history` concluídas com sucesso e recibos recentes confirmados.
- Muitos trabalhos permanecem na fila; várias respostas da API retornam `provider_reported_error`. Esses erros não são prova de falta de quota; inspecionar a resposta tipada e disponibilidade do endpoint antes de aumentar retries.

## Alteração do worker neste PR

O orçamento de disparo de uma invocação com até 16 lanes é configurado para intervalos mínimos de 50 ms (até 20 tentativas de requisição/segundo), com teto de 800 tentativas em uma janela útil de aproximadamente 40 s. O padrão de lanes do repositório foi alinhado às 16 lanes já observadas na versão implantada. O teste de paridade do worker cobre os limites.

O limitador **efetivo** continua no PostgreSQL, e o provedor pode responder com `429`. Uma configuração de 1.200/min não significa throughput sustentado de 1.200/min: rede, SQL, duração do worker e cron de 45 s adicionam ociosidade. Não reduzir as proteções do banco, desabilitar backoff ou subir a frequência do cron sem validar capacidade real.

## Rollout da atualização de código

**Atualização operacional de 09/11/2026 às 18:50:50 UTC:** a Edge Function `api-football-import` foi atualizada na produção para a **versão 14**, usando os quatro arquivos do PR #128 (`index.ts`, `football-window.mjs`, `football-materialize.mjs` e `football-coverage-plan.mjs`). A nova janela limita tentativas a 800 por invocação, com espaçamento mínimo de 50 ms; a reserva global e atômica do PostgreSQL continua limitando 20/segundo, 1.200/minuto e 450.000/dia UTC. A função conserva a autenticação própria por segredo e não foi tornada publicamente executável sem credencial.

**Verificação pontual inicial:** versão 14 `ACTIVE`; cron `api-football-history` ativo a cada 45 segundos e 13 execuções bem-sucedidas/nenhuma falha nos dez minutos consultados. O recorte móvel de cinco minutos registrou 3.690 recibos e 3.690 registros inseridos; parte desse intervalo antecede a versão 14, portanto **não representa benchmark depois do deploy**. O pico observado de dez minutos foi de 823 reservas/minuto, abaixo do teto de 1.200/min. A fila segue grande (aproximadamente 2,44 milhões de trabalhos pendentes). A campanha de comparação sustentada, a análise de 429 e a aprovação dos checks finais do PR continuam pendentes.

**Migrações adicionais do PR #128 aplicadas à produção via Supabase MCP:** `drizzle_0063_repair_career_and_push_access_20261109`, `drizzle_0064_support_ticket_outbox_20261109` e `drizzle_0065_atomic_match_room_creation_20261109`. Foram conferidas colunas de geração/tombstone, as tabelas de suporte com RLS sem grants públicos, as funções RPC somente para `service_role`, os três índices de salas e o registro das três migrações em `supabase_migrations.schema_migrations`. A publicação do aplicativo, o webhook de suporte e o transporte multiplayer de simulação continuam **não ativados**; aplicar DDL não equivale a liberar estas funções ao público.

Monitorar: `api_football_quota_usage`, `football_import_private.jobs` por status, recibos/min, `cron.job_run_details`, erros `429`, locks e latência do PostgreSQL; conferir proporção de chamadas com ingestão bem-sucedida. Preservar reserva atômica, caching de páginas e provas de idempotência.
