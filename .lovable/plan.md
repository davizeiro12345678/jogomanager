# Correção de velocidade, salto gráfico 3D, desempenho e ranking opcional

## Objetivo

Deixar a partida visualmente natural e estável durante os 90 minutos, começando pela velocidade excessiva dos jogadores. Depois, elevar iluminação, sombras, gramado, materiais e pós-processamento sem sacrificar fluidez; corrigir os problemas de interface vistos na referência; e adicionar métricas de atividade com ranking público somente para quem optar.

## 1. Corrigir velocidade e movimento dos jogadores

- Separar claramente **tempo da partida**, **velocidade da simulação** e **velocidade física em campo**, para que acelerar o relógio não faça atletas correrem de forma irreal.
- Recalibrar caminhada, trote, corrida e sprint para faixas humanas, reduzindo picos atuais e preservando diferenças de atributo, fadiga, posição e contexto da jogada.
- Trocar deslocamento direto até o alvo por aceleração, frenagem e limite de giro; desacelerar em curvas, domínio, disputa e aproximação da bola.
- Melhorar a interpolação dos snapshots do Worker para evitar saltos, extrapolar apenas por uma janela curta e recuperar atrasos sem teletransportes.
- Sincronizar cadência da passada, apoio do pé, inclinação do corpo e transições parado↔trote↔corrida↔sprint com a velocidade efetivamente desenhada.
- Adicionar regressões para velocidade máxima, distância percorrida, aceleração, jitter e determinismo em partidas longas.

## 2. Desempenho e arquitetura de renderização

- Preservar Three.js + React Three Fiber e WebGL2 como caminho principal; WebGPU continua experimental e com fallback.
- Consolidar os três níveis de detalhe dos jogadores para que o LOD reduza geometria real, materiais, texto e frequência de animação — não apenas esconda pequenos detalhes.
- Manter os 22 jogadores individualmente articulados, mas compartilhar geometrias, texturas e materiais; instanciar torcida, grama, assentos, refletores e elementos repetidos.
- Aplicar culling por frustum/setor e visibilidade de câmera, bounds corretos para instâncias e oclusão simples por arquibancada, sem consultas de GPU que criem travadas.
- Fundir geometria estática compatível do estádio e usar pools para partículas, chuva, flashes, confete, rastros e efeitos de gol.
- Reduzir trabalho por quadro: nenhuma alocação temporária desnecessária, atualizações distantes em frequência menor, placar/HUD fora do loop crítico e física/IA mantidas no Worker.
- Centralizar limites de resolução: DPR máximo 2 no Cinema, menor nos perfis Fluidez/Equilíbrio, com adaptação primeiro em pós-processamento, torcida e sombras.
- Evitar adicionar Stats.js, lil-gui ou outro painel pesado à experiência normal; ampliar o painel de diagnóstico já existente com FPS, ms, p95, 1% low, memória quando disponível, triângulos e draw calls. Controles avançados ficam em modo de diagnóstico.

## 3. Cor, iluminação, refletores, materiais e gramado

- Garantir color management único e correto: texturas de cor em sRGB, mapas de dados em espaço linear, saída sRGB e ACES Filmic sem duplicar curvas.
- Recalibrar exposição e balanço de dia, entardecer e noite para manter uniformes, pele, bola e linhas legíveis.
- Concentrar sombras em uma luz principal com frustum apertado; refletores noturnos usam iluminação rica, mas somente luzes próximas/relevantes projetam sombras.
- Usar 512/1024/2048 conforme o perfil; 4096 somente como opção de diagnóstico em câmera próxima, nunca como padrão da partida.
- Melhorar PBR dos jogadores, uniformes, pele, cabelo, metal, concreto, redes e assentos com variação de rugosidade e reflexão controlada.
- Não carregar HDR remoto. Usar o ambiente local atual e, se houver um arquivo HDR/KTX2 licenciado e empacotado, integrá-lo com fallback local e tratamento de erro.
- Evoluir o gramado procedural já existente: mipmaps/anisotropia limitados pelo aparelho, normal e rugosidade coerentes, desgaste, umidade e fibras instanciadas somente perto da câmera; reduzir densidade automaticamente antes de perder FPS.
- Recalibrar N8AO, bloom, SMAA, vinheta, foco e granulação por perfil e por momento. Partida normal permanece limpa; efeitos cinematográficos completos ficam para replay/cutscene.

## 4. Câmeras, interação e carregamento

