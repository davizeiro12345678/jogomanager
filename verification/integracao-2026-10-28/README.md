# Integração para revisão — 28 de outubro de 2026

Esta branch reúne código, mas **não é uma publicação**. Foi criada separada de
`main` porque a integração automática do Supabase e o Workers Builds podem
alterar ambientes ou gerar custos ao abrir um PR ou mesclar em produção.

## PRs incluídos

As revisões correspondentes aos PRs #35, #54, #66, #68, #70, #73, #74, #79, #80, #82,
#84, #85, #86, #87, #88, #89, #90, #91 e #92 foram incorporadas preservando
o histórico de seus commits. O código do #93 e o trabalho posterior da IA
e do chat também foram incorporados. Uma colisão entre dois READMEs de
benchmark do Contabo foi resolvida preservando os dois documentos.

O #54 tinha um único conflito em `public/sw.js`. Sua proteção contra respostas
privadas, redirecionamentos e páginas de autenticação em cache já está presente
na implementação mais recente, que também valida MIME e preserva o shell
público offline. O conflito foi resolvido mantendo essa implementação e seus
testes; a árvore resultante ficou idêntica à anterior à mesclagem do #54.

Os cinco conflitos do #35 foram resolvidos preservando o transporte, a
validação de carreira, os materiais e o checkout mais recentes. A normalização
de caracteres Unicode de controle foi adicionada à validação atual e tem teste
próprio. O próprio PR registra divergência histórica entre o checkout e o
esquema do banco examinado; é preciso conciliar migrações e testar o pagamento
em ambiente seguro antes de implantação.

Os PRs #79 e #82 receberam correções de formatação em suas próprias branches.
No #79, todos os jobs não relacionados ao Lighthouse mobile passaram no commit
`b415b3f56baff7dae87a3bd92c48effe7f29f352`; o Lighthouse mobile falhou. No #82,
os jobs não relacionados ao Lighthouse mobile também passaram no commit
`e93cc3fffbb97d2cd65a8a4f9018d6b9004a40e7`; o Lighthouse mobile e, em
consequência, o gate de release falharam.

## Fora da integração

Os PRs #48, #56, #60, #62, #63, #69 e #77 apresentaram conflitos
textuais ou dependem de uma base com conflitos. O #69 também precisa de uma
revisão cuidadosa da atualização de dependências em relação a `main` atual;
não se deve remover testes existentes para resolver o conflito. Não foram
feitos rebase, force-push ou descarte automático dessas alterações.

O #48 altera salvamento e painéis de carreira; os conflitos precisam preservar
as garantias de persistência e sincronização. O #56 altera autenticação e
segurança e registra testes de ponta a ponta ainda pendentes. Os #60 e #63
alteram carregamento e CSS que também evoluíram na base atual. Os #62, #69 e
#77 compartilham uma base extensa que conflita com código de simulação,
checkout e verificações de qualidade incorporados depois.

## Validação e bloqueios

Nesta combinação, a suíte completa passou com 1.676 testes em 308 arquivos;
lint, TypeScript, build e o limite absoluto de bundle também passaram.
O estresse de 200 partidas e suas repetições passou na árvore anterior; esta
atualização não alterou o simulador usado nesse estresse. Os quatro testes
Python dos scripts do cache e a verificação local do histórico de migrações
passaram novamente nesta combinação. A comparação de bundles atual
contra a mesma base reprovou: total +3.402 bytes gzip e +2.959 bytes Brotli;
detalhes e aumentos por rota
estão em [bundle-impact-corrigido.md](../ai-providers-2026-10-28/bundle-impact-corrigido.md).
A linha de Match 3D do relatório original selecionou outro módulo por engano;
a comparação corrigida também identificou aumento de 470 bytes gzip e 351 bytes
Brotli no startup dessa rota. Os limites não foram alterados.

Outras verificações locais passaram: 35 testes dos contratos de cotas,
deploy e fontes; seis testes de API auxiliar; 18 testes dos próprios gates de
performance; e a compilação isolada do worker de partida. O comando de testes
Rust/WASM não pôde ser executado nesta máquina porque `cargo` não está
instalado. O CI do #82 passou em Rust/WASM, mas isso não valida o conjunto
integrado.

O replay completo do PostgreSQL, a validação conjunta de pagamentos e contas
reais de teste, o Lighthouse canônico e o gate completo do GitHub ainda são
necessários para este conjunto. As migrações que os PRs indicam já aplicadas em
produção precisam ser conciliadas com o histórico real antes de qualquer
implantação. A habilitação de serviços, segredos e flags continua fora desta
integração de código.

O teste com plano fixo e os dois resultados divergentes de desempenho do
simulador estão em `verification/ai-player-crowd-2026-10-28/README.md`.

O coordenador de sessão foi reforçado com validação de ingressos e comandos,
limites de fila e comandos, tratamento da reconexão e um assento de IA que não
exige uma segunda conta. Ele continua sendo uma biblioteca de servidor: não há
transporte de partida ao vivo nem persistência de resultado conectados aqui.
