# Cobertura i18n e auditoria de texto literal — 2026-11-08

## Escopos separados

Este documento separa três fatos que não devem ser confundidos:

1. **Paridade estrutural:** o checker verifica JSON válido, chaves, duplicatas, valores vazios e placeholders.
2. **Elegibilidade runtime:** um manifesto explícito decide quais locales podem chegar ao `I18nProvider`.
3. **Hardcoded:** um gate independente registra candidatos de texto literal em TSX e compara o working tree com um baseline; ele não afirma que cada ocorrência de texto precisa de tradução nem que a localização está completa.

Nenhum desses gates certifica qualidade semântica, adequação cultural ou revisão por falantes nativos. Os packs gerados continuam com `status: "draft"` e `reviewRequired: true`.

## Resultado estrutural-only

O catálogo declara **98 locales** e **238 chaves canônicas**. Os **98 JSONs completos** foram mantidos em `src/i18n/drafts/locale-packs/`, fora de `public/`, e o parity checker encontrou 98/98 packs estruturalmente completos, sem chaves ausentes/desconhecidas, duplicatas, valores vazios ou divergências de placeholder.

O comando estrutural é:

```sh
node scripts/i18n-parity.mjs --check
```

O relatório tem `auditKind: "structural-only"`, `semanticReview: "not-assessed"` e `hardcodedAudit: "separate-gate"`. `allPacksComplete: true` significa somente **completo segundo essas regras estruturais para os drafts**; não significa tradução aprovada, publicação ou localização integral do produto. O gate também falha se algum JSON reaparecer em `public/locale-packs/`.

## Política runtime e legado publicado

O manifesto [`src/i18n/locale-runtime-manifest.ts`](../src/i18n/locale-runtime-manifest.ts) permite somente **26 locales com caminho runtime comprovado**:

- `pt-BR` e `en`, servidos pelo bootstrap síncrono;
- os 24 packs parciais que já existiam no `HEAD`, preservados em `src/i18n/packs/` como comportamento legado previamente publicado: `ar`, `bn`, `de`, `es`, `fa`, `fr`, `hi`, `id`, `it`, `ja`, `ko`, `mr`, `pa`, `pl`, `pt-PT`, `ru`, `sw`, `ta`, `te`, `th`, `tr`, `ur`, `vi` e `zh-CN`.

A existência legada é uma decisão de elegibilidade runtime, não uma nova aprovação semântica. O loader rejeita antes de qualquer import um locale fora da allowlist; o provider também rejeita seleção/detecção de draft e não instala seu translator. Os 98 drafts completos, inclusive os 24 códigos que têm uma cópia legada, não são assets runtime e não sobrescrevem os packs legados.

## Gate separado de hardcoded

O scanner [`scripts/i18n-hardcoded.mjs`](../scripts/i18n-hardcoded.mjs) usa uma heurística baseada no AST TypeScript para registrar `JSXText`, strings literais diretas em expressões JSX e atributos de apresentação (`alt`, `aria-description`, `aria-label`, `label`, `placeholder` e `title`). Seu escopo efetivo é `src/**/*.tsx`, excluindo `src/i18n/**` e arquivos `*.test.tsx`; portanto, ele não percorre `.ts`, `.js`, `.jsx`, HTML, Markdown ou CSS, nem detecta textos montados em runtime, valores vindos de dados/props ou atributos JSX fora da lista.

O baseline contém **3.058 candidatos em 184 arquivos**. A aferição atual deste checkout encontra **3.055 candidatos em 184 arquivos**, sem adições e com três remoções em relação à baseline. Esse número é uma triagem reprodutível, não uma contagem de strings que certamente precisam ser localizadas: pode incluir conteúdo editorial, nomes próprios, texto derivado de dados, marcas e falsos positivos; não cobre todo texto montado em runtime.

O baseline está em [`scripts/i18n-hardcoded-baseline.json`](../scripts/i18n-hardcoded-baseline.json). O gate compara candidato por arquivo/tipo/texto (a linha fica no relatório como contexto) e falha somente quando surgem strings candidatas novas. Ele é executado no job `verify` do workflow de qualidade junto com os testes isolados dos dois checkers:

```sh
node scripts/i18n-hardcoded.mjs --check
node --test scripts/i18n-parity.test.mjs scripts/i18n-hardcoded.test.mjs
```

O teste isolado verifica tanto o caso sem adições quanto a detecção de um candidato novo:

```sh
node --test scripts/i18n-hardcoded.test.mjs
```

Nenhum candidato novo foi aferido. As três remoções/alterações aparecem na comparação com a baseline e não são usadas para afirmar localização completa.

## Limitações e próximos passos

Não houve revisão humana completa, certificação nativa, teste de layout para todos os idiomas, validação cultural ou declaração de tradução semântica aprovada. Enquanto essa revisão não ocorrer, os packs gerados permanecem drafts. O próximo trabalho, separado deste gate, deve classificar os candidatos hardcoded (UI transacional/jogabilidade, acessibilidade, editorial/SEO e texto derivado de dados), extrair apenas os que tiverem uma decisão de produto e submeter novas traduções à revisão humana antes de alterar a allowlist runtime.
