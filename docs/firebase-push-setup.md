# Firebase: teste de notificações web

O projeto Firebase esperado é `sscxz-2ee8d`. A função adicionada nesta mudança permite somente enviar uma notificação de teste para o próprio aparelho inscrito. Ela não gera avisos automáticos de eventos do jogo.

## Configuração necessária

Após aprovar e implantar o código e a migração, configurar no Worker as variáveis públicas `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY` e `FIREBASE_WEB_PUSH_VAPID_PUBLIC_KEY` com os valores da configuração web e da chave pública Web Push do projeto Firebase. As outras configurações web têm padrões no código para esse projeto. Configurar também `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` para o projeto Supabase correto.

Armazenar `FIREBASE_SERVICE_ACCOUNT_JSON` como **secret de servidor**, usando uma conta de serviço dedicada ao envio FCM HTTP v1 com as permissões mínimas apropriadas ao projeto. Nunca adicionar a chave privada ao Git, ao código do cliente ou a mensagens. O Worker também precisa de `SUPABASE_SERVICE_ROLE_KEY` como secret de servidor para reservar o limite de envio; essa chave não deve ser enviada ao navegador.

Aplicar `drizzle/migrations/0041_firebase_push_test_rate_limit.sql` pelo processo de migração aprovado do projeto antes de liberar o botão. A função de banco é restrita ao papel `service_role`; a aplicação verifica a sessão e a inscrição do próprio usuário antes de reservar um teste por hora. Uma falha na reserva bloqueia o envio.

## Verificação

Em uma origem HTTPS autorizada, entrar no jogo, ativar avisos no aparelho e conceder a permissão do navegador. Usar **Testar notificação** e confirmar a chegada no próprio aparelho. Verificar também que outro usuário não consegue testar a inscrição alheia e que o limite é respeitado. A entrega pode depender do suporte e das permissões do navegador e do sistema operacional.

Antes da publicação, executar todos os testes e gates exigidos pelo repositório, validar o commit exato implantado e manter o recurso desativado se faltar qualquer credencial ou migração. Os testes automatizados simulam as chamadas ao Google e não substituem o teste real no aparelho.
