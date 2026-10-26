# Verificação adicional de desempenho e integridade — 25/10/2026

Esta rodada parte do PR #62 em `32e42a9efec4192815d184efbc02a042e80eae77`, preservando as atualizações já integradas de multiplayer, chat e otimização. As mudanças desta rodada afetam o protocolo de verificação e a documentação. Os resultados históricos abaixo têm data e revisão próprias; não são apresentados como uma medição nova do renderizador mais recente.

| Problema na verificação | Antes | Correção | Exigência preservada |
| --- | --- | --- | --- |
| Comparação de checkpoints de física incompatível | O teste exigia o mesmo estado entre a revisão de execução 2 da base e a revisão 3 do candidato | Registrar ambos os contratos; comparar exatamente as duas repetições independentes de cada versão; exigir também igualdade entre base e candidato quando a revisão é igual | Mesma fixture, runtime, dependências, backends e todas as três sementes em sete instantes |
| Evidência incompleta ou duplicada | A comparação simples não identificava explicitamente uma sequência de checkpoints incompleta ou duplicada | Validar os 21 pares de semente/instante e os hashes, metadados de ambiente e quatro amostras em ordem ABBA | Falha em contrato ausente, revisão desconhecida, troca de backend ou divergência entre repetições |
| Custo do construtor | Uma divergência física legítima podia reprovar o job apesar da avaliação de CPU | Separar as violações de determinismo da avaliação de CPU no relatório | Regressão acima de 10% confirmada pelo limite inferior bootstrap de 99% continua reprovando |
| Otimização WASM | A revisão histórica tinha arquivo de 101.430 B acima do limite | Preservada a otimização já integrada na branch atual, com Binaryen 132.0.0 e conferência de ABI; arquivo versionado de 63.125 B | Limite de 96.000 B e testes do binário real; módulos de assentos independentes preservados |

O ajuste do benchmark não torna checkpoints de uma partida antiga compatíveis com a física atual. A retomada de partidas continua exigindo o contrato vigente. Replays concluídos têm o fluxo histórico documentado separadamente. Os novos testes incluem casos negativos para a mesma revisão com estados divergentes e para divergências entre repetições mesmo após declarar uma revisão nova.

## Validação local da revisão integrada em 25/10

Executada de 15:20:36 a 15:32:29 UTC (12:20:36 a 12:32:29 em São Paulo), com Node 24.22.0. Fontes de produto em `32e42a9`, acrescidas somente desta correção no benchmark e documentação. A base comparativa é `5a75fef`; ambas usam a mesma árvore instalada de dependências.

| Verificação | Resultado | Escopo e limite |
| --- | --- | --- |
| Testes unitários e de integração | 2.226 testes, 408 arquivos aprovados | Stress excluído desta execução local; validado no CI da fonte 32e42a9 |
| Contratos de performance | 23 testes aprovados | Inclui seis novos testes da política de checkpoints |
| TypeScript e lint | Aprovados; zero warnings | Saídas finais com código 0 |
| Build da aplicação e fixture gráfica | Aprovados | Compilação não certifica FPS |
| Orçamento absoluto dos bundles | Aprovado | Todos os limites existentes preservados |
| CPU do construtor, ABBA | 0,4220 → 0,0630 ms; −85,07% | Ganho das otimizações já integradas no PR, medido sobre a mesma fixture; não é CPU total da partida |
| Intervalo bootstrap de 99% da razão de CPU | 0,1430–0,1884 | 62 amostras por revisão, quatro passes, 3.000 aquecimentos + 31 lotes de 1.000 construções por passe |
| Determinismo ABBA | Aprovado nas quatro amostras | 21 checkpoints: três sementes, sete instantes; igualdade exata entre repetições de cada revisão |
| Comparação de bundles com a main | **Reprovada** | 12 violações: seis rotas maiores, em gzip e Brotli; não compensadas pela redução total/Worker |

| Carregamento JavaScript estimado | Base gzip | Atual gzip | Base Brotli Q6 | Atual Brotli Q6 | Resultado |
| --- | ---: | ---: | ---: | ---: | --- |
| Total, incluindo lazy | 2183,15 KiB | 2140,96 KiB | 2057,09 KiB | 2022,74 KiB | Aprovado |
| Página inicial | 163,85 KiB | 165,63 KiB | 155,19 KiB | 156,78 KiB | Reprovado |
| Nova carreira | 428,48 KiB | 456,66 KiB | 404,85 KiB | 431,52 KiB | Reprovado |
| Partida rápida | 295,29 KiB | 300,73 KiB | 279,70 KiB | 284,61 KiB | Reprovado |
| Match 3D | 550,61 KiB | 574,59 KiB | 520,62 KiB | 542,95 KiB | Reprovado |
| Palco cinematográfico | 525,12 KiB | 530,59 KiB | 492,74 KiB | 498,50 KiB | Reprovado |
| Editor | 174,18 KiB | 178,31 KiB | 164,93 KiB | 168,75 KiB | Reprovado |
| Worker de simulação | 27,75 KiB | 13,41 KiB | 26,71 KiB | 12,96 KiB | Aprovado |

