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


## Checkpoint de continuidade — 25/11/2026 (HEAD atualizado)

### Identidade do PR e política de liberação
- PR #132 permanece aberto em **Draft**; não fazer merge nem deploy de produção.
- HEAD observado nesta continuação: `ac2dd4065e93e48952bf2dbb4968b78ed28d3705`. A branch pode avançar durante a auditoria; sempre revalidar o SHA antes de fechar qualquer gate.
- Comparação com `main`: aproximadamente 890 commits à frente, 0 atrás; o PR lista 1.154 arquivos alterados. A API de comparação limita a amostra de arquivos; usar o inventário completo do workflow, não declarar revisão humana integral.
- O checkout antigo `/home/jmadmin/jm-pr132-audit-20261122` contém alterações locais não commitadas e não deve ser sobrescrito.

### CI / evidência do HEAD mais recente
- CodeQL: PASS.
- NPM audit de produção: PASS.
- 43 suítes de aceitação: PASS.
- 9-axis browser QA: PASS.
- Inventário automatizado de diff/riscos: PASS; isso não equivale a aprovação humana dos 1.154 arquivos.
- CodSpeed paired-walltime: **FAIL no HEAD atual**. O PASS 16/16 observado no HEAD anterior `cd919599` não pode ser transferido para o HEAD novo. Diagnosticar a regressão no run atual e repetir ABBA após correção.
- Gate agregado: ainda não liberado. Lighthouse Mobile, evidência visual e diagnóstico de startup precisam concluir no HEAD exato, sem cancelamento.
- O resultado Lighthouse completo anterior no HEAD `8072393` reprovou em performance (96/100) e LCP (2.643,66 ms em uma amostra). Não usar esse resultado como medição do HEAD atual; ele é evidência histórica de risco que exige nova campanha.
- O workflow 9-axis em preview anônimo registrou limitações de ambiente: Supabase ausente em parte do preview, chamadas de autenticação/assets retornando 503 nesse contexto e o painel de moderação exigindo sessão. Não injetar chaves de produção para “fazer passar”; repetir em staging isolado com credenciais de teste.

### VPS — mega auditoria inicial
- UFW ativo; política de entrada padrão deny e políticas base de entrada DROP. Nginx atende loopback; serviços administrativos e painéis permanecem em loopback/Tailscale.
- SSH: root login desabilitado, password/kbd-interactive desabilitados, autenticação por chave, forwarding desabilitado; chaves de usuários observadas são Ed25519. A configuração ainda declara `RequiredRSASize 1024`; avaliar elevar para 2048 após confirmar CA/host keys e executar teste de reconexão.
- Tailscale está Running; 1 de 3 peers online, sem rotas anunciadas.
- Docker socket: root:docker, modo 0660; grupo docker sem membros. `jmadmin` não pertence ao grupo docker nem video.
- 33 containers observados, com redes internas separadas; Elasticsearch/Kibana/Wazuh/Prometheus publicados em loopback. Tracee usa host PID e capacidades eBPF amplas, mas rede none e rootfs read-only; manter como componente privilegiado de monitoramento e revisar redução de capabilities em separado.
- `jm-coraza-crs` usa host network, mas listener observado é loopback; revisar sandbox/read-only rootfs sem interromper o WAF.
- `sentinelx` tem regra efetiva `NOPASSWD: ALL` em `/etc/sudoers.d/99-sentinelx-admin`. O serviço foi projetado para operações root-equivalent; a remoção imediata pode desativar recursos administrativos. **Bloqueio crítico: exigir decisão operacional e plano de substituição por broker/allowlist antes de retirar a permissão.** A regra restrita de health-check existe separadamente.
- `jmremote-desktop-commander.service` executa como root e possui sandbox de filesystem limitado; não alterar sem matriz de operações necessárias e teste de recuperação.
- Fail2ban e ClamAV estão ativos, mas há registros históricos de falhas de namespace/startup. ClamAV 1.5.4 e base de assinaturas 28194 atualizada em 25/11/2026 06:26 UTC. Revalidar estado atual e executar benchmark EICAR controlado, sem escanear/quarentenar arquivos de produção.
- Certificado local `jm-local-san-20261119.crt` é self-signed para o origin local; certificado público de `jogomanager.com` é válido até 19/02/2027 e TLS 1.3 foi observado.
- O container local de staging responde 200/ready, mas seu release commit é `fb07df1`, anterior ao HEAD do PR. Não usar esse staging como validação do HEAD atual. Criar checkout limpo e build isolado fixado no SHA atual; preservar o checkout antigo com alterações locais.
- A conta `jadmin` está bloqueada e sem authorized_keys observadas; antes de removê-la, verificar autenticação por certificado SSH via `TrustedUserCAKeys` e arquivo de principals.

