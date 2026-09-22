# Atualização gráfica e performance extrema

## Objetivo
Elevar a qualidade percebida da partida sem reescrever a arquitetura existente, recuperando custo onde detalhes não são visíveis e reinvestindo apenas em elementos próximos.

## Execução em batches
1. **Baseline + direção visual:** medir uma partida fixa no Alto e registrar FPS/frame time, p95, draws, triângulos, recursos, carregamento e erros. Depois aprimorar Camera Director, iluminação e tone mapping sem alterar os budgets.
2. **Movimento:** corrigir cadence, foot sliding, foot locking próximo, stride/motion warping, turn-in-place e fases de preparação/contato/recuperação.
3. **Jogadores e contexto:** centralizar contexto visual por snapshot; criar LOD0 hero, LOD1 simplificado e LOD2 mesclado/instanciado com frequência reduzida. Finalizar o PlayerRig próximo sem custo para os 22 atletas.
4. **Cena ampla:** dividir grama detalhada em chunks medidos, criar torcida near/mid/far e escalar sombras por distância e qualidade.
5. **Qualidade adaptativa:** governar DPR, grama, torcida, sombras, pós-processamento e detalhe distante por p95, com histerese e cooldown; preservar escolha manual, WebGL2 e WebGPU opt-in.
6. **Reinvestimento:** melhorar somente o que ficou dentro do orçamento: anatomia/face/cabelo/uniforme próximos, gol/rede/bola, estádio, replays e cinematics.

## Diretrizes técnicas
- Manter Three.js/R3F, Worker a ~10 Hz com interpolação, materiais compartilhados e budgets atuais do Alto.
- Não instalar dependências sem gargalo comprovado; não usar React state por quadro.
- Cada batch terá mudança coerente, teste focal e nova medição no mesmo cenário antes do próximo.
- Métricas indisponíveis serão marcadas como “não medido”; o sandbox não comprova GPU física.

## Verificação final
- Testes da simulação/animação, tipos, build, console, entrada/saída/reentrada, desktop/mobile, Worker e fallback WebGL2.
- Relatório curto Antes/Depois apenas com métricas efetivamente coletadas e limitações explícitas.