# Suite de segurança gratuita — verificações reais em 21/11/2026

## Comparação funcional, sem alegar superioridade absoluta
- **OWASP ZAP 2.17.0**: DAST com spider, scanner ativo, política de cookies, CSP, injeções e relatórios. Melhor encaixe em varreduras da aplicação web.
- **Wapiti 3.3.3**: segundo motor gratuito DAST para XSS, SQLi, path traversal, execução de comandos, SSRF e outras classes (conforme módulos disponíveis); usa crawling e payloads diferentes do ZAP, mas não é comprovadamente melhor em toda aplicação. Instalado em virtualenv isolado no VPS `/opt/jm-security/wapiti/venv`; Docker `python:3.13-slim`, com opção `jm-security/wapiti:3.3.3-sslscan` para módulo TLS (Dockerfile no repositório).
- **Trivy 0.76.2**: análise estática de dependências, configuração, segredos, contêineres e SBOM. Possui mais capacidade de *supply-chain* e infraestrutura que o ZAP, mas não substitui DAST.
- **Nuclei 3.11.1**: mantido no VPS, com 14.228 templates oficiais disponíveis e wrapper `/usr/local/sbin/jm-nuclei-safe`. Não foi removido ou substituído.

## ZAP Full Scan concluído (somente escopo público)
- Execução real: Gateway job `job_01M802YWER00V5FMGWSMR8KZHE`, encerrado em **2026-11-21 22:23:36 UTC**, exit 0.
- Comando oficial `zap-full-scan.py` com spider tradicional, passive scan e active scan; `-m 1 -T 8 -I`; ZAP Java em Docker efêmero isolado, 2 CPU e 3 GiB, 1 thread por host, 1000ms de atraso e máximo de 5 minutos no active scanner.
- O hook registra exclusões para paths privados tanto no spider quanto no active scanner. **Scope:** /, /jogo-de-manager-de-futebol, /modo-carreira-de-jogador, /robots.txt, /sitemap.xml.
- Resultado CLI: **139 PASS**, **4 famílias WARN**, **0 FAIL** (opção `-I` impede falha de exit para avisos). As famílias de warning foram CSP wildcard, cookie SameSite None (Cloudflare), timestamp de tipo Unix e Cross-Origin-Resource-Policy ausente.
- JSON inclui múltiplos subtipos de CSP e cross-origin, além de alertas informativos. Contagens de subtipos **não** equivalem a CVEs únicas.
- Relatórios privados: `/opt/jm-security/zap/20261121-full-mode-scoped/full-scoped.{html,json,md}`.
- O primeiro teste do hook reprovaria permitir query string `/jogo-de-manager-de-futebol?redirect=/api/admin`; o teste reproduziu a falha e o hook foi endurecido para permitir somente URLs exatas. **3 testes Python ficaram verdes** e os scripts shell passaram em `bash -n`. O scan concluído usou a versão anterior, cujos caminhos de autenticação/checkout/API já estavam excluídos; a versão endurecida destina-se a reexecuções futuras.
- **Não foi realizado** Full Scan recursivo/autenticado em toda a aplicação: `staging.jogomanager.com` não resolveu no DNS. Não há licença para concluir segurança das APIs, checkout, multiplayer, Supabase nem autorizações.

## Trivy — código do jogomanager
- Cópia temporária read-only do commit principal `0856c2afc3c71c7d8317e49d8bde3f0634aa0e88`, com root lockfiles e diretórios principais (sparse checkout, 29 MiB).
- Scanners `vuln,misconfig,secret`; 2 alvos de dependências reconhecidos, **8 MEDIUM + 2 LOW**, 0 HIGH/CRITICAL nesses alvos. Não generalizar para todo o código.
- Arquivo privado: `/opt/jm-security/trivy/reports/jogomanager-main-20261121.json`. Wrapper reproduzível: `scripts/security/trivy-code-audit.sh`.

