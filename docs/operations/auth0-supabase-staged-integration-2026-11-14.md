# Auth0 + Supabase: rollout seguro e verificável (14/11/2026)

## Escopo real e estado

- Supabase de produção: `lguqnwvsfeefxamzeyos` (`us-west-2`).
- Auth0: tenant `dev-7v2pprbbxg314kqs` (dashboard informa ambiente Development, US-5).
- O jogo usa **Supabase Auth como identidade primária**. Carreiras, perfis, compras,
  rankings e assinaturas têm `user_id UUID` com políticas baseadas em
  `auth.uid()`. NÃO substituir o singleton em
  `src/integrations/supabase/client.ts`.
- `src/integrations/supabase/auth0-data-client.ts` é um cliente separado,
  desativado por padrão e destinado exclusivamente a **novos** recursos
  Auth0-aware, nunca às tabelas legadas ou à autorização de pagamentos.
  Nenhuma UI o importa, e nenhum login de jogador é alterado.
- A instalação do Auth0 Wrapper pelo dashboard produziu
  `ERROR 42501 permission denied to create foreign-data wrapper`.
  A extensão `wrappers` existe, mas nenhum `auth0_wrapper` foi criado.
- Não houve configuração do Auth0 no dashboard, publicação de Action,
  implantação do Worker nem integração Third-Party Auth em produção.

## Separação essencial

**Third-Party Auth** permite que o Data API/Storage/Realtime confiem em
JWTs assimetricamente assinados pelo Auth0. **Auth0 Wrapper** usa
credenciais da Management API para *consultar usuários* em tabelas externas.
Um não substitui o outro.

Atenção: o `sub` usual do Auth0 não é UUID, enquanto `auth.uid()` efetua
cast de `sub` para UUID. O simples cadastro de Auth0 em Third-Party Auth
NÃO conecta um jogador às contas Supabase existentes. Não reescrever
`user_id`, não tentar converter `sub` e não vincular identidades apenas
por coincidência de email.

## Configuração Auth0, somente em ambiente de homologação

1. Conferir que o tenant correto aparece no dashboard. Preparar uma
   aplicação **Single Page Application** dedicada ao piloto do jogo;
   identificar seu Client ID (público). Nenhuma secret de máquina vai ao browser.
2. Estabelecer callback e logout de **staging**, em um domínio já implantado
   e com tratamento PKCE efetivamente testado. Não adicionar caminhos
   inventados à allowlist; o callback dedicado ainda NÃO existe no jogo.
   Nunca configurar wildcards de callback ou CORS.
3. Em Branding / Universal Login, definir nome do jogo, favicon/logo
   hospedado em domínio controlado, cores e traduções pt-BR.
   Não inventar URL de logotipo; validar URLs públicas e HTTPS.
4. Ativar bloqueio de tentativas abusivas e credenciais comprometidas quando
   disponíveis no plano. Revisar fluxos de verificação de email, MFA e
   recuperação. Não impor SMS sem provedor e mitigação de fraude.
5. Em Actions > Post Login, criar, revisar, publicar e anexar o código
   `auth0/actions/post-login-supabase-role.cjs`. Adicionar Action Secret
   `PFM3D_AUTH0_CLIENT_ID` com o ID da aplicação piloto. Confirmar que o
   claim **literal** `role: "authenticated"` aparece no **ID token** desse
   cliente, e não em outros clientes.
6. Conferir o issuer OIDC, o `jwks_uri`, o `kid` do JWT e o algoritmo de
   assinatura: RS256 ou outro assimétrico oficialmente aceito. Não usar
   HS256 ou PS256. Conferir audience, validade temporal e rotação de chaves.

## Supabase, somente staging até a liberação

1. Em Authentication > Third-Party Auth, adicionar a integração Auth0
   oficial com tenant/region confirmados. Fazer em projeto de staging isolado
   antes do projeto de produção; NÃO alterar Signing Keys do Supabase Auth.
2. Criar teste em recurso de staging com autorização específica ao issuer
   Auth0, usando `auth.jwt()->>'sub'` em colunas TEXT e RLS
   `TO authenticated`. Isolar o issuer para que tokens Supabase e Auth0
   não compartilhem acidentalmente dados. Usar `auth.jwt()->>'iss'` e
   validar o valor exato do issuer.
