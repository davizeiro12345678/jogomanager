# Proteção adicional de OTP telefônico e estado das integrações (21/10/2026)

## Mudança REAL no Supabase de produção
Foi aplicada a migração `harden_private_phone_otp_budget` no projeto `lguqnwvsfeefxamzeyos` (JogoManager - Produção).

- Novo schema privado `auth_safety` e tabela `auth_safety.phone_otp_attempts` com RLS habilitada.
- Sem USAGE do schema para `anon` e `authenticated`; somente `service_role` recebeu USAGE. Nenhuma política libera leitura/alteração de linhas a usuários.
- Função `auth_safety.consume_phone_otp_budget(phone_hmac, ip_hmac, channel)` é SECURITY INVOKER com `search_path=pg_catalog` e EXECUTE restrito a `service_role`.
- Limites implementados *quando a função for integrada no caminho de envio*: 60 s de intervalo por número, no máximo 4 tentativas aprovadas/hora por número, 8/24h por número e 15/hora por IP. SMS e WhatsApp compartilham o orçamento por número para impedir contornar limites trocando o canal.
- A função recebe hashes **HMAC-SHA-256 com chave do servidor** do número E.164 e do IP, ambos representados por 64 caracteres hexadecimais minúsculos. Nunca guardar telefone ou IP em claro nem usar SHA-256 simples de telefone enumerável.
- Bloqueio atômico com advisory locks no PostgreSQL para não aceitar múltiplos pedidos simultâneos além da cota.
- O log é append-only e requer uma rotina administrativa de limpeza de entradas com mais de 48h ou 72h, executada com privilégios restritos. Não apagar logs prematuramente.
- Teste realizado numa transação revertida sob `SET LOCAL ROLE service_role`: primeira tentativa autorizada; segunda tentativa bloqueada com `cooldown`; zero linhas de teste persistidas. USAGE por `anon` e `authenticated` foi verificado como falso.

**ATENÇÃO:** a função NÃO está conectada ao Supabase Auth ou ao Twilio, por falta das credenciais/serviço e de um ponto de interceptação da remessa. Os limites do Supabase Auth devem continuar ativos; não é correto anunciar que esta tabela bloqueia SMS real até que o fluxo obrigatório passe por ela. Para integração, usar Send SMS Auth Hook ou serviço autenticado equivalente, checar o orçamento ANTES de qualquer chamada paga, e considerar que o Supabase pode enviar OTP diretamente por provedor nativo sem consultar essa tabela. Integração deve ser testada com conta/telefone de teste e autorização explícita.

## Auditoria de produção
- Supabase Postgres 17; 68 tabelas em public, todas com RLS ativa na inspeção anterior.
- As políticas de `profiles` verificadas associam leitura/escrita ao `auth.uid()=user_id`.
- `match_room_secrets`, `payment_webhook_events` e `checkout_session_owners` não concedem SELECT a `anon`/`authenticated`.
- O advisor identifica uma função SECURITY DEFINER autenticada `public.mutate_player_career`, cuja necessidade foi analisada na nota de segurança existente: **não revogar sem revisar chamadas**.
- As tabelas GraphQL de futebol podem ser catálogo público proposital. Descoberta de tabela não é necessariamente vazamento de linhas.

## Fastly real e controles que NÃO estão ativos
Conforme `docs/security-fastly-supabase-twilio-2026-10-21.md` do branch principal, já existe o serviço CDN `bhEs3I9sbvxlCzr9kb0IBQ`, versão 2 ativada, com bypass de cache para rotas privadas e proteção DDoS em modo Blocking. O teste do hostname Fastly retornou 200, conforme nota, mas `jogomanager.com` ainda não foi apontado ao Fastly. Não duplicar um segundo serviço sem necessidade. O certificado para o domínio principal depende da validação ACME/DNS.

As opções Next-Gen WAF, API Discovery/Enforcement, Bot Management e rate limiting avançado continuam dependentes de habilitação comercial na conta, não são ativadas pela simples existência do serviço CDN. **Não contratar nem aceitar tarifas indeterminadas automaticamente.** Compute em trial não deve receber tráfego de produção segundo documentação oficial.

`src/lib/fastly-origin-gate.ts` nesta branch é uma **proposta alternativa** de origem dedicada e ainda não foi integrada ao serviço Fastly existente. Atualmente o serviço usa a origem `jogomanager-web.davizeiro10-jogos.workers.dev`. Não transferir hostnames ou DNS até compatibilizar as duas arquiteturas, conferir Host/SNI, TLS, rate limiting e rollback.

## Twilio e acesso
A conta Twilio está em teste limitado e Verify e Fraud Guard exigiam upgrade na inspeção registrada na nota de segurança existente. As quotas de teste não significam SMS/WhatsApp já integrados. O Supabase Auth já está integrado ao site e oferece recuperação por e-mail e login social. SMS e WhatsApp não estão habilitados para usuários.

Prioridades antes da ativação: serviço Twilio Verify e remetente autorizado, segredo no painel Supabase (nunca em VITE_*), limites Auth, controles de país, opt-in e custo, UI de MFA/recuperação, `aal2` em rotas sensíveis, não exigir SMS de usuários existentes e teste real com número autorizado.

## Core Web Vitals
Uma execução Lighthouse do GitHub Actions não equivale aos dados RUM da Cloudflare. A suíte do GitHub em 21/10 executou 15 Lighthouse mobile em `127.0.0.1:4173`; passou no job, mas registrou avisos para meta de 98 pontos e LCP 2,5 s em cinco páginas. Não usar esses valores como métricas reais do site atrás da Cloudflare. A ligação Cloudflare da ferramenta falhou; `Web Analytics > Core Web Vitals` ou `Speed > Observatory` exige acesso à zona e fornece LCP/INP/CLS p75 reais. Um teste público PageSpeed Insights pode complementar, mas não substitui o RUM.
