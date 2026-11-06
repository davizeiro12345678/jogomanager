# Roadmap
## Continuação aprovada (06/11, sem publicação)
- [x] Concluir passada com cansaço e validar contato compartilhado entre os níveis de detalhe (testes e atleta isolado).
- [x] Enviar denúncias do chat para o servidor, com duplicatas e abuso limitados; gravação real de denúncia entre contas ainda não exercitada.
- [x] Adiar estatísticas opcionais da partida sem bloquear o campo; integração visual durante partida permanece a verificar.
- [x] Conferir encadeamento de saves: não existe; implantação requer novo contrato atômico e compatibilidade offline, não foi simulada por hash no cliente.
- [x] Executar regressão (306 arquivos, 1.633 testes), stress de 200 partidas com replay e lint; registrar evidências.
- [x] Índice do mercado aplicado após plano de consulta medido (varredura de 201.530 jogadores substituída por leitura ordenada).
- [ ] Concluir hash de saves, modularização restante, demais objetivos gráficos/IA/economia e validação completa de acessibilidade.
- [ ] Executar Quality gates completo e comparação de bundles/Lighthouse; publicação continua não autorizada neste ciclo.
## Plano aprovado: CSS sob demanda e segurança (06/11)
- [x] Separar CSS público por família de página, preservando estilos críticos no primeiro carregamento.
- [x] Carregar catálogo de /new apenas ao escolher clube; corrigir cache público sem armazenar sessões.
- [x] Executar Semgrep, scanners e testes ativos não destrutivos; corrigir vulnerabilidades confirmadas.
- [x] Verificar navegação móvel/desktop e registrar evidências e limites em docs/report-2026-11-06-css-security.md.
- [ ] Divisão fina dos painéis de gameplay e gates publicados: requer continuidade de auditoria visual, medição e workflow Quality gates; não publicar antes disso.

Plano aprovado: `.lovable/plan/plano-partida-3d-muito-melhor-ia-mais-esperta-moedas-úteis-2-2026-11-03.md`

- [ ] E1 Gráficos da partida 3D (salto visual)
- [ ] E2 Cutscenes
- [ ] E3 Física (salto de qualidade)
- [ ] E4 IA (salto de qualidade)
- [ ] E5 Moedas e benefícios
- [ ] E6 Idiomas (25 maiores completos)
- [ ] E7 Proteção, anticheat e moderação
  - [x] 7.3 Moderador do chat no servidor (disfarces, links, dados pessoais, punição progressiva)
  - [x] 7.3b Denúncia enviada ao servidor antes de ocultar localmente, com validação e limite no banco
- [ ] E8 Home, estilos e carregamento

- [x] E3: 10 novas funcionalidades de física da partida (src/game/match-physics-extras.ts)
- [x] E3: teste de estresse de 200 jogos e respectivos replays passou em 588,9 s (06/11); evidência CI estruturada ainda depende do Quality gates
- [x] Visitantes: aviso de login obrigatório para compras/recursos de conta (loja pública e loja do jogo)
- [x] Cutscenes: clarão branco por partícula colada na câmera (tamanho das partículas limitado)
- [x] Física dos jogadores: rede lateral sólida (placas e bancos já ficam fora do alcance)
  - [x] Passada que encurta com o cansaço, com cadência sincronizada para não patinar
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
