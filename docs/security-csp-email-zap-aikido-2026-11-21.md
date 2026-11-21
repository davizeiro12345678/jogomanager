# Endurecimento CSP, DNS de e-mail e testes gratuitos — 2026-11-21

## Evidências de origem
- CSP em produção: script-src atualmente contém `'unsafe-inline'` e `'unsafe-eval'`. A política com nonce e `'wasm-unsafe-eval'` está apenas em Report-Only.
- HTML público inspecionado: / (13 tags script; 11 blocos de script inline) e /auth (6 tags; 4 blocos inline); nenhum atributo on* nos elementos retornados dessas páginas.
- O PR adiciona `script-src-attr 'none'` à política aplicada e à Report-Only, impedindo manipuladores de eventos HTML como `onclick=` mesmo com a compatibilidade transitória de script-src inline. Adiciona também `manifest-src 'self'`.
- O CSP de produção só muda depois do merge, CI e implantação, não pela abertura deste PR. A remoção de `'unsafe-inline'`/`'unsafe-eval'` **ainda não foi concluída**.

## Roteiro de migração CSP (não executar às cegas)
1. Corrigir emissão do nonce no HTML SSR de cada script inline permitido e auditar scripts externos, importmap e scripts em hidratação.
2. Capturar violações Report-Only sem incluir tokens, cookies, URLs sensíveis ou conteúdo de autenticação em logs.
3. Provisionar ambiente de staging isolado; revisar Stripe Checkout, OAuth, Supabase, Lovable, PostHog, GTM, WebGL/Three e WASM; testes reais de navegador e dispositivos.
4. Com a telemetria limpa, remover `'unsafe-inline'` e `'unsafe-eval'` de script-src no staging. Se um framework exigir eval, investigar alternativa técnica específica sem liberar arbitrariamente toda a política.
5. Validar regressões, acessibilidade e Lighthouse móvel; promover somente com checks verdes e rollback documentado.

## DNS de e-mail verificado em Cloudflare
- SPF único no apex: `v=spf1 include:_spf.mx.cloudflare.net ~all`.
- Esta é a recomendação publicada para o Cloudflare Email Routing. Não substituir por `-all` até verificar remetentes reais — especialmente provedores de envio com DKIM / subdomínios dedicados.
- MX aponta para `route1.mx.cloudflare.net`, `route2.mx.cloudflare.net` e `route3.mx.cloudflare.net`.
- DMARC apex: `p=reject; pct=100; sp=reject; adkim=r; aspf=r`.
- MTA-STS publicado em `https://mta-sts.jogomanager.com/.well-known/mta-sts.txt` em modo testing; manter até confirmar relatórios TLS-RPT e MX válidos. DKIM deve ser verificado para cada serviço remetente.
- Monitorar registro DNS SPF duplicado, excesso de 10 lookups, falhas DKIM/DMARC e mudanças de MX. Não remover provedores de e-mail sem inventário validado.

## OWASP ZAP — gratuito e delimitado
- Workflow `.github/workflows/security-zap-passive.yml`: execução manual de ZAP baseline, 1 min de spider, scanner passivo e regras alpha, limite 1 CPU/2,2 GB RAM, drop de capabilities, relatório JSON/HTML/Markdown em artefato por 14 dias.
- Em produção: **apenas Baseline**; não usar `zap-full-scan.py`, fuzzing, autenticação com conta real, payloads de escrita, exploração ou varredura ampla.
- Para staging somente após ambiente isolado funcional e autorizado: ZAP Automation Framework com contexto autenticado de contas de teste, OpenAPI/GraphQL se existir, varredura ativa com limites, exclusões para pagamentos/webhooks e destruição de fixtures no fim.
- Os alertas do ZAP são hipóteses de risco, não vulnerabilidades comprovadas; reproduzir em ambiente seguro antes de atribuir severidade.
- Guia oficial: https://www.zaproxy.org/docs/docker/baseline-scan/ e https://www.zaproxy.org/docs/docker/full-scan/.

## Aikido Security
- Integração Aikido **não autorizada nem instalada nesta etapa**. O usuário deve entrar em https://app.aikido.dev/ e conceder escopo mínimo de leitura ao repositório `davizeiro12345678/jogomanager` antes de scans automáticos.
- O plano gratuito padrão, segundo a página oficial, oferece capacidade limitada; SAST no IDE gratuito para JavaScript e Secrets. O Aikido distingue AI SAST/AI Pentest por créditos/planos; **não presumir créditos nem DAST premium gratuitos**.
- Programa Aikido for Students: https://www.aikido.dev/aikido-for-students, sujeito a comprovação de matrícula e e-mail estudantil válido; verificar termos e funcionalidades concretas na conta.
- Após conectar, habilitar apenas scanners presentes no plano: secrets, SAST, dependências/SCA quando disponíveis, configurações IaC, e DAST apenas se realmente habilitado; restringir testes dinâmicos ao staging.
- Não fornecer credenciais SSH, cookies de sessão, tokens de produção nem chaves de Stripe para a ferramenta.

## Critérios de aceite
- Testes unitários CSP passam; nova regra aparece no cabeçalho após deploy e não quebra homepage, auth ou checkout.
- ZAP gera relatórios completos e alertas são triados; GitHub workflow não altera produção.
- SPF/DMARC verificáveis e entrega real de e-mail preservada.
- Nenhuma mudança DNS/email ou de CSP estrito é aplicada sem evidência de compatibilidade.
