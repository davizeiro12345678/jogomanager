# Gráficos, engine, jogadores e narrador

## 1. Corrigir o bug da engine (prioridade)

Os registros do seu navegador mostram falhas reais no novo modo de renderização (WebGPU) durante a partida: erros de validação repetidos ("Vertex buffer slot 1 ... was not set", comandos inválidos) e uma falha de inicialização de módulo em segundo plano. É isso que causa tela quebrada/travada e queda de desempenho.

Correção:
- Voltar a renderização padrão para o modo estável (WebGL2) e manter o WebGPU atrás de uma opção explícita nas Configurações, marcada como experimental.
- Detectar o primeiro erro do renderizador e trocar automaticamente para o modo estável, sem recarregar a página.
- Corrigir a causa do erro: a grama instanciada e a torcida usam atributos por instância que o caminho WebGPU não recebe; passam a ser criados de forma compatível com os dois modos.
- Remover a inicialização de trabalho em segundo plano que falha ("init did not return a callable function").

## 2. Sombras, luz e texturas

- Luz principal com sombra em cascata simples: mapa maior e ajustado ao redor da bola, para sombra nítida perto da jogada e barata longe dela.
- Sombra de contato suave em todos os jogadores (mancha elíptica que responde à altura do salto), com sombra projetada real nos jogadores próximos.
- Refletores do estádio com brilho e halo corretos, e luz de rebote do gramado para os jogadores não ficarem "chapados".
- Texturas novas em resolução maior: gramado com padrão de corte, desgaste, marcas de trava e poças; concreto das arquibancadas; rede do gol; pele e tecido dos uniformes com rugosidade variável.
- Filtro anisotrópico e mapas de normal em tudo que aparece perto da câmera; versões reduzidas nas qualidades média e baixa.

## 3. Realismo dos jogadores

- Proporções e articulações revisadas (ombros, quadril, joelhos, pescoço), com pés que apoiam no chão sem deslizar.
- Transições suaves entre parado, andando, correndo, disputa, chute, defesa e comemoração, com mistura por tempo e não por troca seca.
- Movimento com inércia: inclinação nas curvas, frenagem, passada que acompanha a velocidade real.
- Cabelo, pele e uniformes com variação por jogador, mantendo a identidade estável entre partidas.
- Goleiro com mergulho, palma e encaixe próprios.

## 4. Engine e simulação

- Passo fixo separado do desenho (já iniciado) com interpolação, para movimento sem trepidação.
- Física de bola revisada: quique, efeito, bloqueios, altura e desvios.
- Marcação, coberturas e linhas mais coerentes; menos aglomeração em volta da bola.
- Cansaço influenciando velocidade, precisão e decisão ao longo dos 90 minutos.

## 5. Narrador: triplicar as falas

- Passar de cerca de 70 para mais de 200 falas por idioma (português, inglês, espanhol).
- Novos momentos narrados: quase-gol, defesa difícil, contra-ataque, bola na trave, falta perigosa, pênalti, expulsão, virada, empate no fim, tempo acrescido, goleada, zebra, estreia de jovem, retorno de lesionado.
- Falas com intensidade: calma, empolgada e explosiva, escolhidas conforme o peso do lance (placar, minuto, importância do jogo).
- Nomes de clube, jogador e minuto dentro das frases.
- Nunca repetir a mesma frase seguida (regra já existente, estendida a todos os eventos) e voz em nuvem com entonação por intensidade.

## Detalhes técnicos

- `src/components/game/renderer.ts` e `Stadium3D.tsx`: WebGPU passa a ser opt-in com fallback automático em `onuncapturederror`; atributos de instância declarados via `InstancedBufferAttribute` compatível.
- `src/components/game/players/PlayerRig.tsx`: máquina de estados de animação com cross-fade por tempo e IK simples de pés.
- `src/game/sim.ts`: passo fixo + interpolação, física de bola e marcação.
- `src/game/narration-lines.ts`, `narrator.ts`, `src/lib/tts.functions.ts`, `src/routes/match.tsx`: novos eventos e níveis de intensidade.
- Verificação: checagem de tipos, compilação e teste no navegador sem erros no console da partida.

## O que não entra

- Não vou trocar o motor 3D (decisão já aprovada anteriormente).
- Medição de FPS real e medição de velocidade da página seguem dependendo da sua máquina e da cota diária do Google.
