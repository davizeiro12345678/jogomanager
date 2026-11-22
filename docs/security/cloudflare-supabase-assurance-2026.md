# Plano de proteção, auditoria e garantia do site — Cloudflare + Supabase

**Pro Football Manager 3D · revisão de 22/11/2026 · proprietário: mantenedor do repositório.**

> **Estado: plano de segurança, NÃO certificado de conformidade.** Esta página separa o que foi verificado pela API dos provedores, os alertas de seus diagnósticos, o que está em implantação e o que exige auditoria independente. Valores, responsáveis, achados e métricas mudam; uma fotografia da configuração em 22/11/2026 não garante segurança contínua. Este documento público não contém segredos, IDs internos de infraestrutura ou detalhes de exploração.

[Política de segurança](../../SECURITY.md) · [Manual de arquitetura](../architecture/stack-status.md) · [Runbook de publicação](../cloudflare-supabase-deployment.md) · [Gate de performance](../critical-performance.md)

## 1. Escopo, propriedade e fronteiras

O escopo de avaliação do serviço inclui o domínio público `jogomanager.com`, seus subdomínios de aplicação explicitamente autorizados, o Worker responsável pela entrega, SSR e SPA, APIs, autenticação Supabase, Postgres/RLS, armazenamento, serviços de multiplayer, integrações com a Stripe e pipelines do GitHub. Sistemas de terceiros, redes dos usuários e dispositivos não são cobertos automaticamente por uma auditoria do código.

**Ambientes:** produção e staging possuem projetos e identidades distintos. Scanners ativos que executam escrita, fuzzing agressivo, checkout ou testes de multiplayer destrutivos **só** devem operar no staging isolado com autorização específica, dados sintéticos, backup e limites de taxa. Testes da produção devem priorizar verificação passiva, configuração e checks não destrutivos.

## 2. Fotografia verificada na Cloudflare

Consulta autorizada à configuração da zona em **22/11/2026**:

| Superfície                       | Situação observada                                                                             | Validação ainda necessária                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **SSL/TLS Full (strict)**        | Configurado                                                                                    | Testar cadeia, validade, HTTPS real, subdomínios e renovação                       |
| **Always Use HTTPS**             | Configurado e ativo                                                                            | Testar redirecionamento sem loops, HSTS em clientes elegíveis                      |
| **Security Level High**          | Configurado                                                                                    | Medir falsos positivos e impacto sobre pessoas legítimas                           |
| **WAF gerenciado (Free)**        | Ruleset habilitado                                                                             | Confirmar eventos reais, cobertura do plano e exceções controladas                 |
| **Regras customizadas**          | Bloqueio de sondagens, arquivos sensíveis e métodos não usados; challenge de login habilitados | Exercitar rotas autorizadas sem atacar usuários reais                              |
| **Rate limiting**                | Regra para fluxos de Auth habilitada                                                           | Testar limites por cliente em staging, MFA/passkeys, headers e falsos positivos    |
| **Bot Fight Mode**               | Habilitado                                                                                     | Medir efeitos em acessibilidade, SEO, callbacks e clientes de API                  |
| **Cabeçalhos de resposta**       | Regras de isolamento, no-store, anti-clickjacking e privacidade habilitadas                    | Validar respostas finais e CSP efetiva em SSR, Auth, Stripe e 3D                   |
| **DNSSEC**                       | Estado **pending** na API; NÃO certificado como ativado no registrador                         | Confirmar DS com o registrador e validar cadeia de confiança com consultas DNS     |
| **Worker Custom Domain**         | Domínio principal associado ao Worker de aplicação                                             | Conferir ownership, rota, health, SHA servido e rollback                           |
| **Load Balancer legado do apex** | **Desativado intencionalmente** após conflito de domínio                                       | Não reativar sem segunda origem independente, teste de failover e mudança aprovada |
| **Load Balancer de www**         | Habilitado na consulta                                                                         | Revisar dependência/origem, HTTPS canônico e efeito sobre usuários de www          |

**Regra de segurança operacional:** não reativar hospedagem legada ou LB do apex por intuição. Um health verde de um backend não comprova OAuth, renderização, banco ou assinaturas. Para alta disponibilidade, testar duas origens realmente independentes, monitor que cobre dependências, recuperação da sessão, rollback e propagação controlada.

### Verificações por fluxo de borda

| Caminho                             | Controle em Cloudflare                                      | Segurança adicional exigida no aplicativo                                               |
| ----------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| HTML público, JS, imagens e tabelas | TLS, WAF, cache sem dados privados, Brotli, headers         | SSR sanitizado, limites de JS, CSP compatível e proteção XSS                            |
| Login, OAuth, senha e MFA           | Rate limiting específico, proteção de bots, no-store        | PKCE/state, allowlists de callback, sessão e proteção de abuso                          |
| Webhook Stripe                      | TLS, rota POST pública, proteção contra cache               | **Assinatura Stripe obrigatória**, idempotência, ambiente pinado; não depender só do IP |
| APIs e operações de escrita         | WAF/rate limiting proporcional ao método                    | Autorização por usuário, validação de entrada, RLS e limites transacionais              |
| Multiplayer e WebSocket             | Mitigação DDoS, regras e roteamento compatíveis             | Tickets curtos, servidor autoritativo, antirreplay, reconexão segura                    |
| Operações administrativas           | Acesso restrito, segredo em cofre, logs sem dados sensíveis | MFA, least privilege, trilha de auditoria e recuperação independente                    |

