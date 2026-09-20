# Anúncios nativos, desempenho 3D e versão offline integrada

## 1. Sistema de anúncios primeiro
- Criar um gerenciador central configurável por JSON, com anúncios próprios como prioridade e parceiros desativados até existirem campanhas reais.
- Implementar cartões patrocinados entre itens, produtos em destaque, anúncio lateral contextual, cartão de canto pós-evento e notícia patrocinada.
- Aplicar segmentação local por contexto, navegação e interações; limitar cada anúncio a três exibições por sessão e respeitar cinco minutos após dispensar.
- Carregar as zonas sob demanda, nunca interromper a partida, nunca reproduzir áudio automaticamente e permitir fechar anúncios flutuantes.
- Registrar impressão, clique, dispensa e conversão sem dados pessoais; incluir uma visão de desempenho local para administração.
- Na edição gratuita/offline, anúncios próprios poderão abrir apenas recursos existentes e páginas informativas; nenhum checkout, assinatura ou serviço pago será exigido.

## 2. Desempenho e medição
- Corrigir a medição por tempo de quadro, separando aquecimento, segundo plano e troca de perfil; registrar p95, 1% low, resolução, renderizador, triângulos e chamadas.
- Reduzir trabalho por quadro: LOD e descarte por câmera em jogadores/árbitros/torcida, instâncias para repetição, objetos temporários reutilizados e atualizações distantes menos frequentes.
- Limitar resolução dinâmica, sombras e pós-processamento por perfil, mantendo WebGL2 como padrão e WebGPU somente experimental.
- Carregar estádio, cutscenes, texturas e modelos progressivamente, fora da tela inicial, com fallback claro quando o recurso ainda não estiver disponível offline.

## 3. Gráficos, movimento e simulação
- Recalibrar gerenciamento de cores, exposição, luz ambiente/direcional, refletores e sombras de contato por horário.
- Melhorar materiais PBR existentes de pele, cabelo, tecido, concreto, metal e gramado; usar texturas procedurais leves e anisotropia/mipmaps proporcionais à qualidade.
- Integrar o perfil Cinema aos perfis atuais com efeitos adaptativos, antisserrilhado e profundidade de campo apenas nas cutscenes.
- Refinar transições de caminhada, corrida, sprint, giro, domínio, passe, chute, cabeceio, defesa e comemoração, com passada ligada à velocidade e redução de frequência à distância.
- Melhorar goleiros antecipatórios, pressão sem bola, cobertura, decisões adversárias e passos grandes da bola com testes determinísticos.
- Não importar modelos MakeHuman/Poly Haven sem arquivo e licença individual verificados; preparar manifesto e carregador GLB/KTX2 para recursos futuros sem substituir o rig procedural atual por material não auditado.

## 4. Cutscenes e funcionamento sem serviços pagos
- Melhorar vestiário, túnel, entrada, coletiva e conquista com câmera amortecida, planos variados, iluminação por cena, botão de pular e redução de movimento.
- Sincronizar falas por papel — narrador, comentarista e árbitro — usando voz local e legendas como caminho independente de serviços pagos.
- Manter partida rápida, carreira, táticas, transferências, editor e progressão locais; preservar integrações online já existentes no site sem torná-las obrigatórias.
- Criar os três contratos versionados: perfil gráfico/alvo de FPS, manifesto de recursos/LOD/licença e transferência de carreira compatível com saves atuais.
- Atualizar a PWA para cache progressivo, limites por tamanho/versão e mensagens de disponibilidade offline.

## 5. Verificação honesta
- Adicionar testes de frequência/cooldown dos anúncios, simulação, goleiros/IA, LOD, descarte, contratos, transferência de save e fallback offline.
- Validar partida, pausa, velocidade, fim de jogo, gravação/reabertura, replay, importação e PWA no navegador disponível.
- Comparar capturas de dia/noite, câmera próxima, torcida e cutscenes no ambiente disponível.
- Rodar tipos, lint, testes e build; registrar renderização por software separadamente.
- A meta Cinema será p95 de até 33,3 ms, mas não será declarada atingida sem três sessões de 180 segundos em GPU física identificada.
- Não publicar, trocar domínio, assinatura ou projeto neste trabalho; publicação e URL final somente mediante pedido explícito posterior.

## Limites técnicos
- OrbitControls, auto-rotação e painel de ajustes serão restritos ao modo visual/diagnóstico, não à câmera da partida.
- HDR, 4K, SSAO, bloom e sombras 4096 não serão ativados indiscriminadamente: cada recurso respeitará orçamento de GPU e perfil gráfico.
- Não serão adicionadas doze dependências só por quantidade; serão reutilizadas as bibliotecas 3D já instaladas e apenas uma dependência será adicionada se resolver uma lacuna comprovada.
