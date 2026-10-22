# MFA, índices e carregamento inicial — 22/10/2026

## Produção: aplicado e verificado

- Migração `20261022162109`: índice redundante `idx_subscriptions_stripe_id` removido; o índice UNIQUE e a constraint `subscriptions_stripe_subscription_id_key` continuam válidos. Economia de apenas 8 KiB; não é um ganho massivo de consultas.
- Migração `20261022162542`: 20 políticas RESTRICTIVE exigem AAL2 quando o usuário tem fator confirmado. As políticas de propriedade anteriores continuam exigidas.
- `app_private.mfa_session_allowed()` usa apenas Auth/JWT, não metadados editáveis. Segredos de fatores não são legíveis por anon/authenticated. O RPC SECURITY DEFINER `mutate_player_career` também verifica MFA.
- Teste transacional com fixture descartável: sem fator permite acesso; fator confirmado + AAL1 bloqueia perfil e CAS; AAL2 permite somente o perfil do titular. ROLLBACK confirmado e zero usuários de teste restantes.
- 68/68 tabelas públicas com RLS, zero índices inválidos, zero grants TRUNCATE/REFERENCES/TRIGGER aos clientes.
- Advisors: 62 → 61 índices sem uso registrado. Os outros não foram removidos sem prova de redundância. Permanecem avisos de descoberta GraphQL (20 anon/42 authenticated), 18 tabelas privadas sem políticas e um RPC SECURITY DEFINER intencional. Aviso de descoberta do schema não prova acesso a linhas de outros usuários.

## Código deste PR — ainda depende de release

- TOTP no perfil: inscrição explícita, QR/chave manual, confirmação, autenticador de reserva, remoção com step-up. Usa o Supabase Auth, sem enviar SMS.
- Login/senha, magic link, passkey, retorno OAuth e recuperação passam pela verificação de assurance. Recuperar senha não remove MFA. Segundo fator de telefone continua condicionado às flags de serviço.
- Middleware de funções autenticadas valida o usuário/fatores no Auth para sessões AAL1; AAL2 evita essa consulta adicional. Isso acrescenta uma consulta de Auth às requisições AAL1, em troca da aplicação da proteção no servidor.
- Vite preload helper separado: lazy chunks deixam de importar o entrypoint da aplicação.
- Leitura do armazenamento customizado separada do catálogo. Editor mantém elencos e abas pesadas sob demanda.
- Consentimento usa botões nativos acessíveis e deixa Radix/tailwind-merge fora do caminho inicial das páginas que não precisam deles.
- Imagem móvel AVIF com recorte dedicado e preload por media query: variante 540 = 25.521 B, contra imagem anterior de 58.387 B (-56,3%). Demais tamanhos continuam disponíveis para desktop.

## Verificação local

- `npm test`: 254 arquivos, 1.386 testes aprovados (inclui os seis testes novos de MFA).
- Testes focados de MFA e paridade física: 12 aprovados.
- Lint sem erros/avisos, TypeScript e build de produção aprovados.
- Contratos Edge/importador/performance: 32 aprovados.
- Histórico de migrations validado; novo contrato SQL de MFA incluído para replay no CI.
- Comparação abaixo usa o HEAD original do PR #59, `4970c589`, e o candidato nesta mesma máquina, com o mesmo node_modules. O runner usa Node 24.19.0; o CI exige 24.22.0, portanto conferir novamente no CI. NÃO são medições de Core Web Vitals, CrUX ou FPS.

| Medida | Antes | Depois | Redução |
|---|---:|---:|---:|
| Home: JS inicial gzip | 202,927 B | 192,512 B | 5.13% |
| Editor: JS inicial gzip | 331,736 B | 199,490 B | 39.86% |
| Partida rápida: JS inicial gzip | 336,021 B | 325,816 B | 3.04% |
| Match 3D: JS inicial gzip | 632,811 B | 633,298 B | -0.08% |
| JS total gzip (inclui lazy) | 2,312,766 B | 2,316,030 B | -0.14% |

