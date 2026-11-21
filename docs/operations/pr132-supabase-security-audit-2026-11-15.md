# PR #132 | Auditoria de autorização Supabase (somente leitura, 15/11/2026 UTC)

**Ambiente inspecionado:** projeto existente JogoManager - Produção, referência `lguqnwvsfeefxamzeyos`. Os resultados foram obtidos pelo conector Supabase com `get_advisors(type=security)` e consultas SQL somente de metadados em `pg_class`, `pg_namespace`, `pg_policy`, `pg_proc` e nas ACLs. Não houve DDL, concessão de privilégios, cópia de dados, inspeção de credenciais nem criação de staging.

## Resultado que realmente importa

| Alerta do Supabase | Quantidade | Interpretação / ação |
|---|---:|---|
| `rls_enabled_no_policy` | 37 INFO | **37/37 verificados** via consultas aos grants e USAGE: **zero** tabelas com SELECT, INSERT, UPDATE ou DELETE concedidos a `anon` ou `authenticated`. A ausência de política impede ainda mais o acesso via RLS. Esses casos podem ser intencionais para tabelas internas. Não criar policy pública para simplesmente apagar o aviso. |
| `pg_graphql_anon_table_exposed` | 26 WARN | GraphQL consegue apresentar objetos `public` com permissões já existentes para `anon`. Avaliar individualmente se catálogo público e visões são intencionais. GraphQL não torna uma tabela privada automaticamente pública, mas amplia a superfície de consulta quando há grants. |
| `pg_graphql_authenticated_table_exposed` | 48 WARN | Inclui relações de carreira, perfis, chat, transações e direitos. Verificar RLS e privilégios por relação, acesso entre dois usuários diferentes, e se GraphQL é realmente necessário. |
| `authenticated_security_definer_function_executable` | 1 WARN | `public.mutate_player_career`, executável por `authenticated`, não por `anon`; `SECURITY DEFINER`, owner `postgres`, `search_path` vazio. O corpo lido em modo read-only usa `auth.uid()`, verifica MFA e restringe gravação pelo `user_id` autenticado, com revisão otimista e validação do slot. Não há prova de exploração; precisa teste negativo de propriedade/MFA, especialmente com autenticação anônima. |

## Conclusões de risco

- Os **37 avisos RLS sem policy não são 37 vazamentos**: esta verificação encontrou zero concessões de DML para `anon`/`authenticated`. Não afrouxar o modelo deny-by-default. Conclusão é um *snapshot de ACL e catálogo*, não execução real do GraphQL como usuários distintos.
- O alerta de `SECURITY DEFINER` merece teste de segurança e revisão independente. A função verifica o `auth.uid()` e `app_private.mfa_session_allowed()` e filtra `player_careers.user_id = v_user`. A verificação `auth.role()` está sujeita a semântica de sessões anônimas; conferir configuração, autorização de login anônimo e MFA antes de mudar uma função de produção.
- A triagem **não valida** a ausência de IDOR/BOLA em todos os 48 objetos GraphQL; revalidar políticas `USING`/`WITH CHECK`, funções invoker/definer, e visões `security_invoker` no staging isolado. Considerar revogar grants de relações privadas expostas, não revogar catálogo público legítimo às cegas.
- A possibilidade de acessar todos os dados por `service_role` e a distinção dos schemas privados não devem ser reproduzidas em JavaScript público. Nenhum token de serviço deve ser enviado ao navegador ou a um Worker de staging sem segredo independente.

## Próximos testes obrigatórios no staging isolado

1. `anon`: não deve ler/escrever as 37 tabelas, não pode chamar mutação de carreira.
2. `authenticated` usuário A: sem SELECT/UPDATE para tabelas de usuário B; testes de GraphQL autenticado e anon com dados sintéticos em carreiras, perfil, chat, compras e direitos.
3. `SECURITY DEFINER`: sessão sem MFA e sessão anônima rejeitadas quando exigido; slot/revisão/identidade adulterados rejeitados; usuário B não modifica dados A; validar `search_path` imutável.
4. Projetar e verificar mudanças de grants e RLS com fixture reproduzível e rollback. Em produção, aplicar apenas após revisão independente, CI e plano de migração.

**Não realizado:** nova base de staging com custo, SQL de alteração em produção, publicação de API e homologação de usuários reais. Os resultados não autorizam merge do PR #132.

Fonte de remediação do aviso INFO: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Verificação complementar das exposições GraphQL (15/11)

Uma segunda consulta aos metadados cruzou os nomes sinalizados por ambos os advisors GraphQL com `pg_class`, `pg_policies`, ACL de SELECT e opções das views:

- Todos os objetos sinalizados que são **tabelas** têm RLS habilitada e pelo menos uma política cadastrada; nenhuma dessas tabelas apareceu como RLS desabilitada nessa amostra.
- As duas views sinalizadas, `public.official_events_catalog` e `public.players_catalog`, estão com `security_invoker=true`, não com bypass implícito por privilégio do proprietário.
- As relações autenticadas de carreira, perfis, compras, carteira e chat podem ser consultáveis conforme os grants de `authenticated`; RLS precisa ser testada com **dois usuários sintéticos** para detectar eventuais regras BOLA/IDOR. A enumeração GraphQL não equivale a leitura indevida de linhas.
- Não concedemos acesso ao catálogo de pagamentos, não desabilitamos GraphQL e não modificamos políticas de `public`; mudanças nessa superfície exigem verificar consumidores e smoke test de autenticação no staging.

**Risco residual:** política excessivamente permissiva ou função privilegiada invocada sob identidade indevida não pode ser excluída por uma inspeção de metadados. Um checklist de concessões sem teste com personagens reais não serve como prova de isolamento horizontal.
