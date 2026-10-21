# Fastly + Cloudflare + Twilio | implantação em etapas

**Estado (21/10/2026): PREPARADO NO CÓDIGO, NÃO ATIVADO EM PRODUÇÃO.**
Esta alteração não transfere o DNS de `jogomanager.com`, não contrata a Fastly, não ativa SMS e não altera os fluxos de login. A publicação só pode ser considerada concluída depois de configurar contas externas e comprovar os testes abaixo.

## 1. Arquitetura e limitações

Plano de teste, antes de qualquer alteração no domínio principal:

```text
Navegador
  -> fastly-test.jogomanager.com (Fastly CDN / WAF, SE contratado)
  -> fastly-origin.jogomanager.com (Cloudflare DNS PROXIED, TLS Full strict)
  -> Cloudflare Worker jogomanager-web -> Supabase Auth / Postgres / Stripe
```

O hostname `fastly-origin.jogomanager.com` deve ser configurado como domínio/rota do MESMO Worker; não basta criar DNS. O projeto passa a rejeitar requisições ao novo hostname quando o segredo `FASTLY_ORIGIN_SECRET` não está instalado (503), ou quando o header `x-jm-fastly-origin-secret` não corresponde (403). Demais hostnames mantêm o comportamento atual.

**O segredo deve ser gerado com CSPRNG (32 bytes em hex minúsculo, total 64 caracteres),** armazenado no segredo criptografado do Worker e no **Fastly Secret Store se usar Compute**. Secret Store NÃO está disponível para serviços CDN baseados em VCL; para VCL, só avançar depois de definir um mecanismo de segredos privado e auditado, sem gravar tokens em VCL versionado. Não escrever o valor em arquivos versionados, logs, analytics, URLs ou respostas. A Fastly deve *remover o header recebido do cliente* e *inserir seu valor secreto somente na requisição ao backend*, inclusive em verificações de saúde se forem autenticadas. Cabeçalhos de endereço de origem do visitante não são prova de identidade; confiar apenas em valores normalizados pela borda autenticada. Não copiar um valor de `Fastly-Client-IP`, `CF-Connecting-IP` ou `X-Forwarded-For` fornecido pelo cliente.

**Atenção:** esse gate protege somente o *novo hostname dedicado*. O endereço `*.workers.dev`, rotas antigas e eventuais nomes alternativos do Worker podem continuar acessíveis. Antes de afirmar que a Fastly é uma camada obrigatória, fazer inventário de todos os caminhos diretos e reduzir os bypasses sem cortar a publicação. Um CDN adicional aumenta também a complexidade, a latência e os pontos de falha. Não presumir que duas CDNs significam duas vezes a proteção.

## 2. Fastly: preparação segura

1. Criar conta Fastly com MFA para administradores e confirmar se o plano oferece o WAF desejado. Não assumir que o WAF está incluído com a CDN.
2. Criar serviço Fastly **de teste**, preferencialmente **Compute** caso a autenticação de origem dependa do Fastly Secret Store; cadastrar `fastly-test.jogomanager.com`, certificado TLS gerenciado e CNAME específico informado pela Fastly. Manter `jogomanager.com` e `www.jogomanager.com` inalterados.
3. Criar `fastly-origin.jogomanager.com` na zona Cloudflare como hostname proxied e vinculado ao Worker de produção. Confirmar emissão/validade do certificado e rota HTTP antes de avançar. Enquanto o segredo estiver ausente, esperar 503 apenas neste novo hostname.
4. No backend Fastly, usar HTTPS na porta 443 com validação de certificado. Configurar endereço de origem, SNI, certificate hostname e override de Host para `fastly-origin.jogomanager.com`. **Nunca** apontar a origem para `jogomanager.com` ou `fastly-test.jogomanager.com`, sob risco de loop Fastly ↔ Cloudflare.
5. Provisionar o segredo `FASTLY_ORIGIN_SECRET` no Worker e na Fastly por um canal privado. Remover headers de autenticação de origem recebidos de visitantes e inserir o segredo apenas na requisição Fastly -> Cloudflare. Validar que a origem sem o header responde 403. Testar rotação do segredo com sobreposição planejada: com o código atual somente **um** valor é aceito, portanto a troca deve ser coordenada.
6. Configurar bloqueio/bot/rate limit progressivamente em **log/observe** antes do bloqueio. Não aplicar challenges interativos indiscriminadamente em APIs, rotas de callback, pagamentos, Supabase ou endpoints de health.
7. Na Fastly, configurar passagem sem cache (**pass/no-store**) requisições com Authorization/Cookie, Set-Cookie, requisições não GET/HEAD, `/api/`, `/_serverFn/`, `/auth`, `/checkout`, `/lovable/`, conteúdo privado e respostas não explicitamente públicas. Cache preferencialmente apenas assets estáticos fingerprintados. Não cachear SSR privado, OTP, sessões ou respostas Stripe.
8. Preservar websocket/upgrade, callbacks OAuth, cabeçalhos, query strings e CORS. Realizar testes reais de login, logout, cadastro, MFA, salvamento, multiplayer e webhooks Stripe em ambiente seguro de testes, sem simular compras reais.
9. Validar GET/HEAD/POST, IPv4/IPv6, TLS, latência p95, bloqueios falsos e retorno `/api/health`. Testar vários navegadores, localização no Brasil e cache de arquivos. Monitorar erros 4xx/5xx e custo.
10. **Só após testes e janela de rollback**, avaliar migrar o tráfego público para a Fastly. Preservar registros DNS originais, TTL baixo temporário e rollback documentado. Cloudflare continua como provedor DNS/Worker da origem e pode deixar de ser a primeira borda pública. Não alterar DNS durante uma falha de autenticação ou deploy.

