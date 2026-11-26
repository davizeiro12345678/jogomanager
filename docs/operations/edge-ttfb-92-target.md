# Meta de 92% de redução no TTFB: protocolo verificável

**O objetivo é reduzir o TTFB de GET / na mesma região e condição de rede.**
Não é aceitável comparar HEAD com GET, comparar países diferentes nem confundir TTFB com tempo de inicialização da CPU.

## Baseline observada em 14/11/2026 (Windows no Brasil, Cloudflare produção anterior)

24 GET HTTP 200 ao mesmo endereço `https://jogomanager.com/`: mediana **307,3 ms**, p95 **1.209,1 ms**, mínimo **99,3 ms**, conexão DNS+TCP+TLS mediana **56,4 ms**. A variação do p95 entre coletas é alta, portanto repetir a amostragem.

- **92% sobre p95 de 1.209,1 ms** exigiria **p95 ≤96,73 ms**, resultado próximo ao melhor mínimo observado e ainda não demonstrado.
- **92% sobre mediana de 307,3 ms** exigiria **mediana ≤24,58 ms**, inferior ao próprio handshake de rede medido (56,4 ms). Não é uma promessa física realista nessa conexão sem reaproveitamento de conexões ou mudança da rede.

## Otimização implementada na branch, desabilitada até homologação

O cache de HTML anônimo (TTL **180s na home; 3600s em 14 rotas editoriais estáveis, exceto home**) só funciona no Worker, **após validar método, path, cookies, auth, range, query, cache directives**. A chave incorpora o commit de release e o hostname. Captura apenas `GET` público em uma allowlist explícita. Retorna `x-jgm-edge-html-cache: HIT|MISS` para medir.

- Cache HIT **não executa o TanStack SSR** nem solicita a projeção de ligas.
- Um `HTMLRewriter` em cada HIT substitui todos os atributos `nonce` e o conteúdo de `<meta property="csp-nonce">` por um nonce novo. A proteção `secureResponse` recompõe a CSP report-only para o nonce novo. **Não usar Workers Cache na frente do Worker para o HTML que contém nonce**, pois o hit poderia ignorar a renovação.
- Cookies de sessão, `Authorization`, erros, redirecionamentos, `Set-Cookie`, conteúdo privado, `Vary` não suportado e query strings são bypass obrigatório. Somente o cookie não identificador de sessão `__cf_bm`, quando isolado, pode continuar elegível.
- O cache é **opt-in**: binding `PUBLIC_HTML_EDGE_CACHE_ENABLED="1"` somente após revisão, smoke tests e canário. O padrão é desabilitado. Em falha do cache, a requisição segue por SSR normal; rollback é flag `"0"`/remover binding e nova versão/deploy.
- O cache é local ao datacenter na Cache API; não é Workers Cache com tiered e não serve tráfego sem executar o Worker. Custos, ganhos e hit ratio reais só podem ser medidos depois de deploy controlado.

## Benchmark (sem recorte que esconda falhas)

```bash
node scripts/benchmark-edge-ttfb.mjs --samples=24 --url=https://jogomanager.com/ --baseline-p95-ms=1209.1 --target-reduction=92
```

A rotina usa GET, lê o corpo inteiro para concluir a transmissão SSR e o preenchimento do cache, registra tempo até o primeiro byte, status, Cloudflare colo, tempo app/entry/ssr, HIT/MISS e p50/p95. O comando termina com código 2 caso a meta não seja atingida, não reduz silenciosamente o limiar.

Conferir também na aba Network: CSP report-only atualizada a cada resposta, nenhuma identidade/cookie privado em resposta reutilizada, ausência de regressões em auth/multiplayer/pagamentos, respostas 200/404/503 e `Set-Cookie`, HTML gzip e identity, Lighthouse mobile e Web Vitals reais. Somente declarar a meta atingida após comparação consistente da versão publicada com amostras suficientes.

## Resultado do canário real (14/11/2026)

Uma versão de **PREVIEW isolada**, com build exata do SHA `29bdc39657771c259dd50bbedde7bb13b9b68f23`, foi publicada sob o Worker `jogomanager-web` com slug `ttfb-pr132-safe`, sem trocar a versão de produção. Preview D1: `jogomanager-preview`. Binding `PUBLIC_HTML_EDGE_CACHE_ENABLED="1"` **somente na Preview**, sem credenciais Supabase nem Stripe. URL de Preview: `https://ttfb-pr132-safe-jogomanager-web.davizeiro10-jogos.workers.dev/`. Deployment inicial reportou startup da instância de **3ms**, número fornecido pela Cloudflare, diferente de TTFB.

