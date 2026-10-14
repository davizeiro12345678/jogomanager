# Firebase Web + notificações FCM (Pro Football Manager 3D)

## Estado e limites

O SDK modular **firebase** já está presente no `package.json` e traz os submódulos necessários de App, Analytics, Auth, Messaging e Firestore, sem ser necessário instalar todos como dependências diretas. **Isso não habilita esses produtos automaticamente**: Supabase Auth e Supabase/PostgreSQL continuam sendo as fontes autoritativas para contas, compras e saves.

- Firebase App usa identificadores públicos do projeto configurado.
- Firebase Analytics só inicia com o consentimento de analytics.
- Push é solicitado apenas por um clique do jogador autenticado no Centro de consentimento.
- Inscrições são limitadas ao próprio usuário por RLS na tabela `push_subscriptions`.
- O service worker `/sw.js` já mantém o offline e trata mensagens push de dados. Links externos recebidos em notificações são rejeitados.
- Ao sair da conta, a aplicação tenta remover a inscrição **apenas deste dispositivo**.

## Ambiente de produção

Adicionar ao runtime do Worker Cloudflare / Lovable, com os valores **reais do mesmo projeto Firebase**:

| Variável | Origem e observação |
| --- | --- |
| `FIREBASE_WEB_API_KEY` | Configuração web do Firebase Console (chave de projeto pública). Não usar credenciais de Admin. |
| `FIREBASE_WEB_APP_ID` | ID do app web registrado no Firebase. |
| `FIREBASE_PROJECT_ID` | Identificador do projeto Firebase correspondente. |
| `FIREBASE_AUTH_DOMAIN` | Domínio de autenticação associado ao mesmo app. |
| `FIREBASE_STORAGE_BUCKET` | Bucket associado ao projeto. |
| `FIREBASE_MESSAGING_SENDER_ID` | Número do remetente do FCM. |
| `FIREBASE_WEB_PUSH_VAPID_PUBLIC_KEY` | Chave pública VAPID de Web Push no Firebase Console. **Indispensável para push.** |
| `FIREBASE_MEASUREMENT_ID` | Opcional: ID de Analytics, somente para usuários que aceitaram. |

Os valores de identificação que já existiam no código são usados como defaults; a API key e a VAPID **não** têm defaults. O runtime recusa habilitar push se faltarem.

**Para ENVIAR push** será necessário integrar no servidor o Firebase Admin / FCM HTTP v1, com conta de serviço autenticada, permissões mínimas, logs, rate limit e escolha de audiência. Nunca exponha a conta de serviço ao navegador. Este PR não inventa credenciais nem envia notificações sem a configuração.

## Verificação de homologação

1. Confira que os valores web pertencem ao **mesmo** projeto Firebase; inspecione o domínio autorizado.
2. Teste Chrome/Android, browsers desktop e iOS instalado como PWA quando houver suporte.
3. Faça login em conta de teste, clique "Ativar avisos neste aparelho", conceda permissão e confira uma linha em `push_subscriptions` com o próprio `user_id`. Não registre o token nos logs.
4. Desative e confirme que somente o token do dispositivo atual é excluído.
5. Faça logout e confira o mesmo isolamento, sem impedir a saída em caso de falha do serviço.
6. Sem VAPID/API key, a interface deve permanecer desabilitada com mensagem clara.
7. Nunca vincule token a usuário de outro login e nunca envie push contendo dados privados de saves em texto livre.

## Alertas de dependências

O `firebase@13.0.0` carregava `@grpc/grpc-js@1.9.16`. O PR de segurança usa override para uma versão corrigida, mas **somente o CI com runtime, npm audit, WASM e testes passando valida a compatibilidade**.
