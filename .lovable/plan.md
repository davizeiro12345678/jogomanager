# Grande ciclo: bibliotecas 3D, pré-jogo, narração, importação e correções

## O que o jogo já tem
- **detect-gpu** e **simplex-noise** já estão instalados e em uso: o primeiro escolhe a qualidade pelo aparelho, o segundo já desenha o gramado.
- A **narração ElevenLabs v4** já toca na partida e nas cenas. Falta levá-la ao pré-jogo.
- Atualizações da rodada anterior: postprocessing 6.39.5, sonner 2.0.8, date-fns 4.4.0, @tanstack/react-store e store 0.11.2, @lovable.dev/mcp-js 3.0.5. Não houve versão nova disponível para posthog-js.

## Etapas
1. **Bibliotecas que faltam**
   - Instalar meshoptimizer e comprimir os modelos dos jogadores e do estádio. Medir o tamanho dos arquivos antes e depois.
   - Instalar r3f-perf, com o painel aparecendo só na prévia, com `?perf=1`.
   - Instalar @use-gesture/react: arrastar e pinçar para mover a câmera na partida e deslizar para abrir e fechar o menu no celular.
   - Usar simplex-noise também no balanço das bandeiras e da torcida.
   - Conferir se detect-gpu escolhe a qualidade antes da primeira cena.
2. **Pré-jogo novo** (antes de "Ir para o jogo")
   - Tela no estilo de transmissão com os escudos, a escalação dos dois times, a forma recente (últimos 5 jogos), o estádio e o clima.
   - A narração v4 apresenta o confronto. Ela pode ser pulada e tem botão para tirar o som.
   - O botão grande "Entrar em campo" leva às cenas do túnel e depois à partida.
3. **Narração**
   - Frases novas para a apresentação do pré-jogo, a escalação e a saída do túnel, em português, inglês e espanhol, montadas no servidor (o mesmo modelo seguro de hoje).
   - Cache dos áudios para não pagar a mesma frase duas vezes.
4. **Mega importação**
   - Retomar a liga que travou por tempo limite (offset 42), completar os calendários e os detalhes dos jogos que faltam, e reexecutar a ligação de escudos e uniformes.
   - Relatório final de duplicatas e erros, com os números reais.
5. **Interface, bugs e otimização**
   - Corrigir o painel do desktop, que ficava carregando por cerca de 10 segundos, e revisar a partida ao vivo no celular (placar, botões, narração).
   - Ler os registros de erro e corrigir o que aparecer.
   - Medir os quadros por segundo e as chamadas de desenho da partida antes e depois, usando o painel de desempenho.
6. **Conferência final**
   - Fotos da tela no celular e no desktop para: início, painel, pré-jogo, partida, loja.
   - Relatório com o que mudou e o que não foi possível medir em um celular real.

## Detalhes técnicos
- `gltfpack`/meshoptimizer via script de build e `MeshoptDecoder` no GLTFLoader (o drei useGLTF já aceita).
- r3f-perf carregado com `React.lazy`, apenas quando `import.meta.env.DEV` ou `?perf=1`.
- Gestos: `useDrag`/`usePinch` com `touch-action: none` só no canvas da câmera.
- Pré-jogo: nova rota `src/routes/pre-jogo.tsx`, que lê a carreira e o fixture atuais. Os eventos de TTS `prematch`/`lineup` vão para `NarrateInput` em `src/lib/tts.functions.ts`.
- Importação pelos lotes resumíveis existentes em `src/lib/premium-chain.server.ts`, por `source_id`.
- Sem mudar regras da simulação (determinismo preservado).
