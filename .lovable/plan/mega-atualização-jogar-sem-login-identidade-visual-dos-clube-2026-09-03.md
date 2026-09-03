# Mega atualização: jogar sem login, identidade visual dos clubes e conteúdo

## 1. Jogar sem e-mail (conta opcional)

- Home ganha botão principal "Jogar agora": cria a carreira na hora, sem conta.
- Carreira do convidado salva no navegador (localStorage), com a mesma estrutura da carreira na nuvem.
- Faixa discreta "salve na nuvem para jogar em outros aparelhos" com botão de criar conta; nunca bloqueia o jogo.
- Ao entrar numa conta, a carreira local é enviada para a nuvem e o jogo continua de onde parou (sem perder progresso).
- Todas as telas funcionam nos dois modos: elenco, táticas, partida, mercado, diretoria, finanças, notícias, história, estatísticas, olheiros.

## 2. Logos/escudos: reconstrução visual completa

Hoje os escudos são um desenho simples repetido. Novo gerador com muito mais qualidade:

- 8 formatos de escudo: circular, escudo clássico, escudo inglês, losango, hexágono, brasão com ponta, escudo partido e estrela.
- Composições internas: faixa diagonal, listras verticais, meio a meio, quadrantes, faixa horizontal, raios, contorno duplo.
- Detalhes: monograma legível com fonte forte, ano de fundação, estrelas de títulos, borda metálica (ouro/prata), pequeno símbolo por região (bola, leão, águia, coroa, âncora, folha, montanha, raio).
- Paleta derivada das cores reais do clube, com contraste garantido e versão clara/escura para fundos diferentes.
- Renderização nítida em qualquer tamanho (SVG), com variação de detalhe: versão simplificada para listas e ícones pequenos, versão completa para páginas de clube e placar.
- Escudo aplicado de forma consistente: navegação, tabela, placar do estádio, mercado, notícias e sala de troféus.

## 3. Kits, jogadores e estádio (3D)

- Kits: novos padrões (listras verticais/horizontais, faixa cruzada, xadrez, degradê, ombros contrastantes), meias e calções coerentes, uniforme reserva e goleiro distinto, número e nome nas costas, escudo no peito.
- Jogadores: proporções melhores, variação de altura/físico/tom de pele/cabelo, luvas do goleiro, capitão com braçadeira, animações de comemoração já existentes reaproveitadas.
- Estádio: mais níveis de arquibancada, telão com replay, bandeirões e fumaça da torcida, iluminação noturna, clima (sol/chuva/noite) e desgaste do gramado ao longo da temporada.
- Mantém os modos Baixa/Média/Alta; sem soft shadows e sem depth of field (quebraram o render antes).

## 4. Novas ligas e campeonatos

- ~12 novas ligas nacionais (Escócia, Grécia, Áustria, Suíça, Dinamarca, Noruega, Suécia, Croácia, Sérvia, Japão, Coreia, Austrália) com elencos, nomes locais e escudos gerados.
- Copas nacionais e competições continentais com fase eliminatória integradas ao calendário, às finanças e à sala de troféus.

## 5. UI/UX e conteúdo

- Painel inicial mais claro: próximo jogo em destaque, objetivos da diretoria, alertas de lesão/contrato/moral.
- Navegação com ícones, melhor uso no celular, estados de carregamento e vazios, confirmação visual ao salvar.
- Conteúdo: notícias com contexto da temporada, rivalidades, entrevista pós-jogo simples que afeta moral, prêmios de fim de temporada.

## 6. Novas mecânicas

- Substituições e ajustes táticos durante a partida ao vivo.
- Treino semanal com foco escolhido afetando forma e evolução.
- Empréstimos, cláusulas de rescisão e renovação de contratos.
- Categorias de base gerando jovens promissores.
- Sala de troféus e histórico de temporadas expandidos.

## Detalhes técnicos

- `src/game/storage.ts`: camada única de persistência (localStorage para convidado, tabela `careers` para autenticado) com migração automática no login.
- Rotas de jogo saem de `_authenticated/` para rotas públicas lendo dessa camada; nenhum loader público chama função de servidor protegida.
- `src/components/game/Crest.tsx` reescrito como gerador determinístico por seed do clube (formato + composição + símbolo + paleta), com prop de detalhe (`sm`/`full`).
- Kits em `src/game/kits.ts` ganham novos padrões e mapeamento para texturas do 3D.
- Melhorias 3D seguem o pipeline atual (R3F + postprocessing) em `Stadium3D.tsx`.
- Verificação: type-check estrito, build de produção e captura de tela do jogo em modo convidado.
