# Salto definitivo: imagem 3D de jogo de console, segurança fechada e buscas afinadas

Três frentes num só ciclo. O objetivo visual é claro: quando a partida abre, tem de parecer transmissão de TV — não um campo verde com bonecos. Abaixo, tudo o que muda, em linguagem direta.

---

## PARTE 1 — A partida em 3D, de ponta a ponta

### 1.1 O gramado vira personagem

- **Textura de grama real em alta definição** (gerada por procedimento, sem peso de download): folhas com direção, variação de cor por tufagem e manchas naturais de campo pisado.
- **Corte em faixas diagonais e radiais**, não só horizontais — com brilho diferente quando a câmera muda de lado, como no campo de verdade.
- **Desgaste ao longo da partida**: a zona central e a pequena área vão escurecendo e perdendo fibra conforme o jogo avança.
- **Marcas de jogo que ficam**: pegadas, riscos de carrinho, rastro de deslize do goleiro — aparecem na hora e desbotam devagar.
- **Condição climática por partida**: seco (grama clara e rápida), garoa (brilho molhado, poças pequenas, respingo no carrinho) e noite úmida (reflexo do refletor na grama rasa).
- **Tufos 3D perto da câmera**: na qualidade alta, a grama tem volume real nos lances em close.
- **Linhas de cal com borda imperfeita**: pintura com manchas e apagado nas laterais, em vez de um retângulo digital perfeito.

### 1.2 A bola com física de verdade

- **Física real**: quique com atrito, rolagem que desacelera, efeito curva (a bola fecha ou abre), ricochete na trave com direção certa e baque no corpo do goleiro.
- **Rede que estufa de verdade**: pano com trama em losango que empina no gol, balança e assenta — hoje a rede é quase estática.
- **Rastro de chute forte**: linha de velocidade atrás da bola em chutes acima de certa força, estilo transmissão.
- **Bola com costuras e painéis**: deixa de ser uma esfera lisa branca.

### 1.3 O estádio ganha escala e vida

- **Arquibancada em anéis com setores, escadas, corrimãos e corredores** de acesso; telão grande com placar em texto nítido (hoje é uma imagem refeita a cada mudança) e replay do lance.
- **Cobertura com estrutura metálica**, calhas, sombras projetadas na arquibancada e luz que vaza pelas bordas ao entardecer.
- **Refletores com facho de luz e poeira no ar** à noite; halo visível; luz que bate no gramado com quente/frio correto por horário.
- **Publicidade em LED** ao redor do campo com rolagem suave, cintilação de painel real e arte por clube.
- **Detalhes de transmissão**: banco de reservas com acrílico, túnel de acesso iluminado, câmeras de TV que seguem a bola, cabines de imprensa, portões e cones.
- **Céu coerente com o horário**: dia limpo, entardecer com horizonte quente, noite com nuvens escuras — o mesmo céu reflete nos vidros e na grama úmida.

### 1.4 A torcida para de parecer papelão

- **Mais variedade**: corpos com alturas, larguras e tons de pele diferentes; camisas com pequenas variações de tom dentro do mesmo setor; bonés, cabelos e acessórios.
- **Mosaico por setor**: blocos inteiros levantam cartolina na cor certa em lances grandes, formando a bandeira do clube vista de cima.
- **Ola orgânica**: a onda percorre as arquibancadas com velocidade e altura naturais, morre e recomeça.
- **Reação ao placar**: o setor do time que marca explode em pulos, braços erguidos e flashes de celular; o setor adversário encolhe.
- **Bandeirões grandes** com estampa (listras + escudo), ondulação de pano no vento e cachecóis girando acima das cabeças.
- **Som ambiente** (quando o som estiver ligado): murmúrio contínuo, tambor e explosão no gol.

### 1.5 Os jogadores, de perto e de longe

- **Camisa com nome e número nas costas em texto nítido** (deixa de ser textura embaçada), com o número da escalação real.
- **Chuteiras separadas** com cor própria, meiões com recuo na canela e uniforme com dobras simples de tecido.
- **Pele e brilho de suor** discretos; cabelo com mais formatos.
- **Animações mais vivas**: corrida com braços, condução com toque curto, chute com giro do quadril, carrinho com deslize, defesa do goleiro com salto lateral e comemorações variadas.
- **Nível de detalhe por distância**: perto da câmera, tudo isso aparece; longe, o jogo simplifica sozinho para não pesar — o jogador nunca percebe a troca.

### 1.6 A imagem final (pós-processamento de transmissão)

- **Foco seletivo cinematográfico** no replay e no gol (o fundo desfoca de verdade, com formato de lente).
- **Cor calibrada por horário e por momento**: manhã fria, entardecer quente, noite contrastada; replay com cara de VT; lance decisivo com mais contraste.
- **Granulado leve de câmera**, vinheta suave, reflexos e anti-serrilhado melhorados; aberração de lente só nas bordas, como na TV.
- **Transição de câmera com corte direto** (estilo diretor de transmissão) em vez de deslize infinito.
- **Sempre com os três níveis de qualidade** (alta / média / baixa) e queda automática quando o aparelho sofre — nada disso derruba o desempenho em celular fraco.

