# Evidência de responsividade do login (27/10/2026)

## Ambiente e escopo
- Site publicado: `https://jogomanager.com/auth`, captura no Chrome headless com viewport móvel de 390 px. Não foi enviada nenhuma credencial, e-mail, OTP ou compra.
- Candidato: servidor local da branch `fix/store-all-skus-verified-checkout-oct27`, rota `http://127.0.0.1:5173/auth`, Chrome DevTools Protocol (CDP) com `Emulation.setDeviceMetricsOverride` para **390 × 844 CSS px**.
- A captura da produção também foi validada por `curl -I` com HTTP 200; uma automação de terceiros registrou `ERR_EMPTY_RESPONSE` em outra sessão, o que não comprova indisponibilidade global.

## Defeito confirmado
Na versão pública anterior, o grid de `/auth` ultrapassava o viewport de 390 px. A última coluna dos provedores OAuth, o formulário de e-mail e parte do painel ficavam cortados horizontalmente (captura **antes** abaixo). A causa compatível com a inspeção de CSS era o dimensionamento mínimo intrínseco das trilhas implícitas de grid e controles sociais sem quebra de linha.

## Correção no PR
- `.auth-stage`: `grid-template-columns: minmax(0, 1fr)` e `min-width: 0`.
- `.auth-card`: `max-width: 100%` e `min-width: 0`.
- Campos, seções e formulário podem encolher; botões sociais quebram linha sem ultrapassar o contêiner.

## Resultado reproduzido
Após a alteração, o CDP retornou:
- `window.innerWidth = 390`
- `document.documentElement.scrollWidth = 390`
- `document.body.scrollWidth = 390`
- `.auth-card`: x=16, right=374, width=358
- `#auth-email`: x=41, right=349, width=308
- `.auth-social`: right=349, width=308

A captura mostra a terceira coluna OAuth e o campo de e-mail integralmente dentro do espaço disponível. **Não houve overflow horizontal no cenário medido.**

### Antes: produção
![Login cortado horizontalmente no celular](./auth-mobile-before-20261027.png)

### Depois: branch local
![Login dentro do viewport após CSS](./auth-mobile-after-20261027.png)

## Verificações adicionais
CDP simulando 390 px, páginas públicas locais `/produtos`, `/loja`, `/visual` e `/partida-rapida`: `innerWidth=390`, `documentWidth=390`, `bodyWidth=390`, sem nós fora da largura detectados no instante da captura. **Isto é uma checagem de largura**, não uma auditoria funcional completa: as páginas `/loja` e `/visual` ainda exibiam carregamento inicial durante a amostra, e a vitrine esperava checar a conta.

## Limitações e critérios de publicação
- Não foram testados login real, recebimento de e-mail/código, WebAuthn, OAuth concluído, pagamento Stripe, jogo 3D completo ou dispositivos físicos.
- O PR mantém gates obrigatórios de Lighthouse mobile, comparação de bundle e testes de gameplay; screenshots não substituem esses testes e **não autorizam deploy**.
