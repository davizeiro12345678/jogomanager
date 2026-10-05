# Roadmap
- [x] SEO: H3 descritivos na página inicial e no guia de jogo, metadados da página inicial mais concisos, pré-carregamento da foto principal
- [x] Desempenho: arquivo de orçamento de decodificação KTX2 por aparelho; manter simulação determinística sequencial e GPU via renderizador existente
- [x] Ciclo 1: +89 competições, pirâmide em cadeia (estatísticas: TheSportsDB já esgotado, 285 jogadores)
- [x] Ciclo 2: overall por atributos/potencial, regens (aposentadoria realista, joias), checagem integrada
- [x] Ciclo 3: calibração dos placares + eventos (exibição na tela pendente)
- [ ] Ciclo 4: cupons, Pix/boleto/wallets, descontos
- [ ] Ciclo 5: etapas 3/4/5 conferidas
- [ ] Ciclo 6: KTX2, iluminação, rig, transições

## Grande ciclo (plano aprovado 2026-09-25)
- [x] 1.1 País de origem sem repetição + busca
- [x] 1.2 Varredura de telas (11 telas, 2 larguras; bandeiras vazias e liga da partida rápida corrigidas)
- [x] 1.3 Erros da partida 3D (minuto duplicado, nuvens suaves em todo navegador, anéis do gramado atenuados, texto das placas ajustado, /perfil sem erro)
- [x] 1.4 Inconsistências de dados + autocorreção (save conferido ao abrir, aviso no noticiário)
- [x] 2 Pirâmides nacionais ligadas onde existe divisão parceira; competições estaduais, femininas e isoladas seguem independentes
- [x] 3 Texturas KTX2 — gramado, concreto e rede via CDN; fallback procedural e ativação só em qualidade alta/WebGL2
- [ ] 4 Gráficos 3D — chuva, refletores, placas LED, bancos, túnel, bola e rede já existem; faltam validação de FPS/draw calls e refinamentos do rig
- [ ] 5 Cutscenes — cenários 3D, diretor, timeline de voz, pular e movimento reduzido existem; falta expandir abertura, replays e cerimônias conforme o plano
- [ ] 6 Simulação — calibragem de 2.000 partidas e teste tático determinístico feitos; faltam unificação dos lances da partida 3D e sim rápida e estresse de 2.000 partidas 3D (atual: 200)
- [ ] 7 Design do jogo — navegação móvel com aria-current/toques de 44px, skeleton de rota e erros recuperáveis; falta padronização das demais telas e revisão dos cinco grupos

## Importação e desempenho (pedido 2026-09-25)
- [x] Endpoint protegido com validação de escopo e paginação; ligas e clubes locais importados (4.506 clubes).
- [x] Primeiros lotes premium de jogadores, estatísticas e histórico executados; continuidade por offset sem pular itens com limite de tempo; estatísticas por fonte com upsert.
- [x] Temporada automática em Web Worker; partida ao vivo já isolada no Worker; cache versionado para texturas KTX2 e imagens oficiais.
- [ ] Cobertura total da fonte externa: aguarda processamento paginado dos registros restantes; os endpoints não publicam dados que a fonte não oferece.
- [ ] Compressão/reformatação das fotos externas: requer espelhamento autorizado em CDN de imagens; não modificar conteúdo de origem nem contornar licença.

## Importação completa e CDN de fotos oficiais (pedido 2026-09-26)
- [ ] Percorrer lotes restantes de equipes, jogadores, estatísticas e históricos até a fonte esgotar, preservando offsets e limites.
- [ ] Configurar entrega/cache das fotos oficiais pela CDN quando permitido pela fonte; verificar carregamento e não espelhar sem autorização.

## Importação premium prolongada (pedido 2026-09-27)
- [ ] Executar por até uma hora seguida lotes limitados dos endpoints premium para logos, kits, jogadores, históricos e eventos, registrando offsets e resultados sem repetir ou inventar dados.

## Ciclo CPU/Rust/jogador/cenas (plano 2026-10-05)
- [x] Etapa 2 (parcial, já existente): animação de jogadores longe em taxa reduzida (1/36s, 1/16s), jogadores fora de quadro só atualizam posição, sombra só perto, canvas pausa com aba oculta.
- [ ] Etapa 1: medição em celular real (sandbox sem GPU não serve para FPS).
- [ ] Etapa 3: Rust/WASM para torcida, ossos/IK, simulação rápida; física só com teste de 2.000 partidas idênticas.
- [ ] Etapa 4: modelo de jogador (corpo, rosto/cabelo, movimento, uniforme, 3 níveis).
- [ ] Etapa 5: cenas 3D (abertura, túnel, gol com replay, intervalo/fim, taça).
- [ ] Etapa 6: medição antes/depois.
