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

### Etapa 2. Corrigir corpo, proporções, pivôs e deformação

**Arquivos existentes:** src/game/player-model.ts, rig-body.ts, rig-geometry.ts, rig-skin.ts, rig-correctives.ts e src/components/game/players/PlayerRig.tsx. **Testes relevantes:** player-anatomy.test.ts, rig-body.test.ts, rig-skin.test.ts, rig-correctives.test.ts.

**Interfaces preservadas:** proportionsFor(look: PlayerLook): Proportions; lookWithPhysique(look, measurements): PlayerLook. Novas medidas internas devem ser derivadas dessa referência, não de constantes independentes por renderizador.

- [ ] Criar fixtures de atletas cobrindo GK/DF/MF/FW, corpos leves/normais/fortes/altos e extremos válidos de altura. Usar 12 identidades fixas para comparação visual.
- [ ] Comparar as medidas nominais com a geometria montada; localizar excesso de escala no tronco, quadril, membros, cabeça e pescoço.
- [ ] Corrigir volumes de ombro, peito, cintura, pelve, coxas e panturrilhas, mantendo continuidade das superfícies e articulações.
- [ ] Verificar bind pose, hierarquia, normalização dos pesos, normais e deformações em corrida, flexão, chute e salto.
- [ ] Ajustar o caimento da camisa e do short ao corpo; preservar cobertura e evitar que a roupa distorça a leitura do tronco.
- [ ] Manter testes nominais já existentes e adicionar verificações que meçam a malha real, inclusive após skinning.

**Critérios propostos:** altura visível neutra, sem cabelo, a até 1% da altura alvo; ausência de NaN/infinito e de colapso grave em articulações; silhueta humana consistente nas quatro vistas. A tolerância visual adicional não substitui testes nominais mais rigorosos existentes.

Os testes atuais usam faixas de 7,1 a 8,7 cabeças de altura, entreperna/altura entre 0,46 e 0,54 e largura de ombros/altura entre 0,24 e 0,36 em amostras semeadas. São guardas do código, não prova de correção estética; não serão afrouxados para esconder defeitos.

### Etapa 3. Melhorar cabeça, rosto, pescoço e materiais do atleta

**Arquivos existentes:** src/game/player-sculpt.ts, player-morphology.ts, player-materials.ts, rig-materials.ts e src/components/game/players/player-rig-face.ts. **Testes:** player-sculpt.test.ts, player-morphology.test.ts, player-materials.test.ts e player-naturalness.test.ts.

**Interface preservada:** faceMorphology(seed: number): Readonly<FaceMorphology>. As variações continuam relacionadas à identidade existente.

- [ ] Corrigir implantação do pescoço, largura/profundidade do crânio, mandíbula e ligação com o tronco.
- [ ] Refinar olhos, pálpebras, nariz, boca, orelhas e linha do cabelo, começando pelas formas que afetam a silhueta.
- [ ] Revisar normais, UVs e rugosidade da pele; controlar brilho de suor, contraste dos olhos e separação entre cabelo, pele e tecido.
- [ ] Preservar diversidade entre atletas sem transformar assimetrias em deformações.
- [ ] Revisar mãos, antebraços e chuteiras nos enquadramentos próximos, dentro do limite do perfil.
- [ ] Validar os mesmos atletas em luz neutra, dia, entardecer e noite, com exposição controlada na comparação.

**Aceite:** melhora visível nas vistas comparáveis; sem olhos desalinhados, pescoço desconectado ou superfície severamente facetada onde o close exige continuidade. Sem exigir semelhança fotográfica com jogadores reais, salvo decisão expressa acompanhada de referências e assets adequados.

### Etapa 4. Melhorar locomoção, ações e transições

**Arquivos existentes:** src/game/animation-core.ts, animation.ts, animation-extra*.ts, animation-catalog.ts, gait-kinematics.ts, athlete-pose-blender.ts, football-action.ts, ground-contact.ts e src/components/game/players/player-rig-frame.ts. **Testes:** animation-catalog.test.ts, gait-kinematics.test.ts, athlete-pose-blender.test.ts e player-rig-animation.test.ts.

