# HTTP e Sysbench CPU: verificação real de 28/10/2026

## Alterações efetivamente aplicadas ao VPS
- Nginx 1.24.0, gateway `catalog.jogomanager.com`.
- Alterado `listen 443 ssl;` para `listen 443 ssl http2;` exclusivamente no
  listener público de catálogo. `nginx -t` e reload concluídos sem reiniciar
  os contêineres.
- HTTP/2 confirmado diretamente contra o origin:
  `curl -ksS --http2 -w 'http=%{http_version} status=%{http_code}' ...`
  retornou **http=2, status=200**.
- Requisição com cabeçalho Authorization sintético rejeitada com **400**.
- Os três containers de gateway, Redis, worker e ponte Supabase continuaram
  saudáveis após as mudanças.
- Backup anterior ao upgrade HTTP/2:
  `/etc/nginx/conf.d/pfm-catalog.conf.pre-h2-20261028T180315Z.bak`.
- Script de aplicação fail-closed/rollback preservado em
  `services/contabo-aux/perf/enable-http2-origin-20261028.py`.

## Compressão HTTP
- Endpoint público `/v1/public/crests?limit=1000`, HTTP/2 no localhost:
  86.710 bytes sem Accept-Encoding; **5.507 bytes** com gzip (93,65% menos).
- O gzip já estava configurado anteriormente. Este resultado **verifica**
  seu funcionamento; não é um ganho atribuível à habilitação do HTTP/2.
- A primeira requisição não comprimida ocorreu com cache frio, a compactada
  com cache quente. Não comparar o tempo das duas como ganho de latência.

## Benchmarks reais de HTTP, 16 conexões, wrk com 2 threads, HTTPS loopback

| Amostra | Duração | Req/s | p99 | Observações |
|---|---:|---:|---:|---|
| Antes de habilitar HTTP/2 | 8s | 8.024,80 | 890,88 ms | wrk HTTP/1.1 |
| Após habilitar HTTP/2 | 8s | 15.590,89 | 145,95 ms | wrk ainda HTTP/1.1 |
| Antes de testar stale-while-revalidate | 18s | 13.841,39 | 40,05 ms | Cache normal |
| Com stale-while-revalidate | 18s | 6.020,93 | 111,54 ms | Teste rejeitado |
| Após reverter stale-while-revalidate | 18s | 5.440,59 | 235,84 ms | Ambiente variável |
| Verificação final sem gzip | 8s | 3.984,57 | 139,74 ms | Cache normal, HTTP/1.1 |
| Verificação final com gzip | 8s | 8.035,46 | 129,14 ms | Header Accept-Encoding:gzip |

**Interpretação:** grande dispersão de desempenho entre execuções no VPS
compartilhado. Em particular, o `wrk` utiliza HTTP/1.1, portanto **não
demonstra ganho causado pelo HTTP/2**. HTTP/2 foi validado funcionalmente,
e tem potencial de multiplexação com clientes que o suportam.

O experimento de `proxy_cache_background_update` não teve ganho claro;
a configuração foi **revertida** para o backup
`/etc/nginx/conf.d/pfm-catalog.conf.pre-swr-20261028T180936Z.bak`.
Seu script não foi publicado como solução. O HTTP/2 permanece habilitado.
Os servidores-canário temporários 19446 e 19447 foram removidos, e
`nginx -t` validou a configuração final.

**Não foi comprovada a meta de 59.948 req/s**. A rota cacheada fica muito
abaixo desse número na maioria dos testes e não se deve confundir desempenho
no loopback com capacidade do backend com banco/autenticação/persistência.

## CPU: TODOS os núcleos disponíveis
- VPS KVM com exatamente **8 CPUs lógicas**, `nproc=8` e
  `os.sched_getaffinity(0)={0,1,2,3,4,5,6,7}`.
- Já não havia nenhuma limitação de afinidade a remover. Não é possível
  habilitar 16 threads físicos por software se o hipervisor apresenta apenas
  oito processadores lógicos.
- Rodado `taskset -c 0,1,2,3,4,5,6,7 sysbench cpu --threads=8 --time=6
  --cpu-max-prime=20000 run` 3 vezes. Script reprodutível em
  `services/contabo-aux/perf/benchmark-all-vcpus-20261028.py`.
- Resultados **3.590,14; 3.462,70; 3.163,45** eventos/s;
  **mediana 3.462,70 eventos/s**.
- A primeira referência histórica de aproximadamente 3.303 eventos/s
  (20.000 primos, 8 threads) é 4,84% menor que a mediana atual, mas a
  duração e a carga desse teste inicial não foram controladas.
- Em rodada separada com 16 threads sobre apenas 8 vCPU, medido
  3.456,70 eventos/s e p95 8,74 ms. Isso **não** criou novos cores:
  o desempenho é similar e piorou a latência frente às amostras de 8 threads.
- Outra medição com 8 threads, apenas 10.000 primos e 3 segundos produziu
  8.793,11 eventos/s. **Não comparar diretamente** com primos=20.000.
- **Meta 39.484 eventos/s não alcançada** no mesmo workload.

Nenhuma alteração global arriscada foi feita em quotas de CPU, governor,
afinidade do jogo, cgroups, SSH, Auth ou serviços de compra.
