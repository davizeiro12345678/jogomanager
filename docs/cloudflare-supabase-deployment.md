# Publicação do JogoManager em Cloudflare e Supabase

Estado de preparação e publicação: 2 de outubro de 2026.

## Destinos

- Conta Cloudflare: `31b4ec9dfe5281c893ccfaaaefcfc88d`.
- Worker: `jogomanager-web`.
- Endereço do Worker: https://jogomanager-web.davizeiro10-jogos.workers.dev.
- Supabase: `lguqnwvsfeefxamzeyos`, na conta do proprietário, restaurado e ativo.
- Domínio de produção: https://jogomanager.com. O site novo e `/api/health` foram verificados diretamente nesse endereço, com HTTP 200. `https://www.jogomanager.com` também entrega a versão nova.

O domínio personalizado foi aceito pelo Cloudflare. Para concluir a troca, foi necessário desvincular `jogomanager.com` e `www.jogomanager.com` do Lovable e corrigir duas regras de redirecionamento circular. A origem antiga foi preservada em `fallback.jogomanager.com` e `legacy-origin.jogomanager.com`; os valores e o estado da troca estão em `docs/dns-before-cloudflare-migration.md`. O projeto anterior continua publicado em `stadium-stewards.lovable.app` e seus demais domínios foram mantidos.

O projeto antigo `vylshefvsjggyjlhfups`, apontado pelo código original e pela configuração do Lovable, não resolveu no DNS durante a migração. A consulta ao banco pelo Lovable também expirou. Não foram exportados usuários, senhas, carreiras, compras, objetos privados ou outros registros desse projeto. A estrutura e o catálogo disponíveis no código foram instalados no novo projeto; isso não constitui uma cópia dos dados pessoais antigos.

## Arquitetura

O TanStack Start executa SSR, rotas HTTP e funções do servidor no Cloudflare Workers, com os arquivos públicos servidos pelo binding `ASSETS`. O Supabase administra autenticação, Postgres, RLS e Realtime. D1 não substitui a autenticação nem os registros de carreira do Supabase nesta configuração.

O login usa Supabase Auth diretamente (`VITE_AUTH_MODE=supabase`), com cadastro por e-mail, confirmação, recuperação de senha e PKCE. Botões de provedores sociais aparecem apenas quando o provedor está configurado. A compatibilidade com o login do Lovable continua disponível quando esse modo é explicitamente selecionado.

## Banco instalado

As migrações existentes de `supabase/migrations` e `drizzle/migrations` foram aplicadas em um banco comprovadamente vazio. As três migrações de pagamentos duplicadas entre os históricos são executadas uma vez. O bootstrap adiciona a associação de perfis com `auth.users` e cria automaticamente o perfil de novos treinadores.

- 38 tabelas públicas, todas com RLS habilitado.
- 293 competições e 4.506 clubes do catálogo incluído no jogo.
- 6 produtos e 8 cupons definidos nas migrações originais.
- Políticas de isolamento por usuário e funções privadas restritas ao serviço.

Uma transação remota criou dois usuários temporários sem senha, verificou a criação automática dos perfis, o acesso de cada usuário apenas ao próprio perfil e a leitura pública do catálogo. Também confirmou a ausência de permissão de escrita direta de carreira pelo cliente. A transação foi desfeita com `ROLLBACK`; a consulta posterior confirmou zero contas e perfis temporários. Esse teste comprova os contratos do banco, não o fluxo completo de cadastro por e-mail.

`supabase/backend-access.sql` corrige permissões herdadas do Supabase: revogar apenas `PUBLIC` não remove concessões explícitas anteriores a `anon` e `authenticated`. As operações de concessão de compras, progresso e economia devem permanecer privadas. Saves pessoais enviados pelo navegador permanecem não confiáveis para conquistas duráveis.

`node scripts/supabase-bootstrap.mjs` gera `.cloudflare/supabase-bootstrap.sql`. **Usar somente em um projeto novo e vazio**; o próprio SQL recusa tabelas, contas ou objetos existentes. Para um projeto já instalado, aplicar migrações incrementais.

`node scripts/export-supabase-catalog.mjs` gera lotes de catálogo com até 250 registros. Identidades originais são preservadas e `ON CONFLICT (id) DO NOTHING` evita sobrescrever registros já personalizados. Esse catálogo não representa a importação de todos os dados de um provedor esportivo externo.

