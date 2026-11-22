# OWASP ZAP passivo — evidência real do ambiente publicado
**Data:** 2026-11-21 20:22–20:28 UTC.
**Origem:** Gateway SSH do VPS jm-fra-01, job auditável `job_01M7ZWCVX40037HK61FA41V5T0`.
**Alvo único:** https://jogomanager.com/
**Comando:** imagem oficial `ghcr.io/zaproxy/zaproxy:stable`, `zap-baseline.py -t https://jogomanager.com/ -m 1 -T 8 -a -J baseline.json -r baseline.html -w baseline.md -I -s`.
**Isolamento:** container efêmero `--rm`; CPU 1, RAM 2200 MB, `--cap-drop=ALL`, `--security-opt=no-new-privileges`, pids 256.
**Relatórios completos no VPS (NÃO commitados):** `/opt/jm-security/zap/20261121/baseline.{html,json,md}` (145 KB, 59 KB, 50 KB).
**Resultado do scanner:** `FAIL-NEW: 0; WARN-NEW: 11; PASS: 60`. Exit code do container 0 com `-I` (alertas WARN não quebram a execução). **Não significa ausência de vulnerabilidades.**

## Alertas ZAP (11 categorias agregadas)
| ID | Categoria | Número reportado | Interpretação |
|---|---|---:|---|
| 10055 | CSP wildcard, unsafe-eval, unsafe-inline, style unsafe-inline | 8 | Achado real: origens amplas e permissões de script. Priorizar nonce SSR/eliminação gradual. |
| 10054 | SameSite None ou ausente | 3 | Os parâmetros sinalizados pertencem ao cookie `__cf_bm` da Cloudflare, não a cookie de sessão do aplicativo. Validar no painel Cloudflare, sem substituir cookies arbitrariamente. |
| 90004 | COEP/COOP/CORP ausente ou inválido | 10 | Analisar rota por rota; isolamento cruzado irrestrito pode interferir em OAuth, Stripe e outros embeds. COOP `same-origin-allow-popups` do app pode divergir do critério do ZAP. |
| 10063 | Permissions-Policy ausente | 5 | Encontrado **apenas em arquivos JS estáticos** (`/assets/*`, `/__l5e/*`), não prova ausência na resposta HTML. |
| 10038 | CSP Report-Only existente | 5 | Esperado: há migração explícita via nonce em observação. |
| 10015 | Revisar cache-control | 5 | Validar comportamento do CDN e no-store para conteúdo autenticado. |
| 10049 | Conteúdo armazenável / não armazenável | 9 | Alertas heurísticos de política de cache; verificar private vs público. |
| 10094 | Possível divulgação Base64 | 12 | Heurística: exigir confirmação manual; conteúdo Base64 pode ser nonce/asset inofensivo. |
| 10096 | Possível timestamp Unix | 5 | Baixa confiança; investigar contexto antes de tratar como vazamento. |
| 90005 | Sec-Fetch-* ausentes | 8 | Trata-se dos cabeçalhos de requisição do navegador, não obrigação de cabeçalho na resposta. |
| 10112 | Session Management Response Identified | 2 | Informativo: identificar qual cookie; não implica falha de autenticação. |

**Observação:** o ZAP agrupa 22 subtipos no JSON sob 11 categorias na saída-resumo; por isso as linhas de detalhamento excedem 11. O relatório bruto contém exemplos de URIs; mantenha sob controle do operador.

## Recomendações
1. Corrigir CSP gradualmente conforme PR, com testes de compatibilidade de Stripe, Supabase OAuth, Lovable, PostHog, WebGL e WASM.
2. Repetir baseline após implantar CSP e comparar contagem por ID; não reduzir riscos ocultando alertas sem justificativa.
3. Investigar cookies do próprio aplicativo (sem assumir que `__cf_bm` é cookie próprio).
4. Configurar staging independente antes de qualquer ZAP Full Scan, API Scan ou scan autenticado.
5. Não alterar headers COEP/COOP em produção sem smoke tests de login e checkout.
