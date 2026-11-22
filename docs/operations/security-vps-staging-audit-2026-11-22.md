# Auditoria operacional de segurança — 22/11/2026 (UTC)

> Estado baseado em comandos reais no VPS `jm-fra-01`, Supabase security advisors e leitura dos workflows. Não equivale a certificação de ausência de vulnerabilidades. Os artefatos brutos permanecem no VPS, fora do GitHub, por conterem potenciais metadados sensíveis.

## Isolamento e prontidão

- A rota pública `https://staging.jogomanager.com/` respondeu 200, **mas hospeda somente um Worker sintético**, não a aplicação do jogo. Não direcionar active scans de todas as funções contra essa simulação nem afirmar homologação.
- O contêiner `jm-real-game-stage-local` atende a página inicial localmente, conecta-se à rede Docker `jm-stage-supabase_default`, porém seu endpoint `/api/health` respondeu **503** (auth, credenciais do servidor e banco indicados como indisponíveis).
- A stack Supabase self-hosted de staging utiliza Docker e URL próprios; a branch Supabase hospedada `staging-release-132` também existe, mas o painel indica `MIGRATIONS_FAILED`. Não confundir os dois ambientes.
- A instância local não tinha variáveis `STRIPE_SECRET_KEY` ou `STRIPE_WEBHOOK_SECRET` e não demonstrou backend multiplayer separado. **Não foram processadas compras Stripe, transações ou jogadores reais.**
- `/checkout` e `/api/auth/login` retornaram 404 na instância local; `/multiplayer` retornou 200 (HTML apenas, sem prova de partida).
- Produção não foi submetida a ataques ativos e não foi alterada.

## Scanners executados

| Ferramenta | Resultado real | Evidência privada |
|---|---|---|
| Trivy 0.76.2 | Completo nos alvos reconhecidos: zero vulnerabilidades reportadas nos lockfiles Bun/npm/Cargo examinados; três alertas de Dockerfile (root e HEALTHCHECK); dependências de desenvolvimento suprimidas por padrão. | `/opt/jm-security/fullscan-20261122/trivy/jogomanager.json` |
| Semgrep CE 1.186.0 | 9 findings (2 ERROR, 1 MEDIUM, 6 WARNING), 7 erros de análise: workflows GitHub Actions, HTTP em ferramentas de QA, política Bun. | `/opt/jm-security/fullscan-20261122/semgrep/jogomanager.json` |
| Nuclei | Sete matches de templates de cabeçalhos/CSP e robots.txt, classificados como informativos, contra a aplicação local; não representam sete explorações comprovadas. | `/opt/jm-security/fullscan-20261122/nuclei/stage.jsonl` |
| Wapiti 3.3.3 | 151 páginas rastreadas na instância local; uma categoria de CSP reportada nos módulos executados. | `/opt/jm-security/fullscan-20261122/wapiti/stage.json` |
| OWASP ZAP Full Scan | **Não concluído** contra a aplicação real local: primeira tentativa falhou por limite de threads da JVM; repetição excedeu janela de execução sem relatório íntegro. Contêiner remanescente encerrado. | `/opt/jm-security/fullscan-20261122/zap-real-local/` e `zap-real-retry/` |
| Aikido VM/Cloud | **Não executado** nesta auditoria: instaladores/configurações encontrados, mas autorização ativa e elegibilidade não comprovadas. Não presumir scan completo. | Runbook `docs/security-aikido-codex-zap-load-runbook-2026-11-21.md` |
| Lynis (VPS) | **Incompleto**: check Debian `DEB-0001` excedeu timeout; tentativa de skip rejeitou sintaxe. | `/opt/jm-security/fullscan-20261122/lynis.txt` |

## Correções no código e controles

1. PR #132: endurecimento do workflow `cloudflare-production.yml` para aceitar somente eventos de sucesso do próprio repositório na `main`, fazer checkout de `main` e rejeitar SHA divergente antes de carregar credenciais. Teste Node 24: 3/3 passou.
2. PR #132: `bunfig.toml` ampliado de 24 horas para **sete dias** (`minimumReleaseAge = 604800`) como política de defesa contra novas publicações de pacotes; exceções existentes foram mantidas, não automaticamente consideradas seguras.
3. PR #132: suíte atual de contratos estáticos: **4 passam, 3 pulados** porque os três workflows DAST vivem em uma branch/main diferente do head do PR.
4. PR #151 (draft): troca dos cinco usos `actions/checkout@v4` e `actions/upload-artifact@v4` por commits imutáveis em três workflows DAST e carga de staging; **3/3 testes locais passaram**. Ainda não integrado à `main`.

## Supabase security advisors

- Produção: 37 avisos informativos `rls_enabled_no_policy` (maioria de schemas privados), 26 de visibilidade GraphQL para `anon`, 48 para `authenticated` e uma função `SECURITY DEFINER` acessível ao papel autenticado.
- `public.mutate_player_career` foi inspecionada: usa `auth.uid()`, comparação de `user_id`, validação de slot/revisão e checagem de MFA. **A mera existência desse advisor não prova BOLA**. Não revogar indiscriminadamente permissões de recursos públicos ou quebrar saves.
- Necessário revisar cada tabela e view segundo contrato de autorização e executar testes negativos em staging antes de DDL em produção.

## Condições obrigatórias para concluir o pedido

1. Restaurar `/api/health` para 200 com *checks* reais de Supabase/Auth e validar RLS multiusuário, sem apontar para o projeto de produção.
2. Injetar somente segredos Stripe **test** com gerenciador seguro; comprovar checkout, verificação criptográfica do webhook e concessão idempotente.
3. Isolar transporte/motor autoritativo multiplayer de staging e homologar duas e quatro sessões com reconexão e dados sintéticos.
4. Publicar a aplicação real em rota staging sem alterar produção; comprovar cabeçalhos e identificadores do ambiente real, não só declarações.
5. Reexecutar ZAP Full Active autenticado com recursos adequados e limites de carga, mais Nuclei/Wapiti/Trivy/Semgrep e Aikido quando credenciado. Registrar falsos positivos e evidências de exploração/negação.
6. Rodar suíte completa, comparativos antes/depois, CI no SHA final, revisão independente e manter rollback.

**Conclusão:** os artefatos observados não sustentam a afirmação de que todas as vulnerabilidades foram corrigidas ou que o ambiente real foi homologado. Não realizar merge nem deploy de produção sem os gates acima.