## 3. Twilio: integração correta com Supabase

Twilio NÃO é CDN/WAF. É um provedor de comunicação e verificação de identidade, separado da Fastly. Para telefone/MFA, **preferir a integração nativa do Supabase Auth com Twilio / Twilio Verify**; criar uma segunda implementação de OTP no Worker seria duplicar a fonte de verdade e poderia permitir bypass.

1. Criar ou acessar conta Twilio, habilitar MFA administrativo, revisar país de envio (Brasil e outros países atendidos), custos, verificação da conta e limites de gastos. Provisionar serviço Verify, se usar a modalidade Verify, ou um remetente/Messaging Service suportado pelo painel Supabase.
2. Em Supabase > Authentication > Providers > Phone, escolher o provedor Twilio compatível com a conta e preencher Account SID, credencial secreta e identificador de serviço exigido pelo formulário. Esses valores devem ficar **somente no dashboard/secret manager**. Não inserir `TWILIO_AUTH_TOKEN`/API Secret em `VITE_*`, repositório ou front-end.
3. Para MFA por telefone, configurar fatores de telefone em Authentication > Multi-Factor Authentication. O Supabase gerencia enroll, challenge, verify e `aal2`. **Não exigir MFA de todos os usuários** antes de implementar e testar telas de cadastro e desafio, recuperação de acesso, segundo fator alternativo e autorização nos endpoints/RLS sensíveis.
4. Ativar inicialmente apenas para números de teste autorizados; conferir um desafio real, a confirmação, reenviar, expiração, taxa de erro, fluxo após sign-in social, atualização de sessão, custos e opt-out. Habilitar rate limits, CAPTCHA/Turnstile e alertas antifraude para evitar SMS pumping.
5. Não substituir passkeys e TOTP existentes: preferir passkeys/TOTP quando possível, mantendo SMS como alternativa sob consentimento do usuário. Não usar SMS como senha universal ou como garantia suficiente para pagamentos elevados.
6. Segurança efetiva de MFA exige validação de `aal2` nas APIs e operações com dados sensíveis; apenas enviar SMS não adiciona bloqueio de acesso.

**O que falta externamente:** conta/serviço Fastly conectado, domínio TLS Fastly, origem Cloudflare vinculada, dois segredos iguais provisionados, credenciais/provedor Twilio no Supabase e testes de ponta a ponta. Até lá, não rotular o sistema como ativo.

## 4. Critérios objetivos de aceite

- `jogomanager.com` e `www.jogomanager.com` seguem públicos e funcionais; nenhuma alteração DNS antes do aceite.
- No hostname dedicado: sem configuração = HTTP 503; sem segredo/segredo inválido = HTTP 403; com segredo = fluxo normal. Todos com cache privado.
- No staging Fastly: TLS válido, Host/SNI corretos, sem 301/302 em loop, tráfego de teste atravessa as duas CDNs, APIs privadas não armazenadas.
- Conta Supabase não passa para `aal2` sem challenge bem-sucedido; usuários existentes continuam capazes de entrar enquanto a mudança for opt-in.
- Auditorias: verificar origens alternativas, logs de WAF, métricas de bloqueio, custo de SMS e possibilidade de reverter o DNS no mesmo dia.

## Fontes oficiais

- Fastly TLS: https://www.fastly.com/documentation/guides/getting-started/domains/securing-domains/tls-quick-start/
- Fastly Backends: https://www.fastly.com/documentation/guides/integrations/non-fastly-services/developer-guide-backends/
- Fastly health checks: https://www.fastly.com/documentation/guides/getting-started/hosts/working-with-health-checks/
- Supabase Twilio SMS: https://supabase.com/docs/guides/auth/phone-login
- Supabase MFA telefone: https://supabase.com/docs/guides/auth/auth-mfa/phone
- Supabase MFA e políticas: https://supabase.com/docs/guides/auth/auth-mfa
- Twilio Verify: https://www.twilio.com/docs/verify/api
