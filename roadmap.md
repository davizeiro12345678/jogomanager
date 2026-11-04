# Roadmap
Plano aprovado: `.lovable/plan/plano-partida-3d-muito-melhor-ia-mais-esperta-moedas-úteis-2-2026-11-03.md`

- [ ] E1 Gráficos da partida 3D (salto visual)
- [ ] E2 Cutscenes
- [ ] E3 Física (salto de qualidade)
- [ ] E4 IA (salto de qualidade)
- [ ] E5 Moedas e benefícios
- [ ] E6 Idiomas (25 maiores completos)
- [ ] E7 Proteção, anticheat e moderação
  - [x] 7.3 Moderador do chat no servidor (disfarces, links, dados pessoais, punição progressiva)
  - [ ] 7.3b Denúncia de mensagem enviada ao servidor (hoje só oculta localmente)
- [ ] E8 Home, estilos e carregamento

- [x] E3: 10 novas funcionalidades de física da partida (src/game/match-physics-extras.ts)
- [ ] E3: rodar teste de estresse de 200 jogos (excede o tempo do sandbox; roda no Quality gates)
- [x] Visitantes: aviso de login obrigatório para compras/recursos de conta (loja pública e loja do jogo)
- [x] Cutscenes: clarão branco por partícula colada na câmera (tamanho das partículas limitado)
- [x] Física dos jogadores: rede lateral sólida (placas e bancos já ficam fora do alcance)
  - [ ] Passada que encurta com o cansaço (animação)
- [x] Inteligência dos times: leitura do adversário no intervalo (posse, finalizações, pontas, pressão, placar)
- [x] Moedas: tratamento de lesão (250) e relatório do adversário (100), com limites semanais, pedido único e saldo nunca negativo no banco
- [x] Idiomas: textos da interface completos nos 25 idiomas mais falados (pacotes carregados sob demanda + teste)
- [ ] Proteção: trapaça em saves, partidas e moedas
  - [x] Limites de plausibilidade nos saves + pontuação de risco (30 dias) que bloqueia atestar progresso
  - [ ] Saves encadeados por hash
  - [x] Nomes ofensivos bloqueados ao criar carreira/clube e trocados por "Treinador" no ranking público (banco)
- [ ] Home e páginas: velocidade (home móvel publicada: 87; seções abaixo da dobra adiadas e desfoques removidos, falta medir após publicar)

## Plano: carregamento, modularização, novas compras, Go e C# (aprovado 03/11)
- [x] Etapa 1 Medição de base (docs/report-2026-11-03-speed-and-wasm-pilots.md; FAQ dava 404 no publicado)
  - [ ] Medir de novo depois de publicar
- [ ] Etapa 2 Divisão do código e carregamento
  - [x] Estilo do jogo ausente no publicado (CLS 0,78 em /new) corrigido
  - [x] Catálogo de clubes de /new baixado só depois da pintura
  - [x] Guias longos de loja/criador pulam o desenho fora da tela
  - [ ] Reduzir o JS de /new (463 kB) e o bloqueio de /produtos e /guias (>1 s)
- [ ] Etapa 3 Modularização dos arquivos gigantes
  - [x] Motor da partida: bolas paradas em src/game/sim-set-pieces.ts (2.915 → 2.472 linhas; 30 partidas idênticas ao original, mesma velocidade)
  - [x] Estádio 3D: câmera, céu, festa do gol, arbitragem e medidor de quadros em stadium/ (1.174 → 712 linhas)
  - [x] Motor: disputas de bola, inteligência do time, cartões e lesões (sim.ts 2.472 → 1.671; 30 partidas idênticas, mesma velocidade)
  - [x] Carreira em 7 arquivos (1.683 → 762; 90 rodadas idênticas ao original)
  - [x] Importação em conexão, clubes/jogadores e partidas (1.228 → 160)
  - [x] Estúdio de jogadores: cena 3D e dados separados (1.173 → 644)
  - [x] Tela da partida: estatísticas e táticas/substituições separadas (1.157 → 1.008)
  - [ ] Decisão de quem tem a bola (usa campos privados do motor) e o resto da tela da partida
- [ ] Etapa 4 Experiência do usuário
  - [x] Início: cartão da carreira mostra o próximo adversário e botão "Jogar o próximo jogo" (rodada corrigida)
  - [x] Carregamento do estádio com dicas, aviso de conexão lenta/sem internet e botão de tentar de novo se o download falhar
  - [x] Aviso de aparelho fraco com ajuste automático de gráficos (já existia)
  - [ ] Mensagens de erro simples nas demais telas
- [x] Etapa 5 Novas compras
  - [x] Pacote de estreia (1x por conta) e Kit do clube
  - [x] Pacote médico e análise tática (tratamentos/relatórios guardados na carteira)
  - [x] Passe anual (assinatura anual, 12 meses pelo preço de 10)
- [x] Etapa 6 Go e C# (pilotos medidos; nenhum entra: Go 21% mais lento, .NET +1,3 MB)
- [ ] Etapa 7 Relatório final
