# PR #132 — salto visual, fluidez, física, IA e rastreabilidade

Pedido do proprietário em 12/11/2026: continuar o plano pendente do Superpowers na PR #132 e ampliá-lo com uma grande atualização do Match 3D, cutscenes, carregamento, stack, física, IA e correção dos problemas Semrush das capturas. Este adendo complementa as especificações de integração de 11/11; não certifica a entrega das funcionalidades planejadas.

## Estado de partida

- Repositório `davizeiro12345678/jogomanager`, PR #132, destino `main`, branch de integração `integration/release-2026-11-11`.
- Fonte inspecionada inicialmente: `b0ce05a3d3b0dc8bd673e1450fb73d789d4ab149`. A branch recebe trabalho concorrente; atualizar o SHA antes de integrar e validar novamente o resultado combinado.
- A implementação existente já contém `contactPhysicsRevision: 2`, interceptação preditiva e `tacticalAiRevision: 2` com cobertura, linhas de passe, apoio, impedimento coordenado e plano de intervalo. Os diagnósticos iniciais do plano de 11/11 são históricos; conferir o código atual antes de repetir qualquer correção.
- Já existem materiais de gramado e atletas, KTX2, instancing, orçamento adaptativo, cache de materiais/geometrias e captura IBL estática. Novas tarefas precisam demonstrar uma diferença útil sobre essa base.
- Não há nesta continuação uma campanha comparável de FPS em GPU física. Código, captura e microbenchmark não substituem essa evidência.

## Decisão de arquitetura

Evoluir TypeScript/React 19, TanStack Start/Query, R3F/Three.js, Rapier, pós-processamento e os kernels WASM já existentes. O renderizador apresenta o estado; a simulação continua sequencial no Worker, com contratos de replay/autoridade preservados. Usar a instalação e o lockfile da revisão em teste, com Node `24.22.0` conforme `.nvmrc`.

Alternativas avaliadas pelo executor:

1. Aumentar resolução, sombras e efeitos em todos os perfis: custo elevado sem resolver anatomia, animação ou composição; contraproducente para fluidez.
2. Trocar a engine inteira ou mover decisões da partida para um modelo remoto: amplia regressões, latência, tamanho e risco de divergência; não atende a continuidade da PR.
3. **Escolha do executor:** direção visual coerente, melhorias por subsistema, apresentação por distância/câmera e medições comparáveis. Mantém as fronteiras atuais e permite aprovar cada incremento separadamente.

O pedido do usuário define os resultados desejados. Os detalhes de direção de arte, prioridades e metas adicionais abaixo são decisões propostas pelo executor, explicitadas para revisão.

## Direção visual: transmissão esportiva realista

O salto precisa aparecer durante a partida normal e nos closes. Capturar as mesmas poses e câmeras antes/depois. Uma melhoria só de menu, resolução ou bloom não satisfaz a revisão visual.

| Área              | Resultado visível exigido                                                                                                                                        | Proteção de desempenho                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Atletas           | Silhuetas atléticas e identidade consistente; ombros/pelve/joelhos coerentes; rosto, olhos, cabelo e barba legíveis; roupa com volume, costuras e resposta à luz | Aprovar primeiro retrato isolado, depois 22 atletas; hero detail só onde a câmera consegue percebê-lo; cache com ownership explícito |
| Movimento         | Aceleração, frenagem, giros, recepção, chute, dividida e defesa com peso; pés apoiados e bola conectada ao contato                                               | Amostragem e relógio visual compartilhados entre LODs; IK/blending limitados aos atletas relevantes; apresentação nunca altera posse |
| Gramado e bola    | Faixas de corte naturais, microvariação, desgaste e umidade plausíveis; marcações limpas; sombra de contato e giro da bola legíveis                              | Camadas combinadas, blades por distância, mipmaps e anisotropia por perfil; sem transparência de campo inteiro redundante            |
| Luz e cor         | Exposição coerente em dia, entardecer e noite; pele e uniformes sem clipping; iluminação do estádio com profundidade                                             | Captura IBL por identidade estável; sombras seletivas; `HdrSanitize` antes de bloom; nenhum efeito depende de recaptura por frame    |
| Estádio e torcida | Arquitetura/materialidade reconhecíveis, arquibancadas com profundidade, reação coletiva e bandeiras coerentes                                                   | Instancing/atlas/LOD, frequência reduzida fora de foco, transparência e partículas com teto                                          |
| Cutscenes         | Entrada, vestiário, negociação, gol e replay com enquadramento, luz e continuidade; diálogo legível e retomada confiável após falha de download                  | Um Canvas proprietário, cache limitado, pré-aquecimento com cancelamento, áudio opcional fora do caminho crítico                     |

Manter legibilidade de camisas, bola e linhas sob chuva/noite, acessibilidade e redução de movimento. Capturas não podem esconder defeitos com profundidade de campo ou exposição.

## Fluidez e carregamento

Instrumentar separadamente clique→módulo, módulo→montagem, montagem→primeiro frame e primeiro frame→interação. Registrar cold/warm cache, compilação, decodificação, criação de rigs, IBL e descarte. Não calcular melhora de carregamento a partir de tamanho de bundle.

Pré-carregamento por intenção, downloads deduplicados e recuperáveis, shaders compilados antes da promoção visual quando suportado, trabalho opcional dividido em lotes canceláveis. Reservar CPU para UI e Worker; evitar concorrência de decoders proporcional a todos os núcleos. Ocultar aba suspende trabalho e campanha; tab visível mantém stalls reais no relatório. Limitar recursos retidos ao reabrir cenas, remontar, mudar qualidade e perder/restaurar contexto.

