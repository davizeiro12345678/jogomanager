# JogoManager: proposta de evolução profunda do Match 3D

**Versão:** 2.0, com as diretrizes informadas pelo usuário | **Data:** 25/10/2026, horário de Brasília.

**Estado:** proposta v2 aprovada pelo usuário nesta conversa para implementação com preview e evidências antes de publicar. As escolhas de direção visual e estratégia já foram informadas pelo usuário; os orçamentos e protocolos abaixo constituem a proposta técnica correspondente. A leitura do código é uma investigação preliminar: o defeito da perna ainda não foi reproduzido em execução e não há correção ou ganho de FPS comprovado nesta etapa.

**Objetivo:** obter realismo de alta qualidade com evolução profunda da base atual, corrigir o rasgo e a ausência de superfície na perna do estúdio, melhorar substancialmente corpo, rosto, animações e física e perseguir 60 FPS em celulares básicos a intermediários de 2020, com verificação profunda e evidências reproduzíveis.

**Estratégia escolhida pelo usuário:** corrigir profundamente a base atual. Primeiro eliminar o defeito da perna; depois validar um atleta realista completo, integrar os níveis de detalhe e testar os 22 jogadores. A meta combina melhoria visual e fluidez; não será considerada atendida por reduzir a resolução sem declarar a perda visual ou por apresentar apenas imagens estáticas.

**Diretrizes consolidadas:** realismo de alta qualidade; celulares básicos/intermediários de 2020 como prioridade; 60 FPS como alvo; estúdio com perna incompleta/rasgada como defeito prioritário; física e animações com evolução substancial; entrega acompanhada de verificações e evidências completas. O ano do celular, isoladamente, não define a capacidade de CPU/GPU: a certificação depende dos modelos efetivamente medidos.

## 1. Escopo solicitado e limites do diagnóstico

O PDF enviado contém uma imagem de uma solicitação. Ela aponta tronco desproporcional, pernas, pescoço, cabeça, rosto e corpo estranhos, e pede uma melhoria substancial de gráficos, animações, geometria, física e desempenho. A imagem não contém uma captura utilizável do personagem defeituoso. Portanto, a existência de uma reclamação está confirmada, mas a causa visual específica ainda precisa ser reproduzida.

O usuário especificou depois que o defeito ocorre no estúdio e produz um rasgo na perna, com uma parte do modelo ausente. Esse relato passa a ser a prioridade P0. Ainda falta identificar a região exata, o movimento, o instante e o jogador que o reproduzem; isso será investigado na etapa 1, sem presumir que a causa está na coxa, no joelho ou na canela.

O escopo proposto abrange anatomia, malhas, esqueleto, deformações, materiais, locomoção, ações de futebol, contato com solo/bola/jogadores, LODs, torcida, apresentação da partida, carregamento relacionado ao 3D e validação da entrega. Inclui a investigação do bloqueio de desempenho já encontrado no CI.

A base de código foi consultada em modo de leitura no repositório **davizeiro12345678/jogomanager**, branch **main**, revisão **5a75fef3662e3750917df1c2259169e4ed9f24d3**. Na execução, essa referência deverá ser atualizada antes de começar, caso main tenha avançado.

Não foram executados novos benchmarks, testes locais, capturas do personagem ou medições em aparelhos físicos nesta fase. O estado publicado não foi confirmado: a ferramenta de consulta não conseguiu ler /api/health. Isso não demonstra indisponibilidade do site. Causas de deformação e ganhos percentuais permanecem hipóteses até a reprodução.

## 2. Evidências verificadas

| Elemento             | Evidência observada                                                                           | Implicação para o plano                                                      |
| -------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Arquitetura          | React, TanStack Start, R3F, Three.js, Rapier e pós-processamento já aparecem nas dependências | Reaproveitar a infraestrutura; evitar outro motor 3D                         |
| Anatomia             | player-model.ts gera aparência por semente e proporções por posição, altura e massa           | Corrigir superfícies e medidas sem sortear outra identidade                  |
| Renderização         | PlayerRig usa ossos e SkinnedMesh; LowPlayers usa uma representação específica para distância | Validar os dois caminhos e a transição entre eles                            |
| Animação             | Há clipes, mistura de poses, IK, correção anatômica e apoio dos pés                           | Investigar composição e ordem das camadas antes de adicionar mais movimentos |
| Estúdio              | Existe player-studio.html, ligado ao renderizador real                                        | Usar o estúdio como primeiro ponto de validação visual                       |
| Física               | Relógio das regras a 30 Hz e contrato de integração com passos de no máximo 1/139 s           | Não confundir frequência da simulação, integração e FPS                      |
| Evidência de release | CI possui stress real, comparação de CPU, contratos gráficos, bundle e Lighthouse             | Preservar todos os controles obrigatórios                                    |

