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
