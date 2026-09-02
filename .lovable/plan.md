# Mega atualização: estádio, jogadores, kits, ligas, UI/UX e funcionalidades

Objetivo: elevar o jogo de "protótipo bonito" para um manager 3D completo — visual de transmissão de TV, elencos e ligas muito maiores, e camadas de gestão de verdade (transferências, contratos, treino, copas, temporada plurianual).

## 1. Estádio e jogadores em 3D

- Gramado: textura procedural com listras de corte em diagonal, desgaste na área e círculo central, brilho úmido e sombras suaves.
- Estádio: arquibancadas em anéis com inclinação e cobertura, túnel, banco de reservas, placar eletrônico 3D com o placar ao vivo, bandeirinhas de escanteio, redes de gol reais (malha, não wireframe).
- Torcida: mosaico nas cores do time da casa, bandeirões animados, ola ocasional, reação a gol (pulos e brilho), fumaça/sinalizador na comemoração.
- Atmosfera: refletores com halo volumétrico, poeira/névoa leve, três horários de partida (dia, entardecer, noite) com iluminação e céu diferentes.
- Jogadores: corpo mais anatômico (tronco, braços, cabeça com tom de pele variado), corrida com braços e pernas, animações de chute, deslize, comemoração e goleiro em mergulho; número e nome nas costas.
- Bola: rotação real conforme velocidade, sombra no chão, rastro em chutes fortes.
- Câmera: adiciona modos "torcedor", "atrás do gol" e "replay" — replay automático de gol com câmera orbital.
- Desempenho: 3 níveis de qualidade (baixa/média/alta) que reduzem torcida, sombras e resolução; alvo de 60fps no notebook comum.

## 2. Kits e escudos

- Kits: sistema de uniformes por clube (listras, faixa, quadriculado, gola/mangas em cor secundária) aplicados como textura no jogador; uniforme 1 e 2 com troca automática quando as cores se chocam.
- Goleiro com kit próprio em cor contrastante.
- Escudos: refinar a geração — mais formatos (escudo clássico, círculo duplo, losango, brasão com estrela), tipografia melhor, faixa com nome curto, acabamento metálico e realce; consistência entre escudo, kit e cores no 3D.

## 3. Ligas e campeonatos

- Ampliar de 18 para ~30 competições: acrescentar Grécia, Suíça, Áustria, Dinamarca, Noruega, Suécia, Polônia, Rússia, Ucrânia, Chile, Colômbia, Uruguai, Paraguai, Equador, Austrália, Coreia do Sul, China, Egito, África do Sul e mais divisões inferiores (Serie B, Segunda División, 2. Bundesliga, Ligue 2).
- Copas: copa nacional em mata-mata para cada país e três competições continentais (Libertadores, Champions, Sul-Americana/Europa) com fase de grupos e mata-mata, vagas dadas pela classificação da liga anterior.
- Bandeiras: substituir emoji por SVG próprio (o emoji aparece como quadrado em vários sistemas).
- Nomes de jogadores: bancos de nomes específicos para cada nova nacionalidade (hoje tudo sem banco cai em nomes brasileiros).

## 4. UI/UX

- Layout de central de comando: barra lateral fixa com escudo, navegação por ícones, header com rodada, saldo e próxima partida.
- Painéis com hierarquia visual de transmissão: cabeçalhos em fonte condensada, cartões com brilho sutil, gráficos de forma e sequência de resultados.
- Elenco: filtros por posição/idade/overall, ordenação, comparação de dois jogadores, arrastar para escalar, indicação de melhor posição.
- Táticas: campo interativo com arraste de posição, instruções individuais e presets salvos.
- Partida: HUD estilo TV com placar, cronômetro, barra de posse animada, feed de lances com ícones, mapa de calor no intervalo e súmula ao final.
- Animações de entrada, transições entre telas e estados de carregamento; responsivo para celular.

## 5. Conteúdo e funcionalidades

- Transferências: mercado com janelas, valor de mercado, propostas de compra/venda, empréstimos, negociação com contraproposta e IA comprando/vendendo entre clubes.
- Contratos e finanças: salários, orçamento, receita de bilheteria e patrocínio, saldo mensal, risco de demissão por resultados ruins.
- Treino: intensidade semanal, foco por atributo, evolução e desgaste, risco de lesão.
- Lesões, suspensões por cartões, condição física entre jogos e substituições durante a partida (até 5).
- Base: categorias de base gerando promessas a cada temporada.
- Progressão: fim de temporada com título, rebaixamento/acesso, aposentadorias, evolução/decadência por idade, e nova temporada continuando a carreira.
- Estatísticas: artilharia, assistências, jogador da partida, histórico de temporadas e mural de conquistas.
- Notícias: manchetes geradas por evento (goleada, contratação, sequência invicta).

## 6. Notas técnicas

- Persistência: o estado da carreira já é um JSONB único em `careers`. Os novos campos (finanças, contratos, copas, histórico) entram nesse mesmo estado, com migração de versão (`version: 1` → `2`) que preenche padrões em saves antigos, sem migração de banco.
- `src/game/sim.ts` ganha eventos de substituição, lesão e cartão, mais ganchos de animação (`state` do jogador: correndo, chutando, comemorando) que o `Stadium3D` consome.
- Kits são gerados com `CanvasTexture` a partir das cores do clube, em cache por clube para não recriar por jogador.
- Torcida continua em `InstancedMesh`; mosaico e ola são feitos por cor/offset por instância.
- Competições e calendário ficam em `src/game/season.ts` e num novo `src/game/competitions.ts`; mercado, finanças e treino em módulos próprios em `src/game`.

## Ordem de entrega

1. Estádio, jogadores, kits, escudos e bandeiras (impacto visual imediato).
2. Novas ligas + bancos de nomes + copas e competições continentais.
3. Reformulação da UI (shell, elenco, táticas, HUD de partida).
4. Transferências, finanças, treino, lesões, substituições.
5. Fim de temporada, progressão plurianual, estatísticas e notícias.