**Interfaces de referência:** mixPose(a, b, k, out?); seleção de clipe existente; solveGroundContact(input: GroundContactInput): GroundContactResult. A sequência final de aplicação deve preservar apoio e marcadores de contato depois das misturas.

- [ ] Registrar 12 clipes representativos: caminhada, corrida, sprint, arrancada, freada, mudança lateral/direção, passe, chute, domínio, cabeceio, defesa do goleiro e queda/recuperação.
- [ ] Reproduzir saltos de pose na transição entre clipes e conflitos entre IK, olhar, cansaço e postura.
- [ ] Sincronizar a passada com a velocidade real; corrigir apoio, transferência de peso, inclinação e movimento dos braços.
- [ ] Melhorar antecipação, contato e recuperação de ações, mantendo o instante de toque coerente com a bola.
- [ ] Corrigir pé dominante e tratamento espelhado; manter as mãos do goleiro e o eixo do corpo coerentes com a defesa.
- [ ] Comparar playback a 30, 60 e 120 FPS de renderização nos mesmos instantes autoritativos, inclusive pausa e replay.
- [ ] Verificar que o jogador distante não perde o significado da ação quando recebe atualizações menos frequentes.

**Aceite:** ausência de saltos severos de pose, apoio legível, ausência de joelhos invertidos e de evento de contato duplicado. Comparação em vídeo obrigatória; capturas estáticas não aprovam naturalidade de movimento. A frequência de renderização não pode alterar a regra ou o resultado autoritativo por si só.

### Etapa 5. Corrigir física e contato com invariantes verificáveis

**Arquivos existentes:** src/game/rapier-ball-authority.ts, physics-quality.ts, ball-climate.ts, ball-response.ts, rapier-ball-visual.ts, ground-contact.ts e football-action.ts. **Testes:** rapier-ball-authority.test.ts, rapier-ball-visual.test.ts, physics-quality.test.ts, ground-boot-contact.test.ts e live-match.visual-ball.test.ts.

**Interfaces preservadas:** BallPhysicsAuthority, RapierBallAuthority e highFidelitySubsteps(elapsed, maxSubsteps?). Não introduzir outro integrador concorrente para a mesma bola.

- [ ] Auditar unidades, raio visível/físico, colliders, restituição, atrito, damping e posse/soltura da bola.
- [ ] Testar bola no solo, quique, rolamento, impacto em trave, cruzamento rápido, chute e defesa em sequência.
- [ ] Avaliar colisão contínua nos corpos rápidos e custo dos subpassos; manter o contrato atual até haver comparação física e temporal aprovada.
- [ ] Corrigir sola/gramado, apoio de um pé no chute, aterrissagem e transição entre suspensão e contato.
- [ ] Sincronizar reação ao contato entre atletas com o evento da simulação; evitar transformar todo o elenco em ragdolls permanentes.
- [ ] Testar retomada após uma pausa longa, delta inválido e alta velocidade, sem explosão numérica nem atualização duplicada de posição.
- [ ] Verificar se uma correção de trajetória preserva os 21 checkpoints protegidos; separar qualquer alteração incompatível em lote não publicável, com proposta explícita de versionamento, referência e validação, preservando saves e resultados gravados.

**Critérios propostos:** nenhum valor não finito; bola atravessando trave/solo em nenhum cenário de colisão do conjunto aprovado; em poses de apoio plano, penetração máxima da sola de 1 cm. A tolerância de 1 cm é uma proposta para a camada visual, não autorização para ampliar tolerâncias do solver. Repetibilidade dentro da mesma versão, ordem de eventos consistente e prova de custo por cenário.

**Limite de integração:** o primeiro release só recebe as correções compatíveis com os checkpoints obrigatórios. Se eliminar um defeito autoritativo exigir mudar esses estados, entregar a reprodução, o patch isolado e a proposta de transição; manter esse trecho bloqueado para publicação até resolver o contrato, sem apresentar a física incompatível como já entregue em produção.

**Evolução física proposta:** auditar o conjunto bola/solo/traves, vínculo entre gesto e impacto, posse/soltura/defesa, apoio/aterrissagem dos atletas e reações às disputas. Distinguir o evento físico, sua apresentação e a regra esportiva evita que um ajuste visual produza um segundo impulso ou outra autoridade sobre a bola.

