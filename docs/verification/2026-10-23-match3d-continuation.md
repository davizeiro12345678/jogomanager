# Match 3D — continuação da otimização

Data para o solicitante: 23/10/2026, America/Sao_Paulo. Esta continuação parte da entrega `6d5fa4548171fe1ab779e4cedabf72d7da3a9f26`, preservando o histórico do PR #62. **Resultado geral: PARCIAL. Produção continua bloqueada.**

## Correções implementadas

1. **Worker:** a criação dos schemas Zod de táticas e reparação de analytics saiu dos módulos usados pelo loop de simulação. O Worker mantém validação síncrona e limitada na entrada, incluindo campos extras, comprimentos, valores finitos, papéis por posição, deveres e referências entre planos/regras. Não houve adiamento da validação nem alteração da sequência da simulação. Os schemas ricos continuam na importação/reparação de saves.
2. **Paridade do validador:** teste diferencial recursivo compara mais de 3.000 variações com o schema completo, além das formações válidas e regras semânticas. Encontrou um erro anterior: refinamentos Zod podiam receber slot fora dos limites e acessar `.pos` de undefined. Agora retornam uma issue, mantendo a rejeição sem lançar exceção.
3. **CPU:** cache de medidas corporais verifica os dez campos que influenciam a geração; edição de qualquer campo invalida a identidade rápida. WeakMap permite liberar objetos; uma tabela FIFO de no máximo 2.048 entradas reaproveita valores entre clones de elenco. Perfis congelados seguem autoritativos. Resultados retornam cópias e não alteram o RNG da partida. O primeiro cálculo continua existindo; o alvo é repetição de partidas/elencos.
4. **Gráficos:** a estrutura opaca de cada gol passou de seis meshes para dois lotes no alto, preservando separação de sombras e mantendo rede e impacto animados fora do lote. Vidros planos do banco e grades transparentes usam uma passagem de face dupla. Isso reduz chamadas estruturais; aprovação de pico total depende das capturas.
5. **CI:** a fixture antiga `match-route.js` foi substituída pelo formato real de hash e inclui a rejeição de match-analytics. O gate absoluto também identifica a rota real. Aplicados dez hunks exatos de rustfmt emitidos pelo CI em três arquivos; validação Rust depende do novo runner.
6. **Dependências:** Zod 4.6.5 → 4.6.7; body-parser 2.3.0 → 2.4.0; fast-uri 3.1.8 → 3.1.9. Atualizações pontuais, com npm/Bun locks sincronizados. `npm audit --omit=dev`: **3 vulnerabilidades (2 altas, 1 moderada) → zero** no momento da consulta. Isso não é uma declaração de ausência de toda vulnerabilidade possível.

## Evidências de tamanho antes da integração de main

Build pré-integração em checkout novo, com o mesmo node_modules da revisão avaliada, evita acumular chunks de builds anteriores. As saídas locais com múltiplos hashes antigos foram invalidadas para comparação.

| Medida                         | Entrega anterior |     Continuação | Decisão                                                                 |
| ------------------------------ | ---------------: | --------------: | ----------------------------------------------------------------------- |
| Worker, startup estático bruto |        143.753 B |   **119.288 B** | −17,02%; ainda excede teto de 90.000 B                                  |
| Worker, startup gzip           |         45.915 B |    **39.062 B** | −14,92%; ainda maior que main                                           |
| JS total gzip, todos os chunks |      2.368.805 B | **2.363.327 B** | −5.478 B nesta continuação                                              |
| JS total Brotli Q6             |      2.241.218 B | **2.235.724 B** | −5.494 B nesta continuação                                              |
| JS total gzip, referência main |      2.286.673 B |     2.363.327 B | +3,35%; gate comparativo reprovado                                      |
| Match 3D startup gzip          |        584,3 KiB |   **585,7 KiB** | Pequeno crescimento; guard completo também atende chamadores no cliente |

