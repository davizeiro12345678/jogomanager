# Supabase e startup: avaliação de 23/10/2026

Status: proposta no PR #65. As novas migrações ainda não foram aplicadas ao banco de produção; a publicação exige todos os Quality gates.

## Banco e segurança

Auditoria somente de leitura do projeto `lguqnwvsfeefxamzeyos` às 23:14 UTC:
71 tabelas públicas com RLS, 100 políticas, todas com chave primária, nenhum índice inválido ou duplicata exata de índice público. Duas views públicas com `security_invoker=true`. Tamanho: 11.608.566.931 bytes; isso não mede CPU, RAM nem capacidade simultânea.

- As 63 indicações de índice sem uso observado não justificam remoção em massa.
- Tabelas privadas com RLS e sem políticas continuam fechadas por padrão.
- `mutate_player_career` conserva autenticação, proprietário, MFA, CAS e validação de progresso.
- A migração de grants exige concessão explícita para tabelas/sequências futuras criadas por postgres em public. Preserva objetos existentes, defaults de service_role e papéis gerenciados.
- Um índice `(name, source_id)` em `official_teams` atende à consulta real por nome do clube e funciona também com plano preparado genérico. Na observação anterior, a busca percorreu 6.030 linhas rejeitadas e 72 blocos em cache. Não existe medição posterior porque o índice não foi aplicado.
- A correção de estádios preenche somente vínculos ausentes com ID de origem, nome de estádio e esporte coincidentes e associação única. A prévia em produção encontrou 289 clubes elegíveis. A migração registra o vínculo anterior e o novo em tabela privada; não altera vínculos existentes.
- Replay SQL verifica negação por padrão, concessão explícita, preservação do catálogo e RPC, e privacidade dos backups. Executar somente no PostgreSQL descartável do CI.

Qualidade observada: 201.677 registros de jogadores, 196.235 jogadores canônicos de origem player, 38.854 clubes; zero referências quebradas jogador-clube e alias-canônico. Há 66.499 jogadores sem nascimento e 38.854 clubes sem estádio vinculado. Nenhum dado ausente foi inventado para elevar uma pontuação de qualidade.

## Alterações do frontend

- O link comunitário usa uma entrada pequena compartilhada com a URL do convite; a seção editorial permanece separada.
- Os 12 heads de rotas privadas aguardam o catálogo de metadados por importação dinâmica. Isso mantém esse catálogo fora do startup público e preserva canonical e noindex antes da renderização da rota.
- As atualizações de metadados no DOM ficam no mesmo módulo carregado sob demanda, com cancelamento no efeito React.
- As fontes só são ativadas após os recursos críticos da página terminarem; continua disponível o fallback do sistema em caso de falha.
- CSS de cutscenes/HUD foi separado do CSS público. O CSS completo do jogo compilado permanece idêntico byte a byte ao da base.
- O arquivo CSS público caiu de 59.437 para 57.446 bytes; gzip nível 9 de 11.817 para 11.389 bytes. A origem do novo DiscordLink também está incluída explicitamente na geração Tailwind.
- Corrigido o lint de uma linha em branco existente em I18nProvider.

## Comparação auxiliar local

Node 24.22.0, mesma máquina, mesmas dependências instaladas, mesmas configurações e mesmo PFM_BUILD_SHA para os dois builds. Base: main `66f55eab558edb41a6f2d79482d1ac6ed69ed163`; candidata: fontes do PR com estas alterações. Saídas geradas anteriores foram arquivadas antes do build limpo. A identidade fornecida iguala o protocolo; não representa uma release candidata já publicada. CI repetirá a comparação com os SHAs reais e checkouts limpos.

Valores em bytes, gzip nível 9 e Brotli Q6 offline. Não são LCP, INP ou FPS.

| Métrica | Base | Candidata | Redução |
| --- | ---: | ---: | ---: |
| JS emitido total (inclui lazy) | 6.983.545 | 6.977.975 | 0.08% |
| JS emitido total (gzip) | 2.285.974 | 2.284.220 | 0.08% |
| JS emitido total (Brotli Q6) | 2.157.425 | 2.155.796 | 0.08% |
| Página inicial startup (gzip) | 171.238 | 167.638 | 2.10% |
| Página inicial startup (Brotli Q6) | 162.319 | 158.939 | 2.08% |
| Nova carreira startup (gzip) | 440.635 | 438.796 | 0.42% |
| Nova carreira startup (Brotli Q6) | 416.512 | 414.784 | 0.41% |
| Partida rápida startup (gzip) | 304.606 | 302.778 | 0.60% |
| Partida rápida startup (Brotli Q6) | 288.682 | 286.963 | 0.60% |
| Match 3D startup (gzip) | 572.371 | 570.117 | 0.39% |
| Match 3D startup (Brotli Q6) | 541.386 | 539.272 | 0.39% |
| Palco cinematográfico startup (gzip) | 536.833 | 536.586 | 0.05% |
| Palco cinematográfico startup (Brotli Q6) | 503.874 | 503.622 | 0.05% |
| Editor startup (gzip) | 178.818 | 178.520 | 0.17% |
| Editor startup (Brotli Q6) | 169.493 | 169.216 | 0.16% |
| Simulação Worker startup (gzip) | 28.426 | 28.426 | 0.00% |
| Simulação Worker startup (Brotli Q6) | 27.363 | 27.363 | 0.00% |

A comparação estrita local passou sem aumento em nenhum caminho obrigatório ou no JS total. O orçamento absoluto também passou. Nenhum limite foi flexibilizado.

## Dependências e verificação

- `body-parser` 2.4.0 e `zod` 4.6.6 corrigem os dois avisos altos observados em 23/10. Lockfiles npm e Bun regenerados pelos respectivos gerenciadores; nenhuma nova dependência de produto adicionada.
- Auditoria npm de produção: zero vulnerabilidades reportadas na consulta local. É um retrato da base de avisos, não certificação de segurança completa.
- Suíte anterior à última mudança de importação assíncrona: 262 arquivos e 1.411 testes aprovados. Após essa mudança: 17 testes focados aprovados, incluindo head privado assíncrono, Discord e redirects.
- Quatro testes do bootstrap de fontes e 12 testes do mecanismo de gates passaram; não substituem Lighthouse ou stress real.
- Lint e tipos passaram nas verificações locais; build limpo, bundle absoluto e comparação estrita passaram.
- Docker/PostgreSQL local indisponível; replay nativo e todas as demais verificações requeridas continuam obrigatórios no CI.
- O preview Cloudflare local foi impedido por restrição de interfaces de rede do ambiente. Não se declara validação visual ou Lighthouse após esta alteração sem evidência de CI.
- PostHog do projeto 603692: consulta LCP p75 dos últimos sete dias para jogomanager.com vazia; taxonomia informa `$web_vitals` não visto nos últimos 30 dias. Não há comparação real antes/depois disponível.

Não foram alterados planos de hospedagem, Oracle, identidades de conta, dados financeiros ou limites de desempenho. Publicação e novas migrações dependem de todo o workflow Quality gates, inclusive replay, 200 partidas, MatchSim ABBA e Lighthouse desktop/mobile. CPU/RAM/disco posteriores e ganhos de capacidade simultânea só podem ser medidos após publicação válida e carga equivalente.

Referências:
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/database/database-linter
- https://posthog.com/docs/web-analytics/web-vitals
- https://github.com/advisories/GHSA-27r3-jxmh-p828
- https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
- https://npmscan.com/package/body-parser
- https://npmscan.com/package/zod
