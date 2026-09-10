# Estádio, pagamentos reais, jogadores e painel de compras

## 1. Pagamento de verdade (prioridade 1)

Hoje nenhuma compra chega à conta: a tabela de compras está vazia. A causa provável é que o aviso de pagamento enviado pela Stripe não traz os itens comprados, então o jogo não descobre qual pacote foi pago e a entrega falha em silêncio.

O que será feito:

- Ao receber o aviso de pagamento, buscar a compra completa na Stripe (com os itens) antes de creditar.
- Registrar a compra como "pendente" assim que o pagamento é iniciado e mudar para "concluída" quando confirmar, para nada sumir.
- Evitar crédito duplicado se o aviso chegar duas vezes.
- Guardar o erro quando algo falhar, para aparecer no painel de compras.
- Tela de retorno do pagamento: em vez de dizer "confirmado" na hora, conferir a carteira a cada 2 segundos (até ~30s) e mostrar as moedas creditadas, com botão de "atualizar" se demorar.
- A loja passa a atualizar o saldo sozinha ao voltar do pagamento.

Teste: uma compra de R$4,90 no ambiente de teste precisa aparecer na carteira e no histórico.

## 2. Painel de compras (nova página)

Nova página "Minhas compras" (`/compras`), só para quem está logado:

- Total gasto, quantidade de compras e saldo atual em destaque.
- Lista de compras pendentes, com aviso de que a entrega pode levar alguns segundos.
- Histórico completo com data, item, valor e situação.
- Estados de carregando, vazio e erro.
- Eventos enviados ao PostHog: loja aberta, compra iniciada, compra concluída, compra pendente e painel visitado (sem nenhum dado pessoal).
- Entrada no menu do jogo e na loja.

## 3. Estádio, muros, arquibancada, placas e céu

- Muros e concreto: manchas de umidade, juntas, pichação leve, desgaste diferente por altura.
- Arquibancada: cadeiras com variação de cor e sujeira, corrimãos, escadas e numeração de setor.
- Placas de LED: brilho pulsante, varredura de luz, reflexo no gramado e alternância entre patrocinadores.
- Céu: nuvens volumétricas que se movem com o vento, variando com o horário e o clima escolhidos em `/visual`.
- Torcida: mais variação de roupa por setor, bandeiras maiores, ondas mais naturais e densidade diferente atrás dos gols.
- Tudo respeitando os três níveis de qualidade — no celular a versão leve continua sem nuvens pesadas.

## 4. Jogadores (modelo e materiais)

- Pele: tom real com variação, brilho de suor que aumenta com o cansaço e sujeira que acumula no uniforme.
- Cabelo: mais formas (curto, cacheado, dread, coque, raspado), com volume e fios visíveis de perto.
- Uniforme: escudo do clube estampado no peito, patch da liga, gola e tecido com trama visível.
- Roupas sociais para técnico e comissão nas cenas fora do jogo (terno, camisa, agasalho da comissão).
- Geometria: ombros, joelhos e tornozelos com melhor formato, mãos mais definidas e chuteiras com solado.
- Continua com os níveis de detalhe para não pesar no celular.

## 5. Interface, tipografia, ícone e página "Sobre"

- Painéis do jogo com títulos claros, explicação curta do que cada número significa e ordem mais lógica.
- Tela de início mais direta: um caminho óbvio para começar e outro para continuar.
- Tipografia revista (tamanhos, espaçamento e contraste) para leitura fácil no celular.
- Imagens de apoio geradas para a página inicial, a loja e o "Sobre".
- Ícone e imagem de compartilhamento novos, com cara de jogo profissional.
- Nova página "Sobre" contando o que é o jogo, como funciona e quem faz.

## 6. Domínio: melhor opção para o seu orçamento

Com R$29 disponíveis, as opções `.com` custam cerca de US$ 11 (≈ R$60), acima do orçamento.

Recomendação com melhor equilíbrio entre nome brasileiro, cliques e preço:

- **futmanager.xyz** — US$ 1,99 no primeiro ano (renova US$ 12,80). Curto, fácil de digitar e lembra "manager de futebol".
- Alternativas iguais em preço: `seutecnico.xyz`, `futebolmanager.xyz`, `managerbr.xyz`.
- Se puder gastar um pouco mais depois: **tecnicodefutebol.com** ou **jogodetecnico.com** (US$ 11,10/ano) são os melhores para busca no Google em português.

Você já tem vários domínios ligados ao projeto; o novo pode virar o endereço principal se quiser.

## Detalhes técnicos

- Webhook `src/routes/api/public/payments/webhook.ts`: recuperar a sessão com `expand: ["line_items.data.price"]` via `createStripeClient(env)` antes de chamar `fulfillOneTimePurchase`; tratar `checkout.session.completed` e `async_payment_succeeded` pelo mesmo caminho.
- `src/lib/fulfillment.server.ts`: idempotência por `reference` (chave única em `user_purchases.reference`), atualização de `pending` → `completed`/`failed` e coluna de erro; migração com GRANTs e políticas de leitura própria.
- Nova função de servidor autenticada para listar compras + carteira (`requireSupabaseAuth`), consumida pela rota `/compras` com TanStack Query.
- Estádio: novas texturas procedurais em `src/components/game/stadium/textures/` (nuvens, cadeiras, muro) com cache por chave e `THREE.Texture.DEFAULT_ANISOTROPY` já configurado; céu com shader de nuvens ligado ao clima de `visual-settings.ts`.
- Jogadores: ampliar `src/game/player-model.ts` (cabelo, tom de pele, traje) e `PlayerRig.tsx`, com escudo via textura de canvas reaproveitando `Crest`; manter os limiares de LOD por qualidade.
- SEO: `head()` próprio para `/compras` (noindex) e `/sobre` (indexável, com título, descrição e og).
- Verificação: `tsgo --noEmit`, build limpo, compra de teste ponta a ponta e captura de tela em 390px.
