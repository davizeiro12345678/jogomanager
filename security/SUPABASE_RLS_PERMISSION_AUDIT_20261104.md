# JogoManager | revisão não destrutiva de avisos RLS sem políticas

**Data:** 04/11/2026  
**Projeto:** Supabase de produção `lguqnwvsfeefxamzeyos`  
**Modalidade:** SQL de metadados somente-leitura. Nenhum dado de usuário, política, concessão ou tabela foi alterado.

## Resultado

Os 22 avisos `rls_enabled_no_policy` do advisor foram cruzados com
`pg_class`, `pg_policy` e `has_table_privilege` para os papéis `anon` e
`authenticated`. **Todos os 22 objetos sinalizados estavam sem GRANT de
SELECT, INSERT, UPDATE ou DELETE para esses dois papéis.**

| Esquema | Quantidade | Objetos |
| --- | ---: | --- |
| `auth_safety` | 2 | `phone_otp_attempts`, `resend_delivery_events` |
| `backup_restore` | 2 | `batches`, `runs` |
| `data_quality` | 2 | `player_identity_corrections`, `player_role_corrections` |
| `football_import_private` | 3 | `jobs`, `receipts`, `settings` |
| `oracle_bridge_private` | 2 | `config`, `outbox` |
| `private_performance` | 2 | `runtime_metrics`, `top_query_snapshots` |
| `public` | 9 | `api_football_data`, `api_football_import_progress`, `api_football_page_progress`, `api_football_quota_usage`, `api_football_season_coverage`, `checkout_session_owners`, `coupon_eligible_users`, `payment_webhook_events`, `tech_telemetry_rate_limits` |

**Decisão:** preservar as restrições atuais. Criar políticas liberadoras nessas
tabelas apenas para silenciar um aviso converteria um bloqueio intencional
em potencial exposição. A falta de políticas não é vulnerabilidade por si só
quando o acesso direto por `anon`/`authenticated` não foi concedido.

## Limites desta comprovação

- É uma verificação de permissões SQL e RLS, **não** uma execução de requisições
  de duas identidades e **não** comprova a segurança de RPCs `SECURITY DEFINER`.
- As exposições de objetos em `pg_graphql` devem ser avaliadas separadamente:
  a presença no esquema GraphQL não implica autorização efetiva.
- O SQL também lista objetos internos `auth`, `storage` e `realtime`
  que não fazem parte dos 22 avisos de aplicação; esses esquemas são geridos
  pela plataforma e não foram modificados.
- Reavaliar a consulta quando houver migração, alteração de GRANT,
  adição de política ou mudança dos esquemas expostos.

## Checklist de promoção

- Não aplicar DDL de produção baseado apenas na contagem de avisos.
- Executar o teste de `security/staging/rls-idor-ab.mjs` com dois usuários
  fictícios **somente** depois de disponibilizar banco isolado e fixtures.
- Confirmar o princípio de menor privilégio dos endpoints internos que
  operam nessas tabelas.
