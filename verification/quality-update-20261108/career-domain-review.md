# Carreira, contratações, táticas e persistência — 8 de novembro de 2026

Base desta atualização: `c20036f33a8f7d8eff15012d276606a3964e4a54`, merge do PR #125. Branch local: `codex/massive-quality-20261108`. O PR #125 já estava fechado e incorporado ao `main` quando esta atualização começou. Nenhuma alteração deste relatório foi aplicada ao banco de produção.

## Correções implementadas

| Área | Comportamento anterior identificado no código | Comportamento da proposta |
| --- | --- | --- |
| Resultado da partida e navegação | O desmontar da página invalidava `isCurrentOperation` e abandonava um save já aceito entre escritas assíncronas. | O save aceito mantém uma autorização de persistência independente da página. Uma mudança de conta, inclusive A→B→A, ou do epoch da carreira o revoga. O observador de autenticação é removido ao terminar. |
| Hidratação após navegar | Uma página nova podia ler uma escrita local incompleta, inclusive a partir de uma query fresca que não executa `queryFn`. | Um estado compartilhado de conta e epoch bloqueia sincronamente a exposição e a mutação da carreira até a durabilidade local. Assinantes recebem a revisão concluída; caches de outra instância são reconciliados antes de liberar ações. |
| Recuperação da fila | A cópia antiga da nuvem podia substituir alterações locais pendentes da mesma rodada e geração. | O estado da outbox da mesma geração prevalece até a resposta do servidor. É refletido no snapshot local e na carreira exibida. Gerações divergentes e tombstones continuam bloqueando. |
| Falha de escrita local | Uma barreira `pending_save` podia impedir indefinidamente novas tentativas. | A tentativa de recuperação exige lock entre abas, snapshot e geração compatíveis, ausência de tombstone, escrita e leitura de confirmação da outbox. Só então remove a barreira. As demais barreiras não são liberadas por esse caminho. |
| Jogo sem internet | `canMutateCareer('offline')` negava uma edição mesmo quando `update()` já exigia snapshot e geração conhecidos. | A edição comum pode persistir e ficar na fila. A criação e o reset permanecem impedidos enquanto o estado da conta não é confirmado. |
| Visitante com falha de disco | O fluxo de visitante retornava sucesso mesmo quando `saveLocalCareer` retornava `false`. | A falha retorna estado bloqueado e aciona o tratamento de erro da atualização. |
| Sincronização e renderizações | Um novo array da query era criado em cada renderização, recriando callbacks, listeners e o temporizador de flush. | A chave é memoizada por conta e geração. |
| Formação inválida | Chaves herdadas como `constructor` e `toString` resolviam funções de `Object.prototype` em vez da formação de fallback. | A resolução exige uma chave própria de `FORMATIONS`. |
| Táticas corrompidas | Valores ausentes, não finitos ou fora da faixa permaneciam no save. | A reparação normaliza a formação e os quatro controles, preserva escolhas válidas e é idempotente. |
| Banco de reservas | O caminho que preservava uma XI válida podia devolver titulares, IDs duplicados, atletas de outro clube ou indisponíveis no banco. | A seleção para a partida remove essas referências sem alterar o save pessoal. |
| Mercado e scouting | Contagens infinitas ou grandes e nível de olheiro inválido podiam gerar trabalho ilimitado. | A geração rejeita contagens inválidas antes do loop. Mercado limitado a 128 entradas, relatório premium a 40, olheiro aos níveis inteiros 0–5. As chamadas normais preservam sua sequência de RNG. |
| Empréstimos | A metade do salário era arredondada em milhares de euros. | A conta usa euros inteiros e o jogador recebe exatamente o salário cotado. Exemplo de regressão: €12.346/semana passa a €6.173 para o clube que paga metade; a fórmula anterior produzia €6.000, uma diferença de €173 por semana. |
| Identidade da contratação | Nome nulo podia causar exceção; ID vazio, longo ou com caracteres de controle podia criar um atleta inválido. | A contratação e a cotação validam nome, ID, clube, idade e atributos antes de autorizar o pagamento. |
| Condições do empréstimo | Um valor bruto acima do limite podia entrar na faixa válida depois do desconto do empréstimo. | O valor original também passa pela validação monetária. |
| Camisa importada | Uma preferência infinita ou fracionária podia ser usada como número; camisas de outros clubes ocupavam números do atual. | Só aceita preferência inteira 1–99 e verifica ocupação no clube atual. |
| Cotação financeira | Saldo restante fora da faixa podia ser convertido pelo fallback de apresentação para zero. | A cotação valida o valor bruto antes de usar o fallback. |
| Premiação | `NaN`, infinito, valor negativo ou acima do limite podia virar um prêmio de zero e consumir o ID de idempotência. | O valor inválido é rejeitado sem registrar evento; uma tentativa posterior com valor correto funciona. |
| IDs financeiros | Um ID longo podia ser aceito no ledger, mas removido do histórico durável no próximo ciclo. | IDs maiores que 180 caracteres e tipos de evento desconhecidos são rejeitados antes do lançamento. |