## Publicação

Preencher a configuração pública seguindo `.env.example`, com o mesmo Supabase no navegador e no servidor. Os arquivos `.env.production.local` e `.env.development.local` são ignorados; a configuração original foi preservada para rastrear a origem.

```powershell
npm.cmd run cloudflare:build
npm.cmd run cloudflare:check
npm.cmd run cloudflare:deploy
```

Os artefatos do Cloudflare ficam em `.cloudflare/production`, separados das saídas de verificação gráfica. A publicação conserva os segredos instalados no Worker e bloqueia a publicação final se `SUPABASE_SERVICE_ROLE_KEY` estiver ausente. O script nunca acrescenta credenciais privadas ao campo `vars` do Wrangler.

A versão `75f40189-f1e1-4f34-a626-4c4518705f1e` foi publicada após a revisão da central de privacidade. A página e `/api/health` foram novamente verificados em `jogomanager.com`, ambos com HTTP 200.

O login do Wrangler foi concluído por autorização de dispositivo, pois o retorno OAuth para localhost falhou neste computador. A configuração local do Wrangler fica em `.wrangler/config`; não publicar os arquivos dessa pasta.

## Segredos e serviços externos

A chave existente do Supabase foi transferida, com autorização explícita do proprietário, diretamente da interface do Supabase para o segredo criptografado `SUPABASE_SERVICE_ROLE_KEY` do Worker. Não criar arquivos locais com o valor, não usar prefixo `VITE_` e não incluí-lo em logs ou capturas.

| Recurso                                  | Configuração privada necessária                                                             | Observação                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Carreiras, operações do servidor e banco | `SUPABASE_SERVICE_ROLE_KEY`                                                                 | Instalado no Worker como segredo criptografado. Aceita `sb_secret_` ou JWT legado de serviço.                       |
| Sincronização protegida de futebol       | `FOOTBALL_SYNC_SECRET`                                                                      | Usar segredo separado para o endpoint; compatibilidade com `LOVABLE_CRON_SECRET` foi mantida.                       |
| Stripe sandbox / live                    | `STRIPE_SANDBOX_API_KEY` / `STRIPE_LIVE_API_KEY` e respectivos `PAYMENTS_*_WEBHOOK_SECRET`  | A chave pública Stripe existente não permite cobrar ou conceder compras. Manter chaves e webhook no mesmo ambiente. |
| Checkout de visitante                    | `GUEST_CHECKOUT_EMAIL_HASH_SECRET`, configuração `GUEST_CHECKOUT_*`                         | Requer credenciais de pagamento e validação do fluxo de compra e resgate.                                           |
| Inteligência artificial                  | `AI_API_KEY`, `AI_API_URL`, `AI_MODEL`                                                      | Suporta provedor compatível com chat completions, com URL HTTPS; o gateway legado depende de `LOVABLE_API_KEY`.     |
| Voz                                      | `ELEVENLABS_API_KEY`                                                                        | `ELEVENLABS_TTS_MODEL` é opcional e aceita modelos permitidos; o padrão é `eleven_v4_turbo`.                        |
| E-mail transacional independente         | `RESEND_API_KEY`, `TRANSACTIONAL_EMAIL_PROVIDER=resend`, `TRANSACTIONAL_EMAIL_FROM`         | Remetente deve pertencer a um domínio verificado. E-mails do Supabase Auth têm configuração de SMTP própria.        |
| Dados esportivos premium                 | `THESPORTSDB_API_KEY`, `FOOTBALL_DATA_API_KEY`, `APIFOOTBALL_API_KEY`, `SPORTMONKS_API_KEY` | Importações devem ser limitadas, retomáveis e preservar identidades da fonte.                                       |

As credenciais privadas dos provedores do Lovable não puderam ser exportadas automaticamente. A publicação do código não ativa esses serviços sem suas chaves e configurações. Não informar pagamento, IA, voz ou importação premium como concluídos até executar a verificação correspondente.

A narração autenticada usa `eleven_v4_turbo` pelo WebSocket Text to Dialogue, adequado a falas curtas e interativas. Se esse modelo estiver indisponível, tenta Eleven v4, Flash v2.5 e Multilingual v2. Essas alternativas da ElevenLabs consomem a franquia da conta; se a chave/saldo não estiver disponível, a partida usa a voz gratuita instalada no navegador/dispositivo. Configure a chave como segredo criptografado `ELEVENLABS_API_KEY` no Worker; não use prefixo `VITE_`. Para trocar o modelo, configure `ELEVENLABS_TTS_MODEL` somente no servidor para um dos IDs permitidos no código.

