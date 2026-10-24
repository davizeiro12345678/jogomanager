# Match 3D: gráficos, modularização e desempenho

Avaliação de 24/10/2026 UTC. **Resultado geral: PARCIAL. Publicação em produção não aprovada.** Esta iteração parte do PR #62 em `6a49afd45bde606569322e5ffd2c2c1c0ad7d2f4`; preserva suas correções de carreira, loja, física e migração. Não equivale à certificação completa do PR contra main.

## Implementação

- Campo: detalhe de fibras filtrado por derivadas, preservando mapas e cores; bandeiras animadas em dois lotes instanciados, antes oito desenhos. Redes transparentes usam uma passagem por face dupla e atualizam somente os mapas pertinentes.
- Jogadores: trama e costuras analíticas no kit instanciado; transição inercial entre performances/cues sem atrasar continuamente os gestos. Limite linear separado para deslocamento vertical do quadril e conjuntos de juntas em cache.
- Estádio e torcida: normal/roughness compartilhados de 32×32 para concreto (8 KiB antes de mipmaps), sem novos lotes de arquitetura; cartão de torcedor com braços, mãos e rosto sombreado e variação de painéis na camisa.
- Cutscenes: cenário, luzes e boundary extraídos; import do set selecionado com cache de Promise e nova tentativa após falha. Ambiente e lentes permanecem montados durante pausa; renderização sob demanda dorme. MSAA nativo desligado quando o compositor fornece antialiasing. Sonda usa o proprietário compartilhado dos contadores para incluir cena e pós-processamento, sem resets concorrentes.
- Rapier: uma Promise de inicialização WASM compartilhada entre física autoritativa e visual, com retry após erro. Parâmetros do solver e sequência do Worker preservados.
- CSS Modules: estilos cinematográficos e do painel de métricas isolados. Diálogo, configurações e transporte reutilizados, preservando rótulos localizados, legenda e acessibilidade.
- Modularização: MatchPitch de 602 para 201 linhas, com PitchGrass/PitchGoals/PitchFlags; CinematicStage3D de 596 para 341, com CinematicScene; CutsceneStage de 1.150 para 1.033, com CutsceneTransport. Torcida/textura separada. A modularização global permanece parcial: outros monólitos exigem iterações próprias.

## Dependências

Fiber 9.8.1 → 9.8.2; R3F postprocessing 3.1.3 → 3.2.2; Motion 14.0.0 → 14.6.0; three-mesh-bvh 0.9.15 → 0.9.16. Removido r3f-perf e suas dependências antigas; diagnóstico de desenvolvimento usa Stats já fornecido pelo Drei. Three 0.186.1, Drei 10.7.9, Rapier React 2.2.0/compat 0.21.0 e postprocessing 6.39.5 já estavam nas versões consultadas. Troika 0.53.0 preservado, sem downgrade para a tag latest 0.52.5. npm e Bun locks sincronizados. Não houve atualização indiscriminada de pacotes fora do jogo 3D.

Binaryen 132.0.0 fixado para otimização reprodutível após wasm-pack. WASM da torcida: **101.430 → 62.919 bytes (-37,97%)**, abaixo do teto de 96.000. Os 30 exports e 10 imports foram preservados; testes de paridade aprovados. O script recusa crescimento ou mudança dessas assinaturas.

## Validação

| Verificação                              | Resultado                                   | Limite da evidência                                                                          |
| ---------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Suíte completa                           | 2.038 testes, 376 arquivos aprovados        | Executada antes da última correção da sonda; seus testes relacionados foram repetidos depois |
| Regressões finais de save/replay/sonda   | 29 testes, seis arquivos aprovados          | Inclui as três observações de revisão do PR                                                  |
| Stress                                   | 200 seeds, cada uma com replay independente | 400 execuções; não é medição de GPU                                                          |
| TypeScript e ESLint                      | Aprovados, zero diagnósticos do código      | Aviso externo do npm sobre http-proxy                                                        |
| Builds app/estúdios                      | Aprovados                                   | Avisos de chunks grandes permanecem                                                          |
| Contratos Node de performance/assets     | 13 aprovados                                | Ausência de public/game-assets impede certificar intake de novos GLBs                        |
| MatchSim ABBA                            | Aprovado no limite de regressão             | Ficou mais lento; não representa otimização da CPU                                           |
| WASM da torcida                          | Aprovado                                    | ABI e paridade; não certifica todo custo de frame                                            |
| Bundle absoluto e comparativo            | Reprovados                                  | Bloqueiam publicação                                                                         |
| GPU nativa, Lighthouse e replay de banco | Não certificados nesta iteração             | Gates obrigatórios pendentes bloqueiam publicação                                            |

ABBA na mesma máquina AMD EPYC 9V74, Node 24.22.0 e dependências idênticas: 62 amostras por revisão, 21 checkpoints determinísticos iguais, 3.000 warm-ups e 31 lotes de 1.000 construções por passagem. Baseline do PR: 0,241758 ms; candidato: 0,255898 ms, **+5,85%**. IC bootstrap de 99% da razão: [1,028737; 1,094300]. Não excede a regra de regressão material de 10%, mas não é ganho. Não substitui a comparação integral de todo o PR contra main.

## Capturas e metodologia

