## Etapas de implementação

### 1. Linha de base reproduzível

- Criar um cenário fixo de teste com a mesma partida, câmera, resolução, DPR, qualidade e duração.
- Separar carregamento inicial, aquecimento de shaders e desempenho estável.
- Registrar p50, p95, p99, draw calls, triângulos, materiais, texturas, geometrias e tempo até a primeira cena útil.
- Medir câmera ampla, meio-campo, área, replay e reentrada na partida. O relatório antigo de 715 desenhos e p95 de 63 ms serve apenas como histórico, não como prova do estado atual.
- Manter o painel de medição exclusivamente na prévia e adicionar um sinal estável de “cena pronta” para os testes.

### 2. Novo jogador — anatomia e identidade

- Recalibrar o corpo para proporções atléticas: clavícula/ombro, caixa torácica, cintura/pelve, glúteo, coxa, joelho, panturrilha, tornozelo, mãos, pés, pescoço e cabeça.
- Corrigir a silhueta excessivamente larga mostrada nas imagens, sem apagar variações reais de altura e peso.
- Melhorar mandíbula, nariz, boca, pálpebras, sobrancelhas, orelhas e assimetria sutil; ampliar famílias de cabelo com contorno melhor.
- Preservar geração determinística por jogador e os limites anatômicos já cobertos por testes.
- Criar tomadas fixas frontal, traseira, perfil e pose atlética para comparação visual antes/depois.

### 3. Uniformes oficiais e materiais

- Consolidar o atlas de camisa para frente/costas, aplicando padrão, escudo, patrocinador, nome e número nas regiões corretas da malha.
- Corrigir alongamento do número/nome, costuras e UVs nas costas; manter gola, manga, braçadeira, shorts e meias coerentes.
- Compartilhar texturas e materiais por clube/variante; detalhes de tecido KTX2 entram apenas no LOD próximo.
- Manter fallback procedural para clubes sem mídia oficial e contraste automático entre os dois times e goleiros.
- Validar kits claros, escuros, listrados, quadriculados e de goleiro.

### 4. Movimento, contato e comemorações

- Formalizar uma máquina de estados para parado, caminhada, corrida, sprint, freada, curva, giro, passe, chute, cruzamento, cabeceio, domínio, dividida, queda, defesa e recuperação.
- Ajustar stride warping e foot lock para eliminar patinação; limitar correções para não deformar poses.
- Sincronizar apoio, pé de chute, tronco e bola por marcadores semânticos; manter posição do mundo controlada pela simulação e IK responsável apenas pelo contato visual.
- Melhorar goleiros, transições interrompidas e recuperação após colisões.
- Criar comemorações contextuais por importância do gol, com variações determinísticas e promoção temporária dos atletas envolvidos para LOD 0.

### 5. Renderização e desempenho

- Reduzir desenhos por jogador agrupando apenas superfícies compatíveis; evitar recompilar materiais quando texturas chegam.
- Escolher LOD também por cobertura na tela, câmera e replay, não apenas distância; manter histerese para impedir piscadas.
- LOD 1 usa rig/material simplificado; LOD 2 permanece instanciado, com animação amostrada em frequência menor.
- Remover alocações por quadro e cálculos duplicados entre jogadores, câmera, replay e marcadores por meio do contexto visual já compartilhado.
- Aplicar `meshoptimizer` somente a modelos/recursos que realmente sejam entregues como malha, comparando bytes, tempo de decodificação e artefatos.
- Governador de qualidade reduz nesta ordem: resolução, grama, torcida, sombras, pós-processamento e só depois heróis. Subida exige margem estável e cooldown.

### 6. Estádio, sombra e transmissão

- Substituir a sombra larga e dura das imagens por contato curto e suave no jogo; sombra corporal completa fica reservada a retrato/replay quando couber no orçamento.
- Melhorar áreas visíveis da câmera: gramado próximo, gols/redes, túnel, bancos, placas e arquibancadas frontais; fundo distante usa geometria/luz mais barata.
- Reduzir cintilação e sobreposição em gramado, linhas, redes e placas; controlar bloom e transparência.
- Revisar câmera de transmissão para antecipar posse, perigo, densidade de jogadores e direção do ataque sem recalcular tudo.

### 7. Interface e experiência

- Reorganizar a partida em zonas seguras: placar/tempo sempre visíveis, eventos contextuais compactos e controles secundários recolhidos.
- No celular, usar barra compacta e painéis inferiores; preservar o centro do campo e áreas de gesto do sistema.
- Impedir conflito entre toque da câmera, menu e modais; restaurar o controle anterior ao fechar um painel.
- Melhorar estados reais de carregamento: interface primeiro, cena principal depois e detalhes opcionais por último; mostrar recuperação quando um recurso 3D falhar.
- Aplicar movimento curto e funcional, com alternativa para movimento reduzido, foco visível e controles acessíveis.

## Critérios de aceitação

- **Visual:** comparações nas mesmas câmeras mostram anatomia, rosto, cabelo, uniforme e sombra claramente superiores às duas imagens enviadas.
- **Partida:** contatos de passe/chute/domínio e uma comemoração completa sem atravessamentos relevantes ou pés deslizando de forma evidente.
- **Desempenho:** meta de 30 FPS estáveis em celular comum; p95 próximo de 33,3 ms na qualidade automática. Se o aparelho não sustentar isso, o governador reduz custo sem oscilar.
- **Orçamento:** celular médio deve buscar aproximadamente 100–150 desenhos e até 0,5–1,0 milhão de triângulos na câmera normal; desvios ficam documentados por cena.
- **Carregamento:** primeira cena útil medida separadamente; nenhum painel de diagnóstico ou pacote de estúdio entra no jogo publicado.
- **Qualidade:** preset Alto não é rebaixado silenciosamente; ganhos de desempenho são reinvestidos no atleta próximo.
- **Compatibilidade:** WebGL2, fallback de texturas, movimento reduzido, partida após reentrada e celulares em retrato/paisagem continuam funcionando.
- **Provas:** testes de anatomia, rig, materiais, contato e LOD; capturas em 390 px e 1280 px; métricas antes/depois; console sem erro novo, asset 404 ou shader quebrado.

## Detalhes técnicos

- Nenhuma nova engine ou biblioteca 3D será adicionada: a stack já contém R3F, Drei, Rapier, BVH, KTX2, detecção de GPU, pós-processamento, `meshoptimizer`, `r3f-perf` e gestos.
- Mudanças serão incrementais nos módulos existentes de aparência, proporções, malha, materiais, rig, movimento, LOD, estádio e HUD.
- A simulação determinística continua fora da renderização; Rapier permanece visual. Dados salvos não guardarão objetos Three.js.
- Cada etapa só avança após o cenário afetado passar visualmente e nas métricas; se uma otimização reduzir qualidade sem ganho mensurável, ela será descartada.