3. Integrar `createAuth0SupabasePilotClient` somente a esse recurso
   isolado, passando um Auth0 SPA SDK já autenticado. O helper transporta
   ID tokens, mas **não verifica criptografia no cliente**. É o Supabase
   que valida JWT e aplica RLS.
4. Exercitar token válido, token expirado, `kid` inválido, issuer errado,
   ausência de `role`, sessão ausente, CORS, login/logout, refresh, MFA,
   Storage e Realtime. Testar RLS contra uma segunda conta real.
5. Verificar a compatibilidade com SSR, o Supabase Auth atual, PKCE,
   passkeys e os fluxos de compra e carreira antes de qualquer ampliação.
6. Se for exigido um login único no jogo, projetar separadamente um
   **vínculo de identidade verificado** com os UUIDs já existentes, com
   prova de posse de ambas as sessões e auditoria do lado do servidor.
   Nunca associar usuários apenas por email, metadata editável ou JWT
   decodificado sem validação. Validar as políticas e referências antes
   do cutover, com migração/rollback previamente ensaiados.

## Auth0 Wrapper (somente consulta administrativa)

- A extensão `wrappers` e o `supabase_vault` estavam instalados, mas
  a criação do foreign-data wrapper foi bloqueada pelo PostgreSQL gerenciado.
- Não elevar `postgres` a superusuário, não definir `SECURITY DEFINER`
  para contornar privilégios nem copiar credenciais da Management API.
- Encaminhar o erro `42501` ao suporte do Supabase ou usar uma API
  administrativa backend com escopo mínimo `read:users`. Nunca colocar
  um token da Management API no navegador.
- Quando o FDW puder ser criado por mecanismo suportado, manter tabelas
  externas em esquema PRIVADO, sem Data API e sem grants a `anon` ou
  `authenticated`. Wrappers não aplicam RLS automaticamente.

## Gates de aceite antes da ativação

- [ ] Aplicação Auth0 correta, branding, callback/origens e PKCE testados
- [ ] Post Login Action publicada e secret configurado; role no ID token
- [ ] Emissor/JWKS e chaves verificados; assinatura/claims negativas testadas
- [ ] Third-Party Auth configurado no staging e regras RLS revisadas
- [ ] Login, logout, recuperação, MFA e passkeys sem regressão
- [ ] Contas legadas preservam o mesmo UUID e suas carreiras/compras
- [ ] Testes E2E com 2 jogadores e 2 dispositivos, incluindo tentativa de
      acesso cruzado, token expirado, sessão revogada e novos registros
- [ ] Gate TypeScript/lint/unit/visual aprovado no último SHA do PR
- [ ] Revisão humana e plano de rollback aprovados antes de ativar produção
- [ ] Auth0 Wrapper apenas se e quando o provedor liberar instalação segura

## Rollback

1. Desligar a exposição do piloto (não altera Supabase Auth principal).
2. Revogar as sessões Auth0 piloto afetadas e remover a integração
   Third-Party Auth se necessário, conforme política de incidentes.
3. Desabilitar Action do cliente piloto, sem desabilitar outros provedores.
4. Revisar logs e comparar integridade de carreiras e pagamentos; nunca
   realizar alterações em massa de `user_id` como parte do rollback.

## Verificação automatizada local

- `node --test auth0/actions/post-login-supabase-role.test.cjs`
- `npx vitest run src/integrations/supabase/auth0-data-client.test.ts`
- `npx tsc --noEmit` e `npm run lint` no ambiente compatível do repositório

Os testes unitários não substituem login real, hospedagem do callback,
assinatura válida, autorização cruzada nem homologação em dois dispositivos.

Referências:
- https://supabase.com/docs/guides/auth/third-party/auth0
- https://supabase.com/docs/guides/auth/third-party/custom-oidc
- https://supabase.com/docs/guides/database/extensions/wrappers/auth0
- https://supabase.com/docs/guides/database/extensions/wrappers/overview
- https://auth0.com/docs/secure/tokens/json-web-tokens/create-custom-claims