Na execução de **24/10/2026**, correspondente à revisão consultada, passaram CodSpeed e os jobs de stress de 200 partidas, contratos gráficos, build/tipos/testes, bundles, WASM, replay SQL e auditoria de dependências. O workflow Quality gates terminou em falha devido ao Lighthouse mobile e ao agregado de liberação. Isso registra o resultado daquela execução; não certifica qualquer revisão posterior.

| Rota no CI local           | Resultado observado no agregado pessimista | Limite exigido                     |
| -------------------------- | ------------------------------------------ | ---------------------------------- |
| /                          | Performance 72/100; TBT 1.131,09 ms        | Performance >= 98; TBT <= 200 ms   |
| /partida-rapida            | Performance 79/100; TBT 896 ms             | Performance >= 98; TBT <= 200 ms   |
| /melhores-formacoes        | Performance 85/100; LCP 3.562,43 ms        | Performance >= 98; LCP <= 2.500 ms |
| /guias e /guia-de-scouting | Performance 95/100                         | Performance >= 98                  |

Esses resultados são de laboratório no runner do CI. Não são métricas de campo, medições atuais do domínio publicado ou FPS do Match 3D. A causa de cada tempo elevado ainda será extraída dos relatórios e traces; não se atribui a falha ao renderizador sem essa análise.

## 3. Abordagens e estratégia escolhida

| Abordagem                                                      | Benefício                                                                | Custo e dependência                                                                       | Indicação                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| A. Evoluir malhas, esqueleto e animação atuais                 | Preserva integração, personalização e caminho de desempenho já existente | Exige corrigir a geometria procedural; o teto visual depende da qualidade das superfícies | Recomendada para esta execução                                        |
| B. Substituir o personagem por um modelo autoral GLB           | Dá maior controle artístico de topologia, UVs e pesos                    | Precisa de modelo e animações com licença adequada, adaptação e novos LODs                | Escolher se houver assets adequados e intenção de substituir o visual |
| C. Modelo autoral nos closes e representação atual à distância | Concentra detalhe onde aparece                                           | Mantém dois caminhos visuais e exige correspondência de corpo, rosto, kit e poses         | Alternativa se os closes forem a prioridade dominante                 |

**Abordagem A escolhida:** buscar um visual esportivo realista de alta qualidade, adequado ao navegador, com corpo atlético e identidade consistente. Primeiro corrigir o rasgo e a continuidade do corpo, depois silhueta, articulações e deformações, rosto, uniforme e materiais. O número de polígonos será distribuído pelas regiões que alteram a imagem, dentro do orçamento do perfil. B/C ficam apenas como histórico das alternativas; não autorizam uma troca de estratégia.

Se a prova de um atleta não atingir a direção visual acordada, revisar as superfícies, a topologia e a deformação da base atual e explicar o que limita o resultado. Qualquer substituição externa exigiria uma nova decisão. Imagens conceituais não serão apresentadas como modelos 3D implementados.

## 4. Restrições e decisões propostas

- Não contratar serviços, adicionar créditos, comprar modelos ou introduzir dependências pagas. Utilizar a infraestrutura e os recursos já disponíveis.
- Preservar nomes, identificadores, contas, espaços, saves, progressão e propriedade dos arquivos. Trabalhar somente no projeto JogoManager e nos materiais autorizados.
- Preservar a identidade determinística dos atletas: semente, associação do jogador, cabelo, tom de pele e acessórios; melhorar a representação geométrica conforme a direção aprovada.
- Fazer backup dos arquivos importantes e registrar a revisão de retorno antes das alterações. Não reescrever histórico Git publicado, conforme AGENTS.md.
- Manter a simulação fora da árvore de renderização React e conservar uma única autoridade para a bola. Melhorias visuais não devem conceder resultados, itens ou conquistas.
- Não alterar autenticação, pagamentos, servidores, segredos, configurações de conta ou esquema de produção como efeito secundário desta melhoria gráfica.
- Não aumentar limites ou ignorar testes para aprovar uma versão. O JavaScript inicial não pode crescer nos caminhos e totais protegidos; o conteúdo 3D assíncrono continua sujeito a orçamento próprio.
- Dispositivos físicos adicionais só serão usados com autorização. Sem aparelho disponível, a ausência de certificação física será registrada de forma explícita.
- Proposta de entrega: implementação em branch isolada, preview revisável e PR; publicação final após aprovação da versão candidata, conforme a seção 12.

## 5. Arquitetura que será preservada

| Camada                  | Responsabilidade                                         | Contrato de integração                                                             |
| ----------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Identidade e medidas    | Descrever o mesmo atleta em todos os contextos           | lookFor, lookWithPhysique e proportionsFor continuam a alimentar os renderizadores |
| Superfícies e esqueleto | Produzir malhas, pesos e pivôs coerentes                 | Mesma referência anatômica para corpo, roupa, rosto e LODs                         |
| Movimento visual        | Selecionar clipe e compor locomoção, ação, olhar e apoio | Poses limitadas e contatos sincronizados; sem escrever resultados da partida       |
| Física autoritativa     | Integrar a bola e resolver seus contatos efetivos        | Um único dono do estado, com passos controlados e replay por versão                |
| Renderização            | Exibir snapshots, detalhes, torcida e ambiente           | Respeitar os perfis e a seleção de atletas detalhados                              |
| Medição e release       | Comparar revisões e comprovar a entrega                  | Evidência vinculada a semente, cenário, ambiente e SHA                             |

