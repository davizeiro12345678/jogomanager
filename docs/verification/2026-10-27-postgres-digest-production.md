# Otimização real do PostgreSQL em produção (27/10/2026)

Projeto Supabase: JogoManager - Produção (PostgreSQL 17).
Migrações **já aplicadas na produção** pelo Supabase MCP:
- `20261027220121_cache_featured_injury_counts_private`
- `20261027220234_speed_league_digest_indexed_lookup_and_refresh`

## Evidência

Antes: `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.get_public_league_digest_source(ARRAY[39,140,135,78]::integer[])`
executou em **14.707,965 ms** e registrou **29.998 blocos lidos** (quatro ligas, com cache/IO do instante da medição).

Depois: mesma consulta, **16,558 ms** e **1 bloco lido**. Razão observada **~888 vezes**,
**não** um benchmark controlado de produção sob carga equivalente. Tempos são apenas de execução
interna do PostgreSQL, não a latência HTTP fim a fim.

Outras sondagens após: uma liga **~7,4 ms**, doze ligas **~25,4 ms**.

Os quatro registros retornaram exatamente as mesmas contagens (39: 16.956, 78: 13.467,
135: 15.129, 140: 14.504) e os mesmos hashes MD5 do payload antes/depois.

## Segurança e consistência

- View em esquema não exposto. `anon` e `authenticated` não podem executar o RPC;
  `service_role` pode. RPC continua `SECURITY INVOKER`.
- O cache da view é atualizado a cada **15 minutos** por `pg_cron`, então contagens
  de lesões **podem atrasar até 15 minutos**, além do cache público de 5 min na aplicação.
- IDs de ligas fora das doze destacadas mantêm a contagem exata no banco.
- O total de clubes/escudos e as sessões Auth/Stripe/multiplayer não foram alterados.
- Para diagnosticar falhas na atualização: consultar `cron.job_run_details` para o job
  `jm_refresh_featured_injury_counts_15m`. Antes de promover, verificar execuções reais.

## Ainda não feito

- VPS Contabo não aceitou conexão TCP na porta 22 a partir do computador do usuário no teste
  desta execução. Portanto CPU/RAM/IOPS, 8 threads, eventos por segundo, Geekbench e benchmark
  end-to-end no VPS **não foram medidos**.
- O carregamento completo dos 38.854 clubes e de seus escudos está preparado no PR #86,
  que permanece draft: limitado ao gateway atual de 100 itens e sem ativação produtiva.
- `football_queue_finish` acumulou 607.683 chamadas, média 48,71 ms,
  total ~29.600s na amostra histórica de `pg_stat_statements`. É outro gargalo
  e requer perfilamento com amostragem não destrutiva e testes de importação antes de reescrita.
- A auditoria Supabase listou avisos de exposição GraphQL e função
  `mutate_player_career` SECURITY DEFINER; seu acesso de usuário é intencional e
  possui checagens de titularidade/MFA. Não revogar permissões cegamente.

## Rollback (manutenção controlada)

1. Voltar a função à definição anterior da migration
   `20261019235249_get_public_league_digest_source.sql` mantendo ACL.
2. Cancelar o job com `SELECT cron.unschedule('jm_refresh_featured_injury_counts_15m')`.
3. Só após verificar ausência de uso, remover a view e seu schema privado.
   Não fazer o rollback sem necessidade em ambiente com tráfego.

## 28/10/2026: confirmação pelos logs do erro crítico no Supabase
A análise dos logs PostgreSQL das últimas 24h encontrou **848** ocorrências
`ERROR SQLSTATE 57014` (statement cancelado), todas na chamada PostgREST à
`public.get_public_league_digest_source`, queryid `4149581782446921425`.
Distribuição pré-correção: entre 17h e 21h UTC eram aproximadamente 159–164
timeouts/hora. O último timeout registrado foi **27/10/2026 22:02:39 UTC**.
A consulta agregada por janela mostrou **0 ocorrências a partir das 22:03 UTC**
até o horário da verificação (~28/10 00h UTC). Esse dado apoia a hipótese de
que a otimização anterior eliminou o erro recorrente; não garante que erros
futuros sejam impossíveis.

A repetição de `EXPLAIN (ANALYZE,BUFFERS)` de quatro ligas
`[39,140,135,78]` levou **14,127 ms**, com 14.114 blocos hit e nenhuma
leitura física reportada nesse plano. O resultado antigo documentado chegou
à ordem de 14,7 s sob condições diferentes, portanto o fator de melhoria
é indicativo, não benchmark controlado.

Outros avisos do Supabase: `pg_graphql_anon_table_exposed` (26 WARN),
`pg_graphql_authenticated_table_exposed` (48 WARN), um
`authenticated_security_definer_function_executable` WARN. Os objetos
públicos são intencionalmente legíveis; sem auditoria de permissões por
objeto não revogar acesso de forma indiscriminada.
