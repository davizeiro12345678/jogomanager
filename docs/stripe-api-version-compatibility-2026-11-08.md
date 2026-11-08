# Stripe API version compatibility — 2026-11-08

## Decisão

O checkout estava com `stripe@23.0.0` nos locks, embora o ambiente de trabalho tivesse `stripe@23.1.0`. Como o workflow de CI usa `npm ci`, a divergência podia fazer o typecheck depender do conteúdo preinstalado de `node_modules`. `package.json`, `package-lock.json` e `bun.lock` foram alinhados a `stripe@^23.1.0` / `23.1.0`, e os caminhos de cliente nativo e gateway agora fixam `2026-10-28.endive`, versão que corresponde aos tipos dessa release do SDK. O tuple de Bun usa a integridade SRI do pacote 23.1.0; não foi possível executar validação com Bun porque a CLI não está instalada neste ambiente.

A Stripe informa que as versões mensais iniciadas em `2024-09-30` não introduzem breaking changes, e identifica `2026-10-28.endive` como a versão atual. A documentação ainda recomenda verificar o changelog específico da integração antes de mudar a versão [1] [2]. O changelog de Endive registra a remoção de `payment_method_types` de Checkout Sessions em `2026-09-30`; a busca no runtime deste repositório não encontrou uso desse parâmetro [3]. As alterações listadas para `2026-10-28.endive` são adições marcadas como não-breaking no changelog [4].

## Evidência e limites

O teste local `src/lib/stripe.server.test.ts` usa `fetch` mockado e confirma que o header `Stripe-Version` enviado é `2026-10-28.endive`. Foram executados os seis testes do arquivo, sem chamar a API Stripe nem processar pagamentos. O typecheck estrito também passou após alinhar os dois clientes e o lockfile.

Isso não substitui uma validação de checkout ponta a ponta em sandbox. Antes de qualquer publicação, testar checkout de visitante e de usuário, compra única, assinatura quando aplicável e entrega por webhook. A versão de eventos de webhook é configurada no destino e é independente da versão fixada pelo cliente SDK; nenhum endpoint ou evento de produção foi alterado [1] [2].

## Referências

[1]: https://docs.stripe.com/api/versioning "Stripe API versioning"
[2]: https://docs.stripe.com/upgrades "Upgrade your integration"
[3]: https://docs.stripe.com/changelog/endive "Endive API changelog"
[4]: https://docs.stripe.com/changelog "Stripe API changelog"