Refatorações que prometem preservar comportamento devem reproduzir os mesmos checkpoints. Correções intencionais da física podem alterar trajetórias futuras: nesse caso, as novas fixtures precisam de resultados físicos aprovados e identificação da versão. A repetibilidade é exigida dentro de cada versão; não se deve exigir igualdade entre uma física corrigida e a física substituída.

**Compatibilidade com o gate existente:** scripts/match-setup-sample.mjs compara 21 hashes de sim.checkpoint(): três sementes, nos ticks 0, 300, 600, 900, 1.200, 1.500 e 1.800. O comparador exige igualdade entre base e candidato. Esses checkpoints permanecerão inalterados neste release. Correções de contato visual e otimizações de física que preservem esse contrato podem ser integradas. Uma alteração autoritativa que mude qualquer um desses hashes ficará em um lote separado, sem publicação, até existir uma proposta de versionamento e referência compatível aprovada; não será liberada simplesmente atualizando o resultado esperado, escolhendo outras sementes ou desativando o gate. A direção escolhida para a evolução da física define o escopo, mas não remove esse bloqueio técnico.

## 6. Etapas de implementação

### Etapa 0. Preparar a execução e preservar o estado

**Dependência:** aprovação da proposta v2, com as diretrizes já informadas incorporadas. **Resultado:** base reproduzível, backup e lista de alterações autorizadas.

**Arquivos existentes:** AGENTS.md, package.json, .nvmrc, lockfile e docs/critical-performance.md. **Documento proposto:** docs/superpowers/specs/2026-10-25-match3d-design.md e docs/superpowers/plans/2026-10-25-match3d-implementation.md, na branch de execução.

- [ ] Atualizar o SHA de base e ler instruções aplicáveis aos arquivos envolvidos.
- [ ] Criar ambiente isolado com a versão Node e o lockfile do projeto; registrar eventuais diferenças de ferramentas.
- [ ] Preservar a revisão de retorno e os assets autorizados; separar alterações concorrentes antes de editar.
- [ ] Registrar as diretrizes consolidadas como especificação e deixar a matriz de aprovação acessível.

**Aceite:** nenhum arquivo de outro projeto incluído, nenhum segredo no relatório e restauração da revisão anterior definida.

### Etapa 1. Reproduzir defeitos e investigar o bloqueio de release

**Arquivos existentes:** scripts/player-studio.tsx, scripts/graphics-benchmark-contract.ts, src/components/game/FrameProbe.tsx, src/components/game/QuickMatchPage.tsx, .github/workflows/quality.yml, .lighthouserc.mobile.cjs. Os módulos efetivamente responsáveis por TBT/LCP serão escolhidos após os traces.

- [ ] Capturar o jogador atual de frente, perfil, costas e três quartos, com câmera e iluminação neutras fixadas.
- [ ] Reproduzir o rasgo da perna e os demais defeitos em pose neutra e em movimento; indicar se aparecem no rig detalhado, no LOD distante ou nos dois, com tecido ligado/desligado como variável de diagnóstico.
- [ ] Registrar 22 jogadores, câmera broadcast, close, gol/replay e clima seco/molhado.
- [ ] Examinar os relatórios Lighthouse do CI e as tarefas longas de home, partida rápida e páginas editoriais afetadas.
- [ ] Corrigir a causa demonstrada: por exemplo, importação antecipada, hidratação, trabalho síncrono ou recurso LCP, conforme o trace mostrar.
- [ ] Repetir as três execuções por URL e preservar os critérios pessimistas; separar a correção herdada das métricas da melhoria 3D.

**Aceite:** defeitos reproduzíveis documentados; medições base preservadas; Lighthouse mobile aprovado para permitir publicação final. A investigação visual pode avançar enquanto esse bloqueio é resolvido, sem liberar produção antes dos controles completos.

### Prioridade P0. Perna rasgada ou com superfície ausente no estúdio

**Fatos da leitura estática:** em rig-body.ts:827-837, a pele superior da coxa é omitida no atleta de short; a superfície aparente começa em 0,43 do comprimento da coxa. A barra do short usa 0,49 do comprimento da coxa, com o deslocamento do quadril, em player-shorts.ts:23. A cobertura precisa continuar válida depois da deformação. Em player-rig-meshes.ts:133-137, o descarte por enquadramento é desativado para portrait; PlayerStudio.tsx:555-570 usa esse modo no jogador detalhado. Portanto, esse descarte não é a primeira hipótese para um rasgo local nesse caminho. O modo simplificado possui outro caminho e também será testado.

