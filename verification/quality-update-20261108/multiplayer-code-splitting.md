# Carregamento da partida online e catálogos locais

O lobby de multiplayer deixou de importar estaticamente `Stadium3D`, `WorkerMatchView`, `buildTeamSetup`, `createLiveMatchController` e a detecção gráfica. O componente que usava esses módulos foi extraído para `src/features/multiplayer/LiveRoom.tsx` e é solicitado por `React.lazy` somente no ramo da sala em andamento, com fallback acessível em `Suspense`.

A lógica de `LiveRoom` foi copiada literalmente na etapa de extração. Os hashes dessa etapa estão em [multiplayer-code-split-parity.json](./multiplayer-code-split-parity.json). Depois, somente os vínculos de textos da apresentação e a leitura do idioma foram localizados; o hash atual é distinto e está registrado separadamente. Semente pública da apresentação, substituição do placar pelo resultado autoritativo, controle de visibilidade/conexão, retry de settlement e descarte do Worker mantêm o código anterior. O lobby preserva autenticação, chat e as mensagens dos limites de criação de sala.

A checagem de internacionalização usa a identidade do arquivo em sua baseline. A mudança de proprietário dos textos e as novas interfaces foram atendidas com catálogos pequenos de português, inglês e espanhol ligados ao `useT().lang`, seguindo o padrão de mensagens locais já existente. Outros idiomas usam o fallback em inglês. Os catálogos de suporte e partida online permanecem nos respectivos módulos de carregamento sob demanda. Não houve expansão dos pacotes globais ou alteração da baseline para aceitar novos textos fixos.

Os textos novos de suporte, identificação do criador, introdução do atendimento, datas atualizadas e acesso alternativo passaram a usar esses catálogos. Conteúdo de formulários, regras de validação, protocolos, endereços informados, CPF, provedores habilitados e chamadas de autenticação não foram modificados por essa etapa.

Validação local:

- O scanner `i18n-hardcoded.mjs --check` passou: 3.058 candidatos na baseline, 3.050 na proposta e **zero candidatos novos**. Relatório: [i18n-hardcoded-current.json](./i18n-hardcoded-current.json).
- Oito arquivos direcionados passaram com **59 testes e zero falhas**: fronteira de carregamento, autoridade da sala, chat, paridade de chaves PT/EN/ES, botões de autenticação alternativa e validação/entrega de suporte. Relatório: [multiplayer-i18n-tests.json](./multiplayer-i18n-tests.json).
- ESLint dos quinze arquivos afetados passou com zero erros e avisos. `git diff --check` passou.

A redução do arquivo da página não constitui uma medição de bytes baixados ou de FPS. O build final, o grafo de chunks e a comparação de bundles da integração precisam estabelecer o efeito real no carregamento e confirmar os limites por rota. Os testes de segurança que liam `LiveRoom` na página foram direcionados ao novo arquivo proprietário, mantendo as mesmas verificações de seed, autoridade, pausa e leases.

## Cobertura do analisador de bundles

O coletor existente `scripts/bundle-report.mjs` passou a selecionar também entradas `multiplayer-`. A leitura de imports estáticos, a união com root/hydration, a deduplicação e os cálculos de raw, gzip nível 9 e Brotli Q6 não foram modificados. A comparação adiciona **Lobby multiplayer** como rota obrigatória, com raw diagnóstico e o mesmo limite de crescimento de **2.048 bytes** para cada uma das duas métricas de transporte. O limite agregado de 400.000 bytes e os orçamentos absolutos continuam iguais.

O agente de integração deve executar **esse mesmo coletor candidato nos dois builds**, evitando comparar uma medição antiga sem a rota com uma medição nova. Os contratos do analisador passaram com **22 testes, zero falhas**, incluindo a retenção do root e da hidratação, a exclusão dos chunks lazy de `LiveRoom`/estádio, aprovação em +2.048 bytes, reprovação em +2.049 bytes e reprovação quando a rota falta. ESLint dos três scripts passou com zero avisos e erros. Essa validação verifica o método; os valores reais vêm dos dois builds.