Evidências acompanham o relatório exportado: antes, intermediário e depois; retrato do jogador, partida e cinema, incluindo viewport móvel. As primeiras imagens intermediárias do cinema ainda mostravam carregamento e não são usadas para atribuir melhoria estética. O último cinema foi capturado somente após cenário pronto e teste de reproduzir/pausar/retomar. Imagens de campo têm o mesmo cenário broadcast, seed graphics-broadcast-v1 e canvas 1.280×720, DPR 1.

O navegador usa **SwiftShader**, renderizador por software. Capturas verificam apresentação, carregamento funcional, controles e ausência de erro; seus tempos não comprovam FPS em GPU física. O protocolo curto de cinco segundos de warm-up e trinta de coleta não satisfaz a campanha nativa. `readyMs` da ferramenta inclui a janela de medição e não deve ser chamado tempo de carregamento. A comparação final controlada recompila a revisão original com as dependências do candidato e executa as duas versões em série.

Redução estrutural de desenhos foi aplicada, mas a amostra ainda apresenta pico acima do teto de 260. Resultados médios variam com poses, frames e compilação; não justificam prometer fluidez massiva. Há avisos THREE.Clock obsoleto de dependências, sem erro de execução nas páginas verificadas.

## Bloqueios e próximos trabalhos

1. Worker com startup estático de **143.753 bytes**, acima de 90.000, também presente na revisão original do PR. Reduzir dependências de validação sem remover a validação ou deslocar custo para mascarar o gate.
2. Total de JS comprimido e vários caminhos de startup cresceram contra main. A rota Match 3D correta também cresceu: 559,0 → 584,3 KiB gzip. A medição anterior de aproximadamente 168 KiB selecionava o chunk auxiliar match-analytics; não era a rota e foi invalidada. O comparador agora identifica o hash de oito caracteres da rota e tem regressão cobrindo os helpers.
3. Reduzir draws no quadro mais caro, então repetir campanha nativa em GPUs exigidas, três repetições equivalentes, todas as qualidades e cutscenes. Medir carregamento frio separadamente.
4. Concluir Lighthouse desktop/mobile, replay de banco e todos os jobs Quality no SHA candidato. Manter PR em rascunho até todos os gates passarem.
5. Continuar separação de CutsceneStage, PlayerStudio, MatchStands e CSS de carreira com fronteiras de responsabilidade; evitar extrações que criem dependências síncronas no shell.

## PR #62

GitHub informou mergeable=true e nenhum conflito de merge no head verificado. Não foi necessário inventar merge nem reescrever histórico. As três observações sobre save visitante, arquivo v3 autoritativo e replays concluídos da revisão 2 já estavam corrigidas no código-base do PR; a regressão foi reexecutada e os tópicos resolvidos. Nenhuma mudança de conta, pagamento, recurso pago ou produção foi realizada.

## Amostras de renderização preservadas

| Fase                                   | Draws médios | Pico de draws | Triângulos médios | Frame médio (ms) | p95 (ms) |
| -------------------------------------- | -----------: | ------------: | ----------------: | ---------------: | -------: |
| Antes inicial                          |       182,89 |           295 |           531.638 |           535,71 | 1.583,40 |
| Intermediário                          |       160,07 |           280 |           467.751 |           526,32 | 1.396,70 |
| Depois inicial                         |       170,61 |           280 |           511.237 |           731,71 | 1.625,20 |
| Antes controlado, dependências iguais  |       180,76 |           295 |           524.348 |           517,24 | 1.442,90 |
| Depois controlado, dependências iguais |       166,03 |           280 |           493.310 |           483,87 | 1.106,50 |

As duas últimas execuções ocorreram em série, após a campanha de CPU. A queda de 295 para 280 no pico é observada nessa fixture, ainda **20 draws acima** do teto de 260. A dispersão das amostras iniciais demonstra por que a melhora de um único intervalo não certifica fluidez. Todas as execuções são curtas e em SwiftShader; a aceitação gráfica retornou false. A fixture avançou ao comando de um segundo nas duas versões controladas. Nenhuma janela foi descartada para fabricar aprovação.

Cinema final: cenário locker pronto, qualidade alta; 145 draws, 466.633 triângulos, 93 programas e 110 texturas no frame amostrado, incluindo as passagens de pós-processamento. Pausa em 1,213 s, retomada até 1,585 s e nova pausa confirmada. Viewport móvel 390×844 sem overflow horizontal. As três páginas finais (partida/jogador/cinema) concluíram sem pageerror, console.error ou requisição falha; persistem três avisos de THREE.Clock obsoleto.

## Bundle limpo, retificação da medição

A saída anterior de build foi arquivada antes de gerar novamente os arquivos, evitando contar chunks obsoletos de builds anteriores. Na saída limpa, total gzip: **2.286.673 → 2.368.805 bytes (+3,59%)** contra main; Brotli Q6: **2.157.944 → 2.241.218 (+3,86%)**. Contra o head original do PR, a iteração acrescenta 3.369 bytes gzip e 2.942 Brotli: não há redução geral de JS nesta iteração. O WASM é medido separadamente.

O comparador antigo usava startsWith("match-") e podia aceitar match-analytics como rota. A correção não relaxa o gate: elimina a seleção falsa e passa a reprovar a rota real quando cresce. O gate absoluto também continua reprovando o Worker estático de 143.753 bytes. Os testes Node foram repetidos após a correção: 13 aprovados.
