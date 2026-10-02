# Importação de futebol TheSportsDB no Supabase

A importação está ativa no projeto `lguqnwvsfeefxamzeyos`. O serviço `sportsdb-bridge` copia a coleta premium existente no Cloudflare, preservando IDs da fonte, contexto de clube/liga e temporada. O agendamento `sportsdb-supabase-import` executa a cada minuto. Uma execução em andamento é protegida por um lease; a próxima retoma os cursores persistidos.

## Verificação de 2 de outubro de 2026, 15:08 de Brasília

Uma execução adicional acionada pelo conector Supabase recebeu HTTP 200, sem timeout, e processou **82 páginas e 40 arquivos**. O estado consultado em seguida estava habilitado, sem erro atual e com `source_complete=false`.

| Registro consultado no Supabase                    | Quantidade |
| -------------------------------------------------- | ---------: |
| Registros originais, incluindo índices e contextos |     75.799 |
| Ligas oficiais                                     |        692 |
| Equipes oficiais                                   |     10.631 |
| Jogadores oficiais                                 |     19.703 |
| Temporadas por liga                                |      4.025 |
| Uniformes/equipamentos                             |      7.689 |
| Partidas oficiais                                  |     14.810 |
| Estádios com metadados completos                   |          3 |
| Detalhes de partidas                               |          0 |
| Referências de imagens                             |     55.345 |
| Arquivos completos já processados                  |      1.223 |
| Arquivos aguardando processamento                  |      9.598 |

Este é um retrato datado, não o total final do provedor. Índices e arquivos completos têm contagens diferentes. Por exemplo, um índice de estádio pode existir antes de seu arquivo ser processado e alimentar `official_venues`.

A consulta seguinte, às 15:09:56, confirmou o avanço automático para **79.535 registros originais**, 1.267 arquivos processados e 9.756 pendentes, ainda sem erro atual. No painel consultado às 15:09:51 havia 21.590 jogadores, 15.754 partidas, 7.691 equipamentos e 56.632 referências de imagens. As demais contagens do painel permaneciam iguais às da tabela acima. A evidência visual está em `verification/sportsdb-2026-10-02/import-catalog.png`.

## Dados e continuidade

As tabelas `official_*` são o catálogo normalizado. `sportsdb_records` guarda o JSON de origem e `sportsdb_archives` controla os arquivos; ambas são privadas, assim como o controle e os cursores. O importador não altera os clubes, competições ou saves personalizados do jogo. Imagens são referências HTTPS do provedor; não são cópias de todos os arquivos de imagem no Storage do Supabase.

O coletor de origem ainda estava na fase `teams`. `catalog`, `leagues` e `teams-index` estavam concluídos. A conclusão integral também exige `players`, `schedules`, `rounds`, `tables` e `events`. O serviço só declara conclusão quando essas fases, todos os cursores e todos os arquivos terminam.

O banco inteiro ocupava 110.963.859 bytes nesta consulta. A configuração existente pausa a importação a partir de 471.859.200 bytes (450 MiB). Não houve contratação de capacidade adicional. Além disso, a função atual interrompe uma entidade ao atingir offset 100.000: volumes maiores exigirão paginação particionada na origem e na ponte. Portanto, a execução automática está comprovada; a cópia de toda a base histórica do SportsDB ainda não está certificada.

## Como conferir

- No Supabase, abrir o Table Editor e consultar as tabelas `official_*`.
- Executar `scripts/sportsdb-bridge-status.sql` no SQL Editor para contagens, cursores, fases e erros, sem expor credenciais.
- Executar `node scripts/sportsdb-import-preview.mjs` e abrir `http://127.0.0.1:4339` para o painel local somente de leitura. Se já estiver em execução, reutilizar a página existente.
- Executar `node --test scripts/sportsdb-bridge.test.mjs` para os contratos da importação. Os sete testes passaram nesta verificação.
- Executar `node scripts/sportsdb-bridge-access-check.mjs` para validar catálogo público e bloqueio das tabelas privadas. O resultado verificado foi HTTP 200 para ligas/jogadores e HTTP 401 para JSON original/controle.

O advisor de segurança retornou avisos sobre descoberta dos catálogos via GraphQL e funções preexistentes de rankings/economia. Os avisos não foram tratados como comprovação de vazamento: os acessos privados desta importação foram testados diretamente. Não houve mudança de permissões nesta verificação.
