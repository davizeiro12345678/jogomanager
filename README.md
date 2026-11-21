# Pro Football Manager 3D

[![Quality Gates](https://github.com/davizeiro12345678/jogomanager/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/davizeiro12345678/jogomanager/actions/workflows/quality.yml)
[![CodSpeed](https://img.shields.io/endpoint?url=https://codspeed.io/badge.json)](https://app.codspeed.io/davizeiro12345678/jogomanager)
[![Security Policy](https://img.shields.io/badge/security-responsible%20disclosure-26705a)](SECURITY.md)

Gerencie seu clube, desenvolva atletas, escolha táticas e acompanhe partidas em 3D. **Pro Football Manager 3D** é um jogo brasileiro de gestão de futebol desenvolvido para navegadores em computadores e dispositivos móveis.

**[Jogar no site oficial](https://jogomanager.com)** · **[Abrir modo carreira](https://jogomanager.com/modo-carreira)** · **[Reportar uma vulnerabilidade](SECURITY.md)**

> **Estado de publicação:** `main`, branches de integração e implantação em `jogomanager.com` podem representar versões diferentes. Uma aprovação de CI **não** significa deploy, homologação de todos os recursos ou ausência de falhas de segurança.

## O jogo

- **Carreira de treinador:** gestão do elenco, desenvolvimento de jogadores, transferências e decisões táticas.
- **Partidas e visualização 3D:** simulação determinística, modelos e qualidade gráfica ajustados à compatibilidade do dispositivo.
- **Futebol e dados:** competições, clubes, atletas e tabelas atualizados por pipelines de ingestão controlados.
- **Multiplayer:** funcionalidades em desenvolvimento e homologação; verifique o ambiente e o modo antes de assumir que partidas online estão disponíveis.

## Arquitetura e desenvolvimento

| Camada | Tecnologias |
| --- | --- |
| Aplicativo web | React, TypeScript, TanStack Start/Router, Vite |
| Motor e visualização | Three.js, React Three Fiber, Rapier, Rust/WASM, Web Workers |
| Dados e autenticação | Supabase PostgreSQL, RLS, Supabase Auth |
| Serviços e infraestrutura | Cloudflare Workers/Durable Objects, armazenamento isolado, VPS |
| Qualidade | Vitest, Playwright, Lighthouse, CodSpeed e GitHub Actions |

**Ambiente de desenvolvimento:** Node.js na versão de `.nvmrc` e npm. Nunca reutilize tokens, sessões, chaves Stripe ou dados pessoais de produção em testes locais ou staging.

```bash
git clone https://github.com/davizeiro12345678/jogomanager.git
cd jogomanager
npm ci
npm run dev
```

### Verificações antes de integrar

```bash
npm run lint
npm exec -- tsc --noEmit --pretty false
npm test
PFM_LOCAL_VERIFY=1 npm run build
npm run wasm:test
npm run graphics:build
npm audit --omit=dev --audit-level=high
```

O workflow [Quality Gates](.github/workflows/quality.yml) contém os testes mais próximos da liberação, incluindo o replay de migrações, contratos de segurança, estresse determinístico, bundles e Lighthouse. O [CodSpeed](.github/workflows/codspeed.yml) mede 16 cargas distintas com comparação ABBA entre base e candidato no **mesmo runner**. A execução no mesmo runner não é uma garantia de que dois workflows, em datas diferentes, usarão o mesmo CPU; não declare ganhos percentuais sem artefato e ambiente comparável.

## Publicação, pagamentos e serviços online

Mudanças devem passar por PR, revisão apropriada, checks exigidos e homologação isolada antes de qualquer implantação. Staging e produção possuem dados, segredos e permissões separados. Compras usam validação de ambiente, webhook assinado e processamento idempotente; **somente dados de teste** podem ser usados na homologação Stripe.

A versão visível no domínio pode diferir do código: confira os arquivos públicos `/llms.txt`, `/robots.txt` e `/sitemap.xml` após o deploy com:

```bash
node scripts/verify-public-discovery.mjs --live
```

Para desenvolvimento visual, execute `npm run graphics:build` e `npm run graphics:preview`; o estúdio abre em `http://127.0.0.1:4193/player-studio.html`. O proxy de prévia só deve buscar assets públicos e não encaminha cookies ou headers de autenticação.

## Segurança e divulgação responsável

Consulte [SECURITY.md](SECURITY.md) para divulgar vulnerabilidades **de maneira privada**. Não publique segredos, dados de jogadores, provas de exploração ou informações sobre credenciais nos Issues públicos. As configurações de CSP, headers, permissões de Cloudflare, controles Supabase RLS e segurança do VPS são verificadas separadamente — não presuma que um check isolado certifica o sistema inteiro.

## Projeto e créditos

Projeto mantido no repositório [davizeiro12345678/jogomanager](https://github.com/davizeiro12345678/jogomanager). A edição assistida por [Lovable](https://lovable.dev/projects/f0dcad90-231c-4ef4-bd1b-b199f3902fb1) pode fazer parte do fluxo de desenvolvimento, mas a revisão de código, os controles de segurança e as decisões de release permanecem no projeto.
