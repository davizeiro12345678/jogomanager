# ZAP 2.17.0 — varredura ativa delimitada, 21/11/2026

## Execução real com autorização do proprietário

- Job Gateway SSH: `job_01M7ZXBGK90044DPW4AWEC2TS0` (retry funcional de `job_01M7ZX9VTJ00MPKY1XF2FKP6XS`, cujo container não conseguia ler um script de controle; propriedade do arquivo corrigida).
- VPS: jm-fra-01. Container efêmero ZAP 2.17.0, sem publicação de porta, cap-drop ALL, no-new-privileges, CPU 1.5, RAM 2.5 GB.
- Alvo: **somente** `https://jogomanager.com/`. Scanner ativo via API `ascan/action/scan`, `recurse=false`, usuário anônimo, método GET, sem contexto de autenticação.
- Limites: 1 thread por host, 850 ms de intervalo, 3 min máx. scan, 1 min máx. por regra, sem adição de query parameter em GET sem parâmetros.
- O ZAP confirmou acesso HTTP à homepage, iniciou scan ID 0 e chegou a `ACTIVE_PROGRESS 100` com `ACTIVE_COMPLETE True`.
- Resultados: **10 alertas individuais, 9 famílias**, sem alta/crítica. Médios 10055: wildcard CSP, script unsafe-inline, style unsafe-inline, script unsafe-eval; baixos 10096 (timestamps) e 10054 (cookie SameSite None); informativos 10112 sessão, 10015 cache, 10038 CSP Report-Only.
- Evidência local segura no VPS (não commitar payloads): `/opt/jm-security/zap/20261121-active/active.html` (~54 KB), `active-alerts.json` (~23 KB), `active-summary.json` (~1.3 KB), `zap-daemon.log` (~66 KB).
- **Limitação fundamental:** uma página pública não equivale a varredura ativa completa de todos os endpoints, parâmetros, estados de login, multiplayer, Supabase, Stripe nem controles de autorização. Os resultados não avaliam IDOR/BOLA nem lógica de negócio.

## Varreduras ampliadas
- Baseline anterior: 60 PASS, 11 famílias WARN, 0 FAIL, relatório em `/opt/jm-security/zap/20261121/` — job `job_01M7ZWCVX40037HK61FA41V5T0`.
- Segundo baseline com spider tradicional + moderno Ajax, regras alpha, iniciado no job `job_01M7ZXPMNX00Y7S6REZ4NG2AMC`. Registrar resultado final após terminar.
- Workflow `.github/workflows/security-zap-active-staging.yml` admite **somente** `https://staging.jogomanager.com/`, mediante acionamento manual e existência do ambiente isolado, com scanner completo e relatórios. No momento do registro o hostname não resolve; logo esse trabalho não está homologado.
- A varredura ativa completa somente é apropriada depois de staging separado, banco, dados e serviços de teste, sem tocar checkout real, OAuth real nem dados de produção.

## Cabeçalhos e cookies
- A Cloudflare retornou sucesso na criação da regra de resposta para assets `ab524244fe3b4047b6ff72fff8b9264a`, porém requisições HTTP GET e HEAD aos assets ainda não exibiram os cabeçalhos pretendidos. **Não classificar como aplicado na borda sem evidência HTTP**.
- Criado `public/_headers` para a camada Workers Static Assets (CORP same-site + Permissions-Policy) e alterado `src/lib/security-headers.ts` para aplicar CORP same-site às respostas atendidas pelo Worker. Mudanças estão na PR draft, não implantadas.
- Não impor COEP global nem COOP `same-origin` sem homologação de Stripe, OAuth e Lovable; COOP atual `same-origin-allow-popups` intencional.
- Cookie `__cf_bm`: gerado por Cloudflare; SameSite=None com Secure e Partitioned é previsto para compatibilidade CHIPS. Não modificar cookies da infraestrutura só para silenciar um alerta.

## Feed Aikido
- A captura do proprietário mostra 99 grouped issues, cores 6/23/43/27, 83 Auto Ignored nos últimos 7 dias, 155 New e 2 Solved. Os totais são categorias e janelas distintas, não somáveis.
- Os IDs, URLs individuais, títulos e repositórios afetados NÃO aparecem na captura. O Aikido possui exportação CSV/PDF em **Issue Feed → Actions → Export**; não há sessão Aikido autenticada neste ambiente. Evitar classificar as 99 como corrigidas ou atribuí-las a repositórios específicos.
- A conta GitHub conectada mostra 11 repos acessíveis; o acesso à GitHub Issues não substitui o feed privado do Aikido.