| Ensaio físico               | Critério proposto                                                                                 | Como comprovar                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Bola sobre plano e impactos | Penetração no plano <= 5 mm no cenário controlado, preservando tolerância existente mais rigorosa | Distância do centro ao plano comparada ao raio físico por passo                |
| Trajetória rápida e traves  | Nenhuma passagem indevida pelo collider no conjunto de ensaios aprovado                           | Trajetórias, eventos de colisão e clipe em câmera lenta                        |
| Passe/chute/defesa          | Evento de impacto único; marcador visual a até um tick de regras do contato autoritativo          | Linha do tempo com evento, pose, distância de contato e resultado              |
| Apoio dos atletas           | Penetração visual da sola <= 1 cm no apoio plano; sem acumular altura na suspensão                | Medida com a geometria final transformada, nos dois pés                        |
| Repetibilidade              | Mesmo estado nos replays da mesma versão e fixtures; preservar os 21 checkpoints do release atual | Hashes e relatórios de stress, incluindo identificação da versão               |
| Robustez temporal           | Nenhum NaN/infinito ou evento duplicado com pausa, retomada e render a 30/60/120 Hz               | Testes por sequência de passos e comparação nos mesmos instantes autoritativos |

Os parâmetros de atrito, restituição, resistência e contato serão calibrados por ensaio; elevar a frequência de integração ou a quantidade de iterações só será aceito com benefício físico demonstrado e custo medido. A simulação autoritativa mantém as mesmas regras nos aparelhos: o governador pode ajustar detalhes visuais, tecido e torcida, mas não reduzir a precisão física de forma que altere o resultado por dispositivo.

### Etapa 6. Integrar LODs e otimizar CPU/GPU sem perder anatomia

**Arquivos existentes:** src/components/game/players/MatchPlayers.tsx, LowPlayers.tsx, player-rig-frame.ts, src/game/player-lod-geometry.ts, player-lod-torso.ts, player-lod-shorts.ts, player-instance-batch.ts, draw-budget.ts, runtime-scene-budget.ts e quality-governor.ts. **Testes:** os testes correspondentes de LOD, batch, draw-budget e governador.

- [ ] Derivar largura, altura, pivôs e posição da cabeça dos mesmos dados do atleta detalhado.
- [ ] Validar mudanças de distância em torno dos limites com histerese, sem oscilação de silhueta, altura ou identidade.
- [ ] Medir separadamente seleção de atletas detalhados, avaliação de pose, IK, montagem de geometria, skinning, uploads e desenho.
- [ ] Reutilizar buffers, geometria e materiais onde apropriado; eliminar alocações e reprocessamentos demonstrados pelo perfil.
- [ ] Reduzir atualizações de detalhes invisíveis e trabalho fora de campo; preservar a interpolação das ações relevantes.
- [ ] Conferir propriedade e liberação de recursos ao abrir/fechar estúdio, entrar/sair de partidas e alternar replay.
- [ ] Manter os kernels WASM condicionados às medições e controles já existentes; não ativar um caminho apenas por ele usar WASM.

**Aceite:** todos os perfis dentro do orçamento; mesma anatomia reconhecível entre representações; nenhum crescimento contínuo de contagem de geometrias/texturas depois do aquecimento e de ciclos de entrada/saída. A comparação principal fixa o perfil, a resolução e o conteúdo: baixar qualidade não contará como ganho equivalente.

### Etapa 7. Melhorar ambiente, torcida e apresentação

**Arquivos existentes:** src/components/game/Stadium3D.tsx, stadium/CrowdLod.tsx, stadium/CrowdReaction.tsx, cinematic/CinematicCrowd.tsx, CinematicDirector.tsx e post/PostFX.tsx.

- [ ] Melhorar variação de pose e reação da torcida, com eventos e fases determinísticos e custo proporcional à visibilidade.
- [ ] Revisar gramado, linhas, contatos de sombra e separação visual entre atleta, bola e campo.
- [ ] Ajustar enquadramento de replay/close para mostrar a melhoria do personagem e a ação, preservando o fluxo da partida.
- [ ] Ajustar iluminação, exposição e pós-processamento após aprovar forma e deformação do atleta.
- [ ] Controlar efeitos opcionais por perfil; testar dia/noite e seco/molhado sem exceder o orçamento total.