Já existem testes de sobreposição do short com a coxa em poses específicas. Eles mostram uma intenção de cobertura; sem executá-los e sem reproduzir o caso relatado, não demonstram que o defeito atual está resolvido. A causa permanece em aberto.

| Hipótese de trabalho                                      | Experimento que a distingue                                                   | Evidência exigida                                                                           |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Separação entre pele e roupa após deformação              | Isolar as superfícies, congelar o instante e inspecionar a malha transformada | Região descoberta identificada no mesmo jogador e pose                                      |
| Pesos ou bind divergentes em uma junta                    | Inspecionar vértices/ossos dos dois lados da abertura e somas dos pesos       | Índices válidos, pesos normalizados e trajetória dos vértices registrada                    |
| Triângulos ausentes, degenerados ou com orientação errada | Inspecionar índices, normais, wireframe e material de diagnóstico             | Triângulos responsáveis localizados; aberturas intencionais da roupa distinguidas de falhas |
| Deformação do tecido ou corretivo excessivo               | Comparar a mesma pose com apenas uma camada ligada/desligada                  | Mudança isolada confirma ou rejeita a influência daquela camada                             |
| Diferença entre o jogador detalhado e simplificado        | Repetir o clipe e a câmera nos dois caminhos                                  | Matriz por modo e instante, sem deduzir equivalência apenas das medidas nominais            |

- [ ] Fixar identidade, medidas, roupa, clipe, tempo e câmera do caso mínimo. Uma captura do usuário é útil, mas a busca no estúdio pode começar sem ela.
- [ ] Separar as regiões quadril/coxa, joelho e canela/tornozelo e testar as duas pernas; não limitar a investigação ao primeiro ponto suspeito.
- [ ] Adicionar uma regressão que falhe no caso reproduzido antes de alterar a geometria ou os pesos.
- [ ] Corrigir uma causa por vez e verificar cobertura nas posições já testadas e na nova reprodução.
- [ ] Testar 12 identidades, ambas as pernas, quatro vistas e 12 clipes, com amostras em 0%, 25%, 50%, 75% e 100% do clipe, excluindo o instante duplicado quando o loop assim exigir.
- [ ] Testar detalhado/simplificado, tecido ligado/desligado e variações de altura/massa admitidas, incluindo membros em flexão e abdução.

**Aceite P0:** o defeito originalmente reproduzido deixa de aparecer; a malha montada não apresenta uma abertura indevida visível na região; a correção passa na regressão e nas amostras de movimento. Aberturas de gola, manga, short e tornozelo são intencionais e não serão tratadas como falha topológica por si só. O fechamento cosmético de toda abertura não constitui um critério correto de anatomia.

**Evidência P0:** sequência antes/depois no mesmo instante e câmera, vídeo contínuo da pose que causava o rasgo, identificação da causa e dos arquivos alterados, teste falhando antes e aprovado depois. A análise da imagem deve usar a geometria deformada e a cobertura efetiva da região, além dos testes estruturais de índices/pesos.

### Etapa 2. Corrigir corpo, proporções, pivôs e deformaç…4652 tokens truncated… para essa meta. Os perfis Alta/Cinema existentes não representam, por si, certificação a 60 FPS nessa faixa de aparelhos. Aumento de assets carregados após abrir o 3D depende de orçamento de transferência/memória medido e não relaxa a proteção do JavaScript inicial.

### Contrato adicional proposto para mobile de 2020

**Âmbito:** estúdio em reprodução, partida com 22 jogadores e replays nos aparelhos representativos homologados. O objetivo é alta qualidade perceptiva: proporções, superfícies contínuas, rosto natural, movimento, contato e materiais coerentes. A complexidade de microdetalhes é distribuída por área visível na tela, evitando gastar o mesmo trabalho em um close e em atletas distantes.

| Classe de teste proposta             | Render interno de referência    | Limite inicial da cena em partida        | Estúdio/close                                                               |
| ------------------------------------ | ------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| Básico de 2020, 2-3 GB de RAM        | 960 x 540, orientação paisagem  | <= 75 draw calls; <= 130.000 triângulos  | Um atleta detalhado; <= 40 draws e <= 90.000 triângulos na cena do estúdio  |
| Intermediário de 2020, 4-6 GB de RAM | 1280 x 720, orientação paisagem | <= 110 draw calls; <= 260.000 triângulos | Um atleta detalhado; <= 50 draws e <= 140.000 triângulos na cena do estúdio |

Esses valores são orçamentos iniciais de engenharia, ainda não medições. RAM isolada não homologa um aparelho; CPU, GPU, navegador, sistema, resolução e estado térmico devem ser registrados. O celular exato deve ser identificado antes da certificação. O plano não afirma que todos os aparelhos lançados em 2020 tenham desempenho equivalente.

