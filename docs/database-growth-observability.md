# Observabilidade de crescimento do banco

A migração `0060_database_growth_observability.sql` adiciona uma série histórica append-only para comparar o crescimento do banco sem contar linhas das tabelas de negócio. Cada captura registra o tamanho total do banco, o tamanho e os contadores estimados de cada tabela, além do tamanho, uso e validade de cada índice. As linhas de tabelas vêm de `pg_stat_user_tables`; `n_live_tup` e `n_dead_tup` são estimativas do PostgreSQL, não contagens exatas. Os timestamps de vacuum/analyze também são os valores mantidos pelo catálogo de estatísticas.

## Limite e segurança

Os dados persistem em `database_growth_private`, um schema não exposto pelo caminho público. As tabelas têm RLS habilitado e revogam privilégios de `PUBLIC`, `anon` e `authenticated`; apenas `service_role` recebe uso do schema e leitura/escrita necessária para a captura. A ponte RPC no schema `public` usa `SECURITY INVOKER`, fixa `search_path = ''`, valida `current_user = 'service_role'` e revoga `EXECUTE` dos papéis públicos. Não há função `SECURITY DEFINER` nova e nenhum dado de usuário, nome de jogador, e-mail ou conteúdo de negócio é copiado.

A captura usa `pg_database_size`, `pg_total_relation_size`, `pg_table_size`, `pg_indexes_size`, `pg_relation_size`, `pg_stat_user_tables` e `pg_stat_user_indexes`. Portanto, mede o catálogo e os contadores coletados pelo servidor; não executa `COUNT(*)`, não faz `VACUUM`, não remove dados e não cria ou elimina índices. O histórico é somente de inclusão: a migração não concede `DELETE` e não cria rotina de retenção.

As leituras têm limites: o histórico aceita no máximo 100 resumos por chamada, com offset até 100.000; o detalhe aceita no máximo 1.000 tabelas e 5.000 índices e informa quando a resposta foi truncada. Esses limites evitam que uma consulta operacional retorne uma carga arbitrariamente grande.

## Interface server-only

O utilitário `scripts/database-growth-snapshot.mjs` exige `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` somente no ambiente server-side. Não imprima nem envie esses valores ao cliente ou ao log. Exemplos:

```bash
node scripts/database-growth-snapshot.mjs capture
node scripts/database-growth-snapshot.mjs history --limit 30 --offset 0
node scripts/database-growth-snapshot.mjs show --snapshot-id 1 --table-limit 500 --index-limit 1000
```

`capture` retorna apenas o resumo da captura; `history` retorna resumos ordenados do mais recente para o mais antigo; `show` retorna o resumo e as maiores tabelas/índices do snapshot solicitado. A ausência de uma linha em `show` retorna `null`, sem fallback para uma varredura.

## Operação e interpretação

Uma série útil exige pelo menos duas capturas separadas por uma janela de carga comparável. O tamanho do banco e os bytes por relação devem ser comparados por delta e intervalo, enquanto `n_live_tup`, `n_dead_tup`, scans e timestamps devem ser tratados como estatísticas estimadas/acumuladas. Um aumento de `dead rows` ou um timestamp de vacuum antigo é sinal para investigar; esta migração não autoriza manutenção automática.

A soma dos bytes por relação pode não coincidir perfeitamente com o tamanho total do banco, porque o total inclui objetos e estruturas que não aparecem como relações de usuário. Índices inválidos ou não prontos continuam sendo registrados para diagnóstico e não são alterados pela captura.

A validação local desta frente é focal. Como não há `psql` ou Supabase CLI disponível no worktree para replay de banco, o teste verifica o contrato da migração e as chamadas RPC sem aplicar DDL remoto. A aplicação em produção continua bloqueada até a execução da migração no pipeline autorizado e uma chamada server-only de captura de prova.

## Referências

- [Documentação PostgreSQL — estatísticas de monitoramento](https://www.postgresql.org/docs/current/monitoring-stats.html): define `pg_stat_user_tables`, `pg_stat_user_indexes`, `n_live_tup`, `n_dead_tup` e timestamps de vacuum/analyze.
- [Documentação Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security): explica grants, exposição de views/functions e o risco de `SECURITY DEFINER` em schema exposto.
- [Relatório histórico de auditoria Supabase](./relatorio-auditoria-webcore-seo-supabase-2026-10-23.md): registra uma fotografia anterior sem série confiável de crescimento.
