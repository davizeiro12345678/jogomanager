# Plano: carregamento mais rápido, código modular, novas compras, Go e C#

Ordem: primeiro o que o jogador sente (velocidade e experiência), depois a reorganização do código, depois as novas compras e por fim Go e C#. Cada etapa é medida antes e depois, sempre com o mesmo celular de teste, a mesma página e a mesma partida. Nenhum limite de desempenho é afrouxado.

## Etapa 1 — Medição de base (antes de mexer)
- Lighthouse no celular e no computador, publicado, 3 rodadas cada, nas páginas: home, loja, tabelas, FAQ, criador, guias e as 5 páginas mais acessadas.
- Tamanho do primeiro download de JavaScript e CSS por página; tempo até a partida aparecer; quadros por segundo nas 4 tomadas de câmera.
- Hoje, só a home no celular foi medida: 87 de desempenho, 100 de SEO, tempo de bloqueio de 350 ms.
- Meta por página: desempenho 95 ou mais no celular, maior elemento visível em menos de 1,8 s, tempo de bloqueio abaixo de 150 ms, sem deslocamento de layout.

## Etapa 2 — Divisão do código e carregamento
- Cada página baixa só o que usa: o 3D, a física, a pós-produção e o catálogo de ligas ficam fora das páginas públicas.
- O catálogo de ligas (cerca de 5 mil linhas em 3 arquivos) é dividido por país e carregado sob demanda; a home e a loja não precisam dele.
- As animações (cerca de 4 mil linhas em 3 arquivos) carregam por grupo (corrida, chute, goleiro, comemoração) apenas quando a partida começa.
- Pré-carregamento inteligente: ao passar o dedo ou o mouse em "Jogar", a partida já começa a baixar.
- Fontes e imagens: imagem principal em AVIF/WebP com tamanho certo para o celular e fontes só com os caracteres usados.
- Reduzir o trabalho de estilo e layout (o maior custo medido na home): menos regras de CSS globais e seções abaixo da dobra adiadas (já aplicado na home; estender às outras páginas).
- Carregar os serviços de terceiros (eventos, análise) depois que a página fica interativa.

## Etapa 3 — Modularização dos arquivos gigantes
Sem mudar comportamento; cada passo mantém o jogo funcionando e é conferido pelos testes atuais.
- Motor da partida (2.915 linhas): separar em módulos de bola, posse, bolas paradas, cartões e lesões, IA do time e estatísticas. A mesma semente precisa dar a mesma partida, conferido por teste.
- Carreira (1.683 linhas): separar em temporada, finanças, mercado, diretoria e treino.
- Estádio 3D (1.174 linhas): separar em gramado, arquibancadas, iluminação, câmera e efeitos.
- Tela da partida (1.157 linhas): separar o placar, os controles, a narração e o painel de estatísticas.
- Importação de dados (1.224 linhas): separar por tipo de dado (clubes, jogadores, jogos, tabelas).
- Estúdio de jogadores (1.173 linhas): separar os painéis de corpo, rosto e uniforme.

## Etapa 4 — Experiência do usuário
- Telas de carregamento com progresso real e dicas, sem tela preta nem branca.
- Partida: aviso claro quando o aparelho é fraco, com sugestão automática de qualidade.
- Retomar onde parou: o botão de continuar leva direto ao próximo jogo.
- Erros explicados em português simples, com botão de tentar de novo.
- Acessibilidade: foco visível, contraste e botões de no mínimo 44 px em todas as telas novas.

## Etapa 5 — Novas opções de compra
Todas pagas pela loja segura e entregues pelo servidor. As moedas continuam valendo apenas o que o banco autoriza.
- **Pacote de estreia** (só uma vez por conta): moedas, 3 relatórios e 2 tratamentos médicos, com preço baixo.
- **Pacote departamento médico**: 5 tratamentos de lesão.
- **Pacote análise tática**: 10 relatórios de adversário.
- **Passe de temporada anual**: preço de 10 meses por 12.
- **Kit do clube**: uniforme especial e comemorações (só visual).
- Cada compra mostra o que muda na carreira antes do pagamento (já existe; estender aos novos pacotes).

## Etapa 6 — Go e C#/.NET (pilotos medidos)
A hospedagem executa apenas JavaScript e WebAssembly. Por isso, as duas linguagens entram como módulos compilados, nunca como servidores separados.
- **Go no servidor**: validação de saves (limites e pontuação de risco) e, se compensar, normalização dos lotes de importação. Só entra se der o mesmo resultado que hoje em 500 casos de teste.
- **C#/.NET na inteligência**: a leitura tática do intervalo e as substituições da CPU, rodando dentro do processo paralelo da partida. O motor da partida continua igual, porque o servidor o reexecuta para validar o online.
- Fica só o que melhorar os números da Etapa 1. O .NET pesa vários megabytes e é removido se atrasar a abertura da partida no celular.

## Etapa 7 — Relatório final
- Tabela de antes e depois para cada página e para a partida, mais capturas lado a lado.
- O que melhorou, o que não melhorou e o que ainda falta.

## Detalhes técnicos
- Divisão de código: `React.lazy`/import dinâmico; rotas sem exportar componentes; catálogo em `src/game/data/leagues/<pais>.ts` via `import.meta.glob`.
- Modularização: `src/game/sim/` com reexport em `sim.ts`; `src/game/career/`; `src/components/game/stadium/`; testes de semente e replay como guarda.
- Novas compras: produtos e preços novos no Stripe, linhas em `store_products` com `contents`, entrega pelas funções de banco existentes (`fulfill_store_purchase`, ampliada para tratamentos e relatórios de adversário).
- Go: TinyGo para WASM, chamado de arquivos `*.server.ts`, interface só JSON. C#: `browser-wasm` dentro de `simWorker`. Os `.wasm` gerados ficam no repositório, porque o build da Lovable não compila Go nem C#.
- Ao aprovar, registrar estas etapas em `roadmap.md`.