## 3. Supabase: Auth, Postgres, RLS e Edge Functions

### Controles mandatórios

- **Identidade:** URL e publicável Vite do cliente precisam corresponder ao projeto correto. Service role, segredos de Edge Function e senhas nunca entram no navegador.
- **RLS:** todas as tabelas acessíveis por API devem ter RLS; a concessão por role `authenticated` **não** substitui verificação do dono. Para updates, validar `USING` **e** `WITH CHECK`.
- **Views e RPC:** revisar `security_invoker` de views, `SECURITY DEFINER`, `search_path`, grants `EXECUTE` e superfícies expostas de `pg_graphql`.
- **Auth:** PKCE, redirect URI por ambiente, rate limits, MFA para administradores, passkeys quando suportadas, recuperação e revogação/reautorização de sessões.
- **Storage:** policies por prefixo/identidade, tamanho, tipo MIME, malware e bucket; URLs assinadas de curta validade para conteúdo privado.
- **Service role e chaves:** rotação controlada, privilégios mínimos, escopo por ambiente e registro de mudanças; não entregar credenciais à documentação nem CI de PR externo.
- **Staging isolado:** migrações aplicadas de forma reproduzível, nenhuma escrita em dados reais; testes negativos cruzando anon, usuário A/B e papel de serviço.

### Avisos da ferramenta de segurança em 22/11/2026

| Aviso                                                | Produção                     | Staging                      | Interpretação e próximo gate                                                                                      |
| ---------------------------------------------------- | ---------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| RLS habilitado sem policy                            | 37 apontamentos informativos | 44 apontamentos informativos | Muitos podem ser **negação por padrão** em esquemas privados; classificar por exposição e grants antes de alterar |
| Exposição de tabelas por GraphQL anon                | 26 alertas                   | Não reportado nessa consulta | Verificar se `pg_graphql` está exposto, grants e RLS por objeto; testar como `anon`                               |
| Exposição por GraphQL authenticated                  | 48 alertas                   | Não reportado nessa consulta | Testar BOLA/IDOR com duas contas e campos permitidos; revogar grants desnecessários                               |
| Função `SECURITY DEFINER` executável por autenticado | 1 alerta                     | 1 alerta                     | Inspecionar função e efetivos privilégios; preferir esquema não exposto, mínimos grants e verificações explícitas |

**Importante:** a contagem de alertas não é equivalente à quantidade de vulnerabilidades exploráveis. Nenhuma correção SQL em produção deve ser feita por mera contagem; preparar alterações em migração, testar permissões com clientes reais de staging, comparar grants e registrar rollback. Não adicionar policy permissiva indiscriminada apenas para apagar alertas.

