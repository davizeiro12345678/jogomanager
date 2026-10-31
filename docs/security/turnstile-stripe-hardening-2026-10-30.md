# JogoManager: rollout de autenticação e pagamento seguros (2026-10-30)

## O que existe

- **Turnstile**: widget gerenciado dedicado para `jogomanager.com` e `www.jogomanager.com`, sitekey pública `0x4AAAAAAFtXRJproFio6FVc`.
- **Frontend**: componente próprio, responsivo, com carregamento lazy e reinicialização após envio. Os tokens chegam às chamadas de login por senha, cadastro, solicitação de link por e-mail, recuperação de senha e reenvio de confirmação do Supabase Auth.
- **Feature flag**: o frontend só exibe/solicita CAPTCHA se `VITE_TURNSTILE_AUTH_ENABLED=true` e a variável pública `VITE_TURNSTILE_SITE_KEY` estiver preenchida. O padrão permanece **desativado** até a configuração do servidor, para evitar interrupções do login.
- **Stripe**: checkout autenticado gera identificador de tentativa estável durante a vida do componente e o transmite ao servidor; a chamada de criação de Checkout Session usa a opção `idempotencyKey` vinculada a ambiente, usuário e SKU. O registro da sessão em `checkout_session_owners` preserva dados anteriores com `ignoreDuplicates`. O webhook já verifica HMAC SHA-256 sobre os bytes brutos, recusa assinaturas expiradas e usa um registro durável de eventos, além de um procedimento de entrega atômica no banco. Estes mecanismos não substituem testes de concorrência reais.

## Antes de ativar Turnstile em produção

1. Confirmar que o site retorna HTTP 200, e não a antiga página de erro HTTP 421.
2. Abrir **Supabase Dashboard > Authentication > Bot and Abuse Protection**, escolher **Cloudflare Turnstile** e inserir a **chave secreta** correspondente ao widget. Nunca expor a chave em `VITE_*` ou no repositório.
3. Configurar nas variáveis públicas do build `VITE_TURNSTILE_SITE_KEY=0x4AAAAAAFtXRJproFio6FVc` e `VITE_TURNSTILE_AUTH_ENABLED=true`.
4. Verificar CSP para `https://challenges.cloudflare.com` em `script-src`, `frame-src` e `connect-src`. Testar navegadores móveis, acessibilidade e extensões bloqueadoras.
5. Testar email/senha, cadastro, OTP mágico, recuperação e reenvio de cadastro; verificar também login social, passkeys, autenticação de convidados e fluxos telefônicos. **Não** habilitar o CAPTCHA global antes de avaliar outros fluxos de autenticação que podem usar o mesmo projeto Supabase e não transmitir `captchaToken`.
6. Validar que tokens ausentes, expirados ou reutilizados são rejeitados pelo **Supabase Auth**, não só pela UI. Aplicar reverter `VITE_TURNSTILE_AUTH_ENABLED=false` se ocorrer bloqueio de usuários legítimos.

## Rate limiting

O plano atual é **Cloudflare Free** e o limite desta conta é 1 regra na fase `http_ratelimit`; ela já está ocupada por bloqueio para credenciais vazadas. Uma nova regra dirigida ao login foi **rejeitada pela API (2 de 1)** e nenhuma regra existente foi alterada.

O login de senha usa `supabase.auth.signInWithPassword`, que chama o host de autenticação do Supabase. Um rate limit na zona `jogomanager.com` **não cobre automaticamente** essa API externa. Aplicar os limites do **Supabase Auth** em seu painel, além de cooldown para solicitação de emails/OTP, antes de afirmar que a autenticação está completamente protegida.

## Authenticated Origin Pulls (AOP)

O interruptor global na Cloudflare já está em `enabled`, mas isso sozinho não comprova autenticação mTLS na origem. A aplicação principal usa Worker e o catálogo em `catalog.jogomanager.com` tem origem VPS. Para exigir mTLS no NGINX dessa VPS é necessário primeiro instalar o certificado CA correto, habilitar a verificação **opcional** e testar o tráfego Cloudflare, só então trocar para `ssl_verify_client on;`. Não ativar obrigatoriedade em toda a zona sem validar cada origem/hostname.

## DANE/TLSA

DNSSEC continua em `pending`, com zero DS publicados no registrador. MX do domínio aponta a `route*.mx.cloudflare.net`, que não pertence ao domínio do cliente. Registros TLSA precisam existir no nome do **servidor MX responsável**, e não devem ser fabricados em `jogomanager.com`. Concluir a cadeia DNSSEC com o registrador e verificar se o **serviço específico de Email Routing** possui TLSA/DANE suportados. Suporte a DANE do produto Cloudflare Email Security MX não implica automaticamente suporte no Email Routing básico.

## Validação e rollout

- Executar `pnpm exec tsc -b --pretty false`, teste `src/lib/stripe-webhook-signature.test.ts`, `src/routes/api/public/payments/-webhook.test.ts`, testes de auth e build antes de merge.
- Testar duas chamadas idênticas de Checkout Session com o mesmo `attemptId` e a mesma sessão do usuário; checar mesma sessão/sem duplicação de `checkout_session_owners`.
- Simular webhook Stripe assinado, assinatura inválida, mesmo `evt_*` enviado repetidamente e mensagens fora de ordem em sandbox.
- Monitorar erros de CSP, desafios, taxas 429/401, checkout e entregas. Fazer rollout gradual e reversível.