A interface permanece na resolução adequada à tela. O limite se refere ao framebuffer 3D; em orientação diferente, usar o mesmo teto de pixels com a proporção correspondente, sem esticar a imagem. Qualquer resolução dinâmica efetiva deve constar do resultado. A comparação base/candidato fixa resolução e qualidade; resultados obtidos com outra resolução formam uma comparação separada.

| Indicador            | Critério adicional proposto para tela de 60 Hz                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alvo nominal         | 60 FPS, orçamento de 16,67 ms por quadro                                                                                                                            |
| Medição sustentada   | Média >= 59,5 FPS em cada execução válida, com tolerância explícita de agendamento/medição                                                                          |
| Regularidade         | Intervalo entre quadros p95 <= 18 ms e p99 <= 25 ms                                                                                                                 |
| Quadros muito lentos | Intervalos > 33,3 ms em <= 0,5% dos quadros da janela                                                                                                               |
| Queda sustentada     | Nenhuma janela completa de 5 s abaixo de 58 FPS no trecho medido                                                                                                    |
| Aquecimento          | Repetir o cenário mais pesado por 10 min após aquecimento, com as mesmas regras de aprovação                                                                        |
| CPU e GPU            | Medir separadamente onde houver suporte; alvos iniciais p95 de 6 ms de trabalho da cena na CPU e 10 ms na GPU, sem somá-los como se fossem fases sempre sequenciais |

Os limites de p95/p99 e a tolerância de 0,5 FPS não são uma definição de 60 FPS constantes em todos os instantes: são o critério operacional proposto para avaliar o alvo nominal sem esconder travamentos. A alegação final deve informar a média, a distribuição dos quadros e qualquer falha. Se o alvo não for alcançado no aparelho básico, a entrega continua marcada como reprovada nesse aparelho; 30 FPS não substitui silenciosamente a meta escolhida.

**Ordem de otimização:** reduzir recomputação/alocações e tráfego de buffers; distribuir geometrias e materiais pelo enquadramento; otimizar shaders, sombra e efeitos; verificar uploads e montagem de recursos; ajustar a resolução dentro do contrato declarado. A redução de detalhes periféricos não pode reintroduzir o rasgo, mudar a anatomia, remover jogadores/ações ou fazer a física depender da capacidade do aparelho.

O estúdio parado pode usar renderização sob demanda. Nesse estado não há razão para produzir 60 quadros idênticos por segundo; a meta de 60 FPS aplica-se à animação, órbita e interação, com a imagem estática correta e pronta para responder.

## 8. Protocolo de medição e evidência

**Comparação controlada:** mesma fixture Flamengo x Palmeiras, mesmas sementes, mesma revisão das dependências, mesmo navegador, dispositivo, viewport, DPR, câmera, clima e perfil. A fixture gráfica existente usa 1280 x 720, DPR 1. Preservar esse modo para comparações do cenário e acrescentar resolução nativa do aparelho em relatório separado.

**Protocolo proposto para playback em hardware real:** 10 s de aquecimento e três janelas de 60 s por cenário, sem throttling artificial na comparação principal. Registrar condições térmicas e repetir baseline/candidato de forma intercalada. Cenários: broadcast em jogo corrido, close com ação, gol/replay e condição noturna/molhada. O protocolo do construtor mantém sua metodologia própria; não será substituído por este.

Esse aquecimento de 10 s pertence ao protocolo geral de diagnóstico. Para homologar os celulares de 2020, o protocolo mobile de 2 min abaixo o substitui integralmente. Nas duas revisões, iniciar a janela depois de terminar o carregamento, montar o cenário e concluir o aquecimento especificado; o carregamento frio é medido em ensaio separado. Condições térmicas e critérios de inclusão/exclusão precisam ser iguais entre base e candidato.

**Carregamento:** separar cache frio e aquecido. Registrar bytes transferidos, tempo até primeiro quadro útil e tarefas longas. Lighthouse de laboratório e experiência real em dispositivo ficam identificados em colunas próprias.

**Matriz mobile:** um aparelho básico de 2020 e um intermediário de 2020, com modelos/SoCs identificados e uso autorizado. Incluir o aparelho exato do usuário quando informado. Em cada classe: estúdio animado, órbita/zoom, jogo com 22 atletas, concentração de jogadores, goleiro/área, gol/replay e cenário noturno/molhado. Realizar comparação base/candidato na mesma resolução de referência e teste separado da configuração adaptativa final.

**Procedimento térmico proposto:** registrar navegador/sistema/renderer, estado de bateria, carregamento, rede e temperatura quando mensurável; manter condições comparáveis; aquecer por 2 min; medir três janelas de 60 s por cenário; depois três execuções de 10 min do cenário mais pesado, com baseline/candidato em ordem intercalada. Medir o custo da instrumentação; a gravação de vídeo pode ser feita em uma corrida separada para não distorcer o FPS.

