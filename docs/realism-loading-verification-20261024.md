# Carregamento progressivo e correções de integração

O cliente anterior importava React e o hidratador antes de ceder a primeira pintura. O documento SSR agora identifica as páginas públicas; uma entrada pequena aguarda o documento e sua pintura antes de baixar o hidratador. Abas ocultas e rotas privadas inicializam imediatamente. Links nativos continuam disponíveis no SSR.

Os preloads do Vite preservam dependências novas e a espera pelo CSS, omitindo apenas JavaScript que já pertence aos imports estáticos do módulo chamador. Os helpers compartilhados têm menos arquivos pequenos. A validação do destino de autenticação permanece idêntica, separada das mensagens opcionais do formulário. O acesso aos metadados voltou ao contrato compatível com os testes integrados da base.

## Verificação local

Base `3ff919283456d0409a8cf922baaef85428d2561c`, mesma máquina, Node 24.22.0, mesmas dependências e analisador. Os bytes do hidratador e de sua entrada permanecem contabilizados em todos os caminhos de startup; adiar o download não esconde custo.

| Verificação | Resultado observado |
| --- | --- |
| Suíte da aplicação | 1.463 testes aprovados; zero falhas ou ignorados |
| TypeScript | Aprovado, incluindo propriedades opcionais estritas |
| Lint | Zero erros e avisos no código; evidências locais geradas não fazem parte do checkout limpo de CI |
| Contratos Node de performance | 16 aprovados, incluindo fixture de build real do Vite para JS e CSS |
| Build e orçamento absoluto | Aprovados |
| Gzip/Brotli total e sete caminhos | Nenhum crescimento |
| UI, 390 × 844 | SSR sem JavaScript, consentimento, acessibilidade, 300 ligas, partida e narração com 98 idiomas; zero erros JavaScript |
| Voz do provedor e FPS físico | Não certificados por estes testes de interface |

| Caminho | Variação do gzip estimado | Variação do Brotli Q6 estimado |
| --- | ---: | ---: |
| JavaScript total, incluindo lazy | −2,18% | −2,34% |
| Página inicial | −0,22% | −0,30% |
| Nova carreira | −0,12% | −0,16% |
| Partida rápida | −0,29% | −0,34% |
| Match 3D | −1,19% | −1,22% |
| Cinema | Sem crescimento | Sem crescimento |
| Editor | Menor | Menor |
| Worker | Menor | Menor |

Essas medidas representam código transferido estimado. Não medem FPS nem uma redução proporcional do tempo real de carregamento. Os limites obrigatórios continuam em [critical-performance.md](critical-performance.md).

O relatório local `verification/realism-data-20261022/report.html` mantém as fotos e falhas iniciais e apresenta as correções em seção separada, com 17 comparações adicionais entre a base atual, a etapa 9 reprovada e a etapa 14. Os JSON, logs e fotos ficam junto dele. Runtime, caches de ferramentas e grandes compilações locais não são incluídos no Git.

## Aprovação e entrega

A revisão anterior `6a149c8` passou em CI no stress de 200 partidas com replays, ABBA, comparação dos bundles, replay SQL com contratos de acesso, gráficos, assets, WASM, dependências e Lighthouse desktop. O teste de metadados e o Lighthouse móvel falharam nessa revisão; o agregado corretamente bloqueou a entrega. A correção dos metadados passou na suíte local completa. Esta nova revisão precisa repetir todos os jobs de CI.

A etapa móvel 9 aprovou a página inicial e o scouting nas três amostras de cada página, mas reprovou guias, formações e partida rápida. A etapa 14 repete todas as cinco URLs e os critérios pessimistas originais. Resultados anteriores não são substituídos nem suficientes para declarar aprovação integral.

Continuam necessárias a campanha completa de três repetições por GPU, a audição autenticada das vozes e a verificação dos assets publicados. As 28 categorias suportadas não significam histórico importado completo. Publicação em produção exige todos os gates aprovados e confirmação do SHA compilado exato em `/api/health`.