## E-mails de autenticação

O proprietário informou que usa Resend. A sessão dessa conta foi conectada e o domínio `jogomanager.com` foi adicionado, ainda sem verificação de DNS concluída. O SMTP do Supabase foi preparado, sem salvar uma senha ou habilitar o envio:

- Remetente: `JogoManager <noreply@jogomanager.com>`.
- Host: `smtp.resend.com`.
- Porta: `465` (TLS).
- Usuário: `resend`.
- Senha: chave privada de envio do Resend, a instalar diretamente no campo criptografado.

Os dados seguem a [documentação SMTP do Resend](https://resend.com/docs/send-with-smtp). O serviço padrão do Supabase restringe o envio aos membros do projeto; confirmação de cadastro e recuperação pública devem ser validadas depois de conectar o SMTP. A confirmação de e-mail não foi desativada.

O Site URL do Supabase foi salvo como `https://jogomanager.com`, após a verificação do site e da API nesse domínio. A lista de redirecionamentos contém a rota de autenticação do Worker e a de `jogomanager.com`.

A autorização específica para transferir a chave de envio do Resend ao SMTP do Supabase e ao segredo `RESEND_API_KEY` do Worker está pendente. A transferência aprovada anteriormente abrangia somente a chave do Supabase. Durante a retomada, a conexão de controle com as abas autenticadas do Chrome foi interrompida; o estado de verificação do domínio de e-mail ainda precisa ser revalidado. Nenhuma chave de envio foi instalada nesta etapa.

## Aviso de cookies

O modal de consentimento do Zaraz herdava texto branco sobre seu fundo branco. O CSS de `docs/cloudflare-consent.css` foi salvo e publicado nas configurações de Consentimento da zona, ajustando somente cores. Os controles de consentimento, finalidades e fornecedor existentes foram preservados.

A central de privacidade oferece o botão **Preferências de cookies** quando a API de consentimento está pronta. O botão reabre o modal para que o visitante possa rever sua escolha, sem conceder consentimento automaticamente. A abertura pelo botão e o contraste foram verificados na página de produção: texto `rgb(17, 24, 39)` sobre fundo branco. As capturas anteriores e posteriores à correção estão nos artefatos da revisão.

## Validação

- Testes focados de autenticação, Stripe e saúde do backend: 23 aprovados.
- TypeScript: aprovado. Lint dos arquivos alterados: sem erros; o arquivo da central de privacidade mantém o aviso preexistente de Fast Refresh sobre a exportação de `TRUST_BADGES` junto de componentes.
- Build do Cloudflare e upload real do Worker: executados.
- `/api/health` usa `no-store`; confirma Auth, validade da credencial administrativa e acesso ao catálogo no Postgres. Não retorna chaves nem registros de contas.
- Requisição sem credencial ao endpoint de sincronização: HTTP 401.
- Webhook Stripe sem assinatura válida: HTTP 400 no Worker publicado.
- Página inicial publicada com links do Discord, conteúdo ampliado e convite à comunidade; verificação visual no navegador realizada.
- Início, Sobre, Contato, Guias e Perguntas Frequentes: HTTP 200 com o convite do Discord diretamente em `jogomanager.com`. Autenticação e saúde do backend também retornaram HTTP 200, com `Cache-Control: no-store`.
- O redirecionamento de HTTP para HTTPS preserva o caminho e os parâmetros de consulta; a página inicial não redireciona para ela mesma.
- A regra geral de cache de todas as respostas foi desabilitada. A expressão da regra de dados privados foi corrigida para comparar os prefixos dos caminhos, com a diretiva `no-store`; os cabeçalhos da aplicação continuam controlando o cache dos arquivos públicos.
- Layout verificado em 390 × 844 no navegador: convite do Discord visível, menu móvel funcionando e largura do documento inferior à largura da janela. O tamanho temporário do navegador foi restaurado.

Ainda é necessário comprovar a confirmação por e-mail, login, recuperação e salvamento de carreira com uma conta de teste real, além dos testes separados dos serviços externos. Os resultados de build e testes focados não certificam esses fluxos completos.
