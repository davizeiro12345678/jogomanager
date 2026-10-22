# Segurança de autenticação e webhooks: estado real em 21/10/2026

## Resend: implantado e validado
- Domínio de envio já verificado, Resend webhook **habilitado** com ID `d387e18c-16e6-48c4-a166-4842d6c6fb73`, URL `https://lguqnwvsfeefxamzeyos.supabase.co/functions/v1/resend-delivery-events`.
- 7 tipos recebidos: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.failed`, `email.bounced`, `email.complained`, `email.suppressed`.
- Edge Function `resend-delivery-events` versão 2 com assinatura `svix-id`, `svix-timestamp`, `svix-signature` (**HMAC-SHA256** da string `id.timestamp.payload`), janela de 300 s, limite de payload e registro idempotente.
- **Segredo real SOMENTE no Vault Supabase**: nome `jgm_resend_webhook_signing`. Nunca commitar, mandar ao usuário nem logar. RPC `jm_resend_webhook_signing_key()` disponível somente para `service_role`.
- Banco privado `auth_safety.resend_delivery_events`, RLS on, sem SELECT de `anon` nem `authenticated`. Campos `event_id`, `event_type`, `email_id`, `received_at`, **sem endereço de e-mail nem payload bruto**.
- **Prova ponta a ponta positiva:** POST sintético **assinado validamente** pelo `pg_net` -> Edge Function -> RPC -> linha gravada, HTTP 200 `OK` (requisição de teste 24300). Evento de teste removido depois.
- **Prova negativa:** POST com assinatura falsa -> HTTP **401 Invalid signature** (requisição 24301), sem linha na tabela.
- Essas provas não são envio real de e-mail; nenhum usuário recebeu mensagem no teste. Antes de declarar entregabilidade real, enviar mensagem somente a destinatário de teste consentido e inspecionar webhook real e logs.
- Configuração em produção foi aplicada diretamente à Supabase/Resend **antes do merge deste PR**; migration e Edge Function correspondentes ficam versionadas em `supabase/migrations/20261021225408_secure_resend_delivery_webhook_records.sql` e `supabase/functions/resend-delivery-events/index.ts`.

## Twilio: preparação em código, ainda não ativado
- O catálogo de integrações Lovable mostra Twilio disponível; `add_connector` abriu `https://lovable.dev/dashboard?connectors`. **Isto não autentica a conta Twilio**.
- Nenhum `Account SID`, segredo de API, `Verify Service SID`, assinatura paga, remetente de WhatsApp aprovado nem número de teste foi verificado por esta conversa. **Nenhum SMS/WhatsApp foi enviado**.
- O componente `src/components/security/PhoneMFASettings.tsx`, habilitado somente com `VITE_PHONE_MFA_ENABLED=true`, prepara `auth.mfa.enroll`, `challenge` e `verify` do Supabase para canais SMS/WhatsApp na tela do perfil. `VITE_PHONE_MFA_ENABLED=false` por padrão.
- **NÃO ligar a flag** antes de confirmar mensagens reais, custos, remetentes, políticas AAL2 de autenticação e recuperação, anti-bypass, lockout, backup/TOTP e prova de recuperação. A UI sozinha não garante MFA no login.
- Supabase tem tabela/função privadas `auth_safety.phone_otp_attempts` / `auth_safety.consume_phone_otp_budget`: janela de 60s, 4/telefone/h, 8/telefone/dia, 15/IP/h e canais compartilhados. **Não há hook ativo que invoque esta função antes do envio**, portanto esses limites não protegem SMS nativos ainda.
- Preparar produção com **Twilio Verify Service**, **Fraud Guard** (SMS), **Verify Geo Permissions**, bloqueio de SMS pumping, taxas de envio, budget, canal WhatsApp business aprovado e autenticação segura; conectar ao `Supabase Auth > Phone` e MFA.
- Para ligar o orçamento próprio à entrega real: usar `Supabase Auth Send SMS Hook` (em Pro) autenticado, com HMAC de telefone/IP feito SOMENTE no servidor, usando `service_role` em esquema privado, entrega via Twilio Verify **CustomCode** habilitado no serviço. O IP real pode não estar no payload do Send SMS Hook; somente conte IP quando houver origem autenticada e confiável, nunca valor arbitrário de header. Validar payload, assinatura, idempotência de tentativas, 5 segundos de timeout e falhas fechadas. O SMS hook substitui o provedor nativo, não ativar ambos sem testes.
- **Geo Permissions no Twilio têm efeito imediato**: revisar mercados reais antes de bloquear países; não assumir que o público é 100% brasileiro. Recuperação com segundo fator requer métodos alternativos e validação do dispositivo, nunca apenas SMS (SIM swap).
- Documentação oficial:
  - https://supabase.com/docs/guides/auth/phone-login
  - https://supabase.com/docs/guides/auth/auth-mfa/phone
  - https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook
  - https://www.twilio.com/docs/verify/preventing-toll-fraud/sms-fraud-guard
  - https://www.twilio.com/docs/verify/preventing-toll-fraud/verify-geo-permissions

## GitHub #58/#59
- #58 rebased sem force push para HEAD moderno, preservando `hono@4.13.13`; corrigidas falhas de formatação e migrations Stripe sem schema local. **Lighthouse e bundle Rapier continuam falhando** até correção mensurada, portanto não declarar aprovação integral.
- #59 mantém as alterações de otimização, transporte Resend e novo MFA em **draft**, sem merge. CI de nova HEAD precisa concluir sem erros antes de deploy.
- Os checks Lighthouse são gates reais e não devem ser desligados só para marcar verde. `scripts/bundle-report.mjs` limita JS físico; desvio exige redução verdadeira de tamanho (não aumentar orçamento sem justificativa).