**Aceite:** comparação visual com mesmos instantes, condições e câmera; torcida e efeitos não retiram recursos críticos dos jogadores e da bola. Mudanças de interface, controles ou direção de câmera que ultrapassem esse acabamento exigem uma decisão de escopo específica.

### Etapa 8. Validar, apresentar e preparar a liberação

**Arquivos existentes:** .github/workflows/quality.yml, codspeed.yml, scripts/compare-match-setup.mjs, verify-stress-report.mjs, verify-game-assets.mjs e verify-public-deployment.mjs. **Relatórios propostos:** docs/qa/match3d-2026-10-25/ e artefatos de CI vinculados ao SHA candidato.

- [ ] Executar testes focados nas mudanças de anatomia, animação e física, seguidos dos controles completos requeridos para release.
- [ ] Validar build, lint sem avisos, tipos, stress de 200 partidas, determinismo, bundles, contratos gráficos/assets, WASM, replay do banco descartável e auditoria de dependências.
- [ ] Executar a comparação ABBA do construtor no mesmo runner e manter seus 21 checkpoints; separar essa medida do FPS e do custo da cena.
- [ ] Executar Lighthouse com as três medições por URL e os limites atuais.
- [ ] Entregar preview, vídeo comparativo, tabela antes/depois e PR com os riscos materiais e a validação realmente executada.
- [ ] Publicar somente no escopo aprovado, com todos os controles exigidos aprovados; conferir HTTPS, prontidão do backend e SHA compilado exato em /api/health.
- [ ] Preservar a revisão anterior e executar o procedimento de retorno se a versão entregue mostrar regressão material.

**Aceite:** código e evidências apontam para a mesma revisão; nenhum teste obrigatório ausente, ignorado ou cancelado é tratado como sucesso. Nenhuma afirmação de FPS físico sem medição em aparelho real autorizado.

## 7. Orçamentos obrigatórios preservados

| Perfil | FPS alvo | Tempo de quadro p95 máximo | Draw calls máximas | Triângulos máximos |
| ------ | -------- | -------------------------- | ------------------ | ------------------ |
| Baixa  | 60       | 22 ms                      | 90                 | 180.000            |
| Média  | 60       | 20 ms                      | 170                | 420.000            |
| Alta   | 45       | 28 ms                      | 260                | 850.000            |
| Cinema | 30       | 33,3 ms                    | 340                | 1.200.000          |

Fonte desses limites: src/game/contracts/graphics-profile.ts e docs/critical-performance.md. São contratos do projeto, não resultados atuais medidos. O alvo de FPS e o p95 são indicadores distintos; não se deve converter 22 ms de p95 em uma promessa de 60 FPS constantes.

| Controle           | Regra preservada                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Lint e tipos       | Zero erros e zero avisos no lint; nenhum erro de TypeScript                                                            |
| Stress             | 200 sementes e replays independentes efetivamente executados                                                           |
| CPU do construtor  | Reprovar regressão material > 10% confirmada pelo limite inferior do intervalo bootstrap de 99% no protocolo existente |
| Bundle inicial     | Nenhum crescimento de gzip/Brotli Q6 nos caminhos comparados e no total; cumprir limites absolutos                     |
| Lighthouse mobile  | Performance >= 98; acessibilidade >= 90; LCP <= 2.500 ms; CLS <= 0,1; TBT <= 200 ms                                    |
| Lighthouse desktop | Performance >= 45; acessibilidade >= 90; boas práticas >= 85                                                           |
| Release            | Workflow completo aprovado e revisão pública correspondente ao SHA esperado                                            |

O usuário já definiu 60 FPS em celulares básicos/intermediários de 2020 como prioridade. Os contratos acima continuam obrigatórios, e o contrato mobile adicional abaixo será usado para essa meta. Os perfis Alta/Cinema existentes não representam, por si, certificação a 60 FPS nessa faixa de aparelhos. Aumento de assets carregados após abrir o 3D depende de orçamento de transferência/memória medido e não relaxa a proteção do JavaScript inicial.

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
