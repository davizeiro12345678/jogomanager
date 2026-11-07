# Push (Firebase) e chat — evidências (2026-11-07, ~01:05 UTC; sem publicação)

## Chat conectado ao banco real (já existia; verificado e corrigido)

Tabelas `chat_messages`, `chat_infractions`, `chat_reports` com RLS, realtime ativo em `chat_messages` e envio pelo servidor (`send_chat_message_for`, SECURITY DEFINER) com moderação, limite por minuto e mutes progressivos (3 → 10 min, 5 → 24 h, 7 → 7 dias, 10 → permanente).

Teste com duas contas reais (conta A e conta B, ambas do usuário), navegador headless autenticado:

- B leu as mensagens de A; A leu a mensagem de B (leitura cruzada).
- Mensagens persistidas no banco e lidas numa sessão nova sem cache.
- Mensagem bloqueada ("seucaralho") gera aviso e **não** é gravada.
- 3 bloqueios gravaram 3 infrações (`profanity`) no banco; sessão nova recebeu "silenciado… tente em 10 minutos" — o mute é derivado das infrações persistidas.
- Dados de teste removidos ao final (mensagens e infrações apagadas).

Correções feitas durante a verificação:

1. `ChatPanel.tsx`: a pré-checagem local de moderação impedia o envio ao servidor, então infrações nunca eram contadas e mutes nunca aconteciam. Removida; o servidor decide e registra.
2. `ChatPanel.tsx`: após enviar, a própria mensagem só aparecia após recarregar (dependia do realtime); agora a lista é recarregada após o envio confirmado.

## Notificações push (Firebase Cloud Messaging)

- Conexão Firebase atualizada com Include web push; as 4 chaves web chegaram ao `.env` e o botão "Ativar avisos neste aparelho" destravou (página de privacidade).
- Novo `src/lib/push.server.ts`: envio via gateway (`v1/projects/_/messages:send`), até 200 tokens por evento, tokens mortos (404/INVALID_ARGUMENT) removidos de `push_subscriptions`, fire-and-forget (falha de push nunca bloqueia chat ou compra).
- Gatilhos: nova mensagem no chat avisa os demais inscritos (título "Sala dos técnicos", caminho /chat); serviço do clube cobrado no banco avisa o comprador (7 serviços, caminho /clube).
- 7 testes novos em `push.server.test.ts` (token morto, sem chaves, um envio por token, teto de 200); 14 testes passaram com os de moderação; build OK; lint sem avisos.

## Bloqueio restante do push real

O App ID e a chave web gravados na conexão pertencem ao projeto Firebase antigo (sscxz-2ee8d), idênticos ao fallback antigo do código; a conta de serviço e o Project ID são do projeto sjsjs-ed490. A inscrição de push falha com "Registration failed - permission denied" (service worker ativa, permissão concedida, VAPID presente). O usuário optou por atualizar a conexão com os dados web do projeto sjsjs-ed490. Entrega real de push não verificada até lá.

## Não verificado neste ciclo

- Entrega real de notificação no dispositivo (depende da correção acima).
- Gates completos de lançamento (stress 200, Lighthouse, bundles, replay) — obrigatórios antes de publicar.
- Melhorias amplas de carreira/cutscenes/estádio/rig seguem no roadmap.
