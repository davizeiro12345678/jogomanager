# Startup, CSS e validação do PR #65

Esta proposta altera código e migrações versionadas. Publicação depende de todos os Quality gates. Este documento contém apenas evidência do código e de builds locais; auditorias de ambientes e dados ficam fora do repositório público.

## Comportamento

- Heads de rotas privadas aguardam o catálogo de metadados sob demanda, preservando canonical e noindex. As páginas públicas deixam de carregar esse catálogo no startup.
- O link da comunidade e sua constante compartilham uma entrada pequena; a seção editorial continua separada.
- O bootstrap de fontes aguarda o carregamento dos recursos críticos e conserva o fallback do sistema.
- CSS de cutscenes/HUD é carregado com o jogo. O stylesheet completo compilado permanece idêntico byte a byte ao da base.
- O CSS público compilado passa de 59.437 para 57.446 bytes; gzip nível 9, de 11.817 para 11.389 bytes. A geração Tailwind inclui explicitamente o novo componente DiscordLink.
- As migrações adicionam contratos explícitos de grants para objetos futuros, um índice de busca e um reparo de vínculos com correspondências estritas e registro para reversão. O teste SQL deve rodar somente no banco descartável do replay.
- body-parser 2.4.0 e zod 4.6.6 corrigem os avisos altos GHSA-27r3-jxmh-p828 e GHSA-mrhx-c7xc-m3w5. fast-uri 3.1.9 e Undici 7.30.1 (no ramo de Wrangler) corrigem os avisos moderados da cadeia de ferramentas. Os dois lockfiles foram regenerados pelos respectivos gerenciadores. Nenhuma dependência de produto foi adicionada.

- A projeção pública das ligas normaliza o objeto de classificação e a lista legada de um item, preservando a seleção da temporada e a remoção de campos do provedor. Testes cobrem os dois formatos, cache, concorrência e entradas ausentes/malformadas.

## Comparação auxiliar

Node 24.22.0; mesma máquina, dependências instaladas, configurações e PFM_BUILD_SHA nos dois builds; saídas anteriores arquivadas antes do build limpo. Base main 66f55eab558edb41a6f2d79482d1ac6ed69ed163, candidata com as alterações deste PR. A identidade igualada serve ao protocolo local e não representa uma release publicada. CI deve repetir a comparação entre os SHAs reais.

Valores de transporte estimado, não LCP, INP ou FPS. O total inclui chunks lazy.

| Métrica | Antes | Depois | Redução |
|---|---:|---:|---:|
| JS emitido total (inclui lazy) | 6819.9 KiB | 6814.4 KiB | 0.08% |
| JS emitido total (gzip) | 2232.4 KiB | 2230.7 KiB | 0.08% |
| JS emitido total (Brotli Q6) | 2106.9 KiB | 2105.3 KiB | 0.08% |
| Página inicial startup (gzip) | 167.2 KiB | 163.7 KiB | 2.10% |
| Página inicial startup (Brotli Q6) | 158.5 KiB | 155.2 KiB | 2.08% |
| Nova carreira startup (gzip) | 430.3 KiB | 428.5 KiB | 0.42% |
| Nova carreira startup (Brotli Q6) | 406.8 KiB | 405.1 KiB | 0.41% |
| Partida rápida startup (gzip) | 297.5 KiB | 295.7 KiB | 0.60% |
| Partida rápida startup (Brotli Q6) | 281.9 KiB | 280.2 KiB | 0.60% |
| Match 3D startup (gzip) | 559.0 KiB | 556.8 KiB | 0.39% |
| Match 3D startup (Brotli Q6) | 528.7 KiB | 526.6 KiB | 0.39% |
| Palco cinematográfico startup (gzip) | 524.3 KiB | 524.0 KiB | 0.05% |
| Palco cinematográfico startup (Brotli Q6) | 492.1 KiB | 491.8 KiB | 0.05% |
| Editor startup (gzip) | 174.6 KiB | 174.3 KiB | 0.17% |
| Editor startup (Brotli Q6) | 165.5 KiB | 165.3 KiB | 0.16% |
| Simulação Worker startup (gzip) | 27.8 KiB | 27.8 KiB | 0.00% |
| Simulação Worker startup (Brotli Q6) | 26.7 KiB | 26.7 KiB | 0.00% |


A comparação estrita local e o orçamento absoluto passaram. Nenhum limite foi alterado.

## Verificações

- Build limpo, lint sem erros/avisos, tipos e histórico de migrações passaram localmente.
- Suíte anterior à última mudança de head assíncrono: 262 arquivos / 1.411 testes aprovados; após essa mudança: 17 testes focados aprovados.
- Quatro testes do bootstrap de fontes e 12 testes do mecanismo de gates passaram; estes últimos não equivalem à execução dos gates reais.
- npm audit completo, incluindo desenvolvimento, reportou zero vulnerabilidades após os quatro patches. A consulta é um retrato da base de avisos.
- O preview Cloudflare local foi impedido por restrição de interfaces de rede do ambiente; não há certificação visual/Lighthouse local desta revisão.
- Replay nativo PostgreSQL, stress de 200 partidas com replays, MatchSim ABBA, graphics, comparação de bundles e Lighthouse desktop/mobile continuam obrigatórios no CI.
- Não se declara ganho de produção antes de publicar uma revisão aprovada e comparar a mesma carga.

Referências públicas:
- https://github.com/advisories/GHSA-27r3-jxmh-p828
- https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
- https://npmscan.com/package/body-parser
- https://npmscan.com/package/zod

## CI da revisão de5a5bd

Comparação de bundle, replay nativo de migrações/contratos de acesso, 200 partidas e replays, MatchSim ABBA, gráficos, assets, WASM e Lighthouse desktop passaram. Build/types/tests parou em formatação de um teste, corrigida nesta atualização. O Lighthouse mobile continuou reprovado pelos limites existentes de performance/LCP/TBT; a publicação permanece bloqueada. A revisão atual deve executar novamente todos os checks, sem reaproveitar aprovação de outro SHA.