## Bloqueios ainda existentes

- `bundle:check`: Rapier JS de 210.463 B excede 180.000 B, embora o WASM já seja externo. O editor passou a verificação que antes o bloqueava. Nenhum threshold foi aumentado.
- Gate de zero regressão: JS total +3.264 B gzip e Match 3D inicial +487 B contra o HEAD anterior. O baseline obrigatório do CI é main, portanto também deve ser reavaliado lá.
- Lighthouse móvel anterior no PR #59: home 79–83, LCP até 3.878 ms; páginas editoriais 88–92 e partida rápida 77–87. Sem nova medição não afirmar 98 nem redução de LCP/INP/CLS.
- PR #58 também falhava no orçamento de bundle e Lighthouse; o release gate falhava como consequência.
- NÃO houve merge, deploy de frontend ou aprovação geral dos PRs.

## Twilio: bloqueio de autenticação

O painel desta sessão está na tela de login, sem conector Twilio nem credenciais no ambiente. Fraud Guard, Geo Permissions, CustomCode, provider Phone/MFA do Supabase e WhatsApp NÃO foram ativados. Nenhum SMS/WhatsApp enviado. As flags `VITE_PHONE_AUTH_ENABLED` e `VITE_PHONE_MFA_ENABLED` continuam desativadas.

O hook existente continua fail-closed: assinatura Standard Webhooks, HMAC de telefone, orçamento atômico no banco, timeout e `RiskCheck=enable` no SMS. Ele NÃO protege o envio real enquanto o Auth Hook não estiver configurado e ativo. Limite no navegador sozinho não impede SMS pumping. A configuração completa exige autenticação no Twilio, serviço Verify real, destinos permitidos definidos, credenciais no servidor e teste com destinatário autorizado.

## Continuação de 22/10: provedores e infraestrutura de CI

- Painel Supabase inspecionado: Phone desativado; Twitch e X OAuth2 habilitados; nenhum Custom Provider cadastrado. O frontend já descobre os providers habilitados via `/auth/v1/settings`, incluindo identificadores `custom:`. Não foram criadas entradas com credenciais fictícias ou reaproveitadas de outro provedor.
- Phone agora também exige `external.phone === true` nas configurações públicas, além da flag de release. Isso evita oferecer uma tentativa de login contra um backend desativado. WhatsApp/telefone/MFA continuam sem ativação real.
- Novos provedores OAuth/OIDC exigem Client ID/Secret do aplicativo correspondente e callback `https://lguqnwvsfeefxamzeyos.supabase.co/auth/v1/callback`. Referência: https://supabase.com/docs/guides/auth/custom-oauth-providers. Yahoo, Amazon e LINE exigem cadastro próprio e validação do fluxo; não são disponibilizados só por adicionar um botão.
- O Twilio redirecionou para `accounts.google.com`; a revisão automática recusou acesso a esse domínio. Não houve leitura de credenciais, alteração no Twilio ou envio de mensagens.
- CI: GHCR e depois ECR retornaram `toomanyrequests` antes de executar SQL. O bootstrap local agora tenta GHCR, ECR e Docker Hub somente nesse tipo de falha, preserva o registro bem-sucedido para `db reset` e continua falhando para problemas de saúde/SQL ou esgotamento dos três registros. CLI e versão da imagem permanecem fixados. Quatro testes comprovam esses caminhos.
- Home: seções adicionais abaixo da dobra usam `content-visibility: auto`, preservando conteúdo e navegação no DOM. O hero permanece sem contenção. Build e validação de tipos aprovados; ganho de Lighthouse desta alteração ainda precisa ser medido no CI.
- Nenhum orçamento foi alterado. Rapier 210.463 B, regressão total de JS e Lighthouse mobile continuam bloqueando a publicação. Não afirmar que todos os erros do GitHub foram resolvidos.
