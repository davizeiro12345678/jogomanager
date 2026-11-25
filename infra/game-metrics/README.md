# Telemetria de cache, requisições e cliques do VPS

Este módulo está implantado em `/srv/jogomanager/game-metrics` na Contabo. Exibe métricas Prometheus internas das três réplicas do gateway público.

## Segurança e privacidade

- A única porta de escuta é **9199 dentro das redes Docker** `monitoring_monitoring` e `public-gateway_default`. Não há mapeamento de porta pública.
- O exporter faz GET apenas dos três endereços estáticos internos `/metrics`; não recebe parâmetros de URL nem segredos.
- Os nomes de eventos são uma lista fixa: `open_club`, `open_market`, `open_career`, `start_match`, `open_dashboard`; não são coletados IDs, IPs ou payloads de cliques.
- O endpoint existente `POST /v1/events/click` do gateway exige um token privado `x-pfm-event-token` e `consent: true`. **Nunca** expor o token ao navegador.
- A instrumentação do frontend e o encaminhamento por um servidor de confiança **ainda não estão ativados**. O exporter observa contadores reais e não inventa cliques.
- Contadores do gateway reiniciam quando cada réplica reinicia. O Prometheus reconhece esse reset e guarda séries por sete dias.

## Deploy e verificação

Executar a partir de uma cópia controlada da pasta `infra/game-metrics`, após conferir os nomes externos das redes.

1. `docker compose -f compose.yaml config --quiet`.
2. `node --check server.mjs` (ou Node em um contêiner de teste sem rede).
3. `docker compose -f compose.yaml up -d --no-deps game-metrics`.
4. Confirmar que `pfm-game-metrics-exporter` não publica portas e possui usuário sem privilégios, rootfs read-only e limites de 64 MiB / 0,25 vCPU.
5. Mesclar a entrada `game-cache-clicks` da versão de `prometheus.yml` fornecida **no arquivo de monitoramento do VPS**, guardando backup.
6. `docker exec monitoring-prometheus-1 promtool check config /etc/prometheus/prometheus.yml`.
7. Recarregar sem recriar o Prometheus: `docker kill --signal=HUP monitoring-prometheus-1`.
8. Consultar `sum(pfm_gateway_up)` no Prometheus. Três réplicas saudáveis dão resultado 3.

## Principais métricas

`pfm_gateway_requests_total`, `pfm_gateway_cache_hits_total`, `pfm_gateway_cache_misses_total`, `pfm_gateway_cache_hit_ratio`, `pfm_gateway_upstream_requests_total`, `pfm_gateway_upstream_errors_total`, `pfm_gateway_events_accepted_total`, `pfm_gateway_events_rejected_total` e `pfm_gateway_click_events_total{event=...}`. O estado de cada réplica aparece em `pfm_gateway_up{gateway=...}`.

Os dados internos de `/metrics` dos gateways já existiam. Este componente conecta esses contadores ao histórico Prometheus, mantendo cardinalidade e memória limitadas. Não substitui a autenticação do jogo, a fila Redis, as regras RLS, os resultados oficiais de partidas ou a telemetria de usuário com consentimento.

## Reversão

Remover apenas este exporter via `docker compose -f compose.yaml down`; restaurar o arquivo original de Prometheus a partir do backup do operador e recarregar o processo com HUP. O resto da infraestrutura continua funcionando sem o exporter.

## Verificação aplicada no VPS (27/10/2026)

O código passou em `node --check`, o Compose passou em `docker compose config --quiet`, o Prometheus passou em `promtool check config` e seu alvo `game-cache-clicks` apresentou `health=up`. Foram detectados 3/3 gateways saudáveis, sem publicar portas. O exporter consumia aproximadamente 19–24 MiB de RAM nas verificações, respeitando o limite de 64 MiB.
