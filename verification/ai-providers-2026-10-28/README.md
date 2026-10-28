# Revisão dos provedores de IA — 28 de outubro de 2026

Esta revisão não foi publicada. Ela parte de `codex/integracao-revisao-20261028`,
que já reúne o código de 20 PRs listados em
`verification/integracao-2026-10-28/README.md`. A integração do PR #94 e dos
PRs com conflitos ainda precisa de revisão. O histórico das branches `k` e
`feat/player-career-final-integration-20261015` pode ser incorporado sem
alterar a árvore de arquivos.

## IA

O assistente mantém Anthropic como padrão. A seleção explícita de OpenAI usa
`gpt-6.1-terra`; a alternativa opcional usa `deepseek-flash` com esforço `max`
apenas depois de falhas temporárias. Cada tentativa reserva orçamento próprio.
Recusas, respostas incompletas e falhas de autorização não acionam o segundo
provedor. As credenciais e a ativação dos novos recursos não foram alteradas.

A IA tática GPT existente nesta branch é distinta do assistente e permanece
restrita à partida rápida local autenticada, com a flag desligada. O DeepSeek
adicionado aqui é alternativa para o assistente, não para a IA tática da partida.
Não houve chamada real às APIs nem avaliação da qualidade de respostas reais.

## Verificação local

- `npm test`: 308 arquivos, 1.682 testes aprovados.
- `npm run test:stress`: 200 partidas e seus replays independentes passaram.
- `npm run lint`, verificação TypeScript e build: aprovados; o build registrou
  avisos de dependências e depreciação existentes.
- `npm run test:performance-gates`: 18 testes aprovados.
- `npm run bundle:check`: orçamento absoluto aprovado.
- A comparação de bundles com `main` no mesmo ambiente e dependências falhou:
  +3.402 bytes gzip e +2.959 bytes Brotli no total, além de aumentos nas rotas
  registradas em `verification/integracao-2026-10-28/bundle-impact.md`.
- Os testes dos novos provedores usaram respostas simuladas. Os nomes das
  variáveis sensíveis e os limites estão em `docs/openai-secure-setup.md`.

O Lighthouse mobile do PR #79 reprovou no CI anterior; por exemplo, o tempo de
bloqueio de `/guias` chegou a 1.138 ms contra o limite de 200 ms. Isso é um
resultado de laboratório daquela revisão, não uma medição de usuários ou do
estado atual de produção. Lighthouse, replay do banco e Rust/WASM não foram
executados neste ambiente. As verificações críticas pendentes e os conflitos
impedem afirmar que o conjunto está pronto para publicação.
