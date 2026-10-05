# Roadmap
- [x] SEO: H3 descritivos na página inicial e no guia de jogo, metadados da página inicial mais concisos, pré-carregamento da foto principal
- [x] Desempenho: arquivo de orçamento de decodificação KTX2 por aparelho; manter simulação determinística sequencial e GPU via renderizador existente
- [x] Ciclo 1: +89 competições, pirâmide em cadeia (estatísticas: TheSportsDB já esgotado, 285 jogadores)
- [x] Ciclo 2: overall por atributos/potencial, regens (aposentadoria realista, joias), checagem integrada
- [x] Ciclo 3: calibração dos placares + eventos (exibição na tela pendente)
- [ ] Ciclo 4: cupons, Pix/boleto/wallets, descontos
- [ ] Ciclo 5: stack compatível atualizada; interface e runtime das cenas otimizados; etapas 3/4/5 ainda exigem medição em celular real
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
- [x] 7 Design do jogo — revisão de início, loja, partida rápida e carreira em celular/desktop sem erros nem transbordo; botões da partida rápida em grade de toque
- [x] Conectores: Slack ligado (aviso de compra entregue no canal #social); e-mail, análise de uso e IA já ativos
- [x] Dependências: só atualizações seguras (postprocessing, sonner, date-fns); nenhum pacote 3D novo sem gargalo medido

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
- [x] Etapa 3 medida: temporada automática ~14 ms por rodada (380 jogos, Node); Rust não compensa aqui (custo de troca de dados > ganho). Torcida já usa Rust. Ossos ficam no Three.js (copiar matrizes para WASM custaria mais). Física só com medição em celular real.
- [ ] Etapa 4: modelo de jogador (recalibração atlética, sombra de contato, torso e atlas frontal/traseiro concluídos; rosto/cabelo, movimento e validação dos 3 níveis continuam).
- [ ] Etapa 5: abertura, túnel, intervalo/fim e taça já têm cenários e direção; runtime móvel otimizado; falta validar replay de gol e cerimônias em aparelho real.
- [ ] Etapa 6: medição antes/depois.
- [x] Importação 2026-10-05: 8.079 jogadores duplicados antigos removidos; títulos/clubes anteriores e estatísticas percorridos para todos os 26.076 jogadores oficiais; históricos de clubes percorridos até o fim da lista vinculada.
- [ ] Modelo de jogador e cenas 3D (etapas 4–5): próximo ciclo.

## Grande ciclo (plano aprovado 2026-10-05)
- [x] Pré-jogo de transmissão (/pre-jogo) com narração v4 e legendas
- [x] Instalar r3f-perf (painel ?perf=1 na prévia), @use-gesture/react, meshoptimizer
- [ ] Medição base da partida (fps, p95, draw calls)
- [x] Chuva/neve transferidas da atualização de milhares de matrizes na CPU para animação em shader; falta medir no aparelho
- [ ] Comprimir modelos com meshoptimizer e medir tamanho
- [x] Gesto de deslizar para fechar o menu (câmera pendente)
- [x] Vento (simplex-noise) nas bandeiras de escanteio (torcida pendente)
- [ ] Frases novas de narração (túnel, intervalo, taça; en/es) e cache de áudio
- [ ] Mega importação (liga travada, calendários, detalhes, fotos, homônimos)
- [ ] Painel desktop lento, partida ao vivo no celular, erros
- [x] Manchas no gramado reduzidas + sombra de contato menor, elíptica e suave (falta confirmar no aparelho)
- [ ] Voz do navegador: plano gratuito ElevenLabs quase esgotado (8.990/10.000) — usuário precisa fazer upgrade
- [x] Cenas pré-carregadas no painel e no pré-jogo
- [ ] Estádio melhor, kits reais e números no 3D, comemorações realistas (atlas/UV e classificação contextual corrigidos; direção de grupo ainda pendente)
- [ ] Cena de gol importante + hino do clube no gol