**O que conta como FPS comprovado:** distinguir callbacks de requestAnimationFrame, quadros 3D submetidos pelo renderizador e quadros efetivamente apresentados/perdidos pelo navegador e compositor. Registrar os três níveis quando houver suporte e correlacionar a sequência de quadros da aplicação com o trace do navegador. A aprovação do alvo exige conteúdo 3D animado apresentado com a cadência estipulada; um contador de callbacks a 60 Hz não é prova suficiente. Informar quadros descartados, parciais e repetidos quando essa leitura estiver disponível.

Se o ambiente só fornecer a cadência de callbacks ou submissão, registrar essa medida como tal e deixar a certificação completa da apresentação pendente. Não promover o resultado a 60 FPS apresentados por inferência. A homologação física e o uso do aparelho continuam sujeitos à disponibilidade e autorização, com essa limitação visível no relatório final.

| Grupo       | Medidas e interpretação                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| Fluidez     | FPS, p50/p95/p99 de tempo de quadro e interrupções perceptíveis, sem ocultar o pior cenário                         |
| CPU         | Tempo de animação, contatos, simulação, carregamento e coleta de lixo quando o trace permitir                       |
| GPU         | Draw calls, triângulos e tempo de GPU apenas se a API/dispositivo oferecer leitura válida                           |
| Memória     | Heap quando disponível, contagem de recursos e estimativa de bytes de texturas; não chamar estimativa de VRAM exata |
| Integridade | Checkpoints de simulação, identidade do atleta, versão de física e eventos de contato                               |
| Visual      | Vistas equivalentes, transições de LOD, superfície/pele/roupa, apoio e legibilidade das ações                       |

Relatar indisponibilidade de cada medida como não medida. Renderização por software serve à checagem funcional e à comparação de imagens; não certifica desempenho de GPU física. CodSpeed verifica os workloads de CPU instrumentados, não substitui o benchmark da cena renderizada.

Para cada métrica temporal: **redução percentual = 100 x (tempo base - tempo novo) / tempo base**. Para throughput, usar a fórmula correspondente ao aumento de trabalho por segundo. Não misturar essas duas interpretações. Nenhum ganho percentual será anunciado antes da comparação válida.

**Entregas de evidência:** 48 vistas neutras para 12 atletas; sequência amostrada de 12 clipes em cinco instantes e duas vistas, usando atletas representativos; seis vídeos pareados de aproximadamente 8-12 s; matriz de cenários por perfil; relatórios brutos e resumo de antes/depois. A seleção visual representativa não substitui os testes de contrato sobre a variedade de identidades.

### Pacote completo de comprovação da entrega

| Entregável                | Conteúdo obrigatório                                                                                                 | Limitação que deve aparecer                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Relatório executivo       | Problema, causa confirmada, mudanças, riscos e resultado de cada meta                                                | Separar resultado implementado, medido, pendente e bloqueado                                           |
| Regresso do rasgo         | Caso mínimo, falha antes, aprovação depois, imagens e vídeo equivalentes                                             | Identificar jogador, pose, câmera, modo e tecido                                                       |
| Comparativo visual        | Corpo, rosto, uniforme, articulações, LOD e torcida no mesmo cenário                                                 | Registrar resolução e perfil; imagem conceitual não prova implementação                                |
| Métricas brutas           | CSV/JSON com callbacks, quadros submetidos/apresentados/perdidos, tempos, chamadas de desenho, triângulos e recursos | Campos indisponíveis não medidos; cadência de callback ou CPU throttling não certifica FPS apresentado |
| Identificação da execução | SHA, fixture, semente, dependências, navegador, SO, renderer, viewport/DPR e resolução efetiva                       | Valores do candidato devem corresponder ao preview/versão avaliada                                     |
| Física                    | Linha do tempo de contato, ensaios de colisão, repetibilidade e checkpoints                                          | Destacar qualquer alteração autoritativa ainda não integrável                                          |
| Testes e CI               | Comandos, status, contagem, logs e artefatos realmente produzidos                                                    | Teste ignorado/cancelado/ausente não é aprovado                                                        |
| Memória e estabilidade    | Ciclos de entrar/sair, abrir estúdio, trocar atleta e replay; contagens após aquecimento                             | Heap/VRAM exatos só quando houver leitura válida                                                       |
| Entrega revisável         | Preview, PR, lista de arquivos e procedimento de retorno                                                             | Publicação depende do escopo aprovado e dos gates completos                                            |

Os arquivos da evidência podem ser reunidos em um ZIP e ligados a um relatório PDF/HTML na entrega da implementação. Nesta versão da proposta há leitura de código e histórico de CI; não existem ainda capturas antes/depois, testes novos executados ou medições físicas para preencher esse pacote.

## 9. Critérios de aprovação por marco

