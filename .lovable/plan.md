# Ciclo grande: cenas, narração, jogadores, banco e dados reais

## 1. Cenas cinematográficas em 3D de verdade
Hoje o palco 3D das cenas (`CinematicStage3D`) é pequeno e simples (109 linhas) e boa parte do visual ainda vem de camadas 2D.

- Reconstruir vestiário, túnel, entrada em campo e coletiva como ambientes 3D completos: geometria do espaço, materiais com desgaste, luz prática (lâmpadas, refletores, flashes), névoa volumétrica leve e profundidade de campo.
- Câmera com movimento real por cena (dolly, orbit lento, handheld sutil), cortes por batida de diálogo e transições encadeadas entre as quatro cenas.
- Figurantes 3D com o mesmo rig dos jogadores: elenco sentado no vestiário, fila no túnel, repórteres e flashes na coletiva, torcida ao fundo na entrada.
- Escudo e cores do clube do jogador aplicados em camisas, paredes, backdrop da coletiva e bandeiras.
- Todas as cenas continuam com narração linha a linha e respeitam "pular" e movimento reduzido.

## 2. Narração e voz
- Atualizar a integração ElevenLabs para o modelo atual de melhor qualidade multilíngue, com streaming e ajustes de emoção por contexto (gol, defesa, expulsão, coletiva).
- Ampliar e variar o roteiro: mais falas por evento, variação por placar/tempo/rivalidade, evitando repetição próxima.
- Vozes distintas por papel (narrador, comentarista, técnico no vestiário, repórter na coletiva).
- Manter o orçamento mensal de voz e o fallback local quando o orçamento acabar.

## 3. Jogadores: esqueleto, animações e inteligência
- Esqueleto completo: coluna em segmentos, pescoço e cabeça, clavículas, ombros/cotovelos/punhos, quadril, joelhos, tornozelos e pés, com pesos e limites de articulação.
- Animações: corrida com transferência de peso, mudança de direção, condução, chute, cabeceio, deslize, queda e comemoração; mistura suave entre estados.
- Inteligência: marcação individual e por zona, linha de impedimento, movimentação sem bola, coberturas, tomada de decisão do goleiro e pressão coordenada.

## 4. Ciclo contínuo de melhorias gráficas
Cada ciclo entrega um conjunto (iluminação → sombras → texturas → animações → física) e roda medição de quadros com o painel interno de desempenho já existente.

Importante: este ambiente de build renderiza por software, sem placa de vídeo física. Eu meço e ajusto aqui, mas a confirmação final de quadros por segundo em placa real precisa ser feita por você na pré-visualização ou no site publicado, com o painel de desempenho ligado. Eu incluo um resumo de quadros exportável para você me mandar e eu ajustar no ciclo seguinte.

## 5. Banco: Drizzle com o schema real
O arquivo `drizzle/schema.ts` está vazio ("intentionally left blank").

- Ler o schema real do banco e escrever as tabelas, colunas, chaves, índices e enums correspondentes em `drizzle/schema.ts`.
- Passar as migrações a serem geradas pelo Drizzle a partir desse schema, mantendo o histórico já aplicado intacto (nenhuma tabela existente é recriada ou perdida).

## 6. Elencos dos 415 clubes e kits alternativos
- Preciso da chave paga da fonte de elencos (Sportmonks plano pago, API-Football ou equivalente). Quando você me passar, eu peço a chave por um campo seguro e não a exponho no código.
- Com a chave: importação em lote dos clubes faltantes, com barra de progresso, retomada em caso de falha e cache, além dos kits away e third por clube.
- Sem a chave, essa parte fica parada; todo o resto do plano segue normalmente.

## 7. Dependências
- Atualizar as dependências do projeto (Three, React Three Fiber/Drei, pós-processamento, Stripe, Supabase, ferramentas de build) em lotes, rodando tipos, testes e build entre lotes e revertendo qualquer pacote que quebre.

## Detalhes técnicos
- `CinematicStage3D.tsx` deixa de ser um palco único e passa a ter um módulo por cena, carregado sob demanda, com orçamento de polígonos e sombras separado do jogo.
- Reaproveitar `PlayerRig` para figurantes, com nível de detalhe reduzido fora do foco da câmera.
- `tts.functions.ts`: novo modelo, streaming, mapa de vozes por papel, reserva de orçamento mantida.
- `sim.ts`: marcação, impedimento, coberturas e goleiro; testes determinísticos por semente e o teste de estresse de 200 partidas continuam obrigatórios.
- `drizzle/schema.ts` gerado a partir da introspecção do banco; `drizzle.config.ts` já aponta para o caminho correto.
- Validação de cada lote: tipos, testes, build e uma passada de navegador nas telas principais.
