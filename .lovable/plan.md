# Mega atualização: jogadores, clubes, mecânicas e 59 funcionalidades

Objetivo: elevar drasticamente o realismo visual (jogadores, kits, logos, estádio), a profundidade de gestão (mecânicas novas, eventos dinâmicos, interesse de clubes, demissão) e a UI/UX em painéis, além de novas ligas.

## 1. Jogadores e visual 3D
- Anatomia melhorada: proporções corretas por biotipo (altura/porte por posição), pescoço, cabelo em camadas, barba, tons de pele variados, luvas e caneleiras.
- Kits em alta definição: gola, mangas, números nas costas, listras/xadrez/faixas, patrocinador, kits de goleiro e alternativos, texturas com desgaste e brilho de tecido.
- Movimento: melhor mistura entre as 59 animações existentes, inclinação do corpo em curvas, olhar acompanhando a bola, reação da torcida a lances.
- Estádio: gramado com padrão de corte e desgaste, redes com física suave, luzes de partida noturna, fumaça/bandeirões, placar animado.

## 2. Logos e identidade dos clubes
- Crests procedurais mais ricos: escudos com formas variadas (redondo, escudo clássico, losango), faixas, estrelas por títulos, monogramas, cores por país.
- Identidade coerente: cor primária/secundária do escudo alinhada ao kit e à UI do clube.

## 3. Novas ligas e competições
- +12 países/competições (ex.: Escócia, Suíça, Áustria, Dinamarca, Noruega, Suécia, Polônia, Grécia, Chile, Uruguai, Coreia do Sul, Austrália) com elencos e nomes locais.
- Copas nacionais em formato mata-mata e supercopa no início da temporada.

## 4. UI/UX e painéis
- Painel inicial (dashboard) com cartões: próxima partida, forma recente, finanças, moral do elenco, objetivos da diretoria, notícias.
- Tabelas com ordenação, filtros e comparação de jogadores; gráficos simples de desempenho.
- Layout de transmissão consistente, estados de carregamento, e navegação móvel melhorada.

## 5. Mecânicas novas
Eventos dinâmicos durante a temporada, clubes interessados nos seus jogadores e em você, pressão da diretoria, risco de demissão e possibilidade de pedir demissão para assinar com outro clube.

## 59 funcionalidades
Contratos e renovações, cláusula de rescisão, empréstimos, olheiros, relatórios de scout, base/academia, promoção de jovens, comparação de jogadores, atributos ocultos, potencial, personalidade, entrevistas coletivas, moral individual, relação com o elenco, líderes de vestiário, conflitos internos, pedidos de jogadores, reclamação por tempo de jogo, rotação de elenco, fadiga acumulada, tipos de lesão e prazos, fisioterapia, sessões de treino específicas, treinador auxiliar, preparador físico, staff médico, orçamento de staff, patrocínios, bilheteria, sócios, expansão do estádio, preço de ingressos, folha salarial, fair play financeiro, prêmios por desempenho, objetivos por temporada, avaliação da diretoria, aprovação da torcida, rivalidades, clássicos, sequências de vitórias, forma dos jogadores, jogador do mês, prêmios individuais, artilharia e assistências, estatísticas avançadas, mapa de calor simples, análise pré-jogo do adversário, instruções por jogador, marcação individual, bolas paradas ajustáveis, substituições táticas automáticas, cartões e suspensões por competição, mercado de inverno, agentes livres, transferências de IA entre clubes, histórico de clubes do técnico, e sala de troféus.

## Detalhes técnicos
- Mantém `CareerState` com migração v2 → v3 (novos campos com padrões seguros), persistido em `public.careers` (JSONB, RLS por dono).
- Geração determinística por hash em `src/game/kits.ts`, `Crest.tsx`, `data/` para clubes/ligas novos.
- Novos módulos: `src/game/events.ts` (eventos dinâmicos, interesse de clubes, demissão), `src/game/staff.ts`, `src/game/scouting.ts`, `src/game/contracts.ts`.
- Novas rotas autenticadas: `dashboard`, `staff`, `scouting`, `finances`, `stats`, `board`.
- Verificação: `bunx tsgo --noEmit`, build de produção e checagem visual do estádio via Playwright.

## Entrega em fases
1. Jogadores 3D + kits + crests + estádio.
2. Novas ligas/copas + dados.
3. Painéis e UI/UX.
4. Mecânicas novas, eventos dinâmicos, demissão e o restante das 59 funcionalidades.