### Aplicação / API — verificações públicas sem credenciais
- `GET /api/health`: HTTP 200; resposta no-store e cabeçalhos de segurança observados.
- `GET /api/public/football-assets`: HTTP 200; payload de aproximadamente 2,23 MB. Conteúdo público, mas tamanho e política de cache devem ser otimizados/confirmados.
- `POST /api/public/sync-football` sem segredo: HTTP 401, fail-closed.
- `POST /api/internal/support-dispatch` e `/api/internal/email-automations/dispatch`: HTTP 404 na produção atual; os handlers do branch usam autenticação cron, mas ainda não estão presentes no domínio público observado.
- `GET /api/stripe/webhook`: resposta de contrato/liveness; POST sem parâmetro de ambiente retorna 400 “Webhook environment mismatch”, sem executar fulfillment.
- CSP atual ainda mantém `unsafe-inline` e `unsafe-eval` na política efetiva legada; a política estrita com nonce está em report-only/opt-in. Tratar migração de CSP como gate de staging com OAuth, Stripe, analytics e 3D.

### Chrome virtual graphics QA — configurado no VPS
- Chrome Stable 158.0.8127.88; perfil isolado em `/home/jmadmin/jm-chrome-qa-20261121/chrome-virtual-gpu/`.
- ANGLE + SwiftShader: WebGL 2, shader compile/link e 240 draw calls aprovados; WebGPU adapter/device/compute pipeline executou 16 resultados determinísticos corretos.
- Wrapper não usa `--no-sandbox`; CDP fica desligado por padrão e, quando habilitado, bind em 127.0.0.1.
- **Limite explícito:** SwiftShader é renderização por software em CPU, não GPU física/passthrough. Não certifica 60 FPS, latência ou comportamento térmico. A certificação física em dispositivos permanece pendente.
- Smoke script e screenshots/resultados ficam no diretório privado de QA do VPS.

### Sequência de trabalho adicionada — ainda pendente
1. Reexecutar CodSpeed no HEAD atual; identificar benchmark, mediana e caudas que falharam; corrigir somente regressão comprovada e repetir ABBA.
2. Concluir Lighthouse Mobile, evidência visual e startup CPU no mesmo SHA, sem cancelamento; preservar todos os relatórios.
3. Criar checkout limpo no VPS do SHA exato do PR e build local isolado; testar desktop/mobile, formulários, estados de erro e rotas.
4. Repetir auditoria de API/authz/data leakage em staging com contas sintéticas; não usar dados reais nem chaves de produção.
5. Mega hardening do VPS: sudoers SentinelX, sandbox systemd, Tracee capabilities, containers rootfs/read-only mounts, Fail2ban/ClamAV logs, SSH CA/principals, TLS origin, firewall/nftables e ACLs. Cada alteração requer backup, dry-run, teste de saúde e rollback.
6. Benchmark de detecção: EICAR controlado, ClamAV principal, engine URLhaus isolado, Maldet, Wazuh/Elastic/Tracee; medir detecção, falso positivo, latência, CPU/RAM e logs. Revisar cabeçalho/assinatura ELF com fixtures benignas e malformadas, sem executar amostras.
7. Avaliar modelo local Qwen e alternativas recentes por benchmark de qualidade/latência/memória; manter o modelo atual até existir comparação reproduzível.
8. Evolução arquitetural da engine determinística e stack gráfica conforme os novos itens do plano Match3D; não mudar autoridade, ordem de RNG, contratos de replay ou regras reservadas sem testes de paridade.

### Critério de encerramento
Nenhum item acima passa por inferência. Cada tarefa só muda para concluída com SHA, comando, resultado, artefato e regressão correspondente. Bloqueios de credenciais, dispositivos físicos, sandbox, CodSpeed ou staging permanecem explicitamente pendentes.
