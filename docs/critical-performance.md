# Limites críticos de desempenho e publicação

Os limites abaixo são obrigatórios. Falha, resultado ausente, execução cancelada ou teste ignorado impedem a aprovação do gate correspondente. A publicação em produção depende do workflow completo **Quality gates** concluído com sucesso. Não aumentar tolerâncias, desativar cenários ou converter erros em avisos para liberar uma versão.

## Verificações automáticas

| Área                          | Limite ou contrato                                                                                             | Evidência                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Lint                          | Zero erros e zero avisos                                                                                       | `npm run lint`, com `--max-warnings=0`                                                    |
| TypeScript                    | Nenhum erro                                                                                                    | `tsc --noEmit`                                                                            |
| Stress da simulação           | 200 sementes e os respectivos replays independentes executados e aprovados                                     | `stress-results.json`, validado por `verify-stress-report.mjs`                            |
| Construtor MatchSim           | Regressão material de CPU acima de 10%, confirmada pelo limite inferior do intervalo bootstrap de 99%, reprova | Comparação ABBA no mesmo runner; 62 amostras por revisão e 21 checkpoints determinísticos |
| JavaScript inicial            | Nenhum aumento de gzip ou Brotli Q6 nos caminhos comparados e no total; medidas ausentes reprovam              | Builds das duas revisões no mesmo runner, relatórios e `bundle-impact.json`               |
| Orçamento absoluto de bundles | Todos os limites de `bundle:check`                                                                             | Relatório do build proposto                                                               |
| Lighthouse mobile             | Performance ≥ 98, acessibilidade ≥ 90, LCP ≤ 2.500 ms, CLS ≤ 0,1 e TBT ≤ 200 ms                                | Três execuções por URL, agregação pessimista; todas devem cumprir os limites              |
| Lighthouse desktop            | Performance ≥ 45, acessibilidade ≥ 90, boas práticas ≥ 85                                                      | Limites existentes preservados e agora com severidade de erro                             |
| Assets 3D                     | Contrato de compressão e integridade aplicável aos assets presentes                                            | `verify-game-assets.mjs`                                                                  |
| Gráficos e física             | Contratos do cenário reproduzível e da autoridade da bola                                                      | Testes e build do benchmark gráfico                                                       |
| Segurança do banco            | Replay do histórico canônico e contratos de acesso aprovados                                                   | Banco local descartável; nunca resetar produção para testar                               |
| Publicação                    | HTTPS público, backend `ready` e SHA exato compilado no servidor                                               | `verify-public-deployment.mjs` com `EXPECTED_COMMIT_SHA`                                  |

O agregado **Critical performance release gate** exige sucesso dos jobs de verificação, bundles, stress, construtor, assets, contratos gráficos e Lighthouse. A proteção administrativa do branch no GitHub é uma camada separada: configurar esse check como obrigatório exige acesso às regras do repositório. A existência do workflow não prova que essa configuração administrativa foi aplicada.

## Protocolo do construtor

`npm run perf:match-setup -- DIRETORIO_BASE DIRETORIO_CANDIDATO SAIDA` exige o Node de `.nvmrc` e a mesma árvore de dependências. O runner serializa uma única fixture de Flamengo × Palmeiras e a reutiliza nas duas revisões. A ordem é base, candidato, candidato, base. Cada passagem aquece 3.000 construções e coleta 31 lotes de 1.000 construções.

Os checkpoints de três sementes em sete instantes devem coincidir. O relatório inclui hashes da fixture e do lockfile, ambiente, amostras brutas e violações. O bootstrap caracteriza a variabilidade observada no protocolo; não certifica representatividade de todo hardware nem transforma CPU do construtor em tempo de carregamento ou FPS.

## Limites gráficos por perfil

Os valores são definidos em `src/game/contracts/graphics-profile.ts` e continuam sendo requisitos de qualidade do perfil.

| Perfil | FPS alvo | Frame time p95 máximo | Draw calls máximas | Triângulos máximos |
| ------ | -------: | --------------------: | -----------------: | -----------------: |
| Baixa  |       60 |                 15 ms |                 90 |            180.000 |
| Média  |       60 |                 15 ms |                170 |            420.000 |
| Alta   |       60 |                 15 ms |                260 |            850.000 |
| Cinema |       30 |               33,3 ms |                340 |          1.200.000 |

Esses valores são os alvos configurados para o controlador; a atualização de 22/10/2026 tornou os alvos de frame time e do perfil Alta mais exigentes, sem aumentar os limites de geometria ou chamadas de desenho. A configuração não comprova que um dispositivo alcançou o alvo.

O governador reduz o trabalho visual quando há pressão. Testes de contrato e imagens de um navegador com renderização por software não comprovam esses limites em um aparelho físico. Mudanças do rig ou do renderizador exigem comparação no mesmo cenário, semente, resolução, qualidade, dispositivo e caminho gráfico, com erros e perdas visuais examinados. Registrar explicitamente quando essa certificação não foi realizada.

## Release do Supabase e do Cloudflare

A migração `20261020101601` deve ser entregue pelo fluxo canônico, sem reaplicar as 47 versões históricas. Antes de promover uma branch Supabase, comparar também as Edge Functions: o merge publica funções além de SQL e pode reintroduzir implementações antigas. Não trocar segredos ou configurações de produção como efeito secundário de uma migração.

`tests/sql/supabase-production-readonly.sql` faz a verificação de metadados após a entrega sem criar usuários de teste, escrever registros ou alterar o esquema. O contrato com fixtures pertence somente ao banco descartável.

O identificador de versão de `/api/health` é incorporado no build a partir do Git; não é um rótulo mutável do Worker. O workflow recusa um SHA de build divergente do checkout e uma execução de publicação superada por outra revisão em `main`. Uma resposta `ready` sem o SHA esperado é insuficiente para confirmar a entrega.
