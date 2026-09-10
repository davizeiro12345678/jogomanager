# Salto visual do jogo + novas compras

Um pacote grande de melhorias em cima do que já existe: jogadores mais realistas,
estádio e cenas mais bonitos, interface mais moderna e mais opções na loja.

## 1. Jogadores (corpo, rosto, uniforme)

- Corpo com proporções por tipo físico (alto/magro, forte, baixo/veloz) em vez de um só formato.
- Rosto com mais detalhe: sobrancelhas, boca, orelhas, olhos com brilho e piscada natural,
  barba e cabelo com mais variações.
- Uniforme com tecido de verdade: trama da camisa, canelado do meião, brilho da chuteira,
  número e nome nas costas mais nítidos, três tipos de gola.
- Pele com poros, suor que aparece conforme o cansaço e sujeira de grama nas pernas.
- Tudo respeita o ajuste "detalhe dos jogadores" da página Visual, para o celular seguir fluido.

## 2. Movimento e 89 animações novas

- Novo pacote com 89 movimentos: dribles, fintas, giros, carrinhos, comemorações,
  reações de erro, defesas do goleiro, disputa de bola, cansaço e conversa em campo.
- Troca de movimento mais natural: transição suave entre correr, frear, girar e chutar.
- Peso e inércia: o corpo inclina na curva, os braços acompanham a corrida, o pé
  encosta no chão no tempo certo.

## 3. Estádio, gramado e torcida

- Gramado com mais camadas: desgaste nas áreas mais usadas, lama na chuva, marcas de
  chuteira e brilho molhado.
- Redes que balançam com o gol, bandeirinhas de escanteio, gols com estrutura mais real.
- Torcida por setor com mais gente, movimento de onda, bandeirões, mosaico e flashes.
- Estádio com telão, cabines de imprensa, túnel, banco de reservas e escadas.

## 4. Cenas (cutscenes) e imagem de TV

- Novos ângulos de câmera: grua, trilho na lateral, close do banco, plano do túnel.
- Transições suaves entre cenas, foco que acompanha a bola, poeira e luz no ar.
- Imagem de transmissão: raios de luz dos refletores, contraste de TV, grão fino.

## 5. Interface do jogo e menu inicial

- Página inicial com apresentação mais forte: destaque do clube, atalhos maiores,
  cartões com movimento leve e melhor leitura no celular.
- Painéis do jogo (elenco, tática, mercado, carreira) com visual unificado:
  mesma altura de cartão, mesmos espaços, ícones consistentes.
- Menu de partida mais limpo, com atalhos grandes para o celular.

## 6. Mais opções de compra

Novos pacotes além dos atuais, todos com preço acessível:

- Baú grande de moedas (melhor custo por moeda)
- Pacote de olheiro avançado (mais relatórios e alcance internacional)
- Pacote de estádio (novas cadeiras, telão e bandeirões)
- Pacote de uniformes (novos padrões e golas)
- Pacote de comemorações (animações exclusivas)
- Passe de temporada anual (mais barato que 12 meses)

Cada pacote entra na vitrine pública, na loja do jogo e na loja dentro da partida,
com entrega automática igual à de hoje.

## Detalhes técnicos

- Arquivos principais: `src/components/game/players/PlayerRig.tsx`,
  `src/game/player-model.ts`, `src/components/game/Stadium3D.tsx`,
  `src/components/game/Cutscene.tsx`, `src/components/game/post/PostFX.tsx`,
  `src/routes/index.tsx`, `src/game/store-catalog.ts`.
- As 89 animações novas vão num segundo módulo (`animation-extra2.ts`) e entram
  na seleção de clipes junto com as 148 atuais.
- Texturas continuam procedurais e em cache, com custo controlado pelo nível de
  qualidade e pelos ajustes da página Visual.
- Novos produtos criados no ambiente de teste do provedor de pagamento e espelhados
  no catálogo em código, mantendo os mesmos identificadores.
- Validação: verificação de tipos, build e captura de tela em 390px na home,
  em uma partida e na loja.
