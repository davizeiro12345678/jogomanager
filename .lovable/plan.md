# Atualização mega grande: partida 3D, telas, conteúdo e dados

Tudo numa entrega só, na ordem abaixo (performance primeiro, beleza depois).

## 1. Performance da partida (prioridade)

- Separar o desenho da simulação: física e decisões dos jogadores continuam em passo fixo (30 Hz) e fora do quadro de desenho; o desenho só interpola posições, acabando com as travadinhas.
- Jogadores: um único conjunto de peças repetidas (corpo, cabeça, braços, pernas) em vez de 22 bonecos independentes; três níveis de detalhe conforme a distância da câmera.
- Torcida: manter o desenho em lote, cortar setores fora do campo de visão e reduzir atualização por distância.
- Luzes e sombras: uma luz principal com sombra, resolução ajustada à qualidade; as demais luzes sem sombra. Sombra de contato para quem está longe.
- Zerar recálculos por quadro: nada de criar objetos novos dentro do laço, nada de atualizar a interface a cada quadro (HUD continua em ~10 Hz).
- Corte por campo de visão ativado onde hoje está desligado sem necessidade.
- Medidor de quadros por segundo dentro do jogo com registro de média e pior caso, para comparar antes/depois na sua máquina (o ambiente de teste aqui não tem placa de vídeo real).

## 2. Movimentação e anatomia dos jogadores

- Máquina de estados de animação: parado, trote, corrida, disputa, chute, defesa, comemoração — com mistura suave entre estados (sem salto brusco).
- Passada sincronizada com a velocidade real (pé não "patina" no gramado), giro do corpo com inércia, inclinação em curvas e aceleração/frenagem realistas.
- Braços, tronco e cabeça acompanham a direção da bola; goleiro com mergulho próprio.

## 3. Qualidade visual 3D (depois do ganho de performance)

- Iluminação de fim de tarde/noite com reflexo de ambiente, gramado com brilho variável e faixas de corte mais nítidas.
- Câmera com suavização, enquadramento que acompanha a jogada e leve balanço nos lances de perigo.
- Texturas em melhor resolução só onde aparece de perto; distantes continuam leves.
- Pós-processamento contido (brilho seletivo e leve vinheta), desligado automaticamente na qualidade baixa.

## 4. Cutscenes (vestiário, túnel, entrada em campo)

- Câmera em trilho cinematográfico com transições cruzadas entre cenas, sem travar durante o carregamento (cenas pré-carregadas antes de começar).
- Respeita a preferência de menos movimento e o botão de pular.

## 5. Telas: HUD, carreira, elenco, tática e loja

- Mesma linguagem visual em todas (cartões, títulos, espaçamentos, cores do gramado), estados de carregando/vazio/erro padronizados.
- Feedback claro em toda interação (botão pressionado, salvando, sucesso, falha) e transições suaves entre telas.
- Acessibilidade: nomes em botões só de ícone, foco visível, contraste, alvos de toque de 44px, respeito a "reduzir movimento".

## 6. Guias, sobre e páginas de conteúdo

- Todas as páginas de guia e a página "Sobre" passam a usar o mesmo formato: capa, resumo, índice, seções detalhadas, perguntas frequentes e links relacionados.
- Conteúdo muito mais detalhado em cada guia (táticas, scouting, finanças, formações, mercado, glossário, FAQ).
- Créditos do criador: **Davi Andrian Thomazini**, com link do canal https://www.youtube.com/@Davizeirogames na página do criador, no "Sobre" e no rodapé.

## 7. Número de clubes por liga (erro confirmado)

Hoje várias ligas têm contagem irreal — por exemplo: Série B com 16 (real 20), Championship com 18 (real 24), MLS com 18 (real 30), J1 com 18 (real 20), Liga MX 18 (real 18 ok), e dezenas de ligas com 8, 10 ou 12 clubes. Vou corrigir o tamanho de cada liga para o número real da temporada, completando os elencos que faltarem, e ajustar tabela, calendário, acesso e rebaixamento para os novos tamanhos — preservando as carreiras já salvas.

## 8. Base de dados, narração e imersão (conectores)

- **Logo.dev**: escudos e marcas dos clubes em boa resolução.
- **Firecrawl** e **Perplexity**: preencher clubes, elencos, estádios e dados de liga que faltam nas fontes gratuitas atuais.
- **ElevenLabs**: narração muito mais variada — várias vozes, frases por contexto (gol, defesa, falta, pênalti, virada, fim de jogo), variação de emoção e cache para não gastar à toa.
- **Google Search Console**: conferir indexação depois das novas páginas.

Preciso que você autorize a ligação desses conectores quando eu pedir; sem isso, essa parte fica de fora.

## Detalhes técnicos

- `Stadium3D.tsx` (2367 linhas) será dividido: `Scene`, `CameraRig`, `Lighting`, `Crowd`, `Pitch`, `Players`, `Effects`, com estado de alta frequência em refs e apenas o HUD via React.
- Simulação já roda em Web Worker (`match.worker.ts`); vou passar a transmitir posições por buffer compartilhado/transferível e interpolar no cliente.
- Animações via máquina de estados em `src/game/animation-*.ts` aplicadas ao `PlayerRig` com mistura por peso.
- Tamanhos de liga em `src/game/data/leagues*.ts`, com migração de carreiras antigas.
- Verificação final: checagem de tipos, compilação e teste no navegador das telas principais.

## O que não consigo garantir

- Números de quadros por segundo medidos aqui não valem (ambiente sem placa de vídeo); a comparação confiável é o medidor dentro do jogo na sua máquina.
- Dados que os conectores não devolverem ficam com valores gerados pelo jogo, sempre marcados como tal.
