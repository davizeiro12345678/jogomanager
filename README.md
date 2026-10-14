# Pro Football Manager 3D

[![CodSpeed](https://img.shields.io/endpoint?url=https://codspeed.io/badge.json)](https://app.codspeed.io/davizeiro12345678/jogomanager?utm_source=badge)

Jogo de gerenciamento de futebol para navegador, com carreira de treinador, táticas, elencos e visualização de partidas em 3D. A disponibilidade de recursos pode variar conforme dispositivo, conta e serviços online.

This project was built with [Lovable](https://lovable.dev).

**Site oficial e URL canônica:** https://jogomanager.com

> **Publicação:** o conteúdo do GitHub/Lovable não comprova, por si só, a versão servida pelo domínio público. Após publicar, execute `node scripts/check-live-llms.mjs` e confira o deploy e eventuais caches da CDN.

## Pagamentos

O catálogo é público e a pessoa pode iniciar uma compra visitante por e-mail.
Depois do pagamento, um link passwordless cria ou vincula a conta que recebe o
item. Configure `PAYMENTS_ENVIRONMENT=sandbox` no preview e
`PAYMENTS_ENVIRONMENT=live` no publicado. A configuração do servidor precisa
corresponder ao prefixo da chave pública `VITE_PAYMENTS_CLIENT_TOKEN`;
divergências falham fechadas. O checkout visitante também exige a feature flag
do ambiente e, quando `GUEST_CHECKOUT_ENVIRONMENT` estiver definida, ela deve
corresponder ao ambiente de pagamentos do deploy.

## Desenvolvimento com Lovable

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