O WASM da torcida permanece com 62.919 bytes da entrega anterior. Nenhum limite foi aumentado. Remover Zod de um caminho não significa removê-lo da aplicação inteira; os schemas de reparação continuam necessários.

## CPU no mesmo ambiente

Comparações locais pré-integração: Node 24.22.0, AMD EPYC 9V74, fixtures serializadas e dependências idênticas, ordem ABBA. Cada comparação contém 62 amostras por revisão e 21 checkpoints; 3.000 warm-ups e 31 lotes de 1.000 construções por passagem.

| Referência             |    Baseline |        Candidato |    Variação | IC 99% da razão      | Integridade                                 |
| ---------------------- | ----------: | ---------------: | ----------: | -------------------- | ------------------------------------------- |
| Entrega anterior do PR | 0,252172 ms | **0,1159465 ms** | **−54,02%** | [0,428962; 0,476114] | 21 checkpoints iguais; sem violações        |
| main                   | 0,194772 ms | **0,1240225 ms** | **−36,32%** | [0,604145; 0,690743] | Checkpoints divergem; gate global reprovado |

A melhoria é do construtor aquecido com reutilização das medidas. Não mede carregamento frio, duração da partida, latência da rede nem FPS. As duas comparações foram executadas após o término do stress; execuções de referência e candidato nunca ocorreram simultaneamente. O resultado contra main continua bloqueado pela comparação de estado completo, que não foi flexibilizada. A mudança física anterior do PR exige conciliar esse contrato antes da publicação.

## Verificações locais

- Suíte completa: **2.042 testes em 377 arquivos**, aprovada. Após o último ajuste do cache, repetidos 20 testes de medidas/perfil/batching, também aprovados.
- Stress separado: **200 seeds, cada uma com replay independente**, aprovado (357,27 s). Não corresponde a 200 testes unitários distintos; o caso de stress executa a campanha completa.
- TypeScript, ESLint com zero warnings do código, builds de aplicação e estúdios: aprovados. Persistem avisos externos de npm/THREE.Clock e chunks grandes.
- Contratos Node: 13 aprovados. Intake de assets não substitui a validação de novos GLBs; public/game-assets continua ausente.
- Auditoria de dependências de produção: zero advisories na consulta registrada.
- Rust: formatação corrigida a partir do diff do runner. Cargo/rustfmt não estão disponíveis neste ambiente; o novo CI deve certificar compilação e paridade.

## Resultado do CI da entrega anterior

Run Quality gates **40044859519**, no SHA 6d5fa454:

| Job                                               | Resultado observado                                                                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Stress 200 seeds                                  | Aprovado                                                                                                                      |
| Migrações Supabase e contratos de acesso          | Aprovado no Postgres local do CI; não significa alteração de produção                                                         |
| Lighthouse shell                                  | Aprovado                                                                                                                      |
| Contrato 3D determinístico e compressão de assets | Aprovados                                                                                                                     |
| Tipos/lint                                        | Aprovados                                                                                                                     |
| Suíte completa                                    | 2.037 passaram, uma fixture do comparador falhou; corrigida nesta continuação                                                 |
| Audit de produção                                 | Duas altas e uma moderada; atualizadas e zeradas localmente                                                                   |
| Rust                                              | Falhou em formatação; hunks aplicados nesta continuação                                                                       |
| CPU contra main                                   | +29–31% no IC e checkpoints diferentes na entrega anterior; custo melhorou nesta continuação, integridade continua bloqueante |
| Bundle                                            | Crescimento em caminhos e no total; continua reprovado                                                                        |
| Lighthouse móvel                                  | Reprovado                                                                                                                     |

No pior resultado móvel da entrega anterior: Home performance 0,80, LCP 3.795 ms, TBT 263 ms; partida rápida performance 0,49, LCP 4.184 ms, TBT 1.210 ms, CLS 0,1703. Os limites continuam performance ≥0,98, LCP ≤2.500 ms, TBT ≤200 ms e CLS ≤0,1. Esses resultados são anteriores ao novo SHA e não foram substituídos por uma promessa de melhora. CodSpeed e API-Football importer também concluíram com sucesso na entrega anterior.

