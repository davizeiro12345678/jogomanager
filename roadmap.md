# Roadmap
## Push e chat (07/11, 01:00 UTC; sem publicação)
- [x] Conexão Firebase atualizada com Include web push; chaves web chegaram ao .env e o botão de ativação destravou.
- [x] Envio FCM no servidor (push.server.ts via gateway): chat avisa demais inscritos, serviços do clube avisam o comprador; tokens mortos removidos; 7 testes passaram; build OK.
- [x] Chat: persistência verificada com duas contas (davizeiro10.jogos e davizeirod) — leitura cruzada, sessão nova lê histórico, mensagem aparece na hora (corrigido), infração gravada (corrigida a pré-checagem local que impedia o registro) e mute de 10 min persistindo entre sessões; dados de teste removidos; evidências em docs/report-2026-11-07-push-chat.md.
- [ ] Push real bloqueado: App ID/chave web na conexão são do projeto Firebase antigo (sscxz-2ee8d); inscrição falha com "permission denied". Usuário optou por atualizar a conexão com os dados web do projeto sjsjs-ed490; entrega real não verificada.
- [ ] Melhorias amplas de carreira/cutscenes/estádio/rig e tabelas complexas seguem abertas nas seções abaixo; gates completos obrigatórios antes de publicar.
## Melhorias amplas restantes (06/11, 23:52 UTC; sem publicação)
- [x] Criadores: navegação por etapas acessível, revisão editável e separação dos painéis grandes, preservando escolhas e salvamento.
- [x] Jogador: trabalho da semana antes de informações secundárias, metas/atributos separados e visual 3D opcional.
- [x] Clube/estádio: capacidade e evolução reais em destaque, prévia de ampliação clara e cabine de transmissão com foco acessível.
- [x] Verificar criação/retomada local, navegação por teclado e celular, 60 testes focados e lint sem avisos/erros; build OK. Sincronização do atleta mostrou conflito preservando o local: entrega na nuvem não confirmada.
- [ ] Gates completos continuam obrigatórios antes de publicar; certificação física de FPS exige aparelhos reais.
- [ ] Conexões/push/configuração remota bloqueados pelas permissões recusadas; VIP/pacotes dependem de ofertas e regras ainda não confirmadas.
## Implementação da entrevista (06/11, 22:13 UTC; sem publicação)
- [x] Parallel e Brevo conectados sem duplicatas.
- [ ] Telegram, GoodData e Google Cloud: conexão recusada pelo usuário; sem chamadas ou implementação que dependam delas.
- [x] Firebase: configuração pública do conector, guarda de iframe e mensagens em worker separado do offline; pedido duplicado de permissão removido.
- [ ] Ativar push real: Include web push ausente e atualização da conexão recusada; entrega real não verificada.
- [x] Tutorial de treinador reconhece partidas/treinos/relatórios salvos, próximo passo destacado, marcas manuais separadas; guia do jogador reflete relatórios/participações.
- [x] Exportador PNG do clube e metadados das abas do jogador modularizados; mensagens do criador anunciadas para leitores de tela.
- [x] ElevenLabs v4/v4 Turbo confirmados no catálogo autenticado; defaults de partida/cena já existentes preservados; voz tardia de cutscene passa a ser guardada para replay sem aumentar espera. Cinema e modo leve existentes preservados.
- [ ] Diagnóstico Firebase e configuração remota: Google Cloud recusado e configuração pública web indisponível; nenhuma migração de conta/save.
- [x] Tutorial em carreira autenticada reconheceu duas lições, desktop/mobile sem overflow, Escape fecha; 29 testes focados passaram, lint zero avisos/erros, preview/build OK.
- [ ] Reformulação ampla de estádio/carreiras, restante da modularização e gates completos de lançamento ainda não concluídos; nenhuma publicação.
## Carreira e UI/UX (06/11, 21:43 UTC)
- [x] Hierarquia: trabalho da semana primeiro, prévia derivada do efeito real, confirmação explícita, histórico vindo do save e propostas ligadas à diretoria.
- [x] Modularizar escalação e simulação rápida (career.ts 762 → 542 linhas); 160 escalações, 300 resultados e 12 rodadas idênticos ao anterior. Sem alegação de ganho de CPU.
- [x] CSS separado preservando cascata, escritório adaptado ao celular, navegação sem sobreposição, indicadores acessíveis e espera inicial sem falso estado vazio.
- [x] 312 arquivos/1.656 testes, lint sem avisos e preview/build OK; conta autenticada avançou rodada e histórico leu novamente após reabrir; desktop/mobile sem overflow ou erros.
- [ ] Restante: tutorial com recompensa atestada, entrega atômica de serviços, VIP/pacotes, personalização, evolução visual do estádio e gates completos de lançamento; não publicados neste ciclo.
## Execução restante (06/11, 21:24 UTC)
- [x] Guia retomável de 4 capítulos/10 lições no treinador e orientações próprias no painel de jogador; progresso local, sem recompensa automática.
- [x] Treino (150 moedas, 5/7 dias, +50% no exercício da rodada) e olheiro individual (120, 7/7 dias), com cobrança no servidor e testes.
- [x] Separar cena do estádio (712 → 304 linhas no controlador) e prévia do uniforme do criador (925 → 862 linhas).
- [x] Conferir catálogo: 15 produtos ativos; cinco pacotes propostos e VIP ainda não existem como ofertas pagáveis com entrega correspondente.
- [x] Regressão: 311 arquivos/1.654 testes; lint sem avisos; preview/build OK; tutorial autenticado desktop/mobile sem overflow nem erros.
- [ ] Tutorial guiado por ações com recompensa atestada, VIP/pacotes/personalização, economia/eventos, evolução visual dos níveis do estádio e restante da carreira: implementação ainda não concluída.
- [ ] Entrega durável dos serviços ligada atomicamente ao save e recuperação de pedidos interrompidos; o fluxo atual ainda cobra antes do efeito local.
- [ ] Gates de lançamento: stress 200 jogos atualizado, bundles/Lighthouse, replay do banco e validação gráfica; sem publicar nem certificar FPS físico.
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
  - [x] Saves encadeados por hash (servidor, gatilho no banco)
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
  - [x] Mensagens de erro simples nas demais telas (loja, perfil, autorização)
