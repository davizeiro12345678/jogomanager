# Partida fluida, gráficos melhores e novas telas de painel e perfil

Três frentes: fazer a partida rodar liso no seu aparelho, subir o nível visual sem perder essa fluidez, e criar as telas de painel do manager e de perfil.

## 1. Desempenho da partida (prioridade máxima)

O objetivo é quadro estável, não pico de quadros. Mudanças:

- **Medidor de quadros dentro do jogo**: um painel discreto no HUD mostrando quadros por segundo atual, média dos últimos 30 segundos e o pior momento. Fica no seu aparelho real, que é o único lugar onde esse número vale. Botão para copiar o resultado e me mandar.
- **Modo automático de equilíbrio**: o jogo mede os primeiros segundos e escolhe sozinho entre Fluidez, Equilíbrio e Beleza, com aviso na tela quando trocar. Você pode fixar manualmente.
- **Torcida**: hoje ela desenha tudo sempre. Passa a ter faixas por distância, menos figuras nos setores longe da câmera e corte por campo de visão.
- **Jogadores**: menos vértices nos modelos distantes, animação em taxa reduzida longe da câmera, e as sombras dos 22 vindo de um mapa único em vez de custo por jogador.
- **Luzes e sombras**: uma luz principal com sombra, resolução ajustada ao nível escolhido, resto sem sombra.
- **Simulação fora do caminho do desenho**: a física e a inteligência já rodam em segundo plano; o ajuste é garantir que nada de pesado (montar textos, recalcular listas) aconteça a cada quadro no HUD e no placar.
- **Pós-processamento por nível**: no modo Fluidez só o essencial; efeitos caros entram apenas em Beleza.

## 2. Salto visual (sem perder o ganho acima)

Baseado na sua imagem de referência, o que mais destoa: grama chapada, torcida em blocos e jogadores sem peso.

- Gramado com listras de corte reais, desgaste na área e nas laterais, brilho molhado e fibras mais densas perto da câmera.
- Iluminação por horário com sombra mais firme, contato do pé com o chão e reflexo suave do gramado nos uniformes.
- Jogadores com proporções melhores, cabelo e pele com resposta à luz, camisa que amassa e escurece com suor.
- Torcida com variação de cor, altura e movimento, além de bandeiras e faixas do clube.
- Câmera com leve respiração e foco no lance, sem enjoo.

Cada item entra atrelado ao nível gráfico, então o modo Fluidez continua leve.

## 3. Tela de painel do manager

Uma tela única com: progresso da temporada (posição, aproveitamento, sequência), elenco resumido com destaques e desfalques, tática atual com o desenho do time em campo, histórico de jogos com resultado e atalho para o relatório, e finanças em resumo. Tudo clicável para a tela completa correspondente.

## 4. Tela de perfil

Nome do treinador, foto, clube atual, tempo de carreira, títulos, conquistas, estatísticas gerais (jogos, vitórias, gols), preferências (nível gráfico, narração, legendas) e estado da conta com opção de salvar carreira na nuvem.

## Sobre medir os quadros em aparelho real

Eu não consigo rodar o jogo numa placa de vídeo de verdade daqui: o navegador de teste roda por software e o número que ele dá é falso. Por isso o medidor entra dentro do jogo, com botão de copiar o resultado. Você joga cinco minutos, me manda o texto e eu ajusto o equilíbrio com dado real.

## Sobre os conectores citados

Firecrawl, Google Maps, Resend, GitHub e Firebase não ajudam em desempenho 3D nem nessas telas. Deixo fora deste pacote; se quiser algo específico com algum deles (por exemplo aviso por e-mail ou notificação no celular), digo como encaixar depois.

## Detalhes técnicos

- Novos arquivos: medidor de quadros no HUD, rotas `/perfil` e ampliação de `/dashboard`.
- Torcida e jogadores passam por instanciamento com faixas de distância e corte por câmera.
- Níveis gráficos centralizados em `src/game/device.ts`, sem checagens espalhadas.
- Validação: testes, checagem de tipos, compilação e uma passada no navegador em `/match`, `/dashboard` e `/perfil` sem erros de console.
