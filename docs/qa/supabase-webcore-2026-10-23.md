# Supabase e startup: avaliação de 23/10/2026

Status: proposta em rascunho; não aplicada ao Supabase nem publicada no site.

## Escopo e método

Projeto `lguqnwvsfeefxamzeyos`, código base `66f55eab558edb41a6f2d79482d1ac6ed69ed163`.
Somente catálogos, estatísticas e metadados foram consultados em produção. Não foram
criados usuários, realizadas compras, alterados saldos, resetadas estatísticas ou
executadas cargas de teste no banco remoto. A configuração Oracle existente foi preservada.

## Banco e segurança

- Consulta de 22:38:15 UTC: 71 tabelas no schema public, todas com RLS; zero índices públicos inválidos.
- Nenhuma duplicata exata de índice público encontrada na comparação de chaves,
  classes, collation, opções, expressões e predicados.
- Advisor: 63 índices sem uso observado; isso não comprova que sejam dispensáveis.
- As políticas de proprietário consultadas já usam subselect de auth.uid().
- As duas views públicas consultadas usam security_invoker=true.
- A RPC mutate_player_career autentica o proprietário, verifica MFA e faz CAS;
  não foi removida sua execução autenticada para silenciar o advisor.
- As tabelas internas sem políticas continuam fechadas por padrão. Catálogos
  públicos não perderam SELECT para eliminar avisos de descoberta GraphQL.
- Tamanho do banco: 11.608.534.163 bytes. Não é uma medição de RAM/CPU ou de latência.

Achado de hardening: defaults de tabelas e sequências futuras criadas por postgres
em public concedem privilégios amplos a anon/authenticated. A nova migração exige
grants explícitos nesses objetos futuros, sem alterar objetos existentes ou os
defaults de service_role. Não modifica schemas ou defaults de papéis gerenciados.
É prevenção de exposição futura, não evidência de vazamento atual.

Teste SQL adicionado ao replay descartável verifica negação padrão, concessão
explícita e preservação dos contratos existentes. Não executar esse teste em produção.

## Frontend

O link Discord foi separado da seção completa e seu texto editorial. A página
inicial não precisa incluir a seção inteira na dependência estática do link.
As atualizações DOM de metadados foram movidas para o módulo de gameplay já
carregado sob demanda; o controle de cancelamento permanece no efeito React.
Também foi corrigida uma linha em branco que reprovava o lint na base.

Comparação local com Node 24.19.0, mesmas dependências de npm ci, build de produção
e saída candidata limpa. O projeto exige Node >=24.22.0 <25; portanto a comparação
local é auxiliar e não substitui CI. A base foi construída limpa; a candidata era
um checkout modificado, com identidade de build local diferente. Hashes e divisão
de chunks podem afetar diferenças pequenas. Não se atribui cada byte ao código.

| Estimativa de transporte | Base (bytes) | Candidata (bytes) |
| --- | ---: | ---: |
| Home startup gzip | 171.239 | 170.413 |
| Home startup Brotli Q6 | 162.238 | 161.399 |
| JS total gzip, incluindo lazy | 2.285.933 | 2.286.117 |
| JS total Brotli Q6, incluindo lazy | 2.157.326 | 2.157.452 |

O gate estrito de comparação **reprovou**: +184 bytes gzip/+126 bytes Brotli no
total, além de pequenos aumentos nas demais rotas. Os limites não foram alterados.
Não declarar a proposta pronta para merge ou produção antes de corrigir e repetir
a comparação das revisões limpas no runner exigido.

## Verificação e pendências

- Build candidato concluiu; orçamento absoluto bundle:check passou.
- Suíte existente: 261 arquivos, 1.406 testes passaram antes da última extração.
- Testes focados após a extração: 2 arquivos, 7 testes passaram.
- Testes do mecanismo de gates: 12 passaram; não equivalem à execução dos gates.
- Replay nativo PostgreSQL 17 não executado localmente: Docker/psql indisponíveis.
- Lighthouse desktop/mobile, Core Web Vitals reais, MatchSim ABBA e validação
  visual em hardware físico ainda não certificados nesta proposta.
- Não há comparação CPU/RAM/disco antes/depois de uma implantação, pois não houve
  implantação. Não inferir economia de banco a partir de redução de bundle.

A entrega depende de todo o workflow Quality gates, inclusive replay SQL e
comparação sem regressões. Não ativar extensões ou funções extras sem necessidade
demonstrada, nem executar REINDEX/VACUUM FULL ou remover índices em massa.

Referências: https://supabase.com/docs/guides/api/securing-your-api e
https://supabase.com/docs/guides/database/database-linter.
