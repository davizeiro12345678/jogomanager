# Diagnóstico de CPU, RAM e PostHog | 28/10/2026

## Escopo e origem das medições
Medições diretamente no VPS `vmi3695183` por SSH e no projeto PostHog 603692.
Este é um retrato **fora de um teste de carga**; não prova ausência de
gargalos em picos. Não confundir recursos do VPS com uso de CPU/RAM do
navegador e com os servidores hospedados pela PostHog.

## VPS: CPU e RAM
- Oito processadores lógicos visíveis; `cpuset.cpus.effective=0-7`.
- Memória física: **24.031 MiB**; usada **1.593 MiB**;
  disponível **22.438 MiB** (93,4%).
- `vmstat 1 4` fora de carga: CPU ociosa cerca de 90%-100%,
  `wa=0`, `st=0`; `loadavg` inicial 0,56/0,50/0,87.
- PSI CPU: `avg10=0,40%`, `avg60=1,09%`, `avg300=1,72%`;
  PSI memória `avg10=avg60=avg300=0`, PSI I/O quase zero.
- `/sys/fs/cgroup/cpu.stat`: `nr_throttled=0`,
  `throttled_usec=0`; sem restrição de throttling observada.
- `vm.overcommit_memory=1` (adequado a Redis), THP em `madvise`,
  `net.core.somaxconn=8192`. **Nenhuma alteração de kernel necessária**.
- Disco virtual ~290 GiB utilizáveis; uso de ~13 GiB (5%).
- Swap=0; com 22+ GiB disponíveis e PSI memória=0,
  ativar swap/zram não teria benefício de velocidade comprovado.
- Gateway Node triplo: **54,11 / 48,78 / 54,63 MiB** cada,
  com limites de 192 MiB; sem indício de OOM nessa coleta.
- Match worker: **105,1 MiB/768 MiB**; autenticação bridge:
  **47,04 MiB/128 MiB**; Redis queue **8,27 MiB/384 MiB**;
  Prometheus **37,41 MiB/384 MiB**.
- Processo host que pode ser dispensável em VPS headless:
  fwupd ~47 MiB RSS, multipathd ~27 MiB,
  ModemManager ~13 MiB, udisksd ~14 MiB.
  **Não foram desativados**: tentativa operacional bloqueada pelo
  controle de segurança remoto; não declarar economia sem medição.
- AIDE: duas unidades de verificação apresentaram status failed.
  O log do AIDE crítico lista explicitamente alterações e backups
  Nginx recentes, compatíveis com publicações autorizadas. Não atualizar
  a baseline AIDE automaticamente sem auditoria de integridade.
  `dailyaidecheck` também reclamou da ausência de `mail/s-nail`.

**Conclusão:** CPU e RAM **não estão saturadas no repouso**. Alterar
quotas/cgroup, matar caches Linux, mudar kernel governor virtual ou reduzir
memória dos contêineres neste estado não é otimização baseada em evidência.
Para detectar um gargalo em carga, repetir uma carga de jogo real enquanto
amostra CPU steal, RSS/heap, CPU por processo, eventos/s e p95/p99.

## PostHog: achados do projeto ativo
- Projeto: `Default project`, ID 603692, região US; condiz
  com a configuração US em `.env` do repositório.
- Eventos nas últimas 24 h: `ad_impression` 69,
  `$pageview` 38, `$pageleave` 23, `ad_click` 3,
  `ad_dismiss` 1 (**134 no total**). Exploração não canônica.
- Pageviews nos últimos sete dias: `jogomanager.com` 91,
  `www.jogomanager.com` 2. Domínios descobertos em eventos
  **não autorizam automaticamente** inclusão em `app_urls`.
- Nenhum span APM observado nas últimas 24 h, nenhum serviço
  no resumo de logs, nenhuma issue ativa de Error Tracking nos
  sete dias analisados.
- Os eventos `$web_vitals` e `$exception` **não foram observados
  nos últimos 30 dias**. Isso é ausência de instrumentação utilizável,
  não evidência de desempenho saudável.
- Health checks: **2 warnings ativos**.
  1. `reverse_proxy`: não há ingress de primeira parte;
     dados podem ser bloqueados por filtros de rastreamento.
  2. `authorized_urls`: allowlist de URLs vazia;
     pode impedir recursos de filtragem e toolbar.
- `session_recording_opt_in=false`: replay não impõe custo atualmente.
  `capture_console_log_opt_in=true`, mas isso sozinho não comprova
  coleta de logs nem impacto na CPU.

## Correção proposta no código (este PR)
Arquivo `src/lib/analytics.ts`:
1. Evita inicializar o Firebase repetidamente quando a callback do
   consentimento e o carregamento ocioso ocorrem no mesmo ciclo.
2. Deduplica inicializações concorrentes do PostHog por uma única Promise.
3. Verifica o consentimento **após** carregar dinamicamente o SDK,
   evitando inicialização se ele foi revogado durante o download.
4. Suspende captura PostHog em revogação de consentimento e retoma
   depois de nova autorização, sem carregar repetidamente o pacote.
5. Protege os eventos manuais do Google Analytics/PostHog
   enquanto o consentimento local está desativado.
6. Mantém `autocapture:false` e `disable_session_recording:true`.
   Não aumenta cota de eventos nem ativa gravação de sessão.

**Status de publicação:** apenas branch/PR; não afirmar que foi implantado
no site até merge e deploy comprovados.

## Pendências de configuração PostHog
- Não foi alterado `project-settings-update.app_urls`:
  a ferramenta exige confirmação prévia explícita e a lista é uma
  fronteira de segurança; não confiar apenas em hosts capturados.
- Proxy gerenciado/PostHog via Cloudflare: depende de configurar DNS e
  atualizar `api_host` na versão publicada, mantendo `ui_host`.
  Mudança de rota só deve ser considerada depois de validar custos,
  CORS, disponibilidade e integridade de eventos; não é gargalo
  demonstrado de CPU/RAM do VPS.
- Instrumentar Web Vitals e spans/OTel nos serviços relevantes, com
  limites de amostragem e respeitando o consentimento, antes de atribuir
  gargalos não observados à PostHog.

Fontes técnicas:
- https://posthog.com/docs/libraries/js/config
- https://posthog.com/docs/health-checks/no-reverse-proxy
- https://posthog.com/docs/advanced/proxy