**Falha real encontrada e corrigida antes da medição:** Nitro `lazyService` passa ao serviço SSR apenas `fetch(req)`, sem `env` nem `context` posicionais. Eles são injetados em `request.runtime.cloudflare.env/context`. O cache opt-in inicialmente não via os bindings, causando 0 HITs. O SHA mencionado implementa recuperação por requisição, sem globais compartilhadas. Depois disso a Preview registrou 1 MISS e 11 HITs consecutivos; `Server-Timing: app` caiu para cerca de 4ms nos HITs.

**Testes de segurança reais** com `node scripts/verify-worker-preview-cache.mjs --url=https://ttfb-pr132-safe-jogomanager-web.davizeiro10-jogos.workers.dev/`: PASS, 6/6 HITs com seis nonces distintos, `meta[property="csp-nonce"]` alinhado ao nonce de cada resposta, CSP report-only recomputada por requisição, sessões e bearer bypass `no-store`, URLs com query e `/auth` sem cache, `__cf_bm` isolado pode usar HIT. Em todas as respostas testadas, `cdn-cache-control: no-store` impede cachear HTML na frente do Worker. As regras de CDN para assets continuam intactas.

**Comparação por Node fetch, 30 GETs para cada hostname na mesma máquina brasileira, colo GIG:**

| Métrica | Produção anterior | Preview opt-in | Diferença |
|---|---:|---:|---:|
| TTFB p50 | 67,70ms | 49,25ms | −27,25% |
| TTFB p95 | 1.345,65ms | 123,86ms | **−90,80%** |
| Handler `app` p95 | 112ms | 5ms | **−95,54%** |
| HIT | 0/30 (flag indisponível) | 30/30 | n/a |

**A meta de 92% no TTFB fim a fim NÃO foi demonstrada.** A comparação foi entre produção e um Preview com outro hostname, e o Preview não tinha o mesmo backend Supabase. São amostras pequenas e a produção tem outliers frios, portanto estes percentuais **não são prova de ganho de produção**. É preciso um teste A/B pareado em produção com bindings equivalentes, IPs/colos iguais, proteção contra cookies pessoais, revisão da release e rollback monitorado. A flag de produção continua desabilitada.


## Comparação real entre produção e Preview (14/11/2026, Cloudflare GIG)

Foram executados 28 pares alternados de **GET** na mesma máquina e no mesmo colo GIG, consumindo o HTML completo. O Preview **ttfb-pr132-safe** já estava quente e apresentou 28/28 HITs, 28/28 HTTP 200:

| Métrica | Produção anterior | Preview com cache | Diferença |
| --- | ---: | ---: | ---: |
| TTFB p50 | 71,93 ms | 49,02 ms | -31,85% |
| TTFB p95 | 1.280,12 ms | 138,16 ms | **-89,21%** |
| TTFB p95 sem primeira amostra | 499,84 ms | 111,14 ms | -77,77% |
| Server-Timing app p95 | 106 ms | 6 ms | -94,34% |

A medição é curta, limitada a um único colo e Preview com dependências potencialmente diferentes. **A meta de 92% no p95 não foi atingida nesta amostra**, e nenhum resultado deve ser vendido como benefício comprovado de produção.

**Correção de CI da Cloudflare:** Workers Builds usava Bun 1.2.15, incompatível com `bun.lock` v3. O Preview da branch `integration/release-2026-11-11` passou a usar Bun 1.4.4, mas o lock ainda divergia de `package.json` nos overrides Hono/React Email. Regeneramos `bun.lock` com Bun 1.4.4 e verificamos `bun install --frozen-lockfile --lockfile-only` antes de publicar o commit no PR. O build do Preview da branch voltou a concluir com sucesso, sem implantar em produção.

**Ativação restrita:** `vite.config.ts` agora declara `previews.vars.PUBLIC_HTML_EDGE_CACHE_ENABLED="1"`, enquanto não existe a flag na configuração de produção. Assim, todo Preview atualizado testa o cache de 180 segundos e a rotação dos nonces sem alterar `jogomanager.com`. A condição para release permanece: revalidar a versão atual do PR com `scripts/verify-worker-preview-cache.mjs`, comparar TTFB com GET no mesmo POP, confirmar os Quality Gates e aplicar rollout controlado.
