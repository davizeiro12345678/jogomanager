# Mega atualização gráfica: estádio, jogadores e apresentação

Objetivo: elevar o visual da partida 3D de "funcional" para "transmissão de TV", mantendo desempenho em navegador e celular.

## 1. Estádio

- Arquibancadas em 3 anéis com inclinação real, escadas, corredores e vãos de acesso; cobertura com estrutura de treliça e sombra projetada no gramado.
- Torcida com muito mais densidade, mosaico nas cores do mandante, movimento de onda e reação a gols (pulos e flashes de câmera na multidão).
- Gramado com listras de corte reais em textura procedural de maior resolução, desgaste nas áreas, brilho úmido e leve variação de tom.
- Redes com malha mais fina e balanço físico ao sofrer gol; traves com reflexo metálico.
- Placas de publicidade animadas (troca de anúncio a cada poucos segundos), placar de LED mais legível, bandeirinhas de escanteio que tremulam.
- Faixas de torcida, banco de reservas com jogadores sentados e comissão técnica em pé na área técnica.

## 2. Jogadores

- Modelos mais anatômicos: ombros, pescoço, cabeça arredondada, tons de pele variados, cabelo em estilos diferentes (curto, moicano, coque, careca), luvas e uniforme distinto para o goleiro.
- Animação de corrida com passada e balanço de braços proporcional à velocidade, desaceleração, frenagem e giro suave em direção à bola.
- Poses específicas: goleiro em posição de defesa e mergulho, chute com perna de apoio, deslize em desarme, celebração variada por gol.
- Sombra individual de contato no gramado e número nas costas da camisa.

## 3. Bola e câmera

- Bola com rotação coerente à direção, rastro apenas em chutes fortes, quique com deformação sutil e som visual de impacto (partículas de grama).
- Câmeras: transmissão (padrão), tática alta, atrás do gol, câmera de trilho lateral e replay automático de gol com câmera lenta.
- Enquadramento com suavização e leve tremor em lances de perigo.

## 4. Iluminação e acabamento

- Três horários (dia, entardecer, noite) com céu, cor de luz e sombras coerentes; refletores com halo visível à noite.
- Pós-processamento leve: vinheta, correção de cor e bloom apenas no modo Alto.
- Overlay de transmissão: placar canto superior, nome dos times com cores do clube, cronômetro e barra de eventos com o mesmo estilo visual do jogo.

## 5. Desempenho

- Três níveis de qualidade (Baixo / Médio / Alto) controlando torcida, sombras, pós-processamento e resolução; detecção automática inicial pelo dispositivo.
- Uso de geometria instanciada para torcida, placas e detalhes repetidos, mantendo draw calls baixas.

## Detalhes técnicos

- Todo o trabalho fica em `src/components/game/Stadium3D.tsx` (que será dividido em módulos: `stadium/`, `players/`, `ball/`, `camera/`), mais `src/game/kits.ts` para uniformes e o overlay em `src/routes/_authenticated/match.tsx`.
- Stack atual mantida: React Three Fiber v9 + drei v10 + three 0.185; pós-processamento só é adicionado se couber no orçamento de 1-2 passes.
- Sem novos modelos externos: tudo procedural/instanciado para não depender de download de assets.
- Verificação por screenshot no navegador em cada fase, com typecheck e build limpos antes de finalizar.