O governador reduz primeiro custos pouco percebidos, com histerese para evitar oscilações e novas compilações. Informar preset efetivo; nunca rotular baixa como alta. Não há promessa de eliminar todo frame lento em qualquer aparelho.

## Física e IA

Corrigir defeitos reproduzidos no contrato existente sem mudar replays legados. Mudanças maiores de semântica devem ganhar revisão explícita, persistida em setup/snapshot/checkpoint/ticket/servidor; não reinterpretar revisões antigas.

- Física: contato varrido pela ordem temporal real, movimento relativo e altura da bola; evitar selecionar o primeiro defensor na ordem do elenco. Limitar energia/restituição e resolver pé, domínio, goleiro, postes e solo de forma consistente entre MatchSim e Rapier. Um integrador possui a autoridade da bola.
- IA: percepção local em janelas determinísticas, ETA de interceptação com aceleração/fadiga/altura, coordenação por setor, ocupação de espaço, apoio de terceiro homem, cobertura e gatilhos de pressão. O algoritmo decide com informação disponível naquele tick, sem futuro da simulação.
- Custo: buffers e grades de ocupação reutilizados, nenhuma alocação pesada ou rede por tick. Não aumentar velocidade/atributos para fingir inteligência. A/B por sementes pareadas e lados invertidos, além de cenários táticos explicáveis.
- Caso imediato identificado: apoio defensivo não pode contar atleta expulso como participante na IA v2; manter a sequência histórica da revisão legada.

## Semrush e produção

As duas capturas mostram 14 links internos quebrados, 12 páginas 5xx, 12 páginas inválidas no sitemap; avisos de nofollow externo, crawler bloqueado, noindex, páginas órfãs e redirects. As capturas não fornecem as URLs nem o horário do crawl.

Sondagem anônima nesta continuação reproduziu 12 páginas de liga `/tabelas/{slug}` com HTTP 500 no sitemap público. `/api/health` informou HTTP 503 e dependências de servidor indisponíveis. A source da PR já contém política de indexabilidade pública diferente da produção. Registrar os resultados brutos sanitizados; erro de configuração/publicação não se resolve removendo URLs válidas nem devolvendo HTTP 200 com conteúdo vazio.

O gate público deve conferir status final, canonical, robots HTTP/HTML e destinos internos com limite de crawl. Conteúdo público válido é indexável; páginas privadas de conta/partida mantêm exclusão. `nofollow` em links externos pode ser correto. Bloqueio específico do Semrush exige URL e evento WAF reproduzidos; não abrir proteção global para zerar aviso.

Depois de publicar uma revisão aprovada e configurar seus bindings privados, repetir sondagem e solicitar novo crawl Semrush. O relatório antigo permanece histórico até essa nova medição.

## Metas e evidência de aceite

Preservar `docs/critical-performance.md`, todos os gates e cenários existentes. A campanha registra SHA, hash do lockfile/fixture, seed, navegador/driver/GPU, backend, viewport, DPR, preset solicitado/efetivo, câmera, clima e revisão de física/IA.

| Perfil | Alvo existente       | Teto de draws / triângulos          |
| ------ | -------------------- | ----------------------------------- |
| Baixa  | 60 FPS, p95 ≤22 ms   | 90 / 180.000; mobile 75 / 130.000   |
| Média  | 60 FPS, p95 ≤20 ms   | 170 / 420.000; mobile 120 / 260.000 |
| Alta   | 60 FPS, p95 ≤20 ms   | 260 / 850.000                       |
| Cinema | 30 FPS, p95 ≤33,3 ms | 340 / 1.200.000                     |

Tier A alta: média ≥60 FPS, 1% low ≥50 FPS, p99 ≤33,3 ms e nenhum congelamento visível inexplicado >250 ms, tanto na partida como nas cutscenes com preset alta. O alvo de 30 FPS vale exclusivamente para preset solicitado/efetivo cinema e não aprova cutscenes em alta. Tier B/C e cinema são campanhas separadas. Três repetições por cenário no mesmo aparelho, 30 s de aquecimento e ≥90 s úteis; pelo menos uma sessão contínua de 10 min por dispositivo para estabilidade térmica/memória. Guardar amostras, stalls >33/50/100/250 ms, draws, triângulos, programas, texturas, geometrias e vídeos. Dados ausentes deixam a tarefa parcial.

Lighthouse mobile permanece ≥0,97, TBT ≤200 ms, LCP ≤2.500 ms, CLS ≤0,1, acessibilidade ≥0,90 nas cinco rotas e três execuções pessimistas. Não alterar limites, fixtures ou cenários para aprovar candidato.

## Release e revisão

Entregar incrementos na mesma PR #132, sem reescrever histórico publicado ou reaplicar #127–#131. Preservar modificações concorrentes com merge normal e nova validação. Registrar separadamente código, testes executados, evidência visual/GPU e publicação.

Merge, deploy, ativação de partidas reais, segredos, operações do VPS e manutenção de produção seguem os gates de release já documentados. O contexto anexado sobre PR #135 é evidência de outro trabalho; não autoriza ativação nem prova a versão atual da PR #132.

## Fontes técnicas consultadas

- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html): `compileAsync` e pré-compilação; suporte e comportamento devem ser conferidos na versão instalada `0.186.x`.
- `AGENTS.md`, `docs/critical-performance.md`, contratos e testes da própria revisão.
