# JogoManager: ambiente, MCPs e segurança de borda Fastly
Data de verificação: 21/10/2026. Fonte: chamadas GitHub/Supabase, /api/health público e PageSpeed Insights público.

## Mudanças propostas nesta branch

- `.env`: corrige os dois IDs e URLs Supabase e substitui as duas chaves publicáveis antigas pela chave publicável **confirmada no projeto Supabase de produção** `lguqnwvsfeefxamzeyos`. Preserva Google Analytics, logo.dev e PostHog, chaves voltadas ao navegador (VITE_). Não inclui service_role, JWT privado ou token Twilio/Fastly.
- `.env.development`: preserva a chave Stripe **pk_test_**, valida `sandbox` no lado servidor e mantém checkout convidado desligado.
- `.env.production`: preserva a chave Stripe **pk_live_**, valida `live` no lado servidor e mantém checkout convidado desligado.
- `scripts/validate-public-env.mjs` + GitHub Actions: verifica projeto, consistência das chaves **sem imprimi-las**, bloqueia tipos comuns de segredos privados no repositório e confirma separação de ambientes.
- `.mcp.json`: configura quatro servidores MCP para clientes compatíveis, nenhum com credenciais embutidas. A configuração NÃO autentica nem instala serviços automaticamente.

> Atenção: os três arquivos `.env*` estavam versionados antes desta mudança, apesar do `.gitignore`. Somente chaves publicáveis podem permanecer neles. Se qualquer chave privada apareceu em algum commit anterior, revogue e rotacione no provedor; simplesmente remover do último commit não a remove do histórico.

## MCPs preparados para uso

| Servidor | Comando ou URL | Autorização | Segurança |
|---|---|---|---|
| Fastly oficial | `npx -y -p @fastly/mcp fastly-mcp` | `FASTLY_API_TOKEN` **somente no ambiente local**; inicialmente conceder `global:read` | Não versionar token; acesso de escrita apenas durante alterações aprovadas |
| Supabase hosted | `https://mcp.supabase.com/mcp?project_ref=lguqnwvsfeefxamzeyos&read_only=true&features=database,docs,debugging,development` | Login OAuth pelo cliente MCP | Escopo só neste projeto; leitura apenas |
| Playwright | `npx -y @playwright/mcp@latest` | Navegador local | Testes de UX e fluxos no preview, sem manipular contas alheias |
| Context7 | `https://mcp.context7.com/mcp` | OAuth/API key dependendo do cliente | Documentação de bibliotecas, não acesso à produção |

Para usar os servidores, abra este repositório em **um cliente MCP compatível** e autorize cada conexão. Alguns clientes como Codex e VS Code usam arquivos próprios, não carregam `.mcp.json` automaticamente. Exemplos oficiais:
- Fastly: https://www.fastly.com/documentation/reference/agent-setup/
- Supabase: https://supabase.com/docs/guides/ai-tools/mcp
- Playwright: https://github.com/microsoft/playwright-mcp
- Context7: https://github.com/upstash/context7

### Codex: instalação real no computador do desenvolvedor

A configuração `.mcp.json` é um manifesto portável, mas **não instala plugins no Codex automaticamente**. Seguindo a documentação oficial da Fastly, no terminal local autenticado do desenvolvedor:

```bash
codex plugin marketplace add https://github.com/fastly/fastly-agent-toolkit.git
codex plugin add fastly-agent-toolkit@fastly-agent-toolkit
codex plugin marketplace add https://github.com/fastly/mcp
codex plugin add fastly-mcp@fastly-local
```

Depois autenticar com `fastly auth login` ou fornecer `FASTLY_API_TOKEN` por gerenciador de segredos do sistema, **jamais nos arquivos `.env` versionados**. Para começar, token só de leitura `global:read`. As alterações de serviço requerem token com permissões de escrita, e a autenticação e habilitação comercial do provedor ainda são pendentes. No Cloudflare o conector autenticado não respondeu nesta verificação; não houve alteração de DNS.

## Topologia Fastly e bloqueios

O serviço CDN Fastly **já existe**: `bhEs3I9sbvxlCzr9kb0IBQ`, versão 2. Origem configurada: `jogomanager-web.davizeiro10-jogos.workers.dev`. Seu snippet em `infra/fastly/private-cache-bypass.vcl` só deixa GET/HEAD anônimo em `/assets/` optar pelo cache. Cookies, Authorization, APIs e demais rotas usam pass. DDoS Blocking e mitigação de rede constavam ativos no último levantamento.

**Não confundir serviço Fastly ativo com domínio principal trafegando por Fastly**: `jogomanager.com` ainda não fez cutover DNS/certificado. Não é possível afirmar que o Fastly reduziu latência do tráfego real do domínio enquanto o tráfego ainda não passa por ele.

Para entrada em produção, executar com token de escrita aprovado e observabilidade:
1. Confirmar que domínio TLS é de propriedade do projeto; emissão de certificado Fastly anterior estava pendente de desafio ACME. Validar conflito com provedores de TLS e Host/SNI do Workers antes de mudar DNS.
2. Configurar origin direto `workers.dev` ou hostname de origem dedicado autenticado, sem criar redirecionamento Fastly -> domínio público que retornará ao Fastly (loop).
3. Revisar o gate de origem preparado no PR #56: não aplicar a requisições do hostname público sem migração e segredo compartilhado. O gate ainda não está em produção.
4. Testar rotas anônimas e autenticadas com `curl`, reproduzir POST, login OAuth, MFA, saves, checkout Stripe e webhooks; assegurar `Cache-Control: private/no-store` em dados pessoais.
5. Medir cache HIT/MISS e origens por POP/rota, erros 4xx/5xx, latência p50/p75/p95/p99, CPU, tráfego, TLS, 0-RTT e fraude durante amostra controlada de 24–72h.
6. Validar plano de rollback DNS, manter provedores de certificado e Cloudflare Worker coerentes. Habilitar features avançadas somente após a plataforma ativá-las para esta conta e informar custos.

