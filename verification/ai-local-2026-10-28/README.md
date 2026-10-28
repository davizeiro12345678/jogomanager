# Avaliação local da IA de partida — 28 de outubro de 2026

## Mudanças avaliadas

A seleção local deixa de passar para um alvo claramente impedido e preserva uma
margem de percepção para lances apertados. A regra considera a posição no
momento do passe; a linha usa os dois adversários mais próximos do gol. O
resumo enviado ao modelo passa a refletir as formações realmente usadas na
partida rápida e o número de jogadores titulares em cada posição.

A revisão de execução da partida mudou de 2 para 3. Checkpoints internos de
revisões anteriores, inclusive checkpoints sem revisão, são recusados em vez
de serem retomados com regras diferentes. Isso pode impedir a recuperação de
uma partida em andamento durante uma futura atualização; não muda saves de
carreira. A mudança ainda não foi publicada.

## Comparação de partidas

Foram executadas 24 partidas na base e 24 na candidata, com as mesmas sementes
e a mesma fixture serializada (`fixture.json`, SHA-256
`d9c81ab13eba617ee63a89532c64ec2880a1d6e990a6a5c0375da7882eec0969`). O
cenário é Flamengo 4-3-3 contra Palmeiras 4-4-2, dificuldade difícil, com o
passo de simulação de 1/30 s e escala de relógio 6. A base local tem a mesma
árvore que o commit de revisão remoto `eee52a52a5a9c1d57214d80b5c295f4f075b7a6c`.
As execuções usam física e percepção locais de compatibilidade; não são uma
certificação de desempenho do Rapier, do WASM ou de um aparelho físico.

| Métrica | Base | Candidata |
| --- | ---: | ---: |
| Impedimentos registrados, total | 2.304 | 110 |
| Impedimentos por partida | 96,00 | 4,58 |
| Passes registrados como recebidos pelo destinatário | 782 de 10.011 (7,81%) | 1.991 de 11.112 (17,92%) |
| Gols por partida | 3,62 | 3,88 |
| Finalizações por partida | 32,96 | 37,04 |

Os resultados são descritivos para um único confronto e 24 sementes. As
trajetórias deixam de ser iguais quando as decisões mudam; a diferença combina
a correção da arbitragem e a seleção de passes, sem separar os efeitos. A
taxa de passes recebidos continua baixa e requer investigação. Não se pode
concluir, a partir desses números, que o jogo seja realista ou que toda a IA
tenha melhorado.

`baseline.json` e `candidate.json` guardam os resultados por semente.
`evaluate.mjs` registra o protocolo; execute-o com Node e `tsx`, apontando para
a revisão correspondente e para a mesma fixture. Não há chamadas à OpenAI ou
credenciais nesses arquivos.

## Verificação

- A suíte principal passou em 309 arquivos e 1.685 testes; lint, TypeScript,
  build e orçamento absoluto de bundles passaram localmente.
- A suíte de estresse executou as 200 sementes e seus 200 replays
  independentes. `stress-results.json` passou pelo verificador do gate.
- Os 18 testes dos scripts de gates de desempenho passaram. A comparação local
  dos bundles, porém, reprovou: em relação ao `main` local `955a1d97`, o total
  cresceu 3.386 bytes em gzip e 3.115 bytes em Brotli Q6, além de aumentos em
  caminhos específicos. Em relação à integração anterior, os aumentos totais
  foram 165 e 260 bytes, respectivamente. Os relatórios e medições brutas
  estão em `bundle-main-*` e `bundle-previous-*`.
- Os dois builds locais de comparação usaram a mesma máquina, Node 24.22.1 e
  árvore de dependências, com SHA-256 do lockfile
  `2a3ef045eda83e421f68fdf60649d3f73c8d55ed77bd9b7fcbfd572264efe97d`.
  A candidata estava com alterações ainda não commitadas. Estes resultados
  não substituem o job de comparação de releases na CI.
- A comparação obrigatória do construtor não iniciou: o projeto fixa Node
  24.22.0 e o ambiente disponível tem 24.22.1. Os checkpoints deliberadamente
  mudam com a nova revisão de regras; o gate de comparação permanece
  obrigatório e não foi modificado.
- Lighthouse, replay do banco, certificação em aparelho físico e CI remota
  completa não foram executados nesta alteração.

## Integração OpenAI e limites

O cliente no servidor continua configurado para `gpt-6.1-terra`, esforço
`max`, saída estruturada validada, `store: false` e limites de tempo,
frequência e orçamento estimado. `store: false` não comprova ausência de
retenção para segurança ou outras finalidades previstas pelo provedor. A
[documentação oficial do modelo](https://developers.openai.com/api/docs/models/gpt-6.1-terra)
confirma o identificador e a opção `max`; isso não comprova acesso da conta ou
qualidade das decisões.

A presença de `OPENAI_API_KEY` na Cloudflare foi informada pela pessoa usuária,
mas não foi verificada nesta execução. O recurso exige também
`MATCH_AI_OPENAI_ENABLED=true` no servidor e um build com essas alterações
aprovado e publicado. Não foi feita chamada real ao modelo ou teste online;
se a chamada falhar ou retornar tarde, a partida usa a IA local.