- [x] Etapa 5 Novas compras
  - [x] Pacote de estreia (1x por conta) e Kit do clube
  - [x] Pacote médico e análise tática (tratamentos/relatórios guardados na carteira)
  - [x] Passe anual (assinatura anual, 12 meses pelo preço de 10)
- [x] Etapa 6 Go e C# (pilotos medidos; nenhum entra: Go 21% mais lento, .NET +1,3 MB)
- [ ] Etapa 7 Relatório final

## Banco (2026-11-06)
- [x] Busca de jogadores por nome: índice de trigramas + estatísticas atualizadas (nome raro 1.409ms → 0,24ms)
- [x] Tabela de liga: índice por prefixo de referência (5,6ms → 4ms)
- [x] Acessibilidade: telas cheias usam altura real do celular (30 telas); imagens e botões de ícone já têm descrição

## Plano carreira/tutorial/VIP (aprovado 2026-11-06)
- [ ] E1 Tutorial completo
- [ ] E2 Interface fácil
- [ ] E3 Carreiras e criador de clube
- [ ] E4 Serviços com moedas (5 novos) e 5 pacotes
- [ ] E5 VIP e personalização
- [ ] E6 Estádio 3D
- [ ] E7 Arquivos grandes
- [ ] E8 Economia
- [ ] E9 Retorno
- [ ] E10 Testes e entrega
  - [x] E4 parcial: Acelerar evolução (300) e Melhoria do estádio (500) cobrados pelo banco, na tela do elenco
  - [x] E4 serviços: Aprimorar treino, Olheiro individual premium e extensão de contrato disponíveis; contrato continua sendo extensão direta, não reabertura após recusa.
  - [ ] E4 compras: cinco novos pacotes ainda dependem de implementação de inventário/entrega e ofertas reais no provedor.
