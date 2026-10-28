# JogoManager: cache público e compressão (27/10/2026)

**Situação:** código preparado para revisão; não é prova de deploy ou ganho em produção.

O protocolo anterior do serviço auxiliar está preservado em
[`README-auxiliar-20261025.md`](README-auxiliar-20261025.md), para manter seu contexto histórico.

## Observações medidas, não projeções

- O endpoint existente `127.0.0.1:3092/v1/public/clubs?limit=50` produziu **5.318 bytes JSON brutos**. O mesmo corpo teve **896 B com gzip -1**, **858 B com gzip -6** e **851 B com gzip -9**. O Nginx de produção serviu **893 B HTTP body** ao cliente com `Accept-Encoding:gzip` (HTTP 200). Isso não inclui bytes de TLS/rede.
- O Supabase contém **38.854 clubes** e **33.112 escudos não nulos**. O cliente opcional antigo usava `PAGE_SIZE=100`, `MAX_PAGES=72` e falhava por limite em um catálogo completo. A versão proposta usa páginas de 1.000 e teto de 48.000 registros, descartando qualquer resposta incompleta.
- A amostragem SQL das 39 páginas do catálogo atual com `id,name,crest_url` produziu entre **84.283 B e 115.821 B** por página, média **107.631 B**. Está dentro do limite atual por item de 160 KiB, sem expandir RAM ou liberar dados privados.
- A projeção dedicada `/v1/public/crests` usa somente `id,crest_url`, enquanto a rota legada `/v1/public/clubs` continua oferecendo `id,name,crest_url`. Na primeira página, os JSONs estimados foram 89.712 vs 114.392 bytes, uma redução bruta de cerca de 21,6% sem truncamento. As 39 páginas úteis, em lotes paralelos de seis, implicam até **42 requisições** para detectar o último lote. A versão anterior precisaria de pelo menos 389 requisições para esses 38.854 registros, mas descartava o catálogo no máximo 72. Isso é uma redução projetada de requisições para catálogo **após** upgrade do gateway, não é um throughput medido.
- Os últimos benchmarks separados relatados anteriormente: VPS HTTPS estático **51.349,93 req/s** mediana; VPS com cache Node em produção **7.348,22 req/s** mediana; Sysbench `cpu --cpu-max-prime=20000 --threads=8` **2.956,42 eventos/s** mediana. São cargas diferentes e não representam ponta a ponta.

## Proteções e conteúdo deste PR

- `src/lib/vps-public-catalog.server.ts` e teste: paginação de 1.000 com limite de 48.000, mantendo validação de identificadores/URLs, rejeição de respostas truncadas, origens fixas HTTPS e nenhuma transmissão de cookies/JWT.
- `gateway-paging-upgrade.mjs`: valida trechos exatos do gateway legado no Contabo e gera backup antes de **qualquer** alteração. Por padrão, apenas `--check`; `--apply` exige `JM_APPROVE_CATALOG_PAGING=YES`. Não reinicia contêineres automaticamente. Além do limite 1.000, limita `page * limit <= 50.000` para não permitir offsets absurdos ao Supabase. Acrescenta a nova rota `/v1/public/crests` com projeção mínima e chaves de cache separadas das de `/clubs`.
- `nginx-public-only-canary.conf`: dois servidores independentes, **somente em loopback**, `19444` sem edge cache e `19445` com cache de 15 segundos. Ambos contêm apenas GET público, bloqueiam Auth/Cookie/keys, desabilitam rotas privadas e usam gzip nível 2 para comparação justa.
- `benchmark-local-cache-vs-proxy.sh`: 3 × 6 s para cada um dos dois endpoints, hash do conteúdo descomprimido para verificar equivalência, negativas de Auth/Cookie/POST/rotas privadas, depois 3 × Sysbench CPU 8 threads. Requer `JM_PERF_CANARY=YES`. Executar somente com carga isolada e acompanhamento da saúde do host.

## Pré-requisitos para ativação

1. Revisar PR, executar `node --test services/contabo-aux/perf/gateway-paging-upgrade.test.mjs`, `npx vitest run src/lib/vps-public-catalog.server.test.ts`, TypeScript, lint e build.
2. Enviar os arquivos para staging controlado. **Não** executar `curl | sh`, não publicar chaves, não abrir portas à internet. Criar pasta de cache com permissões apropriadas e habilitar config **local**, verificar `nginx -t`.
3. Validar `--check` no gateway, simular alteração numa cópia, fazer backup, testar Node `--check`, e somente depois alterar gateway com revisão e reiniciar uma réplica canário. Autorização do usuário não substitui rollback.
4. Testar conteúdo real completo, igualdade do hash e contagem 38.854, chaves públicas ausentes do JSON, `cache MISS/HIT`, TTL e rejeição de requisições autenticadas; depois carga graduada e medição CPU, p95/p99, erros, memória e upstream.
5. Ativar `VPS_CATALOG_ENABLED=1` somente em servidor canário, mantendo caminho Supabase direto como fallback. Desativar imediatamente diante de divergência ou aumento de erro. Confirme a duração do cache no navegador e a invalidação quando os dados mudarem.

## Comparação de compressão

Gzip já economiza mais de 83% dos bytes JSON do catálogo de 50 clubes. Subir `gzip_comp_level` de 2 para 9 pode economizar alguns bytes, mas custa CPU em cada resposta. Não há suporte Brotli carregado no Nginx inspecionado. Portanto, a prioridade é **evitar repetição do trabalho** com caching isolado e projeções menores, não aumentar cegamente a compressão.

## Otimização SQL adicional identificada

Na produção, `EXPLAIN (ANALYZE, BUFFERS)` da última página com `LIMIT 1000 OFFSET 38000` levou **420,29 ms** e fez index scan em 38.854 linhas; a comparação **pontual**, com cursor já conhecido (`WHERE id >= <last-page-cursor>`), levou **5,086 ms** e percorreu apenas os 854 registros restantes. **Não dividir esses tempos para prometer ganho 82x**: estado de cache e custo de obtenção do cursor diferem. O uso de offsets grandes continua como gargalo mesmo com menos páginas. Próxima versão precisa de snapshot de cursores e/ou paginação `id > cursor`, com testes de paridade, mudança de catálogo entre páginas e fallback integral. Nenhum índice novo foi instalado.

## Pendências fora deste PR

- Terceira camada real (VPS + Auth/RLS + compras Stripe em test mode + persistência): staging sintético com métricas comparáveis, sem dados ou cobranças de produção.
- Perfil de simulador offline, determinismo e multiplayer real; Auth e banco transacional não podem ser colocados no cache público.
- Avisos Supabase: Auth limitado a 10 conexões, 62 índices sem uso declarado, avisos de GraphQL e função SECURITY DEFINER; verificar políticas e planos antes de qualquer mudança.
- 390 mil req/s, 120 mil eventos/s Sysbench, +1.290% por operação: **não atingidos** e não inferíveis da compressão.

## Rollback

Desabilitar flag no servidor; desabilitar apenas o canário Nginx e validar `nginx -t`; restaurar `gateway.mjs` do backup criado pelo aplicador e validar `node --check` antes da restauração dos contêineres. Nenhuma migração SQL nem alteração de Stripe é necessária por este PR.
