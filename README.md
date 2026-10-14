# Pro Football Manager 3D

[![CodSpeed](https://img.shields.io/endpoint?url=https://codspeed.io/badge.json)](https://app.codspeed.io/davizeiro12345678/jogomanager?utm_source=badge)

Jogo brasileiro de gerenciamento de futebol no navegador, com carreira de treinador, gestão de clubes, táticas e visualização de partidas em 3D conforme a compatibilidade do dispositivo.

**Site oficial e endereço canônico:** https://jogomanager.com

**Desenvolvimento:** [Lovable](https://lovable.dev/projects/f0dcad90-231c-4ef4-bd1b-b199f3902fb1) · [Repositório de código](https://github.com/davizeiro12345678/jogomanager)

O site publicado pode não refletir imediatamente a branch principal: integração de código, publicação do deploy e atualização de cache na CDN são etapas distintas. Compare sempre `/llms.txt`, `/robots.txt` e `/sitemap.xml` no domínio canônico com a revisão de código efetivamente implantada.

## Pagamentos

O catálogo é público e a pessoa pode iniciar uma compra visitante por e-mail.
Depois do pagamento, um link passwordless cria ou vincula a conta que recebe o
item. Configure `PAYMENTS_ENVIRONMENT=sandbox` no preview e
`PAYMENTS_ENVIRONMENT=live` no publicado. A configuração do servidor precisa
corresponder ao prefixo da chave pública `VITE_PAYMENTS_CLIENT_TOKEN`;
divergências falham fechadas. O checkout visitante também exige a feature flag
do ambiente e, quando `GUEST_CHECKOUT_ENVIRONMENT` estiver definida, ela deve
corresponder ao ambiente de pagamentos do deploy.

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f0dcad90-231c-4ef4-bd1b-b199f3902fb1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone https://github.com/davizeiro12345678/jogomanager.git
cd jogomanager
npm ci
npm run dev
```

## Qualidade, segurança e documentação pública

A definição de CI está em `.github/workflows/quality.yml`. Antes de publicar mudanças, execute:

```sh
npm ci
npm run lint
npm exec -- tsc --noEmit --pretty false
npm test
PFM_LOCAL_VERIFY=1 npm run build
npm run wasm:test
npm run graphics:build
npm audit --omit=dev --audit-level=high
```

Os testes Rust/WASM e Lighthouse precisam das ferramentas e do ambiente descritos no workflow. Não considere testes que não rodaram como aprovados.

O índice de páginas públicas fica em `public/llms.txt` e deve referenciar apenas URLs canônicas com rotas efetivamente publicadas. Depois do deploy, verifique a versão servida no domínio oficial:

```sh
node scripts/verify-public-discovery.mjs --live
```

Esse comando compara o conteúdo no repositório com a versão pública, confere o tipo de resposta e repete a consulta com URL única para ajudar a distinguir cache desatualizado de deploy ainda não publicado. A verificação não publica automaticamente nem apaga caches. Se detectar divergência, confira a revisão implantada e só então invalide a URL pública afetada na CDN.
