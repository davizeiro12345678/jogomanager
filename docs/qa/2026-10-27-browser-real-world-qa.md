# Auditoria visual real, desktop e mobile (27/10/2026)

## Método e limites
Chrome/Chromium com Puppeteer em dispositivo Windows autorizado, perfil isolado, viewports 1366×768 e 390×844. Inspeção em **https://jogomanager.com** (produção antiga) e prévia local do PR #80; nenhum login em conta real, envio de OTP, assinatura, compra ou alteração de dados. Para contornar falhas inconsistentes do resolvedor DNS local, o browser **somente da auditoria** mapeou jogomanager.com para 172.66.40.241, IP obtido dos nameservers autoritativos da zona. Nenhuma configuração pública foi alterada.

## Matriz de navegação observada
As 14 combinações das rotas `/auth`, `/produtos`, `/loja`, `/visual`, `/partida-rapida`, `/multiplayer` e `/compras` retornaram HTTP **200**, sem exceções `pageerror` não tratadas, sem overflow horizontal e sem elementos `img` quebrados no momento da amostra. HTTP 200 **não implica** que o login, pagamentos, partidas ou todos os recursos estejam funcionando.

- Produção `/produtos`: 10 itens, falso CTA «Comprar como visitante»; prévia modal abre e um Canvas 3D é criado.
- Produção `/loja`: apenas 3 cosméticos apesar de 10 SKUs ativos. O PR #80 remove o filtro e corrige o CTA de visitante.
- Produção `/auth`: campos e-mail/senha, opção link/código de e-mail, recuperação de senha, provedores OAuth e passkeys visíveis. Tela responsiva, mas ainda **sem** teste de callback, entrega ou leitura de e-mail/OTP.
- Produção `/visual`: botões Girar à esquerda/direita, Aproximar/Afastar, Pausar, Restaurar câmera, abas Aparência e Cena operaram sem `pageerror`. «Ver cena» abriu modal cinematográfico «Véspera de clássico» com falas (1/3) e **dois canvases** na página. Foi ampliado o teste para quatro cenas («Chegada ao clube», «Apresentação à imprensa», «Vestiário antes do jogo» e «Túnel de acesso»): as quatro abriram diálogo e 2 Canvas, o botão «Pular cena» fechou corretamente e o Canvas voltou a 1, **sem exceções Javascript**; isso verifica ciclo de abrir/pular/liberar interface, **não** renderização perfeita de todas as 87 cutscenes.
- Produção `/partida-rapida` e `/multiplayer`: seleção de times e página multiplayer carregaram, sem autenticação nem execução de partida real.

## Erros concretos reproduzidos com DevTools e curl
1. O recurso `/assets/QuickLive-CaqWVZqy.css` retorna HTTP **404** com `Content-Type: text/html`, portanto o navegador recusa o recurso como CSS. Observado em múltiplas rotas. É um problema real de arquivo/publicação, **não** se conserta forçando MIME text/css em resposta de erro.
2. Texturas `/__l5e/assets-v1/{id}/*.ktx2`, como `jersey_hoops_normal.ktx2`, devolvem **404 HTML** em `/visual` e `/partida-rapida`. Os manifests de `src/assets/textures` referenciam esses arquivos, que exigem restauração/distribuição válida; fallback procedural não é substituto de CDN.
3. `/cdn-cgi/zaraz/s.js` retorna **401** com HTML em vez de Javascript no perfil de auditoria. Verificar consentimento e regras WAF antes de mudar serviço.
4. DNS: o recursor 1.1.1.1 e o resolvedor Windows por vezes retornaram sem A, enquanto 8.8.8.8 e os NS autoritativos Cloudflare responderam dois endereços; pode causar indisponibilidade percebida seletiva. Necessita análise de recursão/cache/DNSSEC e medições de diversos pontos, não mudança improvisada de DNS.

Issue técnico aberto: **#83**. Esses problemas persistem no deploy público e são independentes da alteração de produto do PR #80.

## Prévia local do PR #80
Servidor Vite temporário `http://127.0.0.1:4173`: `/loja`, `/produtos`, `/auth` renderizaram em 390×844 sem erro de Javascript não tratado ou scroll horizontal. Na `/loja`, o DOM passou a exibir moedas/treino/olheiros/passe (não somente os 3 cosméticos), textos «Entrar para comprar», thumbnails, VIP a R$ 19,90/mês e Premium Max a R$ 39,90/mês **indisponíveis para contratação**. O test runner local não conseguiu validar autenticação remota e páginas de produtos ficaram em «Verificando sua conta» neste perfil. Não é um teste E2E financeiro.

## Testes e liberação
- Vários testes unitários e de contratos do checkout/IndexedDB/entitlement passaram; uma execução completa no PC passou **291 arquivos / 1568 testes**.
- GitHub Quality Gates inclui teste de bundle sem regressão e Lighthouse mobile: ainda falham e não foram desativados. Registrar comparações de baseline com commit.
- **Pendente:** login/OTP/e-mail entregue real, checkout Stripe sandbox/webhook idempotente, VIP entitlement/upgrade/cancel, teste de duas sessões offline (#42), ambiente Lovable antigo (#51), 98/100 no Lighthouse (#52), VPS Redis/AIDE (#75/#78) e renderização final de texturas sem 404.
- **Não mesclar nem implantar** antes das verificações e plano de rollback aprovados.
