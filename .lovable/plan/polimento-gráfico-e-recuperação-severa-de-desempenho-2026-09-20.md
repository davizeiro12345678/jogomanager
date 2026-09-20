# Polimento gráfico e recuperação severa de desempenho

## Objetivo

Transformar a partida em uma transmissão esportiva premium, usando a direção **Modern Glass HUD** escolhida, sem sacrificar fluidez. A prioridade será: estabilidade e FPS primeiro, qualidade visual adaptativa depois.

## 1. Corrigir os problemas reais antes de adicionar efeitos

- Remover o uso de `PCFSoftShadowMap`, que foi retirado do Three.js atual e hoje gera avisos contínuos; usar o filtro suportado e calibrar suavidade por tamanho, bias, raio e enquadramento da sombra.
- Corrigir o erro do carregador 3D (`Worker module function... init did not return a callable function`) para evitar falhas e trabalho desperdiçado no navegador.
- Medir separadamente custo de jogadores, torcida, grama, sombras e pós-processamento com a telemetria já existente.
- Evitar novas bibliotecas redundantes: o projeto já possui Three.js/R3F, post-processing, N8AO, detecção de GPU, Rapier, Drei e ferramentas de animação. Dependências novas só entram se substituírem algo mais pesado com ganho comprovado.

## 2. Perfis gráficos realmente distintos

- **Baixo:** jogadores articulados em lotes, grama PBR plana, sem pós-processamento caro, luz principal sem sombras dinâmicas extensas, DPR conservador e torcida fortemente simplificada.
- **Médio:** jogadores detalhados próximos e leves à distância, uma sombra dinâmica controlada, grama com normal/roughness, antialiasing barato e efeitos mínimos.
- **Alto/Cinema:** ambiente físico local, materiais completos, sombras maiores apenas no enquadramento útil, grama instanciada próxima e pós-processamento seletivo.
- Fazer a qualidade cair e subir por histerese, evitando alternância constante durante a partida.
- Aplicar orçamentos explícitos de draw calls, triângulos, DPR, memória e tempo por quadro em cada perfil.

## 3. Iluminação, sombras, grama e materiais

- Recalibrar o ambiente físico já existente para luz coerente de estádio, sem baixar HDR remoto pesado.
- Usar uma luz principal com sombra e refletores visuais sem multiplicar shadow maps.
- Ajustar cascata visual por distância: sombra corporal próxima, sombra simplificada média e sem sombra individual distante.
- Melhorar a grama PBR com variação de roughness/normal/tonalidade e desgaste, mantendo lâminas instanciadas apenas perto da câmera e desativadas no baixo.
- Revisar pele, tecido, cabelo, bola, traves e superfícies do estádio para compartilhar geometrias e materiais.
- Corrigir color management, mipmaps e anisotropia conforme perfil, sem elevar textura além do necessário.

## 4. Modelagem e animação dos jogadores

- Manter o corpo leve instanciado no baixo e reduzir trabalho de articulação fora da câmera.
- No médio/alto, melhorar transições entre parado, corrida, desaceleração, giro, disputa e chute com blend dependente de velocidade e delta time.
- Eliminar cálculos de rotação, face e detalhes para jogadores distantes.
- Reduzir closures e atualizações independentes por atleta onde o lote puder compartilhar cálculo.
- Preservar anatomia visível sem aumentar drasticamente draw calls.

## 5. Pós-processamento adaptativo

- Remover combinações excessivas vistas nas capturas e deixar bloom seletivo, AO em resolução reduzida e antialiasing adequado ao perfil.
- Desligar completamente profundidade de campo, aberração cromática, ruído e tilt-shift durante a jogabilidade normal; reservar efeitos cinematográficos para replays/cutscenes e somente quando houver margem de GPU.
- Garantir que quedas persistentes de FPS desativem efeitos antes de reduzir legibilidade ou estabilidade.

## 6. HUD e experiência escolhida

- Implementar a composição **Modern Glass HUD**: placar mais fino com estatísticas integradas, painel lateral compacto e botões em grades densas.
- Tornar o painel recolhível para liberar o campo; abrir substituições e estatísticas sob demanda.
- Usar transparência e blur moderados, com fallback sem blur em aparelhos lentos.
- Remover elementos flutuantes que competem com a partida e manter FPS discreto.
- Adaptar para desktop, tablet e celular sem sobrepor campo, placar ou controles.
- Manter navegação por teclado, alvos de toque, foco visível e movimento reduzido.

## 7. Métricas e conectores

- Usar o Google Analytics já conectado para eventos amostrados de perfil gráfico, FPS médio, 1% low, quedas automáticas de qualidade e abandono da partida, sem enviar dados pessoais e sem registrar a cada quadro.
- O Cloudflare ainda não está conectado ao projeto. Após aprovação, abrir a conexão e usá-la apenas para leitura de domínio/cache/entrega; nenhuma alteração de DNS, segurança ou cache será feita sem confirmação específica.
- Não usar Cloudflare para hospedar o app; publicação e domínios continuam pelo fluxo do projeto.

## 8. Verificação

- Validar testes da simulação, tipos e build.
- Executar a partida nos perfis baixo, médio e alto, verificando ausência de erros, estabilidade do HUD e troca automática de qualidade.
- Conferir desktop e mobile nas rotas de partida.
- Registrar FPS médio, p95 de frame time, 1% low, draw calls e triângulos no ambiente disponível.
- Não afirmar resultado de GPU física: o ambiente atual usa renderização por software. A confirmação final em aparelho real continuará identificada como pendente.

## Entrega esperada

- Partida mais fluida no baixo e médio.
- Visual premium no alto sem impor esse custo a todos.
- Jogadores e grama mais naturais, sombras suportadas e pós-processamento controlado.
- HUD muito menor, mais legível e mais confortável.
- Telemetria suficiente para ajustar os perfis com dados reais.