## Decisão

Aprovação parcial para as mudanças com testes e métricas verificadas. Produção exige: Worker abaixo do teto, comparação completa de bundle sem crescimento, conciliação da diferença de checkpoints contra main, Lighthouse móvel aprovado, campanha gráfica nativa nas GPUs exigidas e todos os jobs obrigatórios no SHA final. O PR permanece em rascunho; não houve merge nem publicação manual de produção.

## Integração concorrente e validação atualizada

Enquanto esta continuação era preparada, main avançou para `3ff919283456d0409a8cf922baaef85428d2561c` e o PR recebeu o merge `8ba54d9c`. A integração preservou ambos os trabalhos por merge normal. Os conflitos ocorreram somente em package.json, package-lock.json e bun.lock: mantidas as novas overrides de segurança, inclusive undici do Wrangler; Zod fixado em 4.6.7, com locks regenerados. A árvore de código integrada foi enviada em `e67e4d4846be6dbbcae32e4121e779f13206d80f`.

Após integrar: **2.053 testes em 378 arquivos aprovados**, tipos e lint aprovados, auditoria de produção ainda zero. O replay de stress de 200 seeds já havia passado nesta continuação; a simulação permanece igual após o merge de arquivos de shell/dependências.

Builds novos da árvore integrada e do main atual, com as mesmas dependências instaladas:

| Métrica               |             main 3ff91928 | Candidato integrado | Estado                  |
| --------------------- | ------------------------: | ------------------: | ----------------------- |
| JS total gzip         |               2.284.920 B |         2.360.740 B | +3,32%, reprovado       |
| JS total Brotli Q6    |               2.156.442 B |         2.234.214 B | +3,61%, reprovado       |
| Match 3D startup gzip |                 556,8 KiB |           583,0 KiB | Reprovado               |
| Worker estático       | referência anterior ao PR |           119.288 B | Ainda acima de 90.000 B |

A alteração concorrente do shell melhorou algumas transferências e CSS; esse efeito pertence à integração de main, não ao batching desta continuação. Os números pré-integração e pós-integração são mantidos separados.

CI integrado, run **40048130622**: auditoria de produção, contrato 3D e compressão aprovados. Formatação Rust e seus **21 testes** aprovados. O benchmark de CPU contra main registrou 0,201883 → 0,1253035 ms (**−37,93%**), IC 99% da razão [0,618053; 0,626911]; continuou reprovado exclusivamente por checkpoints distintos. A comparação de bundle também continuou reprovada. Demais jobs devem ser conferidos no SHA final.

O build Rust avançou além da formatação e encontrou um novo problema de empacotamento: wasm-pack detectou o Binaryen instalado e tentou otimizar todos os arquivos .wasm do diretório de saída, incluindo seat-transforms.wasm, de memória compartilhada, sem a flag de threads. O script passa a usar `wasm-pack --no-opt` e entrega a pós-otimização ao Binaryen fixado, aplicado especificamente a crowd_visibility_wasm_bg.wasm. Mantém compilação release Rust, controle de ABI, limite de tamanho e a otimização -Oz. Seat-transforms é preservado. Verificação local: script e lint aprovados, otimização estável em **62.919 bytes**, **88 testes WASM em 16 arquivos** aprovados. Reconstrução completa e paridade do binário novo dependem do CI com toolchain Rust.

Captura suplementar pré-integração, sem stress simultâneo: pico observado **289 draws**, média 163,82, frame médio 681,82 ms e p95 1.869 ms em SwiftShader. Não demonstra redução do pior frame em relação aos 280 da entrega anterior. A captura intermediária sob stress chegou a 290 e é mantida apenas como diagnóstico, sem comparação de tempo por frame. Novas capturas da referência e da árvore integrada, executadas em série com dependências iguais, acompanham o relatório visual complementar. Nenhuma dessas execuções curtas substitui a campanha em GPU física.
