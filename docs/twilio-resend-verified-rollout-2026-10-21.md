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