| Marco                 | O que deve estar pronto                                                                 | Decisão de avanço                                                       |
| --------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| M1: prova do atleta   | Rasgo reproduzido e corrigido; corpo/rosto/pescoço e seis ações prioritárias no estúdio | Validar continuidade da malha e direção de realismo antes de integrar   |
| M2: partida integrada | 22 atletas, LODs, contatos, torcida e cenários                                          | Validar qualidade e contrato de 60 FPS nos aparelhos mobile homologados |
| M3: entrega           | CI completo aprovado, preview e evidências do SHA candidato                             | Liberar a versão no escopo escolhido                                    |

A aprovação inicial autoriza executar as etapas e decisões cobertas por este plano. Uma reprovação de aparência em M1 será tratada dentro da direção acordada. Substituir a estratégia por assets externos ou acrescentar sistemas fora do escopo requer decisão de escopo, em vez de uma mudança silenciosa.

Não haverá publicação automática apenas porque um teste isolado passou. Se o ambiente não permitir um controle obrigatório, registrar o impedimento e manter a versão revisável, sem afirmar que a liberação foi concluída.

## 10. Riscos materiais e resposta planejada

| Risco                                              | Sinal objetivo                                               | Resposta                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Proporções nominais corretas, malha ainda estranha | Testes numéricos passam, mas as vistas mostram volume errado | Medir superfícies montadas e deformadas; revisar silhueta com referência aprovada        |
| Close bonito e partida lenta                       | Regressão em p95, draw calls ou GPU nos 22 atletas           | Corrigir loteamento/LOD e propriedade dos recursos; voltar o lote responsável            |
| Aparência muda ao trocar LOD                       | Salto de altura, cabeça, torso ou kit                        | Derivar representações da mesma referência e testar limiares de distância                |
| Apoio melhora mas chute quebra                     | Correção final prende o pé de golpe                          | Respeitar perna de apoio, pé dominante e marcador de contato                             |
| Física altera trajetórias/replay                   | Checkpoints diferem após correção intencional                | Separar o lote incompatível; aprovar uma transição antes de integrar, sem relaxar o gate |
| Recursos ficam acumulados                          | Contagens aumentam a cada entrada/saída                      | Corrigir ownership/disposal e repetir ciclos após aquecimento                            |
| Lighthouse continua reprovado                      | Uma das três execuções fica fora do limite                   | Resolver o caminho crítico medido, sem reduzir o rigor do gate                           |
| Assets externos inadequados                        | Licença ausente ou topologia imprópria                       | Usar somente material próprio/autorizado; manter estratégia procedural se necessário     |

## 11. Sequência e esforço

Ordem proposta: **base e reprodução do rasgo -> correção P0 da perna -> corpo -> rosto -> animações -> física/contatos -> LOD e desempenho mobile -> ambiente -> validação e entrega**. O diagnóstico do Lighthouse começa no primeiro lote e precisa terminar antes da publicação. Ajustes que cruzem corpo e animação serão agrupados para evitar integrar uma nova malha com poses incompatíveis.

São nove etapas numeradas de 0 a 8, com entregáveis verificáveis. Não é responsável prometer um prazo de uma hora ou um percentual uniforme de melhoria sem baseline, referência visual e hardware alvo. O esforço será reestimado depois de M1, quando ficará claro se a estratégia A atinge a qualidade pretendida. A disponibilidade de assets prontos muda substancialmente o custo de B/C.

O trabalho pode avançar em lotes revisáveis, com registro do que mudou e dos controles que passaram. A correção da anatomia tem prioridade sobre ampliar efeitos do cenário. O acabamento de torcida e ambiente vem depois de demonstrar que o jogador e os contatos atendem à direção visual.

## 12. Decisões consolidadas e aprovação

As respostas do usuário substituem as perguntas de direção da versão 1. Não é necessário repetir o questionário completo para avançar na revisão.

| Tema                        | Decisão informada pelo usuário                          | Consequência prática                                                                                    |
| --------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Estilo                      | Realismo de alta qualidade                              | Corrigir volume, superfície, rosto, materiais e movimento, com prova visual no motor real               |
| Estratégia                  | Corrigir profundamente a base atual                     | Preservar a arquitetura e evoluir malhas, rig e sistemas existentes                                     |
| Público técnico prioritário | Celulares básicos/intermediários de 2020                | Orçamentos mobile e homologação em modelos representativos                                              |
| Fluidez                     | Rodar a 60 FPS                                          | Medir distribuição de quadros e estabilidade térmica, além da média                                     |
| Prioridade visual           | Melhoria substancial com mais fluidez                   | Comparação com qualidade/resolução controladas e análise conjunta de imagem e desempenho                |
| Defeito prioritário         | Perna rasgada ou com parte do modelo ausente no estúdio | Reprodução mínima, diagnóstico por camadas e regressão específica antes do ajuste                       |
| Física                      | Melhoria e correção substanciais                        | Ensaios de bola, solo, traves, gesto/impacto, apoio e reações, com autoridade única                     |
| Comprovação                 | Verificação profunda e evidências completas             | Entregar relatório, métricas brutas, vídeos, testes, identificação da versão e limites reais da medição |

