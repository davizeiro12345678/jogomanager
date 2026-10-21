# JogoManager • revisão real de CI, bundles, Resend e Twilio (2026-10-21)

## Estado observado no GitHub
- PR #55: merged; PR #57: merged.
- PR #56: open/unmerged. PR #58 (atualização Hono): open/unmerged.
- PR #59: open, draft e **não aprovado**, apesar do CodSpeed e do verificador de .env/MCP terem passado em uma execução anterior.
- Quality gates na execução #39683377821 (antes das correções posteriores): vários jobs aprovados, mas quatro bloqueios:
  1. `bundle:check`: `rapier-0r-CT2Vq.js` = **210.463 bytes**, maior que orçamento de **180.000 bytes** embora exista WASM externo. A evidência exige investigação de tree-shaking/versão Rapier, não aumento arbitrário do limite.
  2. Bundle total comparado no mesmo runner: **2.307.096 B gzip**, contra **2.305.892 B** baseline (+**1.204 B**); Brotli **2.175.026 B** contra **2.173.866 B** (+**1.160 B**). Inúmeras rotas startup aumentaram alguns bytes, falha por gate de *zero regression*.
  3. Migration replay do Postgres local falhou porque o `stripe` schema gerenciado não existe localmente.
  4. Lighthouse mobile medido pelo GitHub **não atingiu** os thresholds `categories.performance` e `largest-contentful-paint` em 5 páginas/15 medições. Não inventar score.
- Uma migration foi corrigida com guard de schema; outra migration `20261021183605_stripe_webhook_fk_and_query_diagnostics.sql` também foi corrigida para não exigir Stripe no banco local. Essas correções **ainda exigem novo CI verde**.
- O PR #59 contém alterações no frontend: seções secundárias `HomeDetails` e `HomeLeaguePulse` em chunks sob demanda; controles de acessibilidade do layout raiz em chunk carregado apenas quando usados; metadados de gameplay não baixados em páginas editoriais. As economias ainda **não foram medidas em produção**. Exposição do `Server-Timing` permite isolar duração de handler SSR.
- Não habilitar merge/deploy quando a suíte geral falhar. Não mascarar falhas de CI diminuindo thresholds arbitrariamente.

## Fluxo Resend alterado
- Domínio `jogomanager.com` no Resend: verified, região `sa-east-1`, envio enabled; cap reportado: 100 emails/dia, 3.000/mês; sem mensagens enviadas no snapshot. Nenhum webhook configurado.
- 16 templates existentes, em sua maioria publicados, com identidade própria. O template `pfm3d-welcome-ptbr` estava draft e sem HTML; agora foi preenchido, publicado e atualizado com a logo oficial `https://jogomanager.com/icon-192.png`, versão HTML com tabela para clientes de email e alternativa text/plain, URLs HTTPS e instruções anti-phishing.
- Os templates `pfm3d-security-alert`, `pfm3d-password-change-alert`, `pfm3d-payment-failed` e `pfm3d-signin-notice` já possuem logo do jogo, link para site oficial, conteúdo text/plain e nenhuma marca Sports Interactive, conforme inspeção.
- `src/lib/email-templates/resend-transport.ts` implementa retries limitados de 429/5xx com **Idempotency-Key invariável**, sem repetição de erros 4xx permanentes; `send-email.ts` integra transport somente no backend quando `TRANSACTIONAL_EMAIL_PROVIDER=resend`; testes com `fetch` simulado evitam SMS/email real.
- **Limite operacional:** publicação de template NÃO dispara envio. O aplicativo pode continuar usando Lovable Email enquanto `TRANSACTIONAL_EMAIL_PROVIDER` e `RESEND_API_KEY` do servidor não estiverem configurados; `TRANSACTIONAL_EMAIL_FROM` precisa pertencer ao domínio verificado. Não colocar tokens em `.env` versionado. Não enviar emails para usuários reais como teste não autorizado.
- O domínio Resend tem *open/click tracking* desligado; isso é geralmente positivo para privacidade. Sem webhooks de bounce/delivery, não é possível confirmar entregabilidade histórica.

## Twilio • controles a implementar no painel (NÃO estão ativos)
**Fato operacional:** não existe conector Twilio no ambiente atual; navegador associado tem apenas sessão Google, não Twilio. Não temos acesso autorizado a Account SID/Auth Token, Verify Service SID, remetente WhatsApp aprovado ou permissão para habilitar SMS provider em Supabase Auth. Assim, nenhum SMS/WhatsApp de produção foi enviado, nem MFA via Twilio ativado nesta sessão.

Configuração segura proposta:
1. Conta Twilio: verificar elegibilidade comercial/trial, cobrança, identidade e o número/remetente aprovado. Não assinar plano sem conhecer custo. Usar API Keys restritas e segredos somente do servidor.
2. Criar Twilio **Verify Service** para autenticação, em vez de montar códigos OTP manualmente. Habilitar **Verify Fraud Guard** e revisar nível de proteção `Standard` (considerar `Max` somente após checar falsos positivos), `Verify Geo Permissions` bloqueando destinos fora do mercado atendido e controles de SMS pumping; conferir allowlist de números apenas para números próprios de teste.
3. Configurar Supabase > Auth > Providers > Phone, selecionar **Twilio Verify**, informar credenciais do serviço em secret manager e habilitar SMS com limite por usuário/IP. A configuração de envio de telefone é compartilhada com **MFA Phone**, mas as políticas de AAL2 precisam ser aplicadas a fluxos sensíveis sem bloquear quem ainda não tem segundo fator.
4. WhatsApp via Verify é desabilitado por padrão e requer sender próprio aprovado/ligação comercial; somente após autorização do remetente e eventual fallback para SMS.
5. Ativar Turnstile/CAPTCHA no login/OTP onde suportado; exigir cooldown OTP de 60 segundos, expiração curta, limites de 24h, rate limit de IP com HMAC secreto e custos plafonados. **O limitador `auth_safety.consume_phone_otp_budget` ainda não é chamado pelo Supabase Auth.** Não afirmar que limita envio sem um Send SMS Hook autenticado e validado.
6. Recuperação com segundo fator: proteger alterações sensíveis e recuperação com passkeys/TOTP/backups e processo de prova de posse, além do número telefone, porque SIM-swap e número reciclado tornam SMS menos seguro.
7. Teste ponta a ponta apenas com número validado e consentimento do proprietário: enviar OTP, verificar SMS, verificar WhatsApp, testar negação, cooldown/concurrência e contabilização de cobrança.
8. Criar alarmes para tentativas, fraudes/blocks, custos e indisponibilidade; não usar secret em código público.

Documentação:
- https://supabase.com/docs/guides/auth/phone-login
- https://supabase.com/docs/guides/auth/auth-mfa/phone
- https://www.twilio.com/docs/verify/preventing-toll-fraud/sms-fraud-guard
- https://www.twilio.com/docs/verify/preventing-toll-fraud/verify-geo-permissions

## Aprovação e métricas pós-merge
Exigir antes do lançamento: CI verde incluindo replay em DB local, checks de Rapier e Lighthouse; prova de chunk boundaries e delta `gzip/Brotli` favorável; e depois reexecutar PageSpeed mobile em produção (LCP, FCP, TBT, CLS, Speed Index, TTFB, INP p75). A captura anterior do dono informou FCP 3,5s, LCP 3,9s, TBT 0ms, CLS 0,024, Speed Index 3,6s. Nenhuma nova medição de produção comprovou melhoria ainda.
