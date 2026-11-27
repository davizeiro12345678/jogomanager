# PR #132 | VPS, Wazuh e Cloudflare: checkpoint auditável de 17/11/2026

**Tipo:** evidência operacional, não aprovação de release. **Origem:** inspeções read-only e uma integração nova implantada no host através do SentinelX, com teste do Wazuh. **Branch auditada antes deste registro:** `integration/release-2026-11-11` em `1aa1c0d929d878d004cb47c701765f7284f1f9e9`.

## Evidências objetivas

| Área | Evidência 17/11 | Resultado e limitação |
| --- | --- | --- |
| Acesso remoto | Gateway cadastra `jm-fra-01` mas relata `awaiting_host_trust`; SentinelX conectado ao VPS | Administração via SentinelX operacional; não habilitar porta 22 pública para contornar validação SSH |
| SSH | `sshd -T`: root e senhas desabilitados, chaves públicas obrigatórias, 3 tentativas, forwarding desabilitado; listeners efetivos `127.0.0.1:22` / `[::1]:22` | Hardened; ainda requer homologação de recuperação administrativa |
| Firewall/EDR | UFW ativo, default deny; Fail2ban 43 banimentos; CrowdSec/bouncer, auditd, Tetragon, ClamAV ativos | Exigir testes operacionais de alertas e recuperação; não representa detecção universal |
| Wazuh 4.14.10 | Manager, Dashboard e Indexer em Docker; agente Ubuntu `001 jm-fra-01` ativo; manager local `000` | **1 agente de host**, não 39 hosts. Não criar agentes artificiais ou alegar 39 sistemas |
| Elastic | Elasticsearch 9.5.6 em Docker com acesso local | Kibana completo não homologado; healthcheck do host registra `WARN_KIBANA_NOT_DEPLOYED` |
| PostgreSQL VPS | PostgreSQL 18 local `127.0.0.1:5432`; cluster 16 parado; não há porta 5432 pública | Banco local é distinto do projeto Supabase de produção PostgreSQL 17; sincronização/túnel Supabase requer teste de identidade, ACL e consistência |
| Backup | `jm-backup-daily.service` concluiu com `Result=success` em 17/11, 3 dumps PostgreSQL e arquivos de configuração com checksums OK | Cópia **local** comprovada; cópia off-site e restauração independente NÃO homologadas |
| Recursos | 47 GiB RAM total, cerca de 28 GiB disponíveis, 4 GiB swap; 650 GB disco, 13% usados | Medição momentânea, não reserva para 39 instâncias |
| Segurança Supabase | 37 INFO RLS sem policy, 26 WARN GraphQL anon, 48 WARN GraphQL authenticated, 1 WARN SECURITY DEFINER | 37 INFO já tinham zero concessões de DML para anon/auth em auditoria anterior; não abrir RLS para apagar avisos |
| CI exato do PR | 12/13 workflows aprovados, inclusive 43 suítes; `Quality gates` falhou no job `Production dependency audit` do run `44137751239` | `npm audit --omit=dev --audit-level=high` falha para `picomatch`, GHSA-fc5q-39xc-vjpf (CVE-2026-112366), sem versão corrigida atestada em 17/11 |

## Nona integração Wazuh implantada e comprovada

Oito integrações/regras anteriores foram **preservadas** no manager Docker. Nova integração independente e não destrutiva para saúde e identidade dos Cloudflare Tunnels:

- Probe: `/usr/local/sbin/jm-wazuh-cloudflare-probe`.
- Timer: `jm-wazuh-cloudflare-health.timer` (a cada 5 minutos), `jm-wazuh-cloudflare-health.service` (oneshot com limitações de recursos e sandbox systemd).
- Events JSON: `/var/log/jm-security-integrations/events.jsonl`, fonte já coletada pelo agente Wazuh.
- Regras novas: `jm-cloudflare-health-rules.xml` no volume de regras do manager, IDs `100480` (nível 11, `down`), `100481` (nível 8, `degraded`), `100482` (nível 3, `ok/recovered`).
- `wazuh-analysisd -t` passou; manager controladamente reiniciado; `wazuh-logtest` identificou regras. Eventos reais em `alerts.json`: 19:39:17 UTC, ID `100480`; 19:40:22 UTC, ID `100481`. Após reinício, agente `001` continuou ativo.
- Detector distingue estado local de **identidade remota**: processos múltiplos não equivalem automaticamente a dois túneis independentes.