O [CI da fonte 32e42a9](https://github.com/davizeiro12345678/jogomanager/actions/runs/40143257078) confirmou tipos/testes/build, o orçamento absoluto, Rust/WASM, assets, replay SQL com contratos de acesso/chat, stress de 200 sementes com repetições independentes e Lighthouse desktop. Mobile reprovou: home performance 0,71 e TBT 1.924,50 ms; scouting 0,94; formações 0,87 e LCP 3.324,40 ms; partida rápida 0,73 e TBT 1.688,50 ms. Os limites de performance 0,98, LCP 2.500 ms e TBT 200 ms permanecem. Os checks do novo commit precisam executar novamente.

[Dados de execução, hashes e comparações](data/performance-followup-2026-10-25.json).

## Comparação gráfica observada em 23/10

Base do renderizador: `93c31441261e011f3db3198d77c44b8208a8596e`, com o coletor diagnóstico harmonizado. Candidato: `6a49afd45bde606569322e5ffd2c2c1c0ad7d2f4`. As revisões posteriores do PR não herdam esses números como se tivessem sido medidas novamente.

Condições: Intel Iris Xe via ANGLE/D3D11, cenário Flamengo × Palmeiras, seed `graphics-broadcast-v1`, qualidade Alta, câmera de transmissão, canvas de 1280×720 e DPR 1. A URL usou `manual=1`: o avanço automático da simulação estava parado e o tempo da fixture permaneceu em zero. Portanto, esta comparação mede a renderização da cena controlada; não mede uma partida avançando automaticamente nem a carga simultânea do solver. Cada versão teve 60 segundos de aquecimento e 300 segundos de coleta. Não houve interrupção do protocolo, adaptação de qualidade, mudança de contrato durante a coleta, erro JavaScript ou requisição falhada nas páginas medidas. O HTML e os bundles servidos foram comparados aos arquivos locais.

| Métrica | Base | Candidato de 23/10 | Variação | Leitura correta |
| --- | ---: | ---: | ---: | --- |
| FPS médio | 32,02 | 40,47 | +26,41% | Ganho observado nesta execução |
| Intervalo p95 | 38,40 ms | 27,80 ms | −27,60% | Cadência mais regular nesta execução |
| 1% low | 12,79 FPS | 31,85 FPS | Aumento | Ainda abaixo de 50 FPS |
| Quadros coletados | 9.605 | 12.142 | +2.537 | Mesma janela de 300 s |
| Chamadas de desenho médias | 223,93 | 191,83 | −14,33% | Menos submissões ao renderizador |
| Triângulos médios | 221.189,58 | 452.287,19 | +104,48% | Mais geometria; não é uma redução de custo nessa dimensão |
| Heap JavaScript usado | 61.752.217 B | 98.200.366 B | +59,02% | Aumento; não corresponde à RAM total do processo |
| Geometria referenciada na cena | 10.291.100 B | 11.460.868 B | Aumento | Censo de buffers, não VRAM medida |
| Texturas referenciadas estimadas | 47.819.473 B | 51.878.291 B | Aumento | Estimativa de payload, não alocação real da GPU |

**A campanha gráfica não está aprovada.** Essa dupla não atingiu os critérios do benchmark de 69 FPS, p95 até 20 ms e 1% low de 50 FPS. A campanha exige três execuções equivalentes e duas GPUs; há somente uma dupla válida nesta evidência. O perfil Alta também tem seus próprios alvos em `graphics-profile.ts`, que não devem ser confundidos com os critérios específicos da campanha. O protocolo mede cadência de renderização, não percentuais separados de uso de CPU e GPU. O navegador informou foco/visibilidade estáveis, o que não prova a ausência de oclusão pelo sistema operacional.

[Dados compactos, hashes e limites](data/graphics-iris-xe-2026-10-23.json). Os artefatos brutos permanecem no diretório local `verification/graphics-realism-20261020/final-performance/main66-23c-native/` da cópia histórica de entrega.

## Resultados que continuam precisando de trabalho

| Área | Evidência existente | Próxima exigência |
| --- | --- | --- |
| CPU do construtor | A revisão integrada atual passou: 0,4220 → 0,0630 ms. A versão histórica tinha 0,2810 → 0,3755 ms em 23/10 e 0,3290 → 0,4220 ms em outra execução de 25/10 | Manter os checks no SHA final; este ganho do construtor não certifica o custo da simulação em andamento |
| Lighthouse mobile | CI 32e42a9 reprovou, incluindo TBT de 1.924,50 ms na home e 1.688,50 ms na partida rápida | Reduzir o trabalho inicial e reexecutar três amostras de todas as URLs no SHA final; limites preservados |
| Bundles comparativos | Revisão atual reduz o total gzip em 1,93% e o startup do Worker em 51,68%, mas aumenta seis rotas | Resolver todas as 12 violações; redução de uma rota não compensa regressões em outra |
| Realismo | [690 partidas físicas](2026-10-22-simulation-690.md), 300 competições e 1.187 clubes efetivamente em campo; zero violações auditadas naquela fonte | Empates de 56,96%, gols de 1,50/jogo, passes completos de 53,88% e pênaltis convertidos de 55,46% ainda pedem calibração representativa |
| Cobertura de clubes | Auditoria estrutural cobre o catálogo; 690 partidas oferecem no máximo 1.380 vagas de equipes | Não dizer que todos os 4.601 clubes jogaram; cobertura integral exige uma campanha maior |
| Banco | [Leitura atual de capacidade e isolamento](2026-10-25-production-readonly.md) | Medir janelas de pico antes de aumentar compute pago ou remover índices |

Os números de 690 partidas pertencem ao manifesto de fontes da auditoria original. As integrações posteriores têm suas próprias provas de paridade e stress; uma tabela histórica não substitui a execução dos checks da revisão final. Nenhum resultado incompleto, cancelado ou ignorado foi promovido a aprovação. A publicação continua condicionada a todos os checks obrigatórios.