**Propostas operacionais mantidas:** identidades e saves preservados; variedade atlética natural; uso dos recursos já disponíveis sem contratação; nenhuma alteração de conta, nomes de espaços ou projetos de terceiros; execução isolada com backup; preview e PR antes de publicar a versão final. Essas propostas compõem o escopo que será submetido à aprovação da versão 2.

**Dados ainda úteis para a homologação:** modelo exato do celular do usuário e navegador; captura ou identificação do movimento/instante do rasgo, quando disponíveis. A investigação e a implementação podem ser planejadas sem esses dados, mas o resultado de FPS só poderá ser certificado nos aparelhos efetivamente testados. O relatório deve distinguir a homologação no modelo informado da cobertura parcial da categoria de 2020.

**Escopo da aprovação solicitada:** implementar as nove etapas na base atual, incluindo a prioridade P0 e os contratos adicionais desta versão, produzir uma versão revisável e entregar a validação/evidências efetivamente obtidas. Os gates existentes continuam obrigatórios. Alterações físicas que contrariem os checkpoints terão lote e proposta de transição próprios antes de integrar a versão publicável.

**Publicação proposta:** apresentar preview e evidências da versão candidata; promover à produção somente após aprovação da versão final e sucesso dos controles completos. A aprovação do plano não equivale a uma certificação antecipada de FPS, realismo ou correção do rasgo.

### Resposta suficiente para iniciar a implementação

"Aprovo a proposta v2 para implementação completa, com preview e evidências antes de publicar. Meu celular de referência é [modelo e navegador, se souber]."

Se o usuário autorizar diretamente a execução em outros termos, aplicar o escopo expressamente autorizado. Não será solicitada nova aprovação para cada correção ou lote já coberto por esse escopo; mudanças materiais de estratégia ou publicação fora dele precisam de decisão específica.

## 13. Fontes e nível de confiança

**Confiança alta:** diretrizes explicitadas pelo usuário, conteúdo legível do PDF, arquivos e caminhos de renderização consultados, valores dos contratos e resultados históricos de CI identificados. **Ainda não comprovado:** causa exata do rasgo, estado atual em produção, FPS nos aparelhos de 2020, ganhos percentuais e qualidade artística da implementação futura. Os orçamentos mobile e os critérios adicionais são propostas de engenharia desta versão, não fatos medidos.

1. Documento digitalizado(1).pdf, enviado pelo usuário; uma página de imagem, examinada visualmente em 25/10/2026. Não houve alteração do arquivo original.
2. Repositório e revisão de referência: https://github.com/davizeiro12345678/jogomanager/tree/5a75fef3662e3750917df1c2259169e4ed9f24d3
3. Instruções e limites: https://github.com/davizeiro12345678/jogomanager/blob/5a75fef3662e3750917df1c2259169e4ed9f24d3/AGENTS.md e docs/critical-performance.md na mesma revisão.
4. Contrato gráfico: src/game/contracts/graphics-profile.ts; modelo: player-model.ts; testes anatômicos: player-anatomy.test.ts, na mesma revisão.
5. Workflow Quality gates: https://github.com/davizeiro12345678/jogomanager/actions/runs/40132754553
6. Job Lighthouse mobile e seus logs: https://github.com/davizeiro12345678/jogomanager/actions/runs/40132754553/job/120987781668
7. Execução CodSpeed: https://github.com/davizeiro12345678/jogomanager/actions/runs/40132754558
8. R3F, práticas para reduzir recomputação, alocações e atualizações React no loop: https://r3f.docs.pmnd.rs/advanced/pitfalls
9. R3F, reaproveitamento, instancing e níveis de detalhe: https://r3f.docs.pmnd.rs/advanced/scaling-performance
10. Rapier, relação entre passo de tempo, precisão, colisões e custo: https://rapier.rs/docs/user_guides/javascript/integration_parameters/
11. Código do estúdio e das malhas, na revisão de referência: src/components/game/players/PlayerStudio.tsx:555-570 e player-rig-meshes.ts:133-137; construção da coxa: src/game/rig-body.ts:827-837; short: src/game/player-shorts.ts; deformação: src/game/rig-skin.ts.
12. Three.js, esqueleto, atributos de pesos, bind e limites da malha animada: https://threejs.org/docs/pages/SkinnedMesh.html
13. web.dev, orçamento temporal para renderização em telas de 60 Hz: https://web.dev/articles/rendering-performance
14. Chrome DevTools, contadores de quadros e identificação de frames perdidos: https://developer.chrome.com/docs/devtools/rendering/performance

As práticas de reuso, atualização de alta frequência fora do estado React e LOD seguem a documentação oficial. Valores específicos e decisões do projeto derivam do código consultado ou são identificados como propostas. O plano não afirma que otimizar a renderização reduzirá CPU/RAM/disco do Supabase; isso exigiria medição e escopo de backend próprios.
