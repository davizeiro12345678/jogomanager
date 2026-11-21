# Automações Resend: fontes confirmadas e operação

Inventário consultado em 8 de novembro de 2026: **41 templates publicados, zero rascunhos**, cinco automações habilitadas e cinco eventos definidos. O domínio `jogomanager.com` está verificado para envio na região `sa-east-1`. O webhook de entregas existente permanece separado deste dispatcher. Nenhum template, automação, domínio, segredo ou configuração de produção foi alterado nesta implementação.

| Evento existente | Template da automação existente | Fonte implementada nesta entrega |
| --- | --- | --- |
| `user.created` | `pfm3d-boas-vindas-premium` | Trigger em `auth.users` após cadastro já confirmado ou primeira confirmação de e-mail; uma chave por usuário. Não dispara para conta anônima. |
| `purchase.fulfilled` | `pfm3d-purchase-fulfilled` | Trigger quando `user_purchases.status` é gravado como `completed`; uma chave por compra. A fila participa da mesma transação da entrega financeira. |
| `onboarding.guides_requested` | `pfm3d-getting-started` | Ainda sem fonte conectada. Exige uma solicitação explícita persistida, para não inventar consentimento. |
| `career.backup_alert` | `pfm3d-save-safety` | Ainda sem fonte conectada. Uma falha informada livremente pelo navegador não deve poder enviar e-mails ilimitados. |
| `account.security_alert` | `pfm3d-security-alert` | Ainda sem fonte conectada. Exige um registro de segurança confirmado pelo servidor. |

Os outros 36 templates publicados não ganharam novos disparos automaticamente. Publicação, automação habilitada, evento aceito e e-mail entregue são estados diferentes. Os dois templates conectados não exigem variáveis de template; os eventos têm os esquemas já cadastrados: `user.created` recebe `locale` e `user_id`; `purchase.fulfilled` recebe `user_id` e `order_id`. Esses campos são derivados do banco, com locale fixo `pt-BR`.

## Fronteiras e garantias

`0065_email_automation_outbox.sql` instala a fila privada, os triggers e dois RPCs exclusivos de `service_role`. `anon` e `authenticated` não podem consultar a fila, enfileirar mensagens nem invocar os RPCs. O endpoint não aceita parâmetros para escolher usuário, destinatário, evento ou conteúdo. O destinatário vem de `auth.users`, com e-mail confirmado, conta não anônima, não excluída e sem bloqueio ativo no momento da reserva.

Uma constraint única em `(event_name, source_id)` impede duplicação por reentrega de webhook, atualização repetida ou reconfirmação. Os IDs das fontes são UUIDs internos, sem referência Stripe nem endereço de e-mail na chave. A migração não preenche eventos de contas ou compras históricas. Em UPDATE, os triggers exigem transição real: confirmação `NULL` → preenchida ou status diferente de `completed` → `completed`. Atualizar um estado histórico já confirmado/concluído não cria notificações antigas. INSERT já confirmado ou concluído continua válido. Se a transação original falhar, sua entrada na fila também reverte. A migração não executa requisições de rede em triggers.

A reserva usa token de lease por tentativa e bloqueio transacional de um orçamento global: **no máximo 120 reservas por janela de uma hora, 20 por janela de um minuto e 600 ms entre reservas**, considerando todos os Workers. Cada chamada HTTP processa até dez entradas sequencialmente, com timeout de oito segundos por requisição ao provedor e lease de dois minutos. Para manter o orçamento conservador, falhas também consomem uma reserva. Em qualquer falha ou rate limit, a chamada para antes de reservar outra entrada.

Somente **HTTP 202** confirma aceitação do evento. **HTTP 429** explícito permite retry com a mesma identidade, backoff de 60, 120, 240, 480 e 960 segundos, respeitando `Retry-After` até 24 horas; a sexta tentativa termina como `dead`. O maior entre backoff e `Retry-After` também suspende **globalmente** novas reservas, para qualquer destinatário ou evento, preservando eventual cooldown maior já existente. Até a sexta tentativa esgotada aplica cooldown global. Reserva e conclusão usam a mesma ordem de locks (orçamento antes da fila), evitando inversão de bloqueios. Outros 4xx são terminais. Timeout, erro de rede, 5xx, redirecionamento ou resposta inesperada ficam como `uncertain`. Lease expirada também vira `uncertain`, sem reenvio automático. Uma resposta atrasada do mesmo token pode confirmar a aceitação; um token antigo não pode concluir uma tentativa nova. Alteração do e-mail entre tentativas encerra a entrada, sem redirecionar a notificação para outro endereço.

O header `Idempotency-Key` é estável (`jgm-automation/<outbox-id>`), mas **não constitui garantia do provedor para `/events/send`**: a documentação de idempotência enumera endpoints de e-mail e inbox, sem incluir eventos. Por isso, não há retry automático da janela ambígua entre aceitação externa e confirmação no banco. Essa escolha evita duplicar automações à custa de possíveis notificações que exigem reconciliação manual. Também não garante que a conta mantenha somente uma automação para o mesmo evento; essa é configuração do provedor, preservada nesta entrega.