## Inconsistência de topologia Cloudflare — pendente e alertada

- Cloudflare API: `jogomanager-vps-fra-01`, tunnel ID `340f8cf2-48fd-4457-b3c1-eb8afa048154`, **down/sem conexões**; `jogomanager-vps-multiplayer-canary-20261112`, ID `b6316dea-8293-479d-b757-2bb77960e09e`, **healthy/8 conexões**.
- Host: dois serviços `jm-cloudflared.service` e `jm-cloudflared-multiplayer.service` ativos, mas ambos os tokens locais identificavam o **mesmo túnel canary**; a função de sensor classifica essa discrepância como `degraded`.
- Principal configura `catalog-vps.jogomanager.com -> localhost:8088`; canary tem `matches-vps -> localhost:3219`, `vps-multiplayer -> localhost:3218`, `catalog-vps -> localhost:8088`, `ssh-fra -> localhost:22` (todas entradas por túnel, não encaminhamento público por firewall).
- `jogomanager.com` e `www` responderam HTTP 200 no teste a partir do VPS; outras rotas de host retornaram 404 anônimo, o que pode ser esperado para gate fechado.
- Foi preparado rollback root-only durante tentativa de correção, **sem alterar os tokens ativos**. Transferência de credencial entre conectores foi bloqueada por controles de segurança; **não contornar essa proteção**. Realizar troca por canal de provisionamento de segredo explicitamente autorizado, com rollback e prova remota de health/identidade.

## Pendências de release que não devem ser declaradas concluídas

- **PR #132:** Draft, sem revisão humana aprovada, sem merge nem deploy autorizado. Qualquer commit novo requer verificar novamente os workflows no SHA final, inclusive Quality Gates e orçamento de desempenho.
- **Staging:** Supabase independente não criado (potencial cobrança), sem usar segredo ou dados de produção como substituto; Worker DO remoto ainda com flags fechadas conforme ledger.
- **Jogo:** homologação física 1×1 em dois aparelhos; cooperativo 2×2 em quatro aparelhos; persistência, recuperação, settlement e anticheat em transporte real; desempenho/temperatura 3D e IA em hardware de referência; cobertura de modos/moderação.
- **Site/SEO:** documento `docs/operations/pr132-production-http-seo-2026-11-15.md` registrou health 503, duas tabelas 500 e três páginas `noindex`; exigir **nova verificação** após qualquer correção, 12 tabelas e todas as rotas afetadas, sem 200 fictício.
- **Segurança:** verificar exposição GraphQL por persona, função `mutate_player_career` (MFA, ownership, replay) em staging, backup externo/restauração, recuperação SSH, isolamento/recursos Docker, versões com segurança e proteção obrigatória da `main`.
- **39 agentes:** não há evidência de 39 sistemas operacionais distintos para cadastrar. Instrumentar serviços existentes com Wazuh, logs e sensores sem inventar registros; expandir agentes apenas para instâncias reais e autorizadas.

## Rollback da **integração nova** (não remover as oito anteriores)

Desabilitar agendamento e parar o serviço de probe com `systemctl disable --now jm-wazuh-cloudflare-health.timer`; os arquivos novos e a regra `100480–100482` podem ser removidos **somente após backup e validação de reversão** com `wazuh-analysisd -t` e recarga controlada do manager. Não remover as regras compartilhadas ou volumes Docker.

**Veredito:** integração 9 implantada e comprovada fim a fim; segurança já existente auditada; bloqueios de túnel principal, release, staging, vulnerabilidade npm e homologação física persistem. Não anunciar implantação integral.