## Trivy — imagem Docker PostgreSQL do staging
- Imagem local `postgres:18`, ID `sha256:e754b839f447639b7004895f4d8a4bfcb4e9dbe3a1bc035f27f646562a16fd61`. Scan por Docker tar sem socket exposto ao scanner, nenhuma mudança no contêiner em execução.
- **552 ocorrências** (não CVEs únicas): CRITICAL 2, HIGH 151, MEDIUM 206, LOW 176, UNKNOWN 17. Também houve um alerta de chave privada HIGH em `/etc/ssl/private/ssl-cert-snakeoil.key`, que é nome de chave de teste Debian; verificar uso antes de classificar como exposição real.
- O Trivy, usando severidade NVD, classificou `CVE-2026-6653` (libxml2) como CRITICAL; o tracker oficial Debian para Trixie marca vulnerável mas `<no-dsa>`/minor. Referência: https://security-tracker.debian.org/tracker/CVE-2026-6653.
- Outro alerta CRITICAL: `CVE-2025-68121` em Go `stdlib v1.24.6` incorporada ao binário `gosu`; depende de fluxo específico de reuso TLS. Referência: https://go.googlesource.com/vulndb/+/refs/heads/master/data/osv/GO-2026-4337.json.
- **Não atualizar cegamente** a imagem da base; primeiro canário, compatibilidade, backup/restauração e mitigação de regressões. Acompanhar na issue **#145**: https://github.com/davizeiro12345678/jogomanager/issues/145.
- Relatório privado: `/opt/jm-security/trivy/reports/postgres-18-20261121.json`, modo 0600.

## Wapiti — instalação e prova
- `wapiti3==3.3.3` instalado e `pip check` aprovou as dependências; venv isolado, sem adicionar Python ou Wapiti ao root do sistema host.
- Scan real somente de `https://jogomanager.com/` (escopo *page*, 1 tarefa, tempo limitado), com módulos `xss,sql,wapp`, e tentativa inicial do módulo TLS. A página não apresenta formulário HTML na resposta SSR, portanto a execução **não exercitou payloads de injeção em parâmetros nem provou ausência de XSS/SQLi**.
- O scanner identificou tecnologias como Cloudflare e HSTS, não encontrou vulnerabilidades confirmadas nessa única página. Relatório privado: `/opt/jm-security/wapiti/reports/wapiti-public-page-20261121.json`.
- O módulo TLS foi executado separadamente com `sslscan` por meio da imagem `jm-security/wapiti:3.3.3-sslscan`. O relatório `/opt/jm-security/wapiti/reports/wapiti-ssl-fresh-20261121.json` identificou **4 avisos heurísticos**: ausência de certificado EV, ausência de OCSP Must-Staple, indicação de CVE-2014-0224 (OpenSSL CCS) e falta de renegociação. **Não são quatro vulnerabilidades comprovadas**. A documentação oficial Cloudflare declara que todos os seus servidores de borda foram corrigidos para CCS injection e que deliberadamente não suporta renegociação TLS com clientes (https://developers.cloudflare.com/ssl/reference/compliance-and-vulnerabilities/). EV e OCSP Must-Staple não são requisitos universais. Os ciphers observados TLS1.2/TLS1.3 foram fortes; não alterar a origem ou a borda por esses heurísticos sem comprovação independente.
- Script reproduzível: `scripts/security/wapiti-public-check.sh`, usando uma imagem Python fixada.

## Segurança operacional
- Nenhuma senha, cookie ou chave detectada foi copiada aos commits, issues ou relatórios de resumo.
- Os scanners usam redes e contêineres efêmeros, com privilégios e recursos limitados. Os artefatos brutos permanecem em diretórios privados no VPS.
- `jogomanager.com` terminou com **HTTP 200**.
- Antes de declarar a aplicação segura, criar staging independente e executar ZAP Full Scan autenticado, OpenAPI/API Scan quando o contrato estiver disponível e Wapiti com contas e dados sintéticos. Não atacar dados reais ou envios Stripe.

Documentação oficial: https://www.zaproxy.org/docs/docker/full-scan/ ; https://trivy.dev/docs/latest/target/filesystem/ ; https://github.com/wapiti-scanner/wapiti .
