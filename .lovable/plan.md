# Grande ciclo: jogo mais leve, pré-jogo de transmissão, narração v4 em tudo, importação completa

## Situação atual
- **Já instalados e funcionando:** detect-gpu, que escolhe a qualidade pelo aparelho, e simplex-noise, que desenha o gramado.
- **Narração ElevenLabs v4:** já toca na partida (modelo v4) e nas cenas (v4 turbo). Ainda não chega ao pré-jogo nem ao túnel.
- **Atualizações da rodada anterior:** postprocessing 6.39.5, sonner 2.0.8, date-fns 4.4.0, @tanstack/react-store e store 0.11.2, @lovable.dev/mcp-js 3.0.5. posthog-js não tinha versão nova.
- **Problemas conhecidos:** o painel no desktop fica carregando cerca de 10 segundos; uma liga grande da importação travou por tempo limite; os calendários e os detalhes dos jogos estão incompletos; ainda existem 26 grupos de jogadores com o mesmo nome.

## Regra de ouro do ciclo
Toda mudança tem uma prova visível: foto da tela no celular (390px) e no desktop (1280px), além de números de antes e depois quando o assunto for desempenho. Nada é dado como pronto sem essa prova.

## Etapa 1 — Medir antes de mexer (base para comparar)
- Abrir a partida com o painel de desempenho e anotar quadros por segundo, travadas (p95), chamadas de desenho, triângulos e tamanho dos arquivos 3D.
- Medir o tempo até a primeira cena aparecer e o tempo para o painel abrir no desktop.
- Guardar esses números em uma tabela para o relatório final.

## Etapa 2 — As 5 bibliotecas, de verdade
1. **meshoptimizer:** comprimir os modelos dos jogadores, do estádio e da taça. Meta: arquivos pelo menos 40% menores, com a mesma aparência (confirmada por fotos lado a lado).
2. **detect-gpu:** a qualidade inicial é decidida antes da primeira cena. Celulares fracos começam no "leve" e sobem sozinhos se aguentarem.
3. **r3f-perf:** painel de medição que só aparece na prévia, com `?perf=1`. Os jogadores nunca o veem.
4. **@use-gesture/react:** na partida, arrastar gira a câmera, pinçar dá zoom e um toque duplo volta à câmera de TV. No celular, deslizar abre e fecha o menu. Os gestos não interferem nos botões.
5. **simplex-noise:** vento suave nas bandeiras de escanteio, nas faixas da torcida e no gramado, desligado no modo leve.

## Etapa 3 — Pré-jogo de transmissão (tela nova)
Ordem do fluxo: Painel, depois **Pré-jogo**, depois a cena do túnel e, por fim, a partida.
- **Abertura:** os escudos entram com animação, aparecem o nome do estádio, o clima, a rodada e a competição.
- **Comparativo:** forma recente (últimos 5 jogos em bolinhas V/E/D), posição na tabela, força média dos times e o confronto direto.
- **Escalações:** os dois times em campo desenhado, com números e posições. Jogadores lesionados ou cansados aparecem marcados.
- **Destaques:** o craque de cada time, com foto oficial quando existir.
- **Ações:** "Ajustar táticas", "Mudar escalação" e o grande botão **"Entrar em campo"**.
- **Narração:** o narrador apresenta o jogo em cerca de 15 segundos. Dá para pular e tirar o som.
- **Celular:** os blocos ficam um embaixo do outro, com o botão fixo no rodapé. **Desktop:** três colunas.
- **Sem conexão ou sem voz:** a tela funciona igual, com legendas no lugar do áudio.

## Etapa 4 — Narração v4 em tudo
- **Frases novas:** apresentação do pré-jogo, escalação, saída do túnel, apito inicial, intervalo, fim de jogo e taça, em português, inglês e espanhol.
- **Narração ao vivo mais rica:** reação ao placar ("virada!", "empate no fim!"), menção ao nome do artilheiro e frases diferentes para não repetir.
- **Cache:** cada frase é gerada uma vez e reaproveitada, para economizar créditos e tocar na hora.
- **Controles:** volume da narração separado do volume da torcida, e legenda sempre disponível.
- **Segurança:** o texto falado continua sendo montado só no servidor, a partir de frases fixas, para que ninguém use a voz para dizer outra coisa.

## Etapa 5 — Mega importação de dados
- Retomar a liga que travou, em lotes menores.
- Completar os calendários e os detalhes dos jogos faltantes, temporada por temporada.
- Importar as fotos de jogadores que ainda faltam e reexecutar a ligação de escudos e uniformes nos clubes recém-importados.
- Limpeza: analisar os 26 grupos de homônimos, removendo só duplicatas comprovadas.
- Relatório com números reais: importados, ignorados por duplicata, erros e o que ainda falta.

## Etapa 6 — Interface, bugs e otimização
- **Painel desktop:** achar e corrigir a demora de cerca de 10 segundos.
- **Partida ao vivo no celular:** placar estilo TV mais legível, botões de velocidade e substituição grandes, eventos (gol, cartão) com destaque.
- **Cenas 3D:** transições mais suaves entre túnel, partida, intervalo e taça; botão "Pular" sempre visível.
- **Otimização:** menos chamadas de desenho (agrupar objetos repetidos do estádio e da torcida) e nenhum trabalho escondido quando a aba não está visível.
- **Erros:** ler todos os registros de erro da prévia e corrigir cada um.

## Etapa 7 — Conferência final
- Fotos em celular e desktop de: início, painel, pré-jogo, túnel, partida, intervalo, fim de jogo, loja.
- Tabela de desempenho antes e depois (mesma cena, mesmo aparelho simulado).
- Lista honesta do que não pôde ser testado, como celular físico, compra real e voz em todos os idiomas.

## Detalhes técnicos
- Modelos: `gltfpack -cc` com `MeshoptDecoder` no carregador do drei; KTX2 já existente é mantido.
- r3f-perf via `React.lazy` sob `import.meta.env.DEV || ?perf=1`.
- Gestos: `useDrag`/`usePinch` no canvas, com `touch-action: none` só nele; o controle de câmera atual é reaproveitado.
- Vento: offset de vértices em shader com ruído pré-calculado em textura, sem custo por quadro na CPU.
- Pré-jogo: nova rota `src/routes/pre-jogo.tsx` (head próprio); o "Ir para o jogo" do painel passa a apontar para ela.
- TTS: novos eventos `prematch`, `lineup`, `tunnel` em `NarrateInput` (`src/lib/tts.functions.ts`); cache de áudio no armazenamento por hash da frase.
- Importação: lotes resumíveis por `source_id` em `src/lib/premium-chain.server.ts`, com tamanho de lote menor para ligas grandes.
- Simulação da partida e da temporada não muda (resultados continuam determinísticos).
