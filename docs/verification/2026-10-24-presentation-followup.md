# Apresentação, contato e CPU — segunda rodada 24/10/2026

Base:72389e6434a54c0cd80d63539a953675e7d9c8eb. Cinco subagentes. Pequeno crescimento do bundle autorizado; limites e comparações de release não foram alterados.

## Alterações

- Relógio de pose conserva tempo real em quadros longos. Antes,100ms viravam50ms e a marcha atrasava a10FPS. Molas secundárias mantêm passo limitado separado. LOD retém tempo acumulado; culling descarta histórico invisível. Apoio lateral do quadril usa resposta exponencial14/s, evitando snap dependente de FPS.
- Torcida WebGL2 interpola dois quadros adjacentes do atlas, inclusive7→0, com fase estável por espectador. Mesmos três lotes/atlas/triângulos; custo adicional de uma leitura de textura por fragmento dos cartões distantes. WebGPU continua estático.
- Pigmento contínuo aplicado em crânio, pálpebras e lábios; normais externas da pálpebra assentam também na partida. Após inspeção do primeiro antes/depois, uma segunda passagem enterra pontas da esclera na órbita e aproxima a raiz da orelha do retrato da cabeça. Mesma identidade/topologia/mapas/materiais/passes. O modelo continua estilizado; não é uma substituição fotorealista.
- Alvo do portador da bola calculado uma vez por passo com posse sem observador, preservando recálculo quando o callback pode alterar o portador. Mantidos solver,139Hz, subpassos e regras.

## Evidências

- Suíte integrada:2096 testes/384arquivos aprovados. Após segunda passagem facial,30 regressões adicionais repetidas passaram. Testes focados de animação23, física16 e torcida7 também passaram.
- Relógio/apoio/impacto validados a10/20/30/60Hz, todas cadênciasLOD; marcador0,4 do chute preservado.
- Posse/soltura:720estados e720checkpoints completos Rapier idênticos à base, incluindo observadores mutáveis e seis durações de passo. JSON em2026-10-24-presentation-evidence.
- CodSpeed40101021349 da base72389 concluiu com22benchmarks instrumentados e upload confirmado. Sucesso não prova ausência de regressão nem FPS.
- Comparação isolada do kernel de pés apoiados ac3aa→72389 (melhoria da rodada anterior agora medida):110000chamadas/run,7runs/revisão alternados, Node24.22.1/EPYC9V74/dependências idênticas. Mediana763,713947→174,183895ms (−77,19%).14checksums iguais; máximo delta de campos3,77e−15. Não extrapolar para física inteira ou FPS. Amostras brutas/script preservados.
- Navegador real Chromium134 headless-shell, SwiftShader,1280×720canvas de partida e1360×1000viewport. Capturas do retrato emidle/fase0,45/frontal. Partida com gol sintético explícito só na apresentação; Worker não alterado. Render e interação concluíram sem erros JavaScript/console nas capturas verificadas. FPS de software não certifica GPU física.

## Decisão

Parcial. Melhorias de sincronização, continuidade e cálculos comprovadas; qualidade estilizada ainda limita o salto visual. GPU física/FPS, todos os checks finais do SHA, orçamentoTV, bundle/startup/Worker e comparação de revisões contra main continuam requisitos de release. Nenhum merge emmain nem deploy de produção. Postman/backend não receberam tráfego artificial; serviços de pagamento, conta e banco não foram modificados. CLI Game Development Studio ausente; não se alega render por essa ferramenta.

Build de produção, build gráfico, TypeScript e ESLint zero erros/avisos passaram. bundle:check reprovou Simulation worker startup budget; a autorização de crescimento moderado não foi tratada como passe automático.