## Evidência executada

- Node de verificação: `.cache/node24.22.0/node-v24.22.0-win-x64/node.exe`, versão exigida por `.nvmrc`.
- Quinze arquivos direcionados executados em uma única chamada Vitest, com um worker: **192 testes aprovados, zero falhas**. Relatório estruturado: [career-tests.json](./career-tests.json).
- O conjunto inclui o fluxo real de `useCareer` com renderização React e portas controladas de autenticação, armazenamento e servidor. Cobre navegação após aceitar o save, mudança A→B→A, edição offline com geração conhecida, criação offline bloqueada, recuperação de alteração na mesma rodada e conflito de geração.
- Testes de falha exercitam snapshot, fila, leitura de confirmação, remoção de barreira, falta de lock, geração incompatível, tombstone e reset entre escritas.
- ESLint dos 22 arquivos novos ou alterados desta frente passou com `--max-warnings=0`.
- `git diff --check` passou após a implementação.

Este conjunto é evidência de comportamento local e fronteiras controladas. Não certifica latência da rede, escrita em produção, ausência de vulnerabilidades em todas as telas ou desempenho de FPS. Build, TypeScript global, SQL, stress, bundles, renderização e comparações de desempenho pertencem aos relatórios da integração.

## Correção P1 após revisão independente

A primeira revisão identificou corretamente que aguardar somente dentro de `queryFn` não protegia uma nova tela que recebesse a carreira antiga de um cache ainda fresco. Essa lacuna foi corrigida antes da entrega final:

- `useSyncExternalStore` observa a escrita local compartilhada por conta e epoch. Uma tela nova recebe estado de carregamento e nenhuma carreira enquanto a escrita está pendente.
- A aceitação de uma mutação consulta o mesmo estado de forma síncrona. Uma revisão local identifica também callbacks antigos acionados depois de a barreira terminar; a mutação exige que a instância tenha observado a revisão e a carreira atuais.
- A hidratação confirma a revisão antes de cada etapa. A assinatura provoca reconciliação quando o cache de outra identidade ainda não observou a revisão concluída. Criação e reset respeitam a barreira de escrita em andamento.

O teste [career-remount-browser.json](./career-remount-browser.json) executou o próprio `useCareer` em um navegador Edge instalado, com **ReactDOM, duas telas montadas de verdade, um QueryClient real e IndexedDB/localStorage reais**. A fixture preservou o cache fresco de 30 segundos: a contagem de execuções remotas de `queryFn` permaneceu **zero**, reproduzindo justamente o caminho que escapava da primeira implementação.

A primeira escrita de IndexedDB ficou suspensa por uma porta controlada. Após aceitar o resultado, a primeira tela desmontou e a segunda tentou editar o estado anterior. A edição foi recusada. O teste liberou a escrita, provocou falha do envio à nuvem e tentou novamente o callback antigo, que continuou recusado. Uma edição feita com a carreira atual foi aceita. O snapshot e a outbox terminaram com **rodada 2, um resultado preservado e ingresso de 77**. Foram **duas escritas locais aceitas e dois envios à nuvem controladamente falhos**. Esse teste não usa contas ou serviços reais e não mede FPS.