## Complemento de 22/10/2026: hook Twilio de envio com limite real, EM STAGING

- Edge Function Supabase publicada em produção **como endpoint técnico**, `twilio-verify-sms-hook` **versão 2**, mas `ENABLE_TWILIO_SMS_HOOK` continua desabilitado, sem credenciais Twilio e **não configurada como Auth Send SMS Hook**. Não há SMS real liberado.
- Endpoint interno pronto: `https://lguqnwvsfeefxamzeyos.supabase.co/functions/v1/twilio-verify-sms-hook`. HTTP POST sem credenciais ou switch retorna **503** intencional (testado via `pg_net`). `verify_jwt=false` é exigido pelos eventos pré-login, mas uma assinatura Standard Webhooks HMAC-SHA256 é obrigatória quando habilitado.
- O código fica em `supabase/functions/twilio-verify-sms-hook/index.ts` no PR #59. Verifica assinatura e timestamp de 5 minutos, limita payload a 20 KB, valida `E.164` e formato OTP antes de tentar enviar, trata limites e falhas do provedor sem expor OTP, telefone, tokens ou assinatura em logs.
- Migração `20261021232000_reconcile_private_phone_otp_budget.sql` reconcilia no CI o limitador privado `auth_safety.consume_phone_otp_budget` que já existia em produção, mas estava ausente no histórico Git. A migração seguinte `20261021234500_stage_twilio_sms_hook_budget.sql` expõe RPC **somente service_role**. O acesso anônimo e autenticado ao RPC foi testado e negado.
- Quotas compartilhadas SMS/WhatsApp: 60 segundos entre solicitações ao mesmo número, no máximo 4/tel/h, 8/tel/24 h, e até 15 solicitações/hora em uma chave GLOBAL. A função de hook **não recebe IP confiável do cliente**, portanto não se deve chamar esta última quota de limite por IP. O limite global conservador destina-se ao rollout inicial; deve ser dimensionado para o tráfego e teto financeiro verificados antes de liberar envios em grande escala.
- Twilio Verify usa **CustomCode** gerado pelo Supabase; requer habilitar explicitamente `Enable Custom Verification Code` no serviço Verify. Para SMS, manda `RiskCheck=enable` para respeitar Fraud Guard e Geo Permissions ativados no serviço; para WhatsApp, não inclui esse parâmetro exclusivo de SMS.
- Suporta nome de segredo `SEND_SMS_HOOK_SECRET` ou `SEND_SMS_HOOK_SECRETS` (último para rotação); segredos reais só no armazenamento privado de funções. Não inserir em código, variáveis públicas VITE_*, GitHub ou documentação.
- PR #59 agora usa `import.meta.env.VITE_PHONE_AUTH_ENABLED` e `import.meta.env.VITE_PHONE_MFA_ENABLED` com nomes ESTÁTICOS, permitindo ao Vite remover os chunks de funções desativadas dos bundles de produção. Nenhuma flag foi habilitada.

### Pré-requisitos externos para habilitar em produção

1. Autenticar e validar propriedade da conta Twilio. Verificar status da conta, limite de gastos, remetentes e aprovações comerciais. Não criar nova cobrança sem preço e consentimento.
2. No Twilio Verify, provisionar Verify Service, habilitar **Custom Verification Code**, configurar **Fraud Guard** em SMS, rever **Geo Permissions** com allowlist por país conforme público real, configurar limites do Verify e remetente WhatsApp aprovado. Confirmar se plano permite todas as proteções.
3. Armazenar em Supabase Edge secrets `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `PHONE_OTP_HMAC_SECRET` (≥32 caracteres aleatórios), `SEND_SMS_HOOK_SECRET` fornecido pelo Supabase Auth. Não gravar segredos em `public`, Git ou cliente.
4. Configurar Supabase Authentication → Hooks → **Send SMS** → HTTP → URL do hook. Esse hook **substitui** o envio telefônico nativo. Habilitar `ENABLE_TWILIO_SMS_HOOK=true` somente após validações de configuração, custo, allowlist e trilha de rollback.
5. Usar apenas número próprio de teste, com consentimento. Exercitar envio real, verificação do código, cooldown, múltiplas contas usando mesmo telefone, SMS, WhatsApp, tentativa inválida, indisponibilidade Twilio e custo, assegurando que nenhum evento é declarado enviado se o Twilio rejeitar.
6. Habilitar UI `VITE_PHONE_AUTH_ENABLED` e `VITE_PHONE_MFA_ENABLED` com **novo build** somente quando o serviço passar nos testes. Implementar e verificar enforcement AAL2 no servidor para operações críticas, em vez de confiar exclusivamente na interface.
7. Recuperação segura: disponibilizar **TOTP ou passkey previamente cadastrada** como fator independente do número, verificação AAL2 antes de alterações críticas, fluxo auditável de perda dos dois fatores com prova de propriedade e período de revisão. O endpoint de SMS sozinho **não implementa recuperação de conta**.

### Estado real

Nenhuma credencial Twilio foi fornecida por conector autenticado. Não foram ativadas Geo Permissions nem Fraud Guard no console Twilio, não foi enviado SMS/WhatsApp real e não foi recuperada qualquer conta real. O hook **está publicado mas fail-closed**, impedindo cobrança e abuso enquanto pendente. `main` permanece sem os códigos do PR #59.
