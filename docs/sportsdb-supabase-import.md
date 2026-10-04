# Importação de futebol TheSportsDB

## Arquitetura após a migração do arquivo bruto

A fonte original continua no Cloudflare Worker, com os JSONs arquivados no Cloudflare R2. O Supabase mantém o catálogo normalizado que o jogo consulta, os cursores de importação e um ledger compacto de arquivos processados.

A tabela bruta `public.sportsdb_records` foi removida do Supabase. A coluna `payload` foi removida de `public.sportsdb_archives`; essa tabela agora guarda apenas chave, data, estado e metadados de retry. A função `sportsdb-bridge` transforma cada lote e grava somente nas tabelas `official_*`. O serviço continua privado; as tabelas do catálogo mantêm seu modelo de acesso existente.

## Acesso à origem

A Edge Function aceita o endpoint público sem credenciais. Se Cloudflare Access proteger a origem, configure `SPORTSDB_CF_ACCESS_CLIENT_ID` e `SPORTSDB_CF_ACCESS_CLIENT_SECRET` em Supabase Dashboard → Edge Functions → Secrets; quando ambos estiverem presentes, a função envia os headers padrão de Service Token. Nunca grave esses valores no código ou no SQL do cron.

Na checagem de 4 de outubro de 2026 às 00:45 UTC, o endpoint configurado ainda respondeu HTTP 200 com `text/html` e a página “Sign in ・ Cloudflare Access”, não com o JSON esperado. `jogomanager-web` respondeu 406 e `jogomanager.com`/`www` responderam 403, portanto não são endpoints JSON alternativos. O cron permanece ativo em retry; os cursores persistidos não foram reiniciados.

## Resultado verificado em 3 de outubro de 2026

Às 22:43 UTC (19:43 em Brasília), o banco caiu de **307.940.499 bytes** para **80.833.683 bytes**, uma redução de **227.106.816 bytes (73,7%)**.

| Item | Antes | Depois |
| --- | ---: | ---: |
| `sportsdb_records` | 177.405.952 bytes, 147.735 registros | removida |
| `sportsdb_archives` | 57.303.040 bytes, com 22.271 payloads JSON | 7.569.408 bytes, ledger sem payload |
| Banco inteiro | 307.940.499 bytes | 80.833.683 bytes |
| Arquivo bruto na Cloudflare R2 | — | 22.273 objetos; 110.252.133 bytes no snapshot |

O R2 tinha orçamento configurado de 2.500.000.000 bytes nesse snapshot. O histórico de arquivos no Supabase preservou 22.271 itens como concluídos, sem itens pendentes, em retry ou com falha.

## Estado atual da importação

Depois da migração, a função Edge `sportsdb-bridge` ficou ativa na versão 6. O cron `sportsdb-supabase-import` foi reativado e executa a cada minuto. A resposta registrada às 22:44 UTC foi HTTP 200: `status=ok`, 11 páginas, 1 arquivo processado e `source_complete=false`. O estado consultado às 22:47 UTC mostrava o importador habilitado, sem erro; todos os cursores locais estavam atualizados até o snapshot da origem.

| Catálogo normalizado | Registros |
| --- | ---: |
| Ligas | 692 |
| Equipes | 10.631 |
| Jogadores | 42.913 |
| Temporadas | 4.026 |
| Equipamentos | 8.657 |
| Estádios | 1.916 |
| Partidas | 42.636 |
| Detalhes de partidas | 0 |
| Referências de mídia | 98.837 |

A origem ainda reporta a fase `teams` incompleta. Por isso, a coleta automática continua, mas a importação inteira **ainda não está certificada como completa**. Um cursor local estar atualizado significa apenas que ele alcançou o snapshot publicado pela origem.

## Limites e verificação

- A atribuição da fonte é [TheSportsDB](https://www.thesportsdb.com/).
- A ponte ainda limita uma entidade a offset menor que 100.000. Entidades maiores precisam de paginação particionada na origem e na ponte antes de serem certificadas.
- `scripts/sportsdb-bridge-status.sql` mostra saúde do serviço, tamanho do banco, catálogo, cursores, fases da origem e contagem/tamanho do arquivo R2 sem credenciais.
- `scripts/sportsdb-bridge-integrity-check.sql` confere idempotência do catálogo e valida que o JSON bruto permanece fora do Postgres; todas as alterações da checagem são revertidas.
- `scripts/sportsdb-bridge-access-check.mjs` confere o catálogo público e o bloqueio do ledger, cursores e controle privados.
- `node scripts/sportsdb-import-preview.mjs` abre o painel local somente de leitura. Se `http://127.0.0.1:4339` já estiver ativo, reutilize o servidor existente.

O limite de segurança configurado para a importação no Supabase continua em 471.859.200 bytes (450 MiB). A ponte preserva os IDs de origem e faz upsert dos registros canônicos, sem substituir dados personalizados dos clubes e saves do jogo.
