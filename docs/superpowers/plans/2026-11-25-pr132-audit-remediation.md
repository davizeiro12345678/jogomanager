# PR #132 — checkpoint de auditoria e implementação, 25/11/2026

## Evidência e escopo

Baseline auditada: `8072393507a34eec7c9a8ae201909daf0543e894`.
Produção: `d84657717bd45d72d97e4c336a9f5f98ae2161ab` comprovada por `/api/health` (HTTP 200, ready; auth, serverCredentials e database verdadeiros). Não houve merge ou deploy.

| Item | Estado | Evidência |
| --- | --- | --- |
| Health: redirecionamentos com apikey | Implementado, teste focado aprovado | 9e489be, 7808e48; três servidores HTTP de fixture red/green: 0/3 → 3/3; sem credenciais reais |
| Vite: allowedHosts irrestrito | Implementado, teste focado aprovado | f94d551, 2c5ecd3, 70d1ba7; 4 testes locais aprovados; CI e preview reais pendentes |
| CodSpeed na baseline auditada | Gate pareado aprovado | run 45692951441, job 139482893051: 16/16, encodeReplay +0,41% abaixo do limiar existente de 3%; não certifica o novo head |
| Lighthouse mobile | Bloqueador aberto | run 45692953244: / e /guias 96/100; /guias LCP 2643,6636 ms; limites preservados |
| Health /melhores-formacoes | Intermitência ainda não explicada | uma resposta 503 em navegação mobile anterior; três sondagens HTTP posteriores 200 |
| /new | Carregamento confirmado na produção | Chrome 390x844, após 7 s mostrou Novo treinador; não certifica criação de carreira |
| Partida rápida | Parcial | Sorteio acionado no Chrome; clique JOGAR não concluído no limite do teste; partida não homologada |
| VPS | Diagnóstico parcial | UFW ativo deny incoming/routed; zero unidades failed na amostra; pressão CPU e swap a investigar; não alterados serviços |

## Política de preview Vite

Definir `PFM_DEV_ALLOWED_HOSTS` como lista separada por vírgula de hostnames exatos autorizados antes de iniciar Vite. Exemplo fictício: `PFM_DEV_ALLOWED_HOSTS=preview.example.test npm run dev`. Sem essa configuração, hosts de preview externos não são automaticamente autorizados. Não permitir wildcards nem sufixos compartilhados. Vite ainda aplica sua política padrão para localhost e IPs; limitar a exposição de rede por firewall e túnel. Homologar o preview efetivo antes de publicar.

## Próximos gates (não concluídos)

- [ ] Obter trace Lighthouse do novo SHA, identificar elemento LCP e gargalo de / e /guias, corrigir e preservar os limites.
- [ ] Reproduzir 503 com correlação de request/Worker e verificar a correção em staging.
- [ ] Homologar preview Vite com host autorizado e host rejeitado; CI completo, lint, tipos, build e CodSpeed pareado.
- [ ] QA autenticada: passkeys, OAuth, MFA, Stripe sandbox, carreiras, todos os controles do dashboard.
- [ ] Partida rápida: reproduzir estado após sorteio e início, arbitragem, cutscenes, texturas, física e IA; evidência antes/depois.
- [ ] Multiplayer real 1x1 e 2x2, backup/restauração isolada e auditoria defensiva VPS.
- [ ] Revisão independente e merge somente após todos os gates críticos.

## Regras obrigatórias de qualidade

1. Conferir SHA, contexto, planos e pendências antes de editar.
2. Nunca afirmar conclusão sem evidência.
3. TDD: reproduzir, corrigir e testar regressão.
4. CodSpeed comparável; não afrouxar limites.
5. QA interativa e evidências visuais reais.
6. Responsividade e WCAG 2.2 AA.
7. SSR, hidratação, Vite e separação client/server.
8. Segurança em todas as camadas; testes ativos somente em ambiente autorizado.
9. VPS: hardening, logs, recursos e recuperação sem desativar proteções.
10. Auth e pagamentos em fluxos reais de staging/sandbox.
11. Lighthouse mobile >=97, LCP <=2500 ms e gates existentes preservados.
12. Match 3D: qualidade gráfica, física e benchmark em hardware homologado.
13. Determinismo, autoridade, checkpoints e multiplayer real.
14. Merge/deploy apenas com gates exatos, revisão e rollback.
15. Atualizar ledger, commits, métricas, riscos e bloqueadores sem mascarar falhas.
