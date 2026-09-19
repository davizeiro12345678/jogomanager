# Evolução integrada: página inicial, interface, partida 3D, narração, cutscenes e mídia

## Objetivo

Entregar uma atualização única e coerente, preservando a identidade **Gramado premium cinematic** e priorizando fluidez, clareza e conforto antes de efeitos caros.

## 1. Página inicial e sistema visual

- Reorganizar `index.tsx` para apresentar o jogo como experiência jogável: marca forte no primeiro quadro, ação principal inequívoca, continuação de carreira destacada e demonstração real da partida sem excesso de texto ou cartões.
- Tornar a página mais leve no celular: reduzir camadas fixas, blur, sombras e animações quando o aparelho pedir menos movimento ou tiver menor capacidade.
- Refinar `styles.css` sem criar uma segunda identidade: consolidar superfícies, botões, foco, tipografia, estados e espaçamentos nos tokens existentes; remover estilos duplicados e efeitos globais que custem pintura sem benefício visível.
- Aplicar uma navegação pública compacta e previsível, mantendo “Jogar agora”, “Partida rápida”, “Salvar com Google” e “Continuar carreira” como caminhos prioritários.
- Melhorar leitura, contraste, alvos de toque, navegação por teclado, ordem de foco, mensagens de estado e adaptação real a celular, tablet e desktop.

## 2. Interface da partida e fluxos principais

- Reorganizar HUD, comandos, placar, cronologia, narração e estatísticas para que a partida continue visível e os controles mais usados fiquem acessíveis com uma mão no celular.
- Unificar padrões visuais de carreira, elenco, tática, loja e campeonato com os mesmos controles, estados de carregamento, vazio, erro e sucesso.
- Evitar cartões dentro de cartões e reduzir informação concorrente; detalhes avançados ficam em painéis progressivos sem esconder ações críticas.
- Preservar todos os fluxos existentes, inclusive modo convidado, salvamento na nuvem, compra e compartilhamento.

## 3. Engine, física e inteligência da partida

- Evoluir a física determinística no Worker: domínio orientado pela velocidade, primeiro toque, passe sob pressão, chute com apoio/perna dominante, curva coerente, colisão, bloqueio, rebote, defesa e bola dividida.
- Melhorar marcação individual e por zona, coberturas, linha defensiva, impedimento, movimentação sem bola, sobreposição, ocupação de espaços, pressão coordenada e decisões conforme placar e tempo.
- Refinar goleiros: posicionamento pelo ângulo, tempo de saída, escolha entre encaixe/espalmada, rebote seguro e reposição contextual.
- Manter limites rígidos para laços, eventos, filas e coleções; ampliar testes por semente, partidas longas e invariantes contra bola travada, jogadores inválidos e resultados impossíveis.
- Reduzir o tráfego entre Worker e tela com snapshots compactos/diferenciais, buffers reutilizáveis e interpolação visual independente da frequência da simulação.

## 4. Gráficos 3D e pós-processamento escalável

- Recalibrar luz solar, ambiente, refletores, exposição e sombras por distância/importância, com cascata de qualidade e contato simplificado nos objetos distantes.
- Melhorar gramado, linhas, desgaste, umidade, tecido, pele, cabelo, chuteiras, redes e superfícies do estádio usando mapas compartilhados, atlases e materiais reaproveitados.
- Refinar `PlayerRig`: hierarquia corporal completa, proporções e articulações mais naturais, transferência de peso, apoio dos pés, mudança de direção, condução, passe, chute, cabeceio, queda, recuperação e comemoração com transições contínuas.
- Otimizar torcida, árbitros, bandeirinhas e jogadores com instancing, LOD, atualização reduzida fora da câmera, descarte de objetos invisíveis e ausência de alocações por quadro.
- Reequilibrar o pós-processamento: eliminar passagens imperceptíveis durante jogo normal; reservar profundidade de campo, aberração e efeitos dramáticos para replay/cutscene; adaptar resolução, AO, bloom e sombras pela qualidade medida.
- Manter WebGL2 como caminho estável e WebGPU apenas opcional com fallback automático.

## 5. Narração dinâmica, voz, cache e buffer

