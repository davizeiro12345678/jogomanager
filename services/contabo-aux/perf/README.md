# Contabo: benchmark separado e canário de cache público

Status em 27/10/2026: **somente preparação em PR de infraestrutura; nenhum deploy deste diretório foi feito no VPS**.

## Resultados observados anteriormente no VPS

- VPS puro, Nginx HTTPS loopback com catálogo público fixo (50 clubes): **51.349,93 req/s**, mediana de três amostras de 8 s (6 threads/128 conexões).
- VPS com cache de catálogo em produção (Nginx -> três gateways Node, TTL 300 s): **7.348,22 req/s**, mediana das mesmas três amostras. p99 mediano **182,01 ms**, CPU VPS **78,74%** na janela, CPU steal **0,000%**.
- Sysbench CPU 8 threads, prime 20000: **2.956,42 eventos/s**, mediana de três amostras de 6 s.
- Um **único teste adicional** de 5 s no mesmo VPS atingiu 2.509,26 eventos/s. Não substituir a mediana pelo resultado isolado.
- O banco Supabase usa PostgreSQL 17, região us-west-2; consulta read-only observou hit rate **90,77%**, mas esse contador é acumulado. **CPU do Supabase não foi medida diretamente**.
- Nenhum teste equivale a 390 mil requisições/s de ponta a ponta, 120 mil eventos Sysbench/s, ou +1.290% na latência/throughput de saves, compras, Auth e partidas.

## Arquivos deste diretório

1. `nginx-public-cache-canary.conf`: configuração Nginx isolada em `127.0.0.1:19445`. SOMENTE GET de `/v1/public/clubs`. Rejeita `Authorization`, `Cookie`, `X-API-Key`, `X-PFM-Event-Token` e outros métodos; não cria endpoints públicos nem cache de identidades.
2. `bench-isolated-three-layers.sh`: testes de throughput do canário VPS puro e do canário com cache, mais Sysbench CPU 8 threads, em séries controladas. Exige `JM_BENCH_ISOLATED=YES`; recusa alvos diferentes de loopback; usa 3 × 5 s por cenário. A terceira camada ainda NÃO é automatizada, pois requer test identities/pagamentos sintéticos.

**Validação local**, não no Contabo: Nginx `-t` aprovado; 8/8 testes funcionais contra backend fictício aprovados (MISS, HIT, isolamento de cabeçalhos, POST e rota privada). Não interpretar como medição de throughput no VPS.

## Protocolo seguro para a terceira camada

Usar staging isolado com projeto Supabase de teste, contas sintéticas, Stripe em **test mode**, fila Redis privada e worker de partida sem prêmios. Comparar operações idênticas e dados do mesmo tamanho, seed de partida fixa e concorrência declarada, sempre com warm-up, 3+ amostras e p50/p95/p99. Para saves, exigir CAS e revision id monotônico. Para compras, exigir webhook assinado, idempotência e conciliação, sem tocar em pagamentos reais. Para partidas, validar autorização de sala, HMAC, persistência, retries, deduplicação, replay determinístico, atraso, desconexão e reconexão.

Coletar no mesmo intervalo: CPU e CPU steal, PSI, memória RSS e cache, NIC, erros 4xx/5xx, Nginx, p95/p99, contêineres, locks e conexões Postgres, Redis fila/lag, métricas oficiais de CPU/RAM do Supabase via Dashboard Reports/Metrics API. O SQL de `pg_stat_database` **não** substitui CPU real do Supabase.

## Rollout e rollback

Não copiar/ativar o canário automaticamente. Ao preparar um host de teste, criar primeiro o diretório root-owned com gravação permitida para o worker Nginx, revisar Nginx `-t`, confirmar bind somente em loopback e verificar `curl` autenticado retorna 400 (sem servir HIT), POST 405 e rota privada 404. Testar origem de 50 clubes e comparação de hashes; verificar somente GET 200 pode ser cacheado. Fazer medições com carga crescente fora de horário de pico e comparar antes/depois sob condições equivalentes.

Somente considerar ativação do cache de borda após revisão independente de segurança e de invalidação. Rollback do canário: remover **apenas** o arquivo incluído deste canário e recarregar Nginx após `nginx -t`; nunca remover a configuração principal do catálogo.

## Interpretação das metas

A meta de 390.000 req/s não foi atingida: 51.349,93 req/s equivale a 13,17% da meta (VPS puro) e 7.348,22 req/s equivale a 1,88% (gateway cache). 120.000 eventos/s no Sysbench exigiriam 40,59× a mediana medida mantendo o mesmo trabalho; mudar `cpu-max-prime` não é uma otimização legítima. +1.290% mais rápido significa 13,9× a taxa original, não 12,9×.

Rastreio: GitHub issue #75, PR #68. Não contém segredos de acesso.