O runner está em `scripts/verify-career-remount.mjs`, a fixture em `.github/fixtures/career-remount.tsx`. Pode receber `PLAYWRIGHT_MODULE`, `PLAYWRIGHT_CHANNEL` e `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, seguindo o padrão do capturador gráfico existente. Nenhuma dependência ou lockfile foi adicionado para esse teste.

Após a correção P1, os dois arquivos direcionados de lifecycle/hook passaram com **13 testes**, e o lint dos seis arquivos afetados passou com zero avisos e erros. A execução global de TypeScript feita nesse ponto não encontrou erro nesta frente; identificou dois erros de `Material.map` em `player-rig-meshes.ts`, comunicados ao responsável pelos gráficos. A validação global final da integração substitui esse resultado intermediário.

## Separação real dos caminhos excepcionais de manutenção

A comparação dos builds identificou crescimento acima da tolerância em Nova carreira e Match 3D. Para reduzir trabalho inicial de forma real, o carregamento passou a separar somente operações condicionais: a reparação `recoverPendingCareerWrite` é importada quando existe a barreira persistida `pending_save`; `resetCareerSafely` é importado após a aceitação explícita de reset e a aquisição do gate síncrono. A migração normal, a gravação, o observador de identidade, a revisão compartilhada e a barreira de renderização continuam disponíveis imediatamente.

Uma falha ao buscar o módulo de reparação preserva a barreira e o snapshot. O reset confere novamente identidade, epoch e revisão compartilhada depois do carregamento e antes de entrar no procedimento de exclusão; uma alteração concluída por outra tela nesse intervalo impede o reset antigo. O gate é liberado em `finally`, inclusive quando o módulo não carrega. A API pública e o procedimento transacional de `career-reset.ts` não foram alterados.

A suíte direcionada após essa separação passou com **106 testes**, incluindo seis novos casos de carregamento atrasado/falho e concorrência entre instâncias. Evidência: [career-cold-path-tests.json](./career-cold-path-tests.json). O teste real de duas telas em navegador foi repetido e passou: [career-remount-cold-path-browser.json](./career-remount-cold-path-browser.json). TypeScript global e lint dos três arquivos afetados passaram sem diagnósticos. Os ganhos de bytes dependem da próxima comparação dos dois builds com o mesmo analisador; os números de arquivo-fonte não foram usados como substituto.

## Migração carregada quando existe um snapshot bruto

A segunda comparação real de bundles mostrou que separar apenas reparação excepcional e reset ainda não atendia à tolerância de crescimento por rota. O próximo ajuste separa uma dependência efetiva do grafo inicial: o módulo síncrono `career-migration.ts` mantém a mesma API e o mesmo algoritmo, mas `useCareer` solicita seu código somente quando recebe um snapshot bruto local, remoto ou da outbox. Uma conta vazia e a utilização de uma carreira já hidratada no cache não precisam desse módulo. Não existe temporizador nem exposição provisória do estado sem migração.

Todas as chamadas de reparação aguardam o carregamento. Após esse limite assíncrono e antes de migrar, persistir ou devolver um estado hidratado, o hook confere conta, epoch, revisão compartilhada e ausência de uma nova escrita local em andamento. Uma falha ao carregar o módulo rejeita a hidratação. O envio da outbox repete as verificações depois do carregamento; uma falha preserva a entrada sem confirmação, e um envio antigo descartado não publica estado sincronizado.

O relatório [career-migration-boundary-tests.json](./career-migration-boundary-tests.json) registra **116 testes aprovados**, incluindo dez novos cenários de conta vazia, cache pronto, falha e atraso de carregamento, mudança de conta/epoch, escrita nova concluída ou pendente e tentativas de reconexão. O mesmo teste real de duas telas passou novamente: [career-remount-migration-boundary-browser.json](./career-remount-migration-boundary-browser.json). TypeScript global e lint dos três arquivos desta separação passaram sem diagnósticos. Os bytes e o resultado do gate pertencem à comparação do build seguinte; esta alteração não presume que o orçamento tenha sido atingido.

## Achado para uma versão futura do motor

`src/game/sim-team-ai.ts:245` ativa a armadilha de impedimento com `pressing >= 3`. O contrato de tática em `src/game/types.ts` e o validador em `src/game/match-command-validation.ts` aceitam pressão entre 0 e 2. Portanto, essa condição é inalcançável para um comando legítimo.

Não foi alterada nesta frente: tornar a condição alcançável modifica trajetórias válidas e replays determinísticos. A evolução deve definir uma versão de regras e comparar cenários táticos, distribuição de impedimentos, chances e a autoridade do servidor. Corrigir apenas o número durante uma campanha de paridade mudaria silenciosamente o comportamento de partidas existentes. Nenhuma melhoria de IA foi inferida dos testes de finanças ou dos testes estruturais.
