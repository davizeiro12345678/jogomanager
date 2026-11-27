# JogoManager: desempenho, confiança e experiência

## Objetivo e autorização

Implementar a solicitação de 8 de novembro de 2026 em uma branch nova e um PR novo, a partir de `c20036f33a8f7d8eff15012d276606a3964e4a54`. O usuário autorizou investigação, implementação e quinze subagentes. Preservar nomes, identidades dos espaços, projetos alheios e configurações da conta. Nenhuma contratação, crédito adicional ou dispositivo adicional está autorizado.

## Estado comprovado

- Repositório: `davizeiro12345678/jogomanager`, main, TanStack Start/React/Three/R3F/Rapier, kernel Rust/WASM, Supabase e Cloudflare.
- CI baseline: build/tipos/lint/testes, Rust/WASM, replay SQL, stress de 200 partidas, bundle e MatchSim passaram. Lighthouse mobile falhou em `/partida-rapida`: score mínimo 0,85 e TBT máximo 589 ms. CodSpeed executou com sucesso.
- Alta atualmente visa 45 FPS; alterar um número de contrato não prova 60 FPS.
- O navegador remoto público disponível está sem WebGL. Capturas da interface são possíveis; ele não certifica FPS do estádio. Medição em SwiftShader deve ser explicitamente identificada.
- O medidor visível descarta pausas acima de 250 ms mesmo em aba ativa. Isso pode esconder as piores travadas e será corrigido antes de comparar resultados.
- O kernel de seções do atleta repete trigonometria por anel e cria arrays transitórios para índices. Há oportunidade concreta sem mudar geometria.
- Supabase identificado: `lguqnwvsfeefxamzeyos`. Diagnóstico de índices e RLS precisa distinguir controles intencionais de falhas; não apagar índices somente porque o advisor diz não usados.
- Resend tem 41 templates publicados; a integração dos eventos e o chamador de produção precisam ser comprovados separadamente.

## Abordagens e decisão

1. Reescrita de motor/stack: alto risco de romper saves, RNG e orçamento; rejeitada nesta entrega.
2. Alterações incrementais sobre a arquitetura atual, com baseline e gates existentes: escolhida por preservar determinismo, facilitar revisão e permitir atribuir diferenças.
3. Reduzir preset/gates para atingir o número: rejeitada; a qualidade alta e os limites críticos permanecem verificáveis.

As escolhas de implementação são decisões técnicas do executor dentro da autorização do usuário, não aprovações adicionais atribuídas ao usuário.

## Metas e evidência

Registrar as duas interpretações de 89%: velocidade 1,89× significa tempo ≤52,91% do baseline; redução de tempo de 89% significa ≤11% e velocidade 9,09×. A meta mais exigente pedida inicialmente é registrada separadamente. Nenhuma melhora geral será declarada a partir de um único benchmark.

FPS: preset alta fixo, resolução/DPR/seed/cenário/build e renderer identificados; média = frames / tempo, frame time p50/p95/p99, 1% low e 0,1% low, pausas >33,3/50/100/250 ms, janelas de partida e cutscene separadas. Pausas visíveis contam; aba em segundo plano não. Comparar before/intermediate/after no mesmo ambiente. Screenshot, fixture e contrato estrutural não são certificação física.

## Limites globais

- Lint zero errors e zero warnings; TypeScript sem erros.
- Não afrouxar `Quality gates`: Lighthouse mobile ≥0,97; TBT ≤200 ms; LCP ≤2.500 ms; CLS ≤0,1; a11y ≥0,90; cinco rotas, três runs e agregação pessimista.
- Crescimento startup gzip/Brotli ≤2.048 bytes por rota/métrica e JS agregado ≤400.000 bytes; limites absolutos mantidos.
- Testar os 200 seeds/replays; refactors da simulação preservam ordem RNG e resultados.
- Servidor/DB são autoridade de saldo, compras, resultados e achievements. Cache/IndexedDB e JSON de carreira são não confiáveis.
- Migrações novas em `drizzle/migrations/`, com exceção de policies Realtime conforme AGENTS. Sem replay destrutivo em produção.
- Sem force-push ou histórico publicado reescrito. PR não implica deploy; release só após gates e SHA exato de `/api/health`.

## Entregas por domínio

1. Instrumentação correta e relatório reproduzível de desempenho.
2. CPU/GC do kernel TS e Rust, classificação e caminhos quentes comprovados, sem trocar fixture ou remover benchmark.
3. Multiplayer/chat: validar identidade, sequência, membership, tamanho, rate limits, reconexão, deduplicação e autoridade no servidor onde o código existente permitir integração comprovável.
4. IndexedDB/cache: schema/ownership, falhas recuperáveis, limites, invalidação e isolamento por usuário; nenhuma decisão financeira baseada em cache.
5. Auth: confirmar o que já é Supabase e reduzir dependência do broker Lovable sem simular failover de banco ou transportar senhas entre projetos.
6. Supabase/Cloudflare: consultas e índices baseados em estatísticas/planos, cache público separado de conteúdo autenticado, revisão de policies. Mudanças operacionais somente após checagem e rollback concreto.
7. Carreira/contratação/finanças/táticas: jornadas e bugs observados, preservando saves e idempotência.
8. Estádio/jogadores/torcida/clima/cutscenes/IA: priorizar hotspots e bugs observados, com budgets e parity; não trocar o motor indiscriminadamente.
9. Code splitting/modularização: imports pesados fora do startup e fronteiras coesas, mantendo reexports e CSS SSR.
10. Sobre/contato: endereço e CPF fornecidos pelo usuário, descrição da criação e suporte webhook com autenticação, limites e deduplicação. Dados declarados não equivalem a verificação de identidade.
11. Resend: inventário de templates, eventos/chamadores e dispatch seguro; publicar template não equivale a automatizar evento. Nenhum e-mail de teste para destinatário real sem necessidade.

## Teste de segurança ativo

Produção: somente poucas verificações públicas não destrutivas. Exercícios de payload, abuso e concorrência ocorrem primeiro em ambiente local/descartável com dados sintéticos, uma conexão por padrão e limite explícito. Cessar antes de degradação, em timeout, erro inesperado, resposta 429/5xx ou alteração de disponibilidade. Não bombardear produção, acessar dados alheios ou tratar 'intensidade média' como permissão de indisponibilidade.

## Condições de conclusão

Cada item termina implementado e verificado, rejeitado por contraprova, ou pendente com causa e evidência. Evidências anteriores do PR #125 são baseline histórico, nunca resultado novo. Metas não medidas ou não atingidas permanecem explicitamente abertas. O PR deve conter escopo final, validações reais e riscos remanescentes.
