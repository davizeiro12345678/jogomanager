# Otimização do finalizador da fila PostgreSQL, 27/10/2026

**Aplicado ao Supabase de produção**: `20261027222143_cache_football_queue_column_validation_per_batch`.

## Diagnóstico
`football_queue_finish` apareceu em `pg_stat_statements` com 607.683 chamadas,
48,71 ms por chamada e 29.600 segundos de custo acumulado no histórico consultado.
A fila registrava 3.507.124 jobs pendentes e 643.533 concluídos (fotografia, não tempo real).
A função verificava `pg_catalog.pg_attribute` repetidamente para cada coluna de cada registro modificado.

## Correção segura
- Cache **local à chamada** das colunas permitidas por tabela/lote, criado apenas quando
  a primeira alteração precisa de validação. Reduz consultas repetidas ao catálogo.
- Preserva testes de lease, locks por identidade, proteção de colunas, chaves,
  idempotência e o `SECURITY DEFINER` preexistente.
- Checagem MD5 do texto da função antes do `CREATE OR REPLACE`; não reescreve
  uma versão desconhecida em produção.
- Permissão original restrita a `service_role` confirmada após aplicação.

## Verificação
A migração retornou sucesso. Contrato transacional em produção para lote de 20
registros sintéticos passou, com inserções, idempotência do recibo e rollback de
todos os dados de teste. Não foi alterada nenhuma carreira ou pagamento.

## Limitações
A otimização evita trabalho repetido de metadados por lote, mas **não resolve**
a natureza registro-a-registro dos `UPSERTs` e dos `FOR UPDATE`. Não há benchmark
de ponta a ponta antes/depois com CPU, RAM, RPS e eventos/s sob carga equivalente.
O VPS não foi alterado. Futuras mudanças em massa exigem ensaio de equivalência
em banco isolado e validação de locks/duplicatas antes da produção.