### 1.7 Cutscenes mais bonitas

As cenas 2D de história (apresentação, vestiário, título) ganham: fundo com camadas em profundidade e movimento suave de câmera, iluminação coerente com o horário, retrato do treinador com mais expressões e entrada/saída dos personagens com deslize em vez de aparecer do nada.

---

## PARTE 2 — Nove bibliotecas novas, todas renomadas no 3D web

| Biblioteca | Reputação | O que ela faz no jogo |
| --- | --- | --- |
| `@react-three/rapier` | motor de física usado em jogos web sérios | bola, traves, colisões e ricochetes reais |
| `three-mesh-bvh` | referência de aceleração de cena | colisão e detecção rápidas sem travar |
| `three-custom-shader-material` | padrão para material com shader próprio | grama, tecido molhado e reflexos sob medida |
| `troika-three-text` | texto 3D nítido de verdade | telão, nomes/números nas camisas, publicidade |
| `meshline` | linhas grossas clássicas do 3D web | rastro da bola e trajetórias de chute |
| `camera-controls` | controle de câmera profissional | cortes e movimentos de câmera de transmissão |
| `simplex-noise` | o clássico de texturas procedurais | grama, desgaste, nuvens e poças gerados no jogo |
| `gsap` | padrão de animação da web | linha do tempo das cutscenes e entradas de câmera |
| `lenis` | rolagem suave de site premiado | rolagem macia nas páginas do site |

Regra de ouro: cada biblioteca entra **atrás do nível de qualidade**. Em aparelho fraco, o jogo não carrega física avançada nem texto 3D — e continua rodando liso.

---

## PARTE 3 — Segurança: fechando as brechas de verdade

Verificado na base de dados agora. Os dois problemas reais:

1. **Qualquer um pode se dar moedas.** A regra de acesso da carteira permite que o próprio usuário grave qualquer saldo pelo navegador. Hoje dá para se creditar moedas infinitas sem pagar.
   **Correção:** a carteira passa a ser **somente leitura** para o usuário. Todo crédito e gasto (compras, recompensas, bônus de temporada) passa pelo servidor, que confere o saldo antes de debitar.
2. **Chat com nome forjável e sem freio.** O nome exibido é enviado pelo próprio navegador (dá para se passar por outra pessoa) e não há limite de mensagens.
   **Correção:** o nome vem da conta, não do navegador; mensagens ganham limite de tamanho e de envios por minuto; ofensas podem ser escondidas pela moderação.

No fim do ciclo, rodo a **varredura de segurança completa** e a de **dependências**, e corrijo o que aparecer — sem deixar aviso pendurado.

---

## PARTE 4 — Buscas (Google) em todos os domínios

O que já confirmei: os oito endereços (soccer-manager.fun, footballcarrer.fun, football-manager.app, soccermanagement.fun e os `www.`) **redirecionam corretamente** para `soccer-manager.fun`, e as verificações rápidas de página e metadados estão **passando**. O que falta:

- **Etiqueta de tipo duplicada** nas páginas de conteúdo (uma definição global brigando com a da página). Correção: manter só a da página.
- **Google Search Console não concluído** em `www.footballcarrer.fun`: colocar a etiqueta de verificação, publicar, confirmar e enviar o mapa do site.
- **Revisão do mapa do site** com as páginas novas (guias, glossário, comparativo, offline, multiplayer) e dos títulos/descrições delas.
- **Nova varredura ao final** para confirmar que tudo ficou verde.

---

## Ordem de execução

1. Segurança (carteira + chat) e varredura — protege o que já está no ar.
2. Buscas (etiqueta, Search Console, mapa do site) — rápido e independente.
3. Instalação das 9 bibliotecas.
4. Gramado + bola + física.
5. Estádio + torcida.
6. Jogadores + animações.
7. Pós-processamento + cutscenes.
8. Teste em partida real (rápida, carreira e multiplayer) nos três níveis de qualidade e nos três horários.

## Detalhes técnicos

- **Física visual, não decisória:** o motor `rapier` desenha a bola, a rede e os ricochetes; quem decide gol, falta e resultado continua sendo a simulação da partida (`src/game/sim.ts`). Nenhum resultado muda.
- **Texto 3D** via `troika-three-text` substitui os `CanvasTexture` refeitos por quadro no placar e nas camisas — nítido de perto, leve de longe.
- **Carteira:** novas funções de servidor em `src/lib/wallet.functions.ts` com autenticação obrigatória; migração deixando `public.user_wallet` com `SELECT` para o usuário e escrita só pelo servidor; `src/lib/wallet.ts` passa a chamar essas funções.
- **Chat:** validação com `zod`, limite de tamanho na coluna e `display_name` derivado do usuário autenticado.
- **Buscas:** remover o `og:type` global de `src/routes/__root.tsx`; fluxo de verificação META do Search Console; `src/routes/sitemap[.]xml.ts` revisado com as páginas novas.
- **Sem quebra de qualidade:** todo efeito novo verifica o nível (alta/média/baixa) antes de existir; a queda automática de qualidade já existente continua valendo.
