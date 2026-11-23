# Evidências e plano de proteção do repositório — 21/11/2026

**Alvo:** [davizeiro12345678/jogomanager](https://github.com/davizeiro12345678/jogomanager)  
**Branch de trabalho:** integration/release-2026-11-11 ([PR #132](https://github.com/davizeiro12345678/jogomanager/pull/132); reconciliação da main, ainda não integrada)
**Critério:** distinguir controles **verificados**, **configurados no código** e **dependentes de acesso administrativo**. O documento não é uma certificação de segurança.

## Inventário observado por API

| Controle | Observação de 21/11/2026 | Classificação |
| --- | --- | --- |
| Repositório | Público, branch padrão main | **Verificado** |
| Branch main | Endpoint de branch apresenta protected=true | **Verificado** |
| [Ruleset #27576613 — Proteção da main](https://github.com/davizeiro12345678/jogomanager/rules/27576613) | enforcement=active, aplicado à default branch | **Verificado** |
| Pull request obrigatório | ruleset exige PR, zero reviews obrigatórios, resolução de conversas; dismiss de reviews desatualizadas | **Verificado** |
| Integridade de branch | ruleset bloqueia delete e non-fast-forward | **Verificado** |
| Check de release | Critical performance release gate, integração 15368, verificação strict | **Verificado no ruleset; execuções precisam passar** |
| [Ruleset #24017497 — wadweew](https://github.com/davizeiro12345678/jogomanager/rules/24017497) | enforcement=active, mas condições include/exclude de ref_name estão vazias | **Existência verificada; escopo de aplicação não confirmado** |
| Proteção legada da branch | GET /branches/main/protection retorna 403 por falta de permissão da integração | **Não auditar via esse endpoint** |
| Quality gates | Workflow existe, é executado em PR e push main | **Configurado; conferir resultado por SHA** |
| Dependabot version updates | .github/dependabot.yml criado no PR com npm e GitHub Actions semanais | **Configurado no PR; efeitos dependem de merge e GitHub** |
| CodeQL | .github/workflows/codeql-security.yml criado; JS/TS security-extended e permissões por job | **Workflow acionado no PR; resultado ainda não certificado nesta auditoria** |
| CODEOWNERS | Proprietário identificado para árvore e áreas sensíveis | **Configurado no PR, sem revisão obrigatória** |
| Dependabot alerts/security updates | Necessitam confirmação em Settings | **Não verificado** |
| Secret scanning / push protection | Necessitam confirmação em Settings | **Não verificado** |
| Private vulnerability reporting | Necessita confirmação em Settings | **Não verificado** |
| CodeQL alerts e políticas de bloqueio | Exigem workflow concluído e política GitHub revisada | **Não certificado** |
| Cloudflare, Supabase, Stripe, VPS | Fora do escopo de confirmação dessas chamadas do GitHub | **Não verificado por esta auditoria** |

**Interpretação:** a presença de um ruleset é positiva, mas não certifica que todas as APIs de administração estejam acessíveis nem que os sistemas externos estejam protegidos. Não inferir aprovação de um PR a partir de checks de SHA anterior.

## Hardening versionado nesta alteração

1. **README.md:** substituir o texto inicial de ferramenta por uma apresentação autoral, rotas, arquitetura, histórico, fluxo de release e estado de homologação.
2. **SECURITY.md:** corrigir versões fictícias, definir escopo, canal de divulgação responsável, modelo de ameaças, triagem, exigências de teste e plano de incidentes.
3. **.github/dependabot.yml:** abrir PRs de atualizações npm e GitHub Actions com limite de volume; sem auto-merge.
4. **.github/workflows/codeql-security.yml:** análise JS/TS na main, em PRs, agendada semanalmente e manual; ações fixadas em SHA e GITHUB_TOKEN de menor privilégio possível.
5. **.github/CODEOWNERS:** atribuir manutenção geral e de áreas de risco sem forçar aprovação impossível pelo autor de um PR.

## Ativações administrativas ainda necessárias

No GitHub, abrir **Settings → Code security and analysis** e verificar, uma a uma, as opções disponíveis para este repositório público:

- Habilitar **Dependabot alerts** e **Dependabot security updates**.
- Confirmar **Dependency graph**.
- Habilitar **Secret scanning** e **Push protection**, se o plano e as permissões oferecerem as opções.
- Habilitar **Private vulnerability reporting** para tornar efetivo o fluxo confidencial do SECURITY.md.
- Verificar que o **CodeQL** está executando e publicando resultados na aba **Security → Code scanning**. Evitar configuração concorrente duplicada entre default e advanced setup.
- Verificar **Actions → General**: token de workflow com leitura padrão, ações de fornecedores confiáveis, execução em PRs de fork com privilégios seguros, segredos protegidos e política de aprovação.
- Revisar regras da main, mantendo PR, resolução de comentários e o check exato. Após o primeiro CodeQL verde, considerar torná-lo obrigatório no ruleset, sem introduzir bloqueio permanente.
- Habilitar proteção de environment em produção se disponível e compatível com o operador, para separar uma aprovação de release do merge técnico; conferir o workflow de deploy antes de mudar regras.
- Exigir 2FA/passkey no **perfil do mantenedor** e revisar tokens de escopo limitado, instalações de GitHub Apps, deploy keys e credenciais expiradas (ação pessoal e administrativa).

**Não alterar regras para exigir uma aprovação de outro usuário quando o projeto não tem revisor disponível.** O controle compensatório é CI obrigatória, histórico, evidências e revisão independente quando houver.

## Evidências para concluir

1. URL e screenshot sanitizado do ruleset aplicável com status active.
2. SHA HEAD, URLs do Quality gates e CodeQL com **conclusion=success** (não apenas queued/in_progress).
3. URL da aba Security mostrando Dependabot, code scanning, scanning de secrets e Private vulnerability reporting conforme disponíveis.
4. Um PR seguro de teste confirmando bloqueio dos checks exigidos (sem segredos reais, sem force-push e sem afetar produção).
5. Procedimento de release aprovado e canário do domínio confirmando o SHA implantado.
6. Revisão de RLS, OAuth, Stripe sandbox, multiplayer, headers, WAF e restore em seus próprios ambientes, com evidências separadas.

**Regra de decisão:** não declarar proteção completa nem permitir publicação apenas porque os arquivos foram adicionados. Verificação deve relacionar configuração administrativa, execução e resultado real.
