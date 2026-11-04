# Integração verificada do PR #119 | 04/11/2026

## Objetivo e regra de aceite
Consolidar o CSS crítico, as verificações de segurança e a preparação operacional em **um novo PR sem implantação automática**. A única exceção temporária permitida nesta branch é a pontuação de performance, LCP ou TBT do **Lighthouse mobile**. Os relatórios continuam sendo executados e disponibilizados. Acessibilidade, CLS, ausência de resultados e execução incompleta continuam bloqueantes. A exceção se aplica **somente** à branch `integration/pr119-verified-20261104`. Remover assim que os limites forem atingidos.

## Verificação de implementação preexistente, sem duplicação
| Origem | Decisão | Observação |
|---|---|---|
| #119 | Integrado via base da branch | Seleção SSR pública/jogo preservada; CSS base <12 KiB, prefetch acionado por intenção; Semgrep SAST, ZAP passivo manual, auditoria Supabase read-only, scripts de pré-voo SSH e contratos. |
| #116 | Integrado | Workflow Snyk manual, sem token/ataque externo automático. |
| #122 | Integrado | Scripts de benchmark e inventário VPS não destrutivos, documentação de rollout, verificação CI. Nenhum benchmark real nem alteração SSH na VPS foi executado. |
| #121 | **Não duplicar** | A comparação de árvores Git indicou o mesmo conteúdo do HEAD após integrar `main` (#118 já atualizou as dependências). |
| #117 e #120 | Adiados | Integração cruzada sobrepõe CSS, `quality.yml`, `quick-match-entry.ts`, testes de segurança e pagamentos; conflitos concretos. Precisam de resolução sem sobrescrever #119 e testes end-to-end. |
| #110, #111 e #113 | Adiados | Houve conflitos de código, lockfile, renderização e SEO na simulação de merge, incompatíveis com integração automática segura. |
| Outros PRs antigos/draft | Não incluídos automaticamente | Sem comprovação conjunta de CI atual, compatibilidade, dependências e ausência de alterações de produção. |

## Ajustes executados neste pacote
- Atualização da base para o `main` atual, preservando os commits de #119.
- Remoção do hash fixo e obsoleto do benchmark de inicialização 3D; baseline agora usa SHA da base da própria PR.
- Baseline e candidato instalam suas dependências a partir de **seus próprios lockfiles**; evita o antigo falso negativo `htmlparser2/entities/decode` causado por `node_modules` compartilhado.
- Exceção temporária de Lighthouse mobile **apenas** na nova PR, com validadores locais de 15 resultados, 3 por rota e 5 rotas, acessibilidade >=0,90 e CLS <=0,10.
- Testes de contrato da exceção com cenários permitidos e cenários bloqueantes.
- Manteve SAST Semgrep, auditoria de dependências, lint, TypeScript, testes determinísticos, builds, bundles, replay RLS/Supabase e verificações gráficas como requisitos obrigatórios.

## Estado do plano original
**Já existe:** roteamento CSS no SSR por tipo de rota; CSS base crítico; prefetch sob intenção; CI Semgrep e ZAP passivo manual; scripts de RLS em banco descartável, inventário de permissões, scripts de preparação SSH FIDO2; checagem de cache privado e headers.

**Ainda não comprovado:** eliminar a folha pública render-blocking sem FOUC, medições comparativas móveis reais, CSP estrita com nonce, testes Stripe TEST contra destino isolado, testes RLS A/B em staging remoto, revisão/rotação de quaisquer segredos dos arquivos .env rastreados, recuperação VNC e tokens FIDO2 físicos, benchmark real nas duas VPS, ativação de canário/rollback e verificação pós-deploy.

A implementação de CSS assíncrono sem teste visual pode causar tela sem estilo e **não deve ser confundida com o prefetch já implementado**. Os testes agressivos continuam restritos a ambiente de staging com contas fictícias.

## Liberação
- Este PR não altera Supabase produção, Cloudflare DNS, SSH de VPS nem Stripe real.
- Lighthouse mobile conserva evidência, sem transformar regressão em alegação de ganho de performance.
- Não fazer merge se qualquer outro gate falhar; não desligar a política de segurança ou a detecção de credenciais para forçar CI verde.
- Revisar os alertas de exposição nos arquivos .env versionados, sem registrar valores em logs ou neste documento.
