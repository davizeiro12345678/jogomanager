# Mega atualização: 3D, cutscenes de treino e carreira de treinador

Quatro frentes: salto gráfico no estádio/campo/jogadores, cutscenes 2D animadas (treino, elenco, sala de troféus, comissão técnica), e um modo de carreira em que a temporada é vivida como treinador — decisões, semana a semana — em vez de assistir cada partida.

## 1. Estádio e campo em outro nível (com mais quadros por segundo)

- Gramado: textura de corte em resolução maior, com relevo e brilho úmido reais, desgaste na grande área, marcas de deslize e variação de tom por faixa. Fibras de grama próximas à câmera, sumindo ao longe para não pesar.
- Estádio: arquibancadas em anéis com escadas e vãos, cobertura com estrutura visível e sombra no gramado, placas de LED animadas, bandeirinhas tremulando, refletores com halo à noite.
- Torcida muito mais densa, com mosaico nas cores do mandante, onda, flashes de câmera e reação a gol — tudo em geometria repetida para não custar desempenho.
- Três horários (dia, entardecer, noite) com céu, cor de luz e névoa coerentes.
- Pós-processamento reforçado por nível: no Alto, brilho seletivo, correção de cor cinematográfica, leve granulado e vinheta; no Médio, versão econômica; no Baixo, nenhum.
- Desempenho: resolução adaptativa, detalhamento que cai com a distância, sombras só onde importam, e limpeza de desenhos repetidos. Meta: partida fluida em celular e mais fluida ainda no computador.

## 2. Jogadores mais bonitos

- Proporções melhores (pescoço, ombros, quadril), tons de pele e cabelos variados, luvas e uniforme próprio do goleiro, número nas costas.
- Corrida com passada e balanço de braços proporcionais à velocidade, frenagem, giro suave em direção à bola; poses de chute, defesa, mergulho, desarme e comemorações variadas.
- Sombra de contato individual e três níveis de detalhe conforme a distância da câmera.

## 3. Cutscenes 2D — muito mais e animadas

- Novo motor de cena: fundos ilustrados com camadas em movimento, personagens que entram e saem, "câmera" que aproxima, texto que aparece letra a letra, som ambiente opcional e botão de pular. Tudo respeita "reduzir movimento".
- Cenas de treino: aquecimento, trabalho tático no campo, finalização e conversa individual — com o elenco animado e o treinador desenhado no centro.
- Sala de troféus: prateleiras que enchem conforme os títulos conquistados.
- Sala da comissão técnica: quadro tático, assistente, preparador, médico e olheiro comentando a semana.
- Novas cenas de história: chegada, apresentação à imprensa, vestiário, virada do jogo, derrota dolorosa, janela de transferências, reunião com a diretoria, sequência de vitórias, risco de demissão, acesso/título, despedida.
- As cenas disparam sozinhas nos momentos certos da carreira e ficam guardadas para não repetir; uma galeria permite rever as já vistas.

## 4. Carreira de treinador (temporada sem partida ao vivo)

- Nova forma de jogar a temporada: cada semana você escolhe treino, conversa com o elenco, mexe na tática, cuida do caixa e responde à diretoria; o jogo resolve o resultado e devolve um resumo rico (placar, gols, notas, momentos-chave, manchetes) com a opção de assistir aos melhores momentos em 3D se quiser.
- Progressão de carreira: começar em clube pequeno, subir de divisão, receber propostas de clubes maiores, acumular reputação, títulos e histórico de passagens.
- Finanças e pressão viram peça central: salários, receitas, patrocínio, bilheteria, metas da diretoria e barra de pressão que leva a demissão se ignorada.
- Partida ao vivo em 3D continua disponível — passa a ser uma escolha, não a única rota.

## Detalhes técnicos

- 3D: `src/components/game/Stadium3D.tsx` dividido em `stadium/`, `players/`, `ball/`, `camera/`, `post/`; texturas procedurais por canvas (cor, normal, rugosidade); instâncias para torcida/placas/assentos; `AdaptiveDpr` + níveis de qualidade já existentes em `src/game/device.ts`; pós-processamento com `@react-three/postprocessing` já instalado (1–2 passes no Alto).
- Cutscenes: `src/content/cutscenes.ts` expandido para cenas com camadas/atores/passos; `src/components/game/Cutscene.tsx` reescrito como runtime animado; gatilhos por evento de carreira gravados em `seenScenes`.
- Carreira: novo módulo `src/game/season-mode.ts` sobre `advanceRound`/`autoplay.ts`, nova rota de temporada e resumo semanal; `CareerState` ganha o modo escolhido, com migração de versão preservando saves atuais.
- Verificação por screenshot no navegador em cada fase, `bunx tsgo --noEmit` e build limpos antes de finalizar.
