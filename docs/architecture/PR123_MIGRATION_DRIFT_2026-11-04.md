# PR #123 | Reconciliação de histórico Supabase sem tocar em produção

Data: 04/11/2026. Origem: API de leitura de migrações do projeto Supabase de produção `lguqnwvsfeefxamzeyos` e lista de arquivos `supabase/migrations/*.sql` da branch `integration/pr119-verified-20261104` no GitHub.

## Resultado inventariado

- Migrações registradas no banco de produção: **81**.
- Arquivos SQL versionados nesta branch: **71**.
- Registradas no banco e **ausentes do repositório**: **16**.
- Versionadas no Git e **sem o mesmo registro de versão em produção**: **6**.
- A tabela `supabase_migrations.schema_migrations` inclui colunas `version`, `name`, `statements`, `created_by`, `idempotency_key` e `rollback`. Os registros ausentes do Git têm SQL armazenado no ledger, mas seu conteúdo **não foi incluído neste relatório** por conter potencialmente dados sensíveis.

### Migrações aplicadas em produção que não estão neste Git

| Versão | Nome no registro |
|---|---|
| `20261021191622` | `harden_private_phone_otp_budget` |
| `20261021211845` | `schedule_private_phone_otp_retention_72h` |
| `20261022000414` | `stage_twilio_sms_hook_budget` |
| `20261022184023` | `voice_request_admission` |
| `20261022191541` | `optimize_official_event_cursor` |
| `20261023190534` | `oracle_public_projection_bridge` |
| `20261027182147` | `seed_23_optional_store_drafts_20261027` |
| `20261027220121` | `cache_featured_injury_counts_private` |
| `20261027220234` | `speed_league_digest_indexed_lookup_and_refresh` |
| `20261027221927` | `avoid_unchanged_sportsdb_archives` |
| `20261027222143` | `cache_football_queue_column_validation_per_batch` |
| `20261027233208` | `staged_bulk_football_upsert_helper` |
| `20261027233240` | `enable_bulk_football_queue_upserts` |
| `20261102224223` | `add_private_runtime_metrics_sampling_20261102` |
| `20261102230321` | `add_private_performance_metrics_rates_20261102` |
| `20261102230509` | `add_private_hourly_query_latency_snapshots_20261102` |

### Migrações na branch que não estão registradas em produção

| Arquivo SQL |
|---|
| `20261021232000_reconcile_private_phone_otp_budget.sql` |
| `20261021234500_stage_twilio_sms_hook_budget.sql` |
| `20261023223348_require_explicit_public_table_grants.sql` |
| `20261023232728_index_public_club_name_lookup.sql` |
| `20261023232734_link_verified_club_stadiums.sql` |
| `20261104221915_secure_career_risk_attestation.sql` |

A última migração listada acima (`secure_career_risk_attestation`) **foi criada nesta PR e é propositalmente pendente**. Não aplicá-la até garantir a ordem e o ambiente corretos.

## Consequências práticas para publicação

1. **Bloquear alterações automáticas no banco de produção** enquanto a genealogia não corresponder à sequência esperada do Supabase CLI. Não usar `migration repair`, `db reset`, exclusões nem `apply_migration` no ambiente de produção sem identificar cada versão e confirmar rollback.
2. Fazer extração autenticada e restrita dos textos originais de `schema_migrations.statements` para as 16 versões, **fora de logs, chats e artefatos públicos**, validar segredos, PII, compatibilidade e autoria antes de reconstruir arquivos históricos.
3. Distinguir migrações SQL diferentes com resultados equivalentes (ex.: alternativas de OTP e Twilio) de migrações realmente pendentes. Ter nomes/versões próximos **não garante equivalência**.
4. Reconstituir uma linha de base reexecutável em banco descartável com histórico convergente, rodar SQL de permissões, RLS A/B, replay de pagamentos e verificações de desempenho.
5. Comprovar um *preview* exclusivo para PR #123 e Stripe Test Mode com webhooks apontando apenas para esse preview, sem o Worker de produção que está em `PAYMENTS_ENVIRONMENT=live`.
6. Só após passar os testes de staging, preparar uma operação de canário reversível na Cloudflare. A reversão de Worker **não reverte dados ou DDL PostgreSQL**.

## Estado e limites

O CI executou `supabase db reset --local` e os testes de integridade contra um banco **descartável**, não contra a sequência integral de alterações que já existe na produção. O projeto de produção permanece ativo e nenhum SQL mutável foi executado por esta auditoria. Os dois ambientes de preview atualmente visíveis pelo sistema de branches do Supabase pertencem aos PRs #60 e #62, **não** ao PR #123.

**Status para revisão:** divergência confirmada e inventariada; recuperação segura dos históricos, equivalência e replay representativo de produção ainda pendentes. Não declarar pronta a implantação.
