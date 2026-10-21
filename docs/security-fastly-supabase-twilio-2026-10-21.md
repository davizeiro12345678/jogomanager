# Segurança: Fastly, Supabase e Twilio

Verificado em 21 de outubro de 2026. Esta nota distingue recursos configurados de recursos ainda pendentes.

## Fastly

- Serviço: `bhEs3I9sbvxlCzr9kb0IBQ`.
- Nome: JogoManager - segunda camada de seguranca.
- Domínio associado: `jogomanager.com`.
- Origem HTTPS: `jogomanager-web.davizeiro10-jogos.workers.dev`.
- Teste: https://slightly-apt-buffalo.global.ssl.fastly.net/api/health retornou HTTP 200, `ready`, com autenticação, credenciais de servidor e banco disponíveis.
- DDoS Protection está habilitado em modo Blocking. A mitigação de rede always-on aparece habilitada.
- Next-Gen WAF, API Discovery, API Enforcement, Bot Management e Rate Limiting exigem contato comercial na conta. Não foram contratados ou ativados.
- Certificado Let's Encrypt solicitado; assinatura `OCkxB28YH63DKnyNJfmZZw`, pendente de DNS.
- Validação: CNAME `_acme-challenge.jogomanager.com` para `nvwwnl3sr4a2d9x0cj.fastly-validations.com`. Antes de adicionar, verificar se já há desafio ACME usado por outro provedor. Não substituir um desafio existente indiscriminadamente.
- O domínio principal ainda não foi migrado para tráfego Fastly. Antes da troca, validar TLS emitido, cabeçalhos Host/SNI, origem canônica, login/OAuth, saves, pagamentos, webhooks e reversão. Não encaminhar a origem Fastly de volta para o próprio domínio após mudar o DNS.

## Supabase

Projeto de produção confirmado: `lguqnwvsfeefxamzeyos`. A integração existente com o backend respondeu saudável; não foi criado outro banco nem migrados usuários.

A migração `20261021182246_harden_stripe_function_search_paths.sql` foi aplicada em produção e fixa `search_path=pg_catalog` nas funções:
- `stripe.set_updated_at()`
- `stripe.set_updated_at_metadata()`
- `stripe.check_rate_limit(text, integer, integer)`

Verificação: as três configurações foram consultadas após a alteração; o aviso `function_search_path_mutable` desapareceu dos advisors. Um trigger de teste foi executado em tabela temporária e revertido. O limitador Stripe aceitou duas chamadas e rejeitou a terceira em uma transação revertida. O papel anon não conseguiu executar `public.mutate_player_career`.

As políticas consultadas limitam perfis, carreiras, compras e carteira ao proprietário. Os esquemas stripe, backup_restore, football_import_private e data_quality não concederam acesso às tabelas aos papéis anon/authenticated no levantamento.

Avisos de visibilidade GraphQL não demonstram, isoladamente, acesso às linhas de outros usuários. Não remover SELECT das carreiras ou do catálogo público indiscriminadamente. A função de mutação de carreira é SECURITY DEFINER intencional, verifica usuário e propriedade, e usa caminho fixo. Tabelas internas com RLS sem políticas continuam fechadas aos clientes.

## Twilio e autenticação

Nenhum envio de SMS/WhatsApp, serviço Verify, alteração de MFA ou recuperação foi ativado nesta etapa. A revisão automática bloqueou o acesso ao painel redirecionado em `1console.twilio.com`, inclusive após a aprovação do usuário. Não foi contornado o bloqueio.

A configuração de produção requer acesso seguro aos painéis e credenciais no armazenamento de segredos dos provedores, nunca no navegador do jogo ou no repositório. Antes de ativar:
1. Configurar Twilio/Twilio Verify como provedor telefônico no Supabase.
2. Configurar Fraud Guard, destinos permitidos, limites por conta/IP/telefone e intervalo de reenvio.
3. Habilitar canais SMS e WhatsApp somente quando o remetente, conta e templates necessários estiverem aprovados.
4. Implementar e testar cadastro/validação de fatores, recuperação e revogação de sessões no aplicativo. Verificação telefônica simples não equivale a MFA.
5. Não tornar telefone obrigatório para contas existentes sem fluxo de cadastro e recuperação.
6. Testar com número e destinatário autorizados e definir orçamento de envio antes de gerar tráfego cobrado.

O conector Cloudflare falhou; o painel Cloudflare e o painel Supabase de autenticação abriram em tela de login. As permissões SQL do conector Supabase continuam funcionando.
