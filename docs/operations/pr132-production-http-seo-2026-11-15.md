# PR #132 | Produção: HTTP/SEO após hotfix #138 (observado 15/11/2026 UTC)

**Status:** FALHA P0 ainda reproduzível. Este documento é uma verificação pública READ-ONLY, não uma aprovação de deploy nem prova de correção.

## Novas observações públicas verificadas

A inspeção anônima com navegador consultou **oito URLs** do domínio, NÃO as 12 tabelas. Os resultados foram:

| Rota | HTTP | X-Robots-Tag | Evidência |
|---|---:|---|---|
| `/api/health` | 503 | `noindex, nofollow` | `a5b1e5134c5743d9-EWR`, 23:04:27 GMT; retorno `status=degraded` e `auth=false, serverCredentials=false, database=false` |
| `/tabelas/brasileirao-serie-a` | 500 | `noindex, nofollow` | `a5b1e6102e2c43d9-EWR`, 23:05:05 GMT; fallback da tabela sem dados |
| `/tabelas/premier-league` | 500 | `noindex, nofollow` | `a5b1e6176c4943d9-EWR`, 23:05:06 GMT; fallback da tabela sem dados |
| `/jogo-de-manager-de-futebol` | 200 | `noindex, follow` | `a5b1e61e9a3243d9-EWR`, 23:05:07 GMT; conteúdo presente |
| `/tabelas` | 200 | `noindex, follow` | `a5b1e6263fdd43d9-EWR`, 23:05:08 GMT; conteúdo presente |
| `/melhores-formacoes` | 200 | `noindex, follow` | `a5b1e62d8d5943d9-EWR`, 23:05:10 GMT; conteúdo presente |
| `/robots.txt` | 200 | nenhum | `a5b1e5a79d1a43d9-EWR`, 23:04:48 GMT; texto válido |
| `/sitemap.xml` | 200 | nenhum | `a5b1e5bf385343d9-EWR`, 23:04:52 GMT; XML válido |

### Cloudflare: estado e investigação de bindings

A API autenticada Cloudflare confirmou a implantação ativa `58f126fd-b8db-4781-8dd7-31ce8f562af2` do Worker `jogomanager-web` desde **2026-11-14T23:01:28Z**, version ID `4f8a15da-d6f7-4fcd-86f5-67ec491f4303` (100%). Também confirmou os **nomes dos bindings** `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, mas não validou o valor do segredo nem o que chega ao handler.

Uma inspeção read-only do próprio código compilado, obtido da API do Worker (20.407.553 caracteres, multipart), encontrou:

- Rota `/api/health` carregando bindings de `request.runtime.cloudflare.env`, tentando `import("cloudflare:workers")` e depois `selectBackendHealthEnvironment(processModule.env, workerBindings)`.
- `checkBackendHealth` fazendo GET `/auth/v1/settings` com a publishable key e verificando `external`; somente depois faz a consulta administrativa e `competitions?select=id&limit=1` com segredo.
- Portanto o código **contém** a correção de leitura de bindings; o 503 ainda existe. Possíveis causas a discriminar por observabilidade: bindings nativos indisponíveis em runtime no handler, upstream Auth/settings rejeitado, key inválida/rotacionada, bloqueio da requisição ou erro em estágios posteriores. Não atribuir o defeito exclusivamente à árvore de dependências SSR ou ao WAF sem logs.

Foi observado, de uma origem externa independente, que `https://lguqnwvsfeefxamzeyos.supabase.co/auth/v1/settings` respondeu um JSON com `external` usando a publishable key do Worker. Esse êxito da origem externa não prova o resultado dentro do Worker nem o valor/validade do service key. Nenhum segredo foi registrado neste relatório.

## Gate operacional para corrigir sem falsos positivos

1. Correlacionar Ray ID do 503 com Workers observability/logs, recuperar **apenas status e etapa** (bindings resolved, auth GET, admin GET, db GET), SEM dump de headers ou credenciais.
2. No preview isolado com a MESMA versão da aplicação, testar conectividade real aos três endpoints com credenciais próprias e segredos limitados, sem expor o `service_role` em logs ou Frontend. Nenhum segredo de produção deve entrar no staging cooperativo.
3. Corrigir a causa comprovada e obter teste de regressão que falhava antes e passe depois, compilar, testar TypeScript/Prettier, 43 checks, full CI, Lighthouse e baseline bundles.
4. Publicar hotfix isolado com rollback definido, se autorizado, sem promover o PR #132 inteiro ainda incompleto; confirmar SHA publicado/versão, `/api/health=200`, as **12** tabelas com dados reais e sem 500, e as seis rotas indexáveis sem `noindex`.
5. Rastrear sitemap, canonical, X-Robots-Tag, robots e render SSR em GET+HEAD; solicitar recrawl ao Semrush depois de HTTP 200 e conteúdo legítimo. Não habilitar indexação de páginas de erro 500.

Links das evidências públicas: https://jogomanager.com/api/health · https://jogomanager.com/tabelas/brasileirao-serie-a · https://jogomanager.com/tabelas/premier-league · https://jogomanager.com/robots.txt · https://jogomanager.com/sitemap.xml

**Proibição de mascaramento:** não substituir SSR quebrado por HTTP 200 com corpo de erro, não remover páginas do sitemap para aparentar ausência de 500, não desafrouxar WAF e não dizer que PR #138 curou a produção sem rechecagem.
