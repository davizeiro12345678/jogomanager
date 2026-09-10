# Salto visual do jogo + novas compras

Um pacote grande em cima do que já existe: jogadores muito mais realistas,
estádio e cenas mais bonitos, interface mais moderna e mais opções na loja.

## 1. Jogadores — o foco principal

### Corpo e geometria
- Tipos físicos de verdade: alto e magro, forte e encorpado, baixo e explosivo,
  goleiro mais alto — altura, ombro, tronco, coxa e panturrilha variam juntos.
- Ombros arredondados, pescoço ligado ao tronco, joelho e cotovelo com dobra real,
  mãos com formato de mão (não bloco), pés no tamanho certo do calçado.
- Cintura e costas com curva leve, para o corpo não parecer um cilindro.
- Três níveis de detalhe automáticos: perto da câmera o jogador é completo,
  longe fica mais simples — o celular continua fluido.

### Rosto
- Crânio com maçã do rosto, queixo, testa e nariz separados.
- Olhos com íris colorida, brilho e piscada em tempos diferentes por jogador.
- Sobrancelhas, boca com lábio, orelhas, narinas e linha do maxilar.
- Cabelo com volumes diferentes (raspado, curto, volumoso, coque, trança),
  barba em quatro estilos e tons de pele variados.
- Expressão simples que muda com o jogo: concentrado, cansado, comemorando.

### Uniforme e acessórios
- Camisa com trama de tecido, meião canelado, calção com brilho próprio.
- Nome e número nas costas nítidos, número no calção, braçadeira de capitão.
- Três golas (redonda, V e polo), listras/faixas do clube seguindo o kit.
- Chuteiras com granulado, cor por jogador, luvas do goleiro, caneleiras.
- Suor que aumenta com o cansaço, grama e barro grudando nas pernas e no calção.

### Movimento e 89 animações novas
- Novo pacote de 89 movimentos: dribles, fintas, giros, carrinhos, cabeceio,
  comemorações, reações de erro, defesas do goleiro, disputa de bola,
  cansaço, reclamação com o árbitro e conversa em campo.
- Transição suave entre movimentos (não troca "de um quadro pro outro").
- Peso e inércia: o corpo inclina na curva, os braços acompanham a corrida,
  o pé encosta no chão no tempo certo, o tronco cai para frente na arrancada.
- Olhar acompanha a bola e o adversário mais próximo.
- Respiração visível quando o cansaço aumenta.

## 2. Estádio, gramado e torcida
- Gramado em camadas: desgaste nas áreas mais usadas, lama na chuva,
  marcas de chuteira e brilho de grama molhada.
- Redes que balançam no gol, bandeirinhas de escanteio, traves mais reais.
- Torcida por setor com mais gente, onda, bandeirões, mosaico e flashes.
- Telão, cabines de imprensa, túnel, banco de reservas e escadas.

## 3. Cenas (cutscenes) e imagem de TV
- Novos ângulos: grua, trilho lateral, close do banco, plano do túnel.
- Transições suaves, foco que acompanha a bola, poeira e luz no ar.
- Imagem de transmissão: raios de luz dos refletores, contraste de TV e grão fino.

## 4. Interface do jogo e menu inicial
- Página inicial com apresentação mais forte: destaque do clube, atalhos maiores,
  cartões com movimento leve e melhor leitura no celular.
- Painéis (elenco, tática, mercado, carreira) com visual unificado: mesma altura
  de cartão, mesmos espaços e ícones consistentes.
- Menu de partida mais limpo, com botões grandes no celular.

## 5. Mais opções de compra
Novos pacotes, todos com preço acessível:
- Baú grande de moedas (melhor custo por moeda)
- Olheiro avançado (mais relatórios e alcance internacional)
- Pacote de estádio (cadeiras, telão e bandeirões novos)
- Pacote de uniformes (padrões e golas novas)
- Pacote de comemorações (animações exclusivas)
- Passe de temporada anual (mais barato que 12 meses)

Entram na vitrine pública, na loja do jogo e na loja dentro da partida,
com entrega automática igual à de hoje.

## Detalhes técnicos
- Arquivos: `src/components/game/players/PlayerRig.tsx`, `src/game/player-model.ts`,
  `src/game/textures/fabric.ts`, `src/components/game/Stadium3D.tsx`,
  `src/components/game/Cutscene.tsx`, `src/components/game/post/PostFX.tsx`,
  `src/routes/index.tsx`, `src/game/store-catalog.ts`.
- As 89 animações novas ficam em `animation-extra2.ts` e entram na seleção junto
  com as 148 atuais; a mistura entre clipes é feita por interpolação de pose.
- Geometria dos jogadores é gerada e reaproveitada em cache por tipo físico,
  para não criar malha nova por jogador.
- Texturas seguem procedurais e em cache, com custo controlado pelo nível de
  qualidade e pelos ajustes da página Visual.
- Novos produtos criados no ambiente de teste do provedor de pagamento e
  espelhados no catálogo em código, com os mesmos identificadores.
- Validação: verificação de tipos, build e capturas em 390px na home,
  em uma partida e na loja.
