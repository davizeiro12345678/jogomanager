# Salto gráfico total: gramado, estádio, redes, torcida, jogadores e imagem de TV

Objetivo: deixar a partida em 3D com cara de transmissão de televisão de verdade — grama que reage ao jogo, redes que balançam com peso, arquibancada viva, jogadores com movimento humano e imagem tratada como broadcast.

## Situação atual (verificada)

- O estádio já tem gramado em camadas, redes com pano animado, arquibancadas, cobertura, refletores, telão em texto e bandeirões da torcida.
- Os jogadores usam um esqueleto articulado com 3 níveis de detalhe e cerca de 60 animações, com nome e número nas costas.
- A imagem já passa por oclusão de contato, brilho, foco seletivo, cor por horário, granulado e vinheta.
- As bibliotecas visuais pesadas (física, texto 3D, sombreadores, ruído, animação) já estão instaladas e em uso.

Ou seja: a base existe. Esta atualização é de profundidade — cada peça ganha detalhe, variação e reação ao que acontece na partida.

## 1. Gramado e campo

- Corte do gramado escolhido por clube (listras, xadrez, círculos, diagonal dupla) em vez de um padrão único.
- Desgaste que cresce durante os 90 minutos nas zonas mais usadas: pequena área, meio-campo, laterais.
- Marcas de deslize, pegadas e tufos arrancados que aparecem onde a jogada realmente aconteceu e desbotam com o tempo.
- Clima por partida: gramado seco, molhado com brilho rasante e poças, ou com respingos de chuva; neve leve nas ligas de inverno.
- Grama alta em 3D perto da câmera com balanço pelo vento, virando textura ao longe.
- Cal do campo com borda imperfeita, desgaste e retoque, além de sombra própria.

## 2. Redes e balizas

- Rede com malha em losango de verdade, com nós, fios de espessura variável e leve brilho.
- Balanço com peso real: a rede infla no gol, volta em ondas e treme quando a bola bate na trave.
- Trave e travessão com reflexo metálico, marcas de uso e som visual de vibração.
- Rede lateral e traseira presas ao chão com esticadores.

## 3. Estádio

- Arquibancada com setores diferentes: cadeiras numeradas, camarotes com vidro, setor visitante isolado.
- Cobertura metálica com calhas, tirantes, iluminação de serviço e sombra projetada no gramado.
- Refletores com feixe visível, poeira no ar e reflexo nos vidros; ligam ao anoitecer.
- Placas de LED ao redor do campo com anúncios que trocam e refletem no gramado molhado.
- Telão com placar nítido, escudos, tempo de jogo e replay do lance.
- Túnel, bancos de reservas com acrílico, maca, quarto árbitro com placa de substituição, gandulas e câmeras de TV nas laterais.
- Céu, nuvens e cor da luz coerentes com o horário da partida.

## 4. Torcida

- Corpos, alturas, roupas e tons de pele variados por setor, com camisas nas cores do time da casa e do visitante.
- Mosaico organizado por setor antes do jogo, bandeirões grandes ondulando e faixas com o nome do clube.
- Ola circular orgânica, pulos em levas, braços erguidos e aplausos.
- Reação ao que acontece: explosão no gol, silêncio e cabeças baixas ao sofrer, tensão nos minutos finais.
- Flashes de câmera, cachecóis girando, fumaça de sinalizador e bandeiras pequenas.

## 5. Jogadores

- Corpo com ombros, tronco e pernas mais anatômicos; tipos físicos diferentes (alto, forte, franzino) conforme o jogador.
- Cabelos, tons de pele, luvas, meiões e chuteiras separados, com brilho de suor que aumenta com o cansaço.
- Nome e número nas costas em relevo, braçadeira de capitão e uniforme que suja durante a partida.
- Sombra de contato sob os pés e reação do gramado ao pisar.
- Novas animações: comemorações variadas (deslizando de joelhos, abraço coletivo, silêncio, dedo na boca), reclamação com o árbitro, arrumar a chuteira, respirar ofegante, dar instruções, cair e levantar, entrada em campo, aquecimento, substituição, cartão recebido, defesa em três tempos do goleiro, cobrança de pênalti com passos marcados.
- Transição suave entre animações, para o jogador nunca "trocar de pose" de repente.

## 6. Imagem de transmissão

- Câmeras de TV: câmera principal, câmera baixa atrás do gol, câmera de trilho na lateral e câmera de replay lenta.
- Foco seletivo que segue a bola, desfoque de movimento em lances rápidos e leve tremor de câmera na comemoração.
- Cor calibrada por horário e por clima; imagem de replay com contraste e granulado maiores.
- Abertura de partida e vinheta de gol com escudo, placar e nome dos times.

## Desempenho

Tudo entra por nível de qualidade (baixa, média, alta), com queda automática quando o aparelho não aguenta. No celular os detalhes pesados (grama 3D, feixes de luz, foco seletivo, torcida detalhada) ficam desligados, mantendo o jogo fluido.

## Detalhes técnicos

- `src/components/game/stadium/textures/*`: novos padrões de corte por ruído (`simplex-noise`), mapas de desgaste acumulado, normal/rough maps procedurais, textura de rede em losango com nós, LED animado, cadeiras por setor.
- `src/components/game/Stadium3D.tsx`: `GrassField` com padrão por clube e vento; `NetCloth` com massa-mola em grade e resposta a impacto; `Goal` com vibração de trave; `Stands` setorizado; `CrowdFlags` com mosaico e ola; novos componentes de túnel, banco, LED, câmeras e gandulas; rig de câmeras de TV.
- `src/game/animation.ts`: novos clips (comemorações, protesto, entrada, aquecimento, substituição, cartão, defesa em três tempos, pênalti) e `selectClip` com janela de mistura para transições suaves.
- `src/components/game/players/PlayerRig.tsx`: tipos físicos por atributos, camadas de suor/sujeira, chuteiras e luvas separadas, braçadeira, sombra de contato.
- `src/components/game/post/{presets,PostFX}.ts(x)`: novos momentos (`intro`, `goal`, `penalty`), desfoque de movimento, foco que acompanha a bola, ajuste por clima.
- Todos os efeitos novos atrás de `quality` de `src/game/device.ts`, com o monitor de desempenho já existente rebaixando o nível.
- Validação: `bunx tsgo --noEmit`, build limpo e conferência em `/partida-rapida?q=baixa|media|alta` com captura de tela antes de entregar.

## Fora do escopo

Nenhuma mudança nas regras do jogo, na simulação da partida, nos dados de clubes ou nas telas de gestão.
