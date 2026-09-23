# Pro Football Manager 3D

faça um jogo de futebol mega realista 3d onde vc e o manager

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://stadium-stewards.lovable.app

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
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
