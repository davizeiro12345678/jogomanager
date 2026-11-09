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

Estas alterações de código permanecem na branch do PR #128 até que CI, auditoria de orçamento, testes de paridade do Edge e observação de erros/latência estejam concluídos. **Apenas os limites SQL foram aplicados na produção** nesta etapa; não houve deploy da nova Edge Function por este commit.

Monitorar: `api_football_quota_usage`, `football_import_private.jobs` por status, recibos/min, `cron.job_run_details`, erros `429`, locks e latência do PostgreSQL; conferir proporção de chamadas com ingestão bem-sucedida. Preservar reserva atômica, caching de páginas e provas de idempotência.
