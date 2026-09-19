# Atualização massiva: partida 3D, engine, narração, redesign, acessibilidade e SEO

## Direção aprovada

- Identidade **Gramado premium cinematic**: `#0a0f0c`, `#123322`, `#22c55e`, `#eafff2`.
- Tipografia: **Archivo Black** em títulos e **Hind** em textos e dados.
- Estrutura em faixas amplas cinematográficas, com menos cartões aninhados, contraste alto e controles claros.
- Preservar todos os fluxos existentes, priorizando estabilidade e desempenho antes de efeitos visuais.

## 1. Corrigir e desacoplar a engine da partida

- Mover a simulação ao vivo para o Web Worker, não apenas a simulação rápida, enviando snapshots compactos a 30 Hz.
- Interpolar posição, rotação, bola e estados de animação no render para eliminar jitter sem aumentar a frequência da física.
- Manter HUD em frequência reduzida, separar atualizações visuais dos cálculos de IA e evitar reconciliação dos 22 jogadores por quadro.
- Fortalecer física de domínio, passe, chute, bloqueio, defesa, rebote, disputa corporal, impedimento e reinícios, com sanitização contra estados inválidos.
- Instrumentar tempo de simulação, render, FPS médio/p95 e quedas prolongadas para qualidade adaptativa baseada em evidência.

## 2. Salto gráfico com orçamento de desempenho

- Corrigir o provável tone mapping duplicado entre renderizador e pós-processamento.
- Reequilibrar luz ambiente, hemisférica, sol e holofotes; trocar luzes caras por emissão visual quando mantiver o mesmo resultado.
- Ajustar sombras por distância e importância, bias/normalBias e resolução adaptativa; preservar sombra real onde é perceptível e contato simplificado nos demais jogadores.
- Criar presets coerentes de textura do gramado por qualidade, incluindo albedo, normal, rugosidade, desgaste, lama/umidade e linhas, sem carregar 2K em aparelhos fracos.
- Melhorar câmera de transmissão, exposição, profundidade, replay e clima sem ampliar o número de passes caros.
- Manter WebGL2 como padrão estável e WebGPU somente experimental com fallback automático.

## 3. Jogadores mais humanos e fluidos

- Refinar anatomia, proporções, articulações, apoio dos pés, mãos, rosto, cabelo, pele, tecido, chuteiras e variações físicas por identidade.
- Consolidar LOD geométrico/material e congelar pose fora de visão; memoizar entradas estáveis dos 22 rigs.
- Criar uma máquina de transição contínua entre parado, caminhada, corrida, sprint, mudança de direção, domínio, disputa, bloqueio, carrinho, cabeceio, chute e defesa.
- Corrigir escorregamento dos pés e mudanças instantâneas de direção usando aceleração, desaceleração, inclinação e rotação independentes da taxa de quadros.
- Validar visualmente jogadores próximos, distantes, goleiros e aglomerações em diferentes câmeras.

## 4. Narrador muito mais variado e contextual

- Manter as mais de 200 combinações atuais por idioma e substituir variedade apenas por prefixo por frases realmente distintas.
- Adicionar eventos seguros e enumerados: pênalti, impedimento, lesão, vermelho, VAR, gol tardio, empate, virada e gol contra.
- Selecionar falas por momento do jogo, estado do placar, pressão, sequência, rivalidade e intensidade, sem aceitar texto livre no serviço de voz.
- Incluir jogador/time sanitizados apenas em modelos fechados e manter cache determinístico, fila, prevenção de repetição e fallback local.
- Ajustar ritmo, estabilidade e emoção da voz por tipo de lance, respeitando o orçamento mensal e evitando sobreposição de áudio.

## 5. Redesign completo das telas principais

- Aplicar a composição aprovada em home, painel/carreira, clube/elenco, tática, partida/HUD, loja/produtos, autenticação, compartilhamento e páginas públicas.
- Transformar a navegação extensa em uma arquitetura mais previsível no desktop e simplificar as duas navegações concorrentes no celular.
- Reservar dourado para conquistas/raridade e usar superfícies verdes neutras nos estados comuns.
- Melhorar hierarquia, placar, cronologia, ações críticas, feedback de compra, loading, erro, vazio, sucesso e transições.
- Usar imagens/cenas do próprio jogo em faixas cinematográficas; não inventar dados de carreira ou resultados.

## 6. Acessibilidade WCAG

- Garantir um único `main` por página no layout compartilhado e rotular corretamente todas as regiões de navegação.
- Adicionar foco de alto contraste em campo/HUD, nomes acessíveis, alvos mínimos de toque e operação completa por teclado.
- Anunciar erro de login, gols, placar e eventos importantes sem transformar o feed inteiro em ruído para leitores de tela.
- Substituir controles nativos conflitantes dentro de menus pelos componentes acessíveis já usados no projeto.
- Desligar explicitamente flashes e animações contínuas em movimento reduzido; revisar contraste, zoom, reflow e telas móveis.
- Executar auditoria automática e testes manuais de teclado/leitor sem remover a experiência 3D para os demais usuários.

## 7. Títulos, descrições e indexação

- Criar título, descrição, Open Graph e Twitter exclusivos para cada página pública; eliminar a descrição repetida atualmente apontada pela auditoria.
- Manter páginas privadas/de estado do jogo fora do índice e adicionar `noindex` às telas de editor, visual e criação de clube que hoje ficaram indexáveis por omissão.
- Adicionar canônico próprio à página Multiplayer, hoje presente no sitemap sem canonical.
- Conferir sitemap e robots gerados pelas rotas do projeto, incluindo somente conteúdo público útil.
- Preservar o domínio oficial `https://jogomanager.com`; após publicação, submeter o sitemap uma única vez e solicitar nova verificação das páginas alteradas.
- Estado confirmado antes da execução: a home está “Submitted and indexed”, rastreável e com canonical escolhido pelo Google; isso não significa que todas as páginas já estejam indexadas.

## 8. Verificação e critérios de aceite

- Tipos, lint, testes da simulação e build sem erros novos.
- Testes no navegador em desktop e celular: partida, tática por teclado, autenticação, compra, compartilhamento e páginas públicas.
- Comparar FPS/tempo de quadro antes e depois em hardware com GPU real; no ambiente sem GPU, registrar apenas métricas não representativas.
- Partida longa sem acumular atraso, áudio ou memória; qualidade adaptativa sem oscilar continuamente.
- Reexecutar auditoria SEO/acessibilidade depois das correções e marcar achados como corrigidos apenas com evidência.

## Limites honestos

- Não prometer FPS absoluto em toda GPU; a meta será estabilidade de 40–60 FPS com degradação adaptativa.
- O salto visual será condicionado ao orçamento de quadro, memória e temperatura do aparelho.
- “Indexar todas” significa tornar todas as páginas públicas elegíveis, descobríveis e submetidas; o Google decide quando e se cada URL entra no índice.
