# Mega entrega: modo automático, multiplayer, painéis animados, estatísticas reais e gráficos

Dez frentes numa entrega só, na ordem abaixo. Cada etapa termina com verificação no navegador (celular e computador) antes de seguir.

## 1. Painéis animados (conclusão)

- **Elenco**: cada jogador ganha um mini-boneco animado no cartão — animação de chute para atacantes, de passe para meias, de defesa para goleiros, tocando ao passar o dedo/mouse.
- **Copas**: o chaveamento se desenha fase a fase (oitavas → final), com as linhas crescendo, os escudos entrando e o vencedor destacado com brilho.
- Tudo respeita "reduzir movimento" do aparelho.

## 2. Modo automático (o computador joga sozinho)

Novo botão "Simular semana" e "Simular até o fim" na Central: as rodadas do campeonato, copas e continental acontecem sozinhas, com um resumo animado por semana (placar, gols, lesões, notícias). Dá para parar a qualquer momento e voltar a jogar as partidas.

## 3. Tela de temporada automática

Nova tela "Temporada automática": gera o ano inteiro de uma vez — liga, copa nacional e continental — mostrando a evolução da tabela rodada a rodada, artilheiros e títulos ao final, sem escolher partida por partida.

## 4. Estatísticas e troféus com dados reais

- As telas de Estatísticas e História passam a usar os clubes e elencos reais já importados (jogadores, jogos, escudos e cores oficiais).
- **Histórico por partida**: além do acumulado, uma lista por jogo com gols, assistências, minutos e nota — filtrável por jogador e por competição.
- Sala de troféus com os títulos conquistados por clube e por temporada.

## 5. Mercado de transferências com jogadores reais

Tela de mercado reformulada: busca por nome, posição, idade, nível e clube em todo o banco real; proposta, contraproposta, empréstimo e venda. Ao fechar, o elenco da carreira é atualizado na hora (e o clube vendedor perde o jogador).

## 6. Multiplayer ao vivo (dois jogadores, mesma partida)

Sala com código de 6 letras: um cria, o outro entra. A partida corre em tempo real para os dois, com placar, narração e eventos sincronizados; cada um comanda seu time (substituições, mentalidade, pressão). Se um cair, a partida continua e ele volta no mesmo minuto.

## 7. Painel do criador e histórico de versões

Nova página pública "Sobre / Criador": quem fez o jogo, o que foi construído, e a linha do tempo de todas as versões desde o início — cada versão com data, título e as mudanças daquela entrega. Fica linkada no rodapé e no menu.

## 8. Gráficos massivamente melhores + desempenho no celular

- Grama com fibras e brilho úmido melhor, torcida mais densa e viva, estádio com cobertura, telão e refletores mais bonitos.
- Ao mesmo tempo, mais quadros por segundo no celular: menos objetos desenhados por quadro (torcida, arquibancada e placas agrupadas), sombras e efeitos reduzidos automaticamente, resolução limitada e desenho pausado quando a tela fica escondida.
- Meta: partida fluida em celular comum, sem travar em jogo longo.

## 9. Teste completo de partida rápida no celular

Uma partida inteira em tela de celular, conferindo narrador, placar ao vivo, ajuste automático de qualidade e ausência de travamentos — com correções se algo engasgar.

## Detalhes técnicos

- Estado da carreira sobe de versão com migração automática (novos campos: registro por partida, títulos, modo automático) — sem alterar o banco.
- Novos módulos em `src/game`: `autoplay.ts` (semana/temporada automáticas), `matchLog.ts` (registro por partida), e ampliação de `cup.ts`/`season.ts` como fonte única do calendário.
- Mercado real lê `clubs`/`players` do banco por consulta paginada (server function), com cache; a troca grava no estado da carreira.
- Multiplayer usa Realtime do Lovable Cloud: tabela `match_rooms` (host, convidado, semente, estado) com RLS e GRANTs; a simulação roda com semente compartilhada e o anfitrião publica o relógio, então os dois veem o mesmo jogo. Substituições viajam como mensagens.
- Desempenho: `InstancedMesh`/merge para torcida, assentos e placas; LOD por distância; `frameloop` já pausa em segundo plano; `dpr` por nível de qualidade.
- Página do criador: rota pública com metadados próprios e dados de versão num arquivo `src/content/changelog.ts`.

## Preciso confirmar

Para o painel do criador: uso "Davi Davizeiro" como criador e monto a linha do tempo a partir do que já foi construído no projeto. Se quiser outro nome, foto, bio ou links (Instagram, YouTube, e-mail), me mande que eu coloco.
