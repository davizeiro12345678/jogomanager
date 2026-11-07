# Bulk UPSERT para API-Football: correção aplicada em 27/10/2026

## Gargalo e intervenção
A função `public.football_queue_finish` tinha, no histórico consultado,
607.683 chamadas e média de 48,71 ms. Antes, percorria cada linha,
criava SQL dinâmico e executava `UPSERT` individual.

A função auxiliar interna `private_performance.bulk_upsert_football_rows`
processa lotes de 8 a 300 linhas uniformes com os campos reais
`kind,ref,payload,updated_at`, deduplicados. Ela conserva bloqueios consultivos
por identidade, ordenação de locks, `FOR UPDATE`, comparação de contenção
JSONB (não igualdade simples) e contadores inserted/updated/unchanged.
Retorna NULL em entradas incompatíveis. `football_queue_finish` então recua
para o processamento original sem afetar os outros seis destinos.

## Testes
A helper isolada passou inserção/duplicata sem alteração/atualização para
20 registros. Uma execução transacional pela função pública repetiu os três
cenários e passou, com ROLLBACK. Sem alteração de dados de jogadores reais.

## Segurança e limitações
A helper é SECURITY INVOKER em schema privado; não conceder acesso anon/auth.
Função pública mantém ACL e contrato originais. Modificações são dependentes
de duas migrations já aplicadas em produção, versões 20261027233208 e
20261027233240. Precisam ser tratadas como já registradas quando
sincronizando o histórico Supabase/GitHub.

O ganho de throughput real do importador **não foi medido** com carga de
produção normalizada. Não confundir as medições Sysbench do VPS com ganho dos
UPSERTs PostgreSQL no Supabase.
