# Evidência da auditoria ZAP + Nuclei no VPS — 21/11/2026

## Ferramentas usadas
- **OWASP ZAP 2.17.0**: instância temporária no Docker do VPS `jm-fra-01`, vinculada apenas ao loopback interno do contêiner, sem publicação de portas host. 1 thread por host, atraso de 850ms entre requisições, máximo de 2 minutos por alvo. Execução registrada como Gateway job `job_01M800SCP5008KZG7WDVD8Y4G0` e concluída com código 0.
- **ProjectDiscovery Nuclei 3.11.1**: imagem Docker oficial fixada em `sha256:582d5546902e67052097cb2d07296c642d50a1afc5e44623cb038845df9a32eb`; 14.228 templates YAML baixados, conjunto de 6 templates oficiais assinados executado com `-rl 2 -c 1 -ni -pt http`. Execução registrada como Gateway job `job_01M800VBJT009VD2VVYWKBZCZ3`.
- Auxiliar persistente no VPS: `/usr/local/sbin/jm-nuclei-safe`, proprietário root, permissão 0750; workflow reproduzível em `scripts/security/nuclei-curated-docker.sh`. Consolidador `/usr/local/sbin/jm-zap-nuclei-summary`.

## ZAP — escopo ativo real
- Cinco rotas GET públicas, sem credencial: `/`, `/jogo-de-manager-de-futebol`, `/modo-carreira-de-jogador`, `/robots.txt`, `/sitemap.xml`.
- **5/5 scans chegaram a 100%**. O site terminou com **HTTP 200**. NENHUMA das rotas foi escaneada recursivamente; áreas autenticadas e de escrita, API, Stripe e Supabase foram excluídas, por segurança.
- **40 instâncias de alerta** em **9 famílias**; 12 médias (CSP wildcard, unsafe-inline script, unsafe-inline style, unsafe-eval script); 15 baixas (timestamps e SameSite None no cookie `__cf_bm` gerenciado pela Cloudflare); 13 informativas (CSP Report-Only, identificação de sessão, cache-control). **0 alertas de alta/crítica nesse escopo**, não prova ausência de vulnerabilidades na aplicação toda.
- Evidências no VPS:
  - `/opt/jm-security/zap/20261121-multipath/active-multipath.html` (SHA-256 `9b3a33586422268dfb4ac3de6e942049cfa630aeb1bfed6c4832a4fbe505729e`);
  - `active-multipath-alerts.json` e `active-multipath-summary.json`;
  - `auditoria-zap-nuclei-2026-11-21.md` (SHA-256 `fc47765405b4f14389944ec71eb7d811da36f150f6b16db8aca0cca013fe645b`).

## Nuclei — escopo real
- 6 templates HTTPS assinados: `http-missing-security-headers`, `weak-csp-detect`, `csp-script-src-wildcard`, `cors-misconfig`, `git-config`, `robots-txt`.
- **7 achados informativos**, distribuídos em `robots-txt` (1), `csp-script-src-wildcard` (1), `weak-csp-detect` (1) e `http-missing-security-headers` (4). Não houve achado confirmado via `cors-misconfig` ou `git-config` nesse conjunto.
- Relatório original com corpo de resposta está protegido em `/opt/jm-security/nuclei/reports/nuclei-curated-20261121.jsonl`. Não publicar esse JSON bruto no GitHub, pois pode conter cookies, cabeçalhos, respostas e dados circunstanciais.

## Segurança, limites e bloqueios
- Ambos os contêineres foram temporários e NÃO ficaram em execução após o teste.
- `jogomanager.com` continuou com HTTP 200 e não foi necessário rollback.
- **Não é ZAP Full Scan**: sem staging independente, varrer recursivamente todos os endpoints e acionar regras potencialmente destrutivas na produção seria arriscado. `staging.jogomanager.com` ainda não resolve no DNS. Há workflow de ZAP Full Active restrito a staging na PR #144.
- CSP e demais cabeçalhos devem ser corrigidos via mudança de código e testes de navegador antes de publicar a PR #144; 7 achados Nuclei e 40 alertas ZAP são ocorrências, não incidentes confirmados.
- Aikido VM Scanner ainda não retomou: o valor salvo no Gateway como `aikido-vm-production-token` possui finalidade `environment`; o fluxo de escrita segura `Gateway.write_secret_file` exige valor com finalidade `file`. Foi criado o destino `aikido-vm-token-file`. O token local permanece vazio, os serviços de scanner/tempo real desativados e Elastic/Wazuh ativos.

## Próxima execução, com contexto autorizado
1. Subir staging independente com dados sintéticos, autenticação de teste e Stripe sandbox.
2. Executar o workflow `.github/workflows/security-zap-active-staging.yml` e revisar achados de todas as rotas e APIs permitidas.
3. Aplicar CSP, headers e correções mantendo CI de performance e testes funcionais verdes.
4. Receber token de Local VM Scanning como arquivo protegido no Gateway; só então voltar a ativar e medir a conectividade Aikido.

Documentação oficial: https://www.zaproxy.org/docs/docker/full-scan/ e https://github.com/projectdiscovery/nuclei