Entradas `sent` e `dead` apagam destinatário e payload, conservando IDs mínimos para deduplicação. Entradas ainda aguardando ou incertas expiram após sete dias durante a manutenção limitada de cada reserva, até 100 por classe por chamada. A remoção de uma conta elimina seus registros por FK. Se o dispatcher for desabilitado por longo período, a manutenção deixa de executar; aplicar a limpeza operacional abaixo para não conservar destinos incertos.

## Publicação e acionamento

1. Revisar/aplicar a **migração forward 0065** pelo fluxo de release existente. Não repetir o bootstrap nem as migrações históricas em produção.
2. Confirmar que o Worker possui `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `RESEND_API_KEY` no servidor, sem prefixo `VITE_`. O segredo cron existente é `LOVABLE_CRON_SECRET`, com suporte à chave anterior pelo helper existente. O nome do segredo não representa dependência de uma requisição ao Lovable.
3. A entrega fica **desabilitada por padrão**. Somente após revisar uma conta de teste consentida e os workflows existentes, configurar `EMAIL_AUTOMATIONS_ENABLED=true` no servidor. Isso ativa envio real e deve respeitar a franquia já contratada.
4. Configurar o agendador **já existente** para chamar `POST https://jogomanager.com/api/internal/email-automations/dispatch` a cada minuto, com `Authorization: Bearer <segredo cron existente>`, sem corpo. Não criar serviço pago. A rota autenticada é o chamador concreto dos módulos e consulta apenas a fila confirmada pelo banco.
5. A resposta contém apenas contadores: `enabled`, `attempted`, `accepted`, `retryQueued`, `rejected`, `uncertain`. `accepted` mede HTTP 202, não entregabilidade. Não registrar headers, endereços, payloads nem chave de API.

Exemplo para um operador com as variáveis já instaladas em ambiente seguro; não imprimir os valores nem usar modo verbose:

```sh
curl --fail-with-body --silent --show-error --request POST \
  --header "Authorization: Bearer $LOVABLE_CRON_SECRET" \
  https://jogomanager.com/api/internal/email-automations/dispatch
```

Não há uma nova configuração de cron instalada automaticamente por este PR; a conexão do agendador e a ativação de envio são etapas operacionais explícitas. Nenhum e-mail foi enviado nos testes desta entrega.

## Inspeção, pausa e reconciliação

Pausar envio com `EMAIL_AUTOMATIONS_ENABLED=false`; isso não desfaz contas, compras nem filas. Os triggers continuam registrando fontes confirmadas sem transmitir dados externamente. Não apagar chaves de deduplicação para tentar reenviar uma compra.

O operador autorizado pode executar esta inspeção agregada em conexão administrativa; ela não retorna destinatários:

```sql
SELECT event_name, status, count(*) AS entries,
       min(created_at) AS oldest, max(attempts) AS highest_attempt
FROM email_automation_private.outbox
GROUP BY event_name, status
ORDER BY event_name, status;
```

Antes de qualquer reenvio de `uncertain`, reconciliar a tentativa com os logs de evento e de automação do provedor. Se houve aceitação, concluir o registro com o mesmo token pelo RPC e HTTP 202; se não há prova de não aceitação, manter a quarentena. O sistema não oferece botão de reenvio público nem transforma 5xx em prova de não envio.

Para apagar conteúdo de entradas expiradas enquanto o dispatcher permanece pausado, executar em transação administrativa, em lotes até retornar zero linhas:

```sql
UPDATE email_automation_private.outbox
SET status = 'dead', last_error = 'expired', recipient_email = NULL,
    payload = '{}'::jsonb, completed_at = now()
WHERE id IN (
  SELECT id FROM email_automation_private.outbox
  WHERE status IN ('queued','uncertain') AND created_at < now() - interval '7 days'
  ORDER BY created_at LIMIT 100
);
```

## Evidência e limites

Os testes unitários usam fetch/RPCs simulados e não transmitem mensagens. O contrato SQL cria identidades e compras sintéticas numa transação desfeita; verifica deduplicação, rollback, privilégios, confirmação, bloqueio, orçamento, identidade de destinatário, stale tokens, retry e quarentena.

O executor reproduzível `verification/upgrade-20261108/task06-sql-qa.mjs` usa PGlite/PostgreSQL 18.6 com PL/pgSQL real e fixture mínima de Auth/compras. O JSON registra hashes dos SQLs. **Não substitui replay Supabase/PostgreSQL nativo, teste de concorrência com conexões independentes ou validação em produção.** Esses controles continuam necessários no release. Esta implementação não modificou SMTP Auth, disponibilidade do Lovable ou o projeto Supabase publicado.

Fontes oficiais consultadas em 8 de novembro de 2026: [API de eventos](https://resend.com/docs/api-reference/events/send-event) e [endpoints com idempotência documentada](https://resend.com/docs/dashboard/emails/idempotency-keys).