- Manter as câmeras próprias de transmissão no jogo; OrbitControls/auto-rotação ficam apenas na tela de prévia visual, porque controles orbitais durante uma partida prejudicariam a experiência.
- Suavizar transições entre câmeras com damping dependente de delta e impedir cortes repetidos ou movimentos bruscos.
- Adicionar atalhos somente no modo de diagnóstico para alternar sombras, pós-processamento e visualização técnica, sem interferir nos controles normais.
- Usar raycasting apenas onde há interação real na prévia 3D; a partida não fará raycast contínuo sobre todo o estádio.
- Exibir progresso real para recursos carregados sob demanda, com cenário básico sempre visível, fallback em falha e pré-carregamento das próximas cutscenes.
- Preparar carregadores para GLB comprimido/Draco e texturas compactas quando recursos reais forem adicionados; não criar referências para arquivos inexistentes nem streaming artificial de uma cena que já cabe no navegador.

## 5. Simulação, IA e física

- Melhorar movimento sem bola, cobertura, compactação, pressão coordenada, linhas defensivas, apoio ao portador e reação à perda sem aumentar a velocidade máxima.
- Recalibrar goleiros: posição-base, antecipação, tempo de saída, mergulho, rebote e recuperação.
- Refinar bola com subpassos em velocidades altas, atrito dependente do gramado, quique, rotação/Magnus e colisões robustas com trave/linha, preservando o resultado determinístico.
- Manter decisões táticas e física fora do caminho de renderização; enviar snapshots compactos e somente os eventos alterados.

## 6. UI/UX e correções da referência

- Reorganizar o cabeçalho para impedir colisão entre navegação, “Salvar carreira”, busca e “Jogar”; mover ações secundárias para “Mais” conforme a largura disponível.
- Reduzir o painel de salvamento em nuvem: mensagem curta, benefícios compactos e uma única ação dominante, sem ocupar a maior parte da primeira tela.
- Melhorar hierarquia, espaçamento, contraste, truncamento e alinhamento do painel do treinador; manter o próximo jogo como ação principal e reduzir competição visual dos cards auxiliares.
- Revisar HUD da partida, carreira, elenco, tática e loja em desktop e celular; alvos de toque mínimos, foco visível, estados de carregamento/erro/vazio e transições com redução de movimento.
- Corrigir sobreposições, rolagens horizontais involuntárias, textos cortados e botões redundantes antes de aplicar animações adicionais.

## 7. Ranking opcional e métricas de atividade

- Criar participação explicitamente opcional para jogadores autenticados; quem não aderir continua com métricas pessoais locais e não aparece publicamente.
- Medir somente **tempo ativo**: página visível e interação recente; pausar em aba oculta/inativa para não premiar tempo ocioso.
- Registrar de forma agregada tempo ativo, partidas iniciadas/concluídas, vitórias, temporadas e sequência de dias, sem nome real, e-mail, IP ou histórico detalhado público.
- Permitir nome público do treinador, clube/escudo e opção de sair do ranking; ao sair, remover a linha pública mantendo o jogo intacto.
- Criar ranking semanal e geral com paginação, posição do jogador e proteção contra atualizações abusivas; validar tudo no servidor.
- A tabela nova terá permissões explícitas, segurança por usuário e leitura pública apenas dos campos seguros do ranking.
- Integrar métricas de anúncios já criadas ao painel pessoal sem misturá-las ao ranking de jogadores e sem aumentar a frequência dos anúncios.

## 8. Verificação

- Executar testes de engine, física, Worker, anúncios e ranking; validar tipos, lint seletivo e build.
- Testar partida rápida e carreira: início, pausa, velocidades, troca tática, substituição, replay, fim, relatório e retorno ao painel.
- Comparar desktop e celular nas telas de partida, painel, elenco, tática e loja; verificar foco, contraste, redução de movimento e ausência de sobreposição.
- Capturar enquadramentos equivalentes de dia, noite, câmera próxima, torcida e cutscene para comparar cor, sombras e legibilidade.
- Rodar sessões automatizadas longas no ambiente disponível e registrar quando o renderizador for por software.
- Manter como pendente, sem alegar 60 FPS certificado, a medição de três sessões de 180 segundos em GPU física identificada; o próprio painel permitirá coletar o relatório em um aparelho real.

## Limites e decisões técnicas

- A imagem enviada será usada como referência de problemas de densidade e hierarquia, não como recurso do aplicativo.
- Não serão adicionadas dependências que dupliquem recursos já presentes; o projeto já possui pós-processamento, damping, detecção de GPU, física, métricas e utilitários Three.js suficientes.
- Não serão usados HDRs, modelos, texturas ou dados sem arquivo e licença verificáveis.
- A meta é 60 FPS nos perfis Fluidez/Equilíbrio em desktop compatível; Cinema mira qualidade adaptativa e p95 de até 33,3 ms quando medido em GPU física.