Referências oficiais: [recomendações do Supabase](https://supabase.com/docs/guides/database/database-linter) · [segurança da API](https://supabase.com/docs/guides/api/securing-your-api) · [segurança do produto](https://supabase.com/docs/guides/security/product-security).

## 4. Plano de implementação verificável

| Prioridade | Atividade                                                        | Evidência de aceite                                                                         | Estado da fotografia                                     |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **P0**     | Manter domínio na origem Worker correta e impedir LB conflitante | DNS/trace/health, 13 endpoints, SHA servido e rollback                                      | Domínio recuperado; monitoramento contínuo               |
| **P0**     | Corrigir Auth público e staging isolado                          | Login em navegador, callbacks autorizados, sessão, recuperação, MFA e acesso cruzado negado | **Pendente de homologação E2E**                          |
| **P0**     | Revisar exposição GraphQL e funções privilegiadas                | Inventário grants/RLS; testes negativos A/B/anônimo; migração com rollback                  | **Alertas a classificar**                                |
| **P0**     | Verificar Stripe sandbox em backend isolado                      | Checkout de teste, evento assinado, dedupe, entitlement persistido, estorno e repetição     | **Pendente de E2E**                                      |
| **P1**     | Confirmar DNSSEC em registrador                                  | DS propagado; DNSKEY/DS chain validada; sem quebra DNS                                      | **Pending**                                              |
| **P1**     | CSP e headers estritos sem quebrar fluxos                        | Browser real e testes de login, Stripe, multiplayer, WebGPU, analytics consentido           | Rules habilitadas; testes incompletos                    |
| **P1**     | Campanha multiplayer 1×1 e 2×2                                   | 2/4 clientes independentes, reconexão, anti-replay, placar, persistência                    | **Pendente de E2E**                                      |
| **P1**     | Restore isolado e recuperação de VPS                             | Backups externos, restore com integridade, RPO/RTO medidos, cadeia de chaves                | **Sem certificação de restore neste documento**          |
| **P1**     | DAST autenticado e SCA/SAST no staging                           | Escopo autorizado, ZAP e auxiliares, achados priorizados, reteste após fix                  | Requer evidência de execução completa                    |
| **P1**     | Lighthouse e desempenho inicial móvel                            | Cada medição ≥97, LCP ≤2.500 ms, TBT ≤200 ms; cinco rotas e três runs                       | **Falha intermitente/reproduzida na home em 22/11/2026** |
| **P2**     | Observabilidade e exercício de resposta                          | Request IDs, alarme, métricas, retenção, runbook testado, incident drill                    | Verificação contínua                                     |
| **P2**     | Auditoria de privacidade e acessibilidade                        | Inventário de dados, retenção, direitos, WCAG 2.2 AA, testes assistivos                     | Exige avaliação específica                               |

A prioridade acima é uma **ordem de execução proposta** e não um cronograma nem confirmação de implantação. Cada item precisa de responsável identificado no controle privado, evidência sanitizada, teste de regressão e data de revisão.

## 5. Programa de avaliação e certificação — sem alegações falsas

**Uma configuração técnica, pontuação de scanner ou badge do GitHub não é certificação independente.** As trilhas abaixo têm escopos distintos:

| Referência                         | O que pode ser demonstrado                                                                          | O que não se deve alegar                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **OWASP ASVS 5.0**                 | Matriz de requisitos e evidências técnicas por componente, pentest autorizado, revisão e remediação | “OWASP certificou o site” sem auditoria externa e escopo explícito                     |
| **OWASP Top 10 2025**              | Cobertura de classes de risco e correções reproduzíveis                                             | Ausência de falhas simplesmente por passar um scanner                                  |
| **SSL Labs / Mozilla Observatory** | Resultado pontual externo para TLS/headers com data, domínio e artefato                             | Segurança geral do jogo ou aprovação legal                                             |
| **WCAG 2.2 AA**                    | Testes automatizados e manuais, teclado, leitores de tela e dispositivos reais                      | Conformidade apenas porque Lighthouse Accessibility é verde                            |
| **PCI DSS / SAQ A (se aplicável)** | Decisão fundamentada de elegibilidade pelo modelo de checkout, fluxo de dados e requisitos vigentes | Declarar o próprio jogo “PCI certificado” por usar Stripe Checkout; escopo pode variar |
| **ISO/IEC 27001**                  | SGSI com escopo organizacional definido, gestão de riscos, auditoria independente e manutenção      | Certificação da empresa/site sem organismo certificador                                |
| **SOC 2**                          | Relatório de auditor independente sobre critérios de serviços confiáveis e período/escopo auditado  | “SOC 2 compliant/certified” a partir de controles técnicos isolados                    |
| **LGPD**                           | Inventário/base legal, minimização, transparência, direitos, retenção e avaliação jurídica          | “Certificação LGPD oficial” inexistente ou auditoria não realizada                     |

**Critério para qualquer selo público futuro:** nome do organismo emissor, objeto certificado, norma e versão, tipo de avaliação, número identificável, validade, escopo e relatório ou link verificável. Sem esses dados, apresentar **“autoavaliação técnica”**, **“em preparação”** ou **“auditoria pendente”**, jamais um badge de certificação.

### Pacote de evidências por versão

Para cada release auditada, arquivar em local de acesso restrito: SHA e SBOM; inventário de origens/domínios; settings de segurança exportadas **sem segredos**; testes de TLS/DNSSEC; matriz ASVS com critérios e falhas; resultado SAST/SCA/DAST; testes de RLS com contas de staging; trilha de webhook test mode; relatório de multiplayer; Lighthouse de 15 amostras; backup/restauração isolada; aprovadores e rollback. Publicar somente uma síntese sanitizada.

## 6. Fontes e revisão

- [Cloudflare WAF](https://developers.cloudflare.com/waf/) · [Cloudflare DNSSEC](https://developers.cloudflare.com/dns/dnssec/) · [Cloudflare Load Balancing](https://developers.cloudflare.com/load-balancing/)
- [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api) · [Supabase changelog](https://supabase.com/changelog)
- [OWASP ASVS](https://asvs.owasp.org/) · [OWASP Top 10 2025](https://top10.owasp.org/2025/) · [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [PCI SSC FAQ de elegibilidade SAQ A](https://www.pcisecuritystandards.org/faqs/1588/)

**Próxima revisão recomendada:** a cada alteração relevante de domínio, Auth, banco/RLS, pagamento, multiplayer ou incidente; consolidar estado atualizado nas ferramentas dos provedores antes de publicar alegações sobre proteções.
