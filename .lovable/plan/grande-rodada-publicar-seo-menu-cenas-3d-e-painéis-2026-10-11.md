# Grande rodada: publicar, SEO, menu, cenas 3D e painéis

Trabalho grande; executo em fases, conferindo cada uma antes da próxima.

## Fase 1 — Publicar a versão atual
- Conferir que o site compila sem erros e publicar (guias novos, números da página inicial e tabelas chegam ao site real).

## Fase 2 — Limpar páginas parecidas (o Google pune conteúdo repetido)
Juntar páginas que disputam o mesmo assunto, com redirecionamento permanente para a página que fica:

| Sai (redireciona) | Fica |
|---|---|
| Brasileirão (página antiga) | Tabelas > Brasileirão Série A |
| Ligas de futebol | Tabelas |
| Táticas e formações | Melhores formações |
| Gestão financeira | Dicas de gestão (vira seção) |
| Soccer manager online | Jogo de manager de futebol |

O melhor texto de cada página removida é aproveitado na que fica. Mapa do site e links do rodapé atualizados.

## Fase 3 — Tabelas das 12 ligas + página geral
Cada liga ganha conteúdo longo e único, tirado só dos dados reais do banco:
- artilheiros e garçons, maiores transferências, técnicos, lesões, estádios, previsões, forma recente, casa x fora;
- análise "qual clube escolher no jogo" e "promessas para contratar";
- perguntas frequentes próprias da liga e dados estruturados (tabela esportiva, trilha de navegação);
- data de atualização visível e links para as ligas vizinhas e guias.

## Fase 4 — Expandir as páginas que ficam
Guias, glossário, perguntas frequentes, formações, mercado, carreira, offline, multiplayer, comparativo: mais profundidade, exemplos com números reais, índice no topo, links internos entre temas. Título e descrição únicos por página.

## Fase 5 — Mais cliques (CTA)
- Botão principal fixo no celular "Jogar grátis agora" nas páginas de conteúdo.
- Chamadas no meio do texto ligadas ao assunto ("Assuma o líder da Bundesliga").
- Títulos de busca mais atraentes (com números e ano).

## Fase 6 — Menu iniciar
Visual de transmissão esportiva: "Continuar carreira" em destaque com o clube e próximo jogo, atalhos grandes (Partida rápida, Carreira, Jogador, Multiplayer), novidades reais (líderes das ligas, transferências), carregamento mais rápido no celular.

## Fase 7 — Cenas 3D e painéis do jogo
- Cenas: melhor câmera (enquadramentos e cortes), luz e torcida mais vivas, transições suaves, legendas; sem perder desempenho em Android médio.
- Painéis da partida, elenco e clube: mostrar técnico, lesões, forma, transferências e troféus reais; visual mais limpo e legível.

## Ferramentas usadas
Dados de busca (Semrush) para escolher palavras de cada página, varredura de SEO e de segurança, teste visual no navegador.

## Detalhes técnicos
- Redirecionamentos 301 via `beforeLoad` + `redirect` nas rotas removidas; sitemap em `sitemap[.]xml.ts` atualizado.
- `tabelas.$slug.tsx`: novo server fn agregando `top_stats`, `transfer`, `coach`, `injury`, `venue`, `prediction` de `api_football_data`; JSON-LD SportsOrganization/BreadcrumbList/FAQPage visível.
- Cenas em `src/components/game/cinematic/`: reutilizar R3F/post-processing existentes, sem novas libs 3D.
- Publicar ao fim de novo para as fases 2–7 chegarem ao site.
