# Atendimento por webhook

O formulário de `/contato` carrega após a ação **Abrir formulário de suporte**. Ele exige sessão Supabase válida, MFA quando exigido pela conta e e-mail confirmado. Os canais públicos por e-mail, WhatsApp e Discord continuam disponíveis sem conta.

## Idiomas

Os textos novos do formulário, os estados de carregamento/erro/entrega, categorias, aviso de privacidade, controles de abertura e dados do criador usam o idioma de `useT().lang`. Português (`pt-BR`/`pt-PT`) e inglês têm dicionários tipados com as mesmas chaves; os demais idiomas usam **fallback inglês explícito** até receberem tradução revisada. Isso não afirma tradução integral das páginas públicas anteriores nem dos 98 packs existentes.

As regiões novas marcam seu idioma com `lang`. O estado de feedback guarda a chave da mensagem, de modo que uma troca de idioma também atualiza um erro já visível. A data pública e a contagem de caracteres usam `Intl` no locale do texto apresentado; a data fixa é formatada em UTC para não retroceder um dia por fuso horário. O endereço e CPF permanecem dados únicos em `src/content/creator.ts`, sem tradução. O dicionário completo do formulário continua no chunk sob demanda; apenas o texto curto das páginas públicas carrega com Sobre/Contato.

## Ativação

1. Aplicar a migração forward `drizzle/migrations/0063_support_requests.sql` pelo fluxo de release. Validar `tests/sql/support-webhook-contract.sql` somente em banco descartável.
2. Configurar no servidor, nunca em variáveis `VITE_`:

| Variável                                     | Valor                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| `SUPPORT_WEBHOOK_ENABLED`                    | `true` somente após o receptor estar pronto                                  |
| `SUPPORT_WEBHOOK_URL`                        | Endpoint HTTPS do atendimento, sem credenciais na URL; não há destino padrão |
| `SUPPORT_WEBHOOK_SECRET`                     | Segredo aleatório compartilhado, no mínimo 32 caracteres                     |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Configuração de servidor já existente                                        |

3. O receptor deve verificar o corpo bruto antes de fazer parse e rejeitar timestamp mais antigo que cinco minutos, timestamp futuro além da tolerância de relógio e assinaturas inválidas. Comparar assinaturas em tempo constante.
4. Deduplicar duravelmente `X-JogoManager-Event-Id`/`Idempotency-Key` **antes** de executar qualquer efeito; um evento já processado deve retornar o mesmo sucesso sem enviar outra resposta automática. Guardar a deduplicação por pelo menos 30 dias. Não tratar apenas HTTP 200 como processamento humano concluído.
5. Programar diariamente a exclusão dos registros com `created_at < now() - interval '30 days'` em `support_private.requests` usando o mecanismo de operações existente. A migração também remove no máximo 100 registros antigos por nova reserva. Sem o job diário, o prazo de retenção não está garantido em períodos sem tráfego. Exclusão de conta remove seus registros por FK cascade.

Nenhuma dessas variáveis, migrações ou rotinas foi configurada em produção por este patch. Enquanto desativado, a interface apresenta os contatos existentes. A disponibilidade pública revela somente um booleano de configuração, sem URL, segredo ou estado interno.

## Contrato do evento

`POST` JSON com `type="support.requested"`, `version=1`, `id`, `userId`, `createdAt`, `email`, `category` e `message`. Conta e e-mail são obtidos do Supabase no servidor, não aceitos do formulário. Não incluir senha, código, cartão ou save completo na descrição.

Headers: `X-JogoManager-Timestamp` (Unix seconds), `X-JogoManager-Event-Id`, `Idempotency-Key` e `X-JogoManager-Signature`.

Assinatura: `v1=` + HMAC-SHA256 hexadecimal de `timestamp + "." + eventId + "." + rawBody`, usando `SUPPORT_WEBHOOK_SECRET`. A aplicação bloqueia redirecionamentos e aborta o envio após cinco segundos. Respostas não 2xx ou falhas não geram confirmação de entrega.

## Limites e recuperação

- Mensagem: 20 a 4.000 caracteres; payload persistido até 16 KiB. Honeypot e schema estrito não substituem autenticação.
- Banco serializa reservas por usuário, limita a três novas solicitações por hora e vincula o request ID ao hash do payload.
- Lease de 30 segundos impede dois Workers de despacharem simultaneamente o mesmo ticket. Há no máximo três leases por ticket.
- A tentativa falha permanece registrada; o formulário preserva texto/ID para nova tentativa após 30 segundos. Não há retry de background nem cron de reenvio implementado por este patch.
- Uma conexão pode falhar depois de o receptor aceitar a mensagem. A entrega é **at-least-once**: novas tentativas mantêm o mesmo ID, e a deduplicação no receptor é obrigatória para impedir respostas duplicadas.
- Somente o titular da lease pode registrar o resultado; uma falha atrasada não reverte um sucesso. Dados privados e erros de configuração não são enviados ao console do navegador.

O endereço e CPF publicados em Sobre/Contato foram fornecidos pelo responsável no pedido; sua apresentação não é certificação de identidade nem auditoria de domicílio.