- Expandir o contrato da narração para receber minuto, placar, margem, jogador, equipe, sequência do lance, pressão, rivalidade e importância, sempre por campos validados e modelos de frase fechados.
- Selecionar falas por contexto em vez de sorteio puro: abertura, rotina, perigo, defesa difícil, empate, virada, goleada, fim apertado, expulsão, VAR, impedimento, lesão e encerramento.
- Aplicar prioridades e composição de eventos: gol/expulsão interrompem; lances menores podem ser resumidos; falas antigas deixam de bloquear acontecimentos atuais.
- Uniformizar a qualidade da ElevenLabs entre partida e cenas, manter vozes por papel e prosódia por emoção, com tentativa controlada de recuperação antes do fallback local.
- Substituir áudio base64 descartável por Blob URL e um elemento de áudio reutilizável; pré-carregar apenas falas prováveis de início/intervalo/fim e a próxima linha da cutscene.
- Criar cache LRU persistente e versionado para áudio já gerado, com limite de bytes e validade; deduplicar requisições em andamento e nunca armazenar dados pessoais.
- Implementar buffer curto com estados `carregando`, `pronto`, `tocando` e `expirado`, sem deixar a partida esperar pela voz; sincronizar legenda visível com a fala e oferecer volume/mudo acessíveis.
- Preservar o teto mensal, o fallback local e a prevenção de repetição próxima.

## 6. Cutscenes e imersão

- Evoluir os cenários 3D próprios de vestiário, túnel, coletiva, entrada no campo, arquibancada e diretoria com linhas de tempo por cena, câmera motivada pela fala, luz prática, figurantes articulados e continuidade de cores/escudo do clube.
- Reaproveitar o rig otimizado dos jogadores para personagens em foco e LOD reduzido nos figurantes; carregar cada cenário sob demanda e liberar geometria, materiais, áudio e timers ao sair.
- Sincronizar corte, legenda, expressão, gesto e voz; pré-carregar a próxima fala durante a atual para eliminar pausas artificiais.
- Criar níveis de qualidade específicos para cutscenes: completo, equilibrado e leve; em movimento reduzido, usar enquadramento estável sem flashes ou câmera contínua.

## 7. Imagens, WebP/AVIF e cache do aplicativo

- Manter a foto principal no pipeline responsivo já existente e aplicar o mesmo padrão a novas fotos locais: AVIF primeiro, WebP como alternativa e JPEG/PNG somente como compatibilidade.
- Não converter favicon, Apple Touch Icon e ícones PWA para WebP; esses formatos continuam em PNG. A capa de compartilhamento mantém JPEG compatível com redes sociais.
- Não tentar converter SVGs procedurais de escudos; eles já são vetoriais. Para fotos, logos, kits e estádios vindos de fontes externas, usar transformação somente por origem autorizada ou armazená-los na mídia gerenciada do projeto, evitando proxy aberto e risco de segurança.
- Incluir largura/altura, carregamento tardio fora do primeiro quadro, `srcset` e tamanhos adequados onde houver raster local ou armazenado.
- Atualizar o service worker com caches versionados, limite/expiração e estratégias separadas: documentos em rede primeiro; recursos versionados em cache primeiro; imagens externas autorizadas em atualização em segundo plano; nunca cachear autenticação, pagamentos ou APIs privadas.
- Evitar carregar antecipadamente imagens, cenas 3D e áudio que o usuário talvez não abra.

## 8. Verificação e critérios de aceite

- Executar testes determinísticos e de estresse da simulação, narração, Worker, replay e partida longa; validar tipos, build e integridade das diferenças.
- Testar no navegador a página inicial e os fluxos de partida, carreira, elenco, tática, loja, autenticação, cutscene, salvamento e compra em celular e desktop.
- Verificar teclado, leitor de tela, contraste, zoom, movimento reduzido, legenda e controles de áudio.
- Medir tamanho transferido, imagens usadas, cache ocupado, tempo de primeira interação, FPS médio/p95/1% low, memória e mudanças automáticas de qualidade.
- A validação final de desempenho em GPU física será feita no site publicado ou na pré-visualização em aparelhos reais; o ambiente de desenvolvimento usa renderização por software e não produz um número representativo.

## Limites

- “Todas as imagens em WebP” não será aplicado aos ícones PWA, favicon, capa social, SVGs nem a imagens externas fora do controle do projeto; será usada a melhor combinação compatível por tipo.
- Nenhuma qualidade visual terá permissão para reduzir a estabilidade da partida; aparelhos fracos recebem materiais, sombras e pós-processamento mais leves automaticamente.
