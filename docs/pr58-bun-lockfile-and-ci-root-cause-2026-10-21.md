# Dependabot 58: reconciliação segura de npm/Bun em 21/10/2026

O projeto tem `package-lock.json` e `bun.lock`. O Cloudflare Workers Builds parou na fase `bun install --frozen-lockfile` porque o `bun.lock` não acompanhava o bloco `overrides` do `package.json`. Evidência: build `2c16976a-43a2-482d-89d3-376c206513d5` do Worker `jogomanager-web`, 21/10/2026, com `error: lockfile had changes, but lockfile is frozen` e `overrides in package.json changed since bun.lock was saved`.

A branch #58 conserva o patch de `hono@4.13.13`. O workflow `security-lockfile-reconcile.yml` foi habilitado nela, regenerando `package-lock.json` e `bun.lock` sem executar scripts de dependências. Não remover a verificação de lockfile congelado; conferir `bun ci` novamente após merge.

A etapa `npm run bundle:check` ainda bloqueia o bundle de física Rapier (210.463 bytes JS contra limite real de 180.000) e Lighthouse móvel não atinge critérios LCP/TBT. Isso antecede esta atualização de dependências. Não marcar como aprovado até solucionar esses problemas de fato.

Cloudflare também possui um pipeline independente em `.github/workflows/cloudflare-production.yml` que somente publica `main` após `Quality gates` verde e checagem de segredos. A integração nativa Cloudflare Workers Builds usa `bun run build` / `npx wrangler deploy` sem variáveis de build; nunca presumir que essa integração duplicada já substitui o pipeline autenticado e validado.