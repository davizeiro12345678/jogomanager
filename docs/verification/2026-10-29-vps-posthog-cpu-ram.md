# Auditoria CPU/RAM do VPS e PostHog — 2026-10-29

## Escopo, evidência e estado de implantação

- **VPS Contabo:** sem conexão remota durante esta auditoria. O Remote Desktop
  Commander reportou a máquina autorizada offline há ~16 horas, e o SentinelX
  confirmou o agente da mesma máquina offline. O Datadog não retornou hosts.
  Não há leitura atual de CPU, RSS, PSI, quota de cgroup, CPU steal, OOM,
  swap, Redis ou Docker. **Nenhum ajuste no host pode ser considerado
  implantado ou medido neste ciclo.**
- Para preparar a análise sem arriscar desligar o jogo, o script de leitura
  `scripts/diagnose-vps-cpu-ram.sh` coleta topologia, afinidade, PSI de CPU,
  memória e I/O, `free`, `vmstat`, processos de maior RSS/CPU,
  `docker stats` e limites de todos os contêineres. Não altera configurações.
  Validado sintaticamente com `bash -n`.
- Histórico anterior, **não uma medição atual**: 8 vCPUs, cerca de 24 GiB
  de RAM, host com aproximadamente 1,3 GiB usado em amostras anteriores.
  Esses números não permitem declarar gargalo de memória em 29/10.

## PostHog — diagnóstico direto, projeto ativo

Conector PostHog (timezone UTC), consulta dos últimos 7 dias:

| Evento | Ocorrências |
| --- | ---: |
| `$pageview` | 99 |
| `ad_impression` | 98 |
| `$pageleave` | 60 |
| `ad_click` | 5 |
| `ad_dismiss` | 2 |

- As 99 pageviews contêm `jogomanager.com` (98) e
  `www.jogomanager.com` (1); eventos e `$host` foram confirmados no schema.
  Valores **não** equivalem a demanda total do VPS, pois parte do tráfego
  não chega ao PostHog (consentimento e bloqueadores).
- Error Tracking: **zero issues ativos com ocorrências nos últimos 7 dias**.
- Saúde: 2 avisos ativos, ambos `warning`, não `critical`:
  `reverse_proxy` (ausência de proxy de ingestão) e `authorized_urls`
  (lista de domínios autorizados vazia).
- O SDK no app é inicializado no **navegador**, após consentimento e tempo
  ocioso, com `autocapture: false` e `disable_session_recording: true`.
  **Não há evidência de que o PostHog esteja consumindo CPU/RAM do VPS.**
  O custo mais próximo do SDK é tráfego de rede e inicialização no cliente.

## Correção efetiva de infraestrutura PostHog fora do VPS

- Criado proxy gerenciado no PostHog para `e.jogomanager.com`.
- CNAME Cloudflare criado e **verificado**:
  `e.jogomanager.com` -> `e70d2182f1e71c961632.cf-prod-us-proxy.proxyhog.com`,
  `proxied=false` (DNS-only; evitar proxy duplo).
- No último teste o proxy estava com status **`waiting`**, ainda aguardando
  verificação do DNS/SSL. Portanto **o aplicativo ainda não foi direcionado**
  a esse hostname e o aviso não foi declarado resolvido.
- O branch deste PR aceita `VITE_POSTHOG_PROXY_HOST=https://e.jogomanager.com`
  **apenas como opção explícita de rollout depois do HTTPS estar pronto**.
  Sem essa variável, continua usando o PostHog US original. Quando proxy
  está ativo, configura `ui_host=https://us.posthog.com`.

## Otimizações de código neste PR

1. Inicialização **singleflight** do PostHog: chamadas concorrentes
   compartilham a Promise e evitam carregar/inicializar o mesmo SDK duas
   vezes ou retornar `null` só porque outra inicialização está em andamento.
2. Consentimento revalidado após download assíncrono do SDK e preservadas
   as salvaguardas de revogação.
3. **Não carregar o Firebase Analytics em navegadores que nunca consentiram**.
   O código antigo importava seu bundle apenas para solicitar a desativação
   mesmo sem nunca tê-lo inicializado.
4. No consentimento ativo, **evitar imports repetidos do Firebase Analytics**
   em múltiplos eventos `consent-changed`.
5. Teste `src/lib/analytics.test.ts`: inicialização concorrente, rota de
   proxy protegida por ambiente, revogação e reconsentimento.

As mudanças de código são da branch do PR #96, **não uma publicação de
frontend**. Aguardar testes CI e estado HTTPS pronto antes de habilitar a
variável de proxy em produção.

## Aviso de URLs autorizadas

O PostHog recomenda adicionar domínios em `app_urls`, mas isso permite
redirecionamentos autorizados pela toolbar. O host observado em eventos
pode ser falsificado por terceiros que conheçam o token público. Por
segurança, a lista **não foi modificada sem confirmação explícita
dos domínios a autorizar**.

Referências: https://posthog.com/docs/advanced/proxy e
https://posthog.com/docs/libraries/js/config

## Próximas validações técnicas, quando houver conexão ao VPS

1. Executar `bash scripts/diagnose-vps-cpu-ram.sh` no VPS, sem sudo.
2. Identificar processo/contêiner responsável pelos picos de CPU, RAM,
   pressão de memória, swap e `cpu.max`/cpuset antes de mudar quotas.
3. Comparar `sysbench cpu --threads=8 --cpu-max-prime=20000` com o mesmo
   tempo e afinidade do benchmark anterior e medir `wrk` com e sem cache.
4. Corrigir somente os gargalos confirmados e fazer rollback se p95, OOM,
   timeouts, login ou compras regredirem.