**Não habilitados:** Next-Gen WAF, Bot Management avançado, API Discovery, API Enforcement e Edge Rate Limiting comercial. Estes produtos exigem habilitação comercial/contrato no contexto da conta; não é possível tratá-los como inclusos no trial. Nenhuma alteração em DNS ou assinatura foi realizada nesta branch.

## Evidências de disponibilidade verificadas hoje

Uma verificação HTTP de conteúdo retornou:
- `https://jogomanager.com/api/health`: JSON `status=ready`, `auth=true`, `serverCredentials=true`, `database=true`.
- `https://slightly-apt-buffalo.global.ssl.fastly.net/api/health`: o mesmo JSON. Isso comprova alcance do **endpoint de teste** Fastly, não adoção no tráfego público.

As latências de coleta de conteúdo observadas foram 5.101 ms pelo hostname público e 3.124 ms pelo hostname Fastly. **Não são valores de TTFB comparáveis**, pois a ferramenta inclui processamento e caminhos diferentes e usou somente uma amostra por URL. Portanto, não calcular aceleração percentual a partir deles.

## Matriz de desempenho e segurança antes/depois

| Grupo | Indicador | Baseline verificado (21/10) | Depois deste PR (produção) | Medição necessária |
|---|---|---:|---|---|
| Lighthouse mobile (lab) | Performance | **61/100** | Sem implantação; desconhecido | Novo PSI após deploy |
| Lighthouse desktop (lab) | Performance | **98/100** | Sem implantação; desconhecido | Novo PSI após deploy |
| Lighthouse mobile (lab) | LCP | **7,4 s** | Sem medição | Lighthouse |
| Lighthouse mobile (lab) | FCP | **6,0 s** | Sem medição | Lighthouse |
| Lighthouse mobile (lab) | CLS | **0,051** | Sem medição | Lighthouse |
| Lighthouse mobile (lab) | TBT | **0 ms** | Sem medição | Lighthouse |
| Lighthouse desktop (lab) | LCP | **0,8 s** | Sem medição | Lighthouse |
| Lighthouse desktop (lab) | FCP | **0,6 s** | Sem medição | Lighthouse |
| Lighthouse desktop (lab) | CLS | **0** | Sem medição | Lighthouse |
| Lighthouse desktop (lab) | Speed Index | **1,3 s** | Sem medição | Lighthouse |
| CrUX mobile (p75, janela de 28d) | LCP | **4,9 s** (ruim) | Sem medição pós-deploy | CrUX p75 |
| CrUX mobile (p75, janela de 28d) | INP | **449 ms** (precisa melhorar) | Sem medição pós-deploy | CrUX p75 |
| CrUX mobile (p75, janela de 28d) | CLS | **0,02** (bom) | Sem medição pós-deploy | CrUX p75 |
| CrUX mobile (p75, janela de 28d) | FCP | **4,7 s** | Sem medição pós-deploy | CrUX p75 |
| CrUX mobile (p75, janela de 28d) | TTFB | **2,0 s** | Sem medição pós-deploy | CrUX p75 |
| Core Web Vitals mobile | Avaliação agregada | **Não passou** | Sem medição pós-deploy | CrUX |
| Fastly edge | Cache HIT ratio | Não disponível | Não medido | Fastly Stats API por serviço |
| Fastly edge | HIT/MISS por POP | Não disponível | Não medido | Real-Time Log Streaming |
| Fastly edge | Bandwidth/requests | Não disponível | Não medido | Fastly Stats API |
| Fastly edge | Egress offload | Não disponível | Não medido | Origin/edge bytes |
| Fastly edge | p95/p99 e status 5xx | Não disponível | Não medido | Logs edge e origin |
| Segurança | Solicitações WAF bloqueadas | Não disponível | Não medido | WAF dashboard |
| Segurança | Fraude/bots/rate-limits | Features avançadas indisponíveis | Não medido | Entitlement e audit logs |
| TLS | Certificado `jogomanager.com` emitido Fastly | **Pendente** no último levantamento | Não comprovado | Fastly TLS API |
| Topologia | Produção roteada Fastly | **Não** no último levantamento | **Não** alterado por esta branch | DNS + Fastly Stats |
| API | Health Fastly via hostname provisório | **Ready** | **Ready** na consulta pública | Verificação contínua |
| API | Health domínio principal | **Ready** | **Ready** na consulta pública | Verificação contínua |
| GitHub | Configuração Supabase da branch | URL/key antigas em `.env` | Projeto de produção corrigido | CI + revisão |
| GitHub | Stripe keys publicáveis | Dev test; prod live | Modos alinhados e bandeiras off | CI + integração Stripe |

**Fontes PSI** (dados de laboratório e campo capturados no relatório de 21/10):
- Mobile: https://pagespeed.web.dev/analysis/https-jogomanager-com/w8ltwldt6r?form_factor=mobile
- Desktop: https://pagespeed.web.dev/analysis/https-jogomanager-com/w8ltwldt6r?form_factor=desktop

### Alvos mensuráveis depois do cutover

- CrUX p75: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1.
- Lighthouse mobile: objetivo 98, **não garantido por CDN**. O gargalo prioritário é LCP/FCP e TTFB mobile. Medir por rota / dispositivo e aplicar lazy-load, fetchpriority de LCP, renderização inicial menor e redução de CPU apenas conforme waterfall.
- Ativar env de produção e MCPs não reduz Core Web Vitals por si só.
