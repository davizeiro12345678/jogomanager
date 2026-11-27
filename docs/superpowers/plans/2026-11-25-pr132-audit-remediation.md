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

## Checkpoint comprovado — 26/11/2026 (PRs #132 e #179)

Este checkpoint substitui estados operacionais antigos, sem apagar o histórico. Não criar outro PR: #132 é a integração para main e #179 é a correção da auditoria destinada à integração. Ambos continuam Draft. Sem merge em main ou deploy.

### Evidências fechadas e critérios restantes

- [x] Confirmar produção: `/api/health` respondeu HTTP 200/ready com release `d84657717bd45d72d97e4c336a9f5f98ae2161ab`. Não certifica o candidato nem resolve a intermitência histórica de 503.
- [x] Validar a política Vite em processo real, no checkout isolado de `a54090bee9fdde44aacd5c7966036ef869b16a66`, bind loopback e sem credenciais de produção: host autorizado 200, host não autorizado 403, localhost 200 (Gateway job `job_01M8C1WQ5400QT7R0K26HWGEAT`, exit 0). Preview externo autenticado ainda pendente.
- [x] CI do SHA acima: npm ci, lint, tipos, Vitest, build, bundle absoluto/comparativo, replay SQL, Rust/WASM, duas suítes de stress de 200 partidas, contrato gráfico e MatchSim passaram no [Quality Gates 45830854917](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830854917). Lighthouse mobile e gate agregado ainda não concluídos no momento da observação.
- [x] CodeQL [45830854794](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830854794), 43 suítes [45830854544](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830854544), nove eixos [45830854594](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830854594), inventário independente automatizado [45830854781](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830854781) e CodSpeed [45830854573](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830854573) passaram nesse SHA. Não equivale a revisão humana independente nem QA autenticado.
- [x] PR #179: remoção de skip link duplicado no GameShell, foco no conteúdo da carreira e disponibilidade 1x1/2x2 comunicada honestamente (`01fea245`); i18n em pt/en/es (`515e3c3`); comparador por grafo de imports, sem alterar orçamento de 2048 B (`eef1a388`). 35/35 testes locais de gates; [comparação real 45830207865](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830207865) passou no job bundle. O PR #179 ainda reprovou Lighthouse (home 0,92; TBT 320 ms) e CodSpeed [45830207885](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830207885). Não está liberado para integrar.
- [x] VPS: oito patches originais instalados (Kerberos, libpcap, libtiff, runsc); gerenciador de patches ativo, reboot automático desligado; curadoria LMD corrigida com testes e hash da base preservado; On-Access 64→128 MiB no diretório de ingestão; SSH sem senha/root, serviços críticos ativos, zero unidades failed nas amostras. EICAR do daemon aprovado, prevenção acima de 64 MiB ainda não provada.
- [x] Backup local: 5/5 checksums, 1.034 entradas de configuração, restauração isolada do dump JogoManager com duas tabelas, instância encerrada e cópia temporária removida. Timer externo habilitado; nenhum upload confirmado.
- [ ] Backup externo: OAuth do Google Drive e verificação da recuperação criptográfica ausentes; manter gate, não fabricar marcador. Wazuh 4.14.11 pendente de backup restaurável do Indexer e upgrade coordenado dos três serviços centrais antes do agente.
- [ ] Autenticação real (OAuth/passkey/MFA/recuperação), Stripe sandbox/webhook/idempotência, persistência de carreiras, multiplayer 1x1 e 2x2 com dispositivos/assentos reais; staging isolado no SHA exato.
- [ ] UI: CLS auth observado 0,876 e loja 0,162 na produção em Chrome mobile; investigar causa e repetir medidas comparáveis; Lovable removido no código, não confirmado em produção.
- [ ] Match 3D: erro GL_INVALID_VALUE observado duas vezes em campanha anterior e não reproduzido na repetição; GPU stall persiste; simulação completa, benchmark físico, materiais/anatomia, animação, clipping, cutscenes, física e IA precisam de evidência comparável. SwiftShader não certifica FPS físico.
- [ ] Fechar Lighthouse, CodSpeed e QA visual no novo HEAD, revisar threads/alertas restantes (incluindo #47 mencionado anteriormente), validar CSP estrita, backup externo, rollback e revisão independente; só então considerar aprovação. Nenhuma alteração de limites, bypass ou deploy.

**Continuidade:** atualizar estes três arquivos existentes e a descrição dos PRs com evidência, sem marcar tarefas compostas como concluídas apenas por subtarefas. Não incluir IPs, caminhos pessoais, credenciais ou localização de usuário em evidência pública. Qualquer commit de documentação gera um novo SHA; revalidar os gates no novo head.

## Checkpoint P0/P1 — 26/11/2026, 11h06 BRT

- [x] PR #132, SHA `ac28fd521e8224dddc33dc7c9f7765f2a9288ebc`: Quality Gates [45833183094](https://github.com/davizeiro12345678/jogomanager/actions/runs/45833183094), CodSpeed [45833183163](https://github.com/davizeiro12345678/jogomanager/actions/runs/45833183163), CodeQL, 43 suítes e nove eixos aprovados nesse SHA.
- [x] PR #179, SHA `3872f4cdf71d06a0f6d2ece3c56a34f185195fde`: build, types, testes, bundle e stress aprovados. CodSpeed [45833354299](https://github.com/davizeiro12345678/jogomanager/actions/runs/45833354299) inicialmente reprovou decodeReplay +15,47%; reteste no mesmo gate aprovado, 5,3276685 → 4,43962125 ms (−16,67%); fonte do codec idêntica ao #132 antes da nova correção. Preservar as duas amostras, sem alegar ganho causal.
- [x] P0: contagem incremental de bytes UTF-8 de replay, sem materializar histórico inteiro na estimativa. RED reproduziu buffer monolítico; GREEN confirmou igualdade de bytes com Unicode. No VPS, 23.280 frames e V2/V3 exatamente 187.119.120/176.761.024 bytes; teste integral 37,280 s (timeout original 30 s) → 21,420 s (aprovado). São duas amostras sob carga variável, não benchmark certificado. 94/94 testes em 12 arquivos, TypeScript e diff check aprovados. Gateway job `job_01M8C2SWQ700HE6N53V2TSVGAA`. Novo SHA requer CI próprio.
- [x] Contratos locais: OAuth/recuperação 30/30; passkeys 9/9; política/transporte 24/24; Stripe/webhook 13/13; multiplayer 7/7, incluindo quatro assentos sintéticos e reconexão. Não equivalem a validação autenticada de produção.
- [ ] Lighthouse #179: home 0,96, TBT 210,76 ms; outras duas amostras 1,00. Reteste solicitado, sem alterar metas. Evidência visual 3D dos dois PRs ainda em execução na coleta.
- [ ] Staging: verificada stack Supabase local em rede própria, restrita ao loopback; teste autenticado bloqueado pela ferramenta. Não contornar o bloqueio nem usar produção. OAuth real, MFA, passkeys físicas, persistência RLS, checkout sandbox e webhook ponta a ponta continuam pendentes.
- [ ] Backup externo: timer ativo, configuração OAuth e confirmação de recuperação ausentes; sem upload comprovado. Wazuh 4.14.11 depende de backup restaurável do Indexer. VPS com zero serviços failed; ClamAV preventivo ativo com 128 MiB; scanner de dez horas ainda em execução, não interrompido.
- [ ] Materiais/anatomia/animação/estádio, GPU stall, FPS/temperatura física, física/IA, CSP estrita, revisão independente, merge/deploy: não certificados. Nenhum novo PR e nenhuma mudança de produção.

## Continuação P0/P1 — 26/11/2026

- [x] Conferir resultados históricos do HEAD ac28fd52 (#132): 14 workflows concluídos com sucesso, incluindo [Quality gates](https://github.com/davizeiro12345678/jogomanager/actions/runs/45833183094), [CodSpeed](https://github.com/davizeiro12345678/jogomanager/actions/runs/45833183163), CodeQL e evidência visual. Não transferir aprovação ao próximo SHA.
- [x] Conferir HEAD a3a85002 (#179): [Quality gates](https://github.com/davizeiro12345678/jogomanager/actions/runs/45835885174) e [evidência visual](https://github.com/davizeiro12345678/jogomanager/actions/runs/45835885003) aprovados. [CodSpeed pareado](https://github.com/davizeiro12345678/jogomanager/actions/runs/45835884910) reprovado em cinco benchmarks (buildTeamSetup +18,30%, snapshotMatch +7,73%, decodeReplay +24,29%, Rust/WASM 64 +68,46%, Rust/WASM 16 +33,46%). Sem alteração de limiares. A diferença de código em relação à base inclui a estimativa de bytes de replay, mas não a implementação dos cinco kernels; causalidade ainda não demonstrada.
- [x] Corrigir três regressões do handshake WSS: ticket expirado antes do open, ready recebido após expiração e open duplicado. RED 3/3; GREEN 63/63 em cinco suítes (cliente, feed, protocolo, bridge e latência), ESLint focal, Prettier e diff check aprovados. A sessão deve renovar o ticket antes de aceitar estado oficial; não modificar autoridade de servidor.
- [ ] Reavaliar alerta CodeQL #47 e threads de revisão (11 abertas no #132 no momento da coleta). A correção acima fortalece o transporte, mas não comprova fechamento do alerta nem revisão independente.
- [ ] Homologação Supabase/Stripe: apenas projeto de produção acessível; não substituir staging independente por produção. Não foram executadas cobranças reais, migrações de produção ou testes com usuários reais.
- [ ] Backup externo: timer ativo, mas OAuth e confirmação criptográfica continuam ausentes. Sem upload comprovado; Wazuh 4.14.11 depende de backup restaurável do Indexer e upgrade coordenado.
- [ ] CodSpeed do #179, CI do próximo SHA, QA autenticado, desempenho em GPU física, materiais/animação e merge/deploy permanecem condicionados aos respectivos gates. Não criar outros PRs.

- [ ] Sincronização #179 com d2a6d4e: conflitos somente nos três planos, ambos os históricos preservados. Teste combinado local 77/78; prova integral do tamanho de replay calculou os bytes esperados, mas excedeu o limite original de 30 s (30.083 ms). Não mudar timeout; registrar falha, repetir em CI e investigar sob carga controlada. O PR permanece draft.


## Continuação P0/P1 — isolamento de evidências (26/11/2026)

- [x] Reproduzir e corrigir a leitura por links simbólicos no coletor graphics-source-snapshot: dois casos RED e três testes GREEN, incluindo caso normal. Restringir caminhos ao checkout, rejeitar symlinks e arquivos não regulares, usar descritor com O_NOFOLLOW e lista Git delimitada por NUL. Teste conectado ao CI cinematográfico. A corrida de troca concorrente de diretórios ancestrais por outro processo local não é certificada; executar em checkout isolado.
- [x] Conferir quatro workflows apontados por persistência de credenciais: cinematic-recovery, 43-acceptance, independent-diff-review e nine-axis já possuem persist-credentials: false no HEAD d2a6d4e. Nenhuma exceção do scanner adicionada.
- [ ] Fechamento dos alertas de scanners e revisão independente: revalidar no novo SHA; threads não resolvidas automaticamente. Alerta #47 não certificado.
- [ ] CodSpeed #179 bd77aadd: gate pareado 45841850637 reprovado em buildTeamSetup (+3,65%), decodeReplay (+17,26%) e fallback de rig 16 radial (+7,89%). Não alterar limiares nem imputar causa sem evidência. Bundle e shell Lighthouse passaram em ambos os PRs na coleta; Lighthouse mobile completo ainda em andamento.
- [ ] VPS: serviços críticos ativos, zero unidades failed, timer externo habilitado mas sem OAuth e comprovação criptográfica. Wazuh 4.14.11 aguarda backup restaurável. Gateway Free, saldo zero e contratação de backups restrita ao titular. Não publicar credenciais ou dados privados.
- [ ] Staging: apenas Supabase de produção listado; dois contextos Stripe de teste disponíveis, sem checkout real executado. Continuam pendentes autenticação, webhook, multiplayer real, GPU física e release. Não criar novos PRs, não publicar main.


## Continuação P0/P1 — inventário imutável de QA (26/11/2026)

- [x] No HEAD 46eee81e do #132, Quality Gates [45842832159](https://github.com/davizeiro12345678/jogomanager/actions/runs/45842832159), CodSpeed [45842832106](https://github.com/davizeiro12345678/jogomanager/actions/runs/45842832106), CodeQL, 43 suítes, nove eixos e diagnóstico de startup aprovados. Evidência visual ainda em execução na coleta; não transportar resultados para novo HEAD.
- [x] Remover leitura direta do checkout nos dois inventários do QA de nove eixos: apenas blobs regulares do SHA informado, com limite de bytes, sem seguir symlinks e sem ler conteúdo local alterado. RED módulo ausente, GREEN 4/4 incluindo dois testes existentes; sintaxe e diff check aprovados. Ensaio no histórico real: 576/576 fontes elegíveis lidas, zero omitidas. Adicionar testes ao CI existente. Revisão independente e confirmação do scanner ainda pendentes.
- [ ] PR #179 em b83a0d16: CodSpeed pareado [45843063830](https://github.com/davizeiro12345678/jogomanager/actions/runs/45843063830) reprovado em decodeReplay (+18,56%, 4,366291 para 5,176627 ms). Manter limites; não declarar regressão causal sem isolar a diferença de código e repetir em ambiente comparável.
- [ ] VPS: zero unidades failed, SSH efetivo RSA mínimo 2048, serviços essenciais ativos. Timer externo ativo mas OAuth e verificação criptográfica ausentes; sem transferência confirmada. Wazuh aguarda backup do Indexer. A varredura longa está executando; não interromper para alterar política de timeout.
- [ ] Gateway: plano Free e saldo zero confirmados; titular precisa contratar Pro/recarga no painel. Ops bundle incluído no Pro, não comprar redundância. Sem pagamento efetuado.
- [ ] Homologação autenticada, Stripe sandbox, multiplayer real, GPU física, revisão dos alertas, CSP efetiva e deploy continuam pendentes. Manter #132 e #179; nenhum novo PR nem alteração em main.

## Retomada da homologação de 26/11/2026

O [registro de progresso](./2026-11-11-jogomanager-release-integration.progress.md#homologação-retomada-em-26112026) reúne a campanha visual concluída, as medições de layout no Chrome, a correção da barra traseira do calção e a validação do transporte. O check nativo do CodeQL, o staging autenticado na revisão de entrega, a GPU física e a restauração externa continuam como critérios de publicação.


## Continuação P0/P1/P2 — integridade e diagnóstico das texturas (26/11/2026)

- [x] Reproduzir falha do QA de nove eixos do HEAD 7ec779c5: [run 45846818641](https://github.com/davizeiro12345678/jogomanager/actions/runs/45846818641), HTTP 403 ao baixar KTX2. Sondagem independente do VPS confirmou 302 do domínio principal para football-manager.app e 403 no destino; conector Cloudflare não lista essa zona. Não desativar WAF nem contornar controle de acesso.
- [x] Reforçar preparação de fixtures: validar OID Git, limitar manifesto a 64 KiB e textura a 16 MiB, identificar arquivo/host/status HTTP sem imprimir URL completa e remover temporário após falha. TDD isolado: 4/5 RED e 5/5 GREEN; teste conectado ao workflow existente. A primeira execução RED fez uma solicitação pública incidental; repetição corrigida usou mocks de rede.
- [ ] P0: restaurar entrega autorizada das texturas reais e executar nove eixos no SHA novo. Não substituir por imagens fictícias nem ignorar 403.
- [ ] P0: PR #179 6fa4bf09 [CodSpeed 45844733604](https://github.com/davizeiro12345678/jogomanager/actions/runs/45844733604) falhou em MatchSim (+8,96%); causa ainda não comprovada. Preservar limites e revisar novo SHA.
- [ ] P0/P1: staging autenticado, Stripe sandbox, backup externo restaurável, Wazuh coordenado, CodeQL nativo e GPU física seguem pendentes. P2: confirmar CLS, acessibilidade, textos e carregamentos em candidato publicado de homologação. Sem merge em main ou deploy.


## Continuação P0/P1 — homologação remota dos contratos SQL (26/11/2026)

- [x] Localizar branch Supabase staging-release-132, isolada e with_data=false. Consulta SQL funciona apesar do status histórico MIGRATIONS_FAILED e get_project retornar not found; não alterar ou usar produção.
- [x] Executar contratos do SHA b1619cd no preview remoto com BEGIN/ROLLBACK: atomic-match-room, cooperative-match-roster, authoritative-match-settlement, private-matchmaking-queue, match_contact_revision e room-authority-fencing. Todos passaram.
- [x] RED atomic-ranked-match-allocation: 42501 na tentativa de UPDATE direto em sala websocket; proteção correta. GREEN: fixture usa RPC de liquidação para schema 0077+, exige rejeição do UPDATE direto, preserva verificação antiga para 0075. O contrato corrigido passou no preview remoto. Sete contratos SQL aprovados.
- [x] Verificação após rollback: 0 auth.users, salas, queue, pairs, resultados, ratings e crons ativos; 78 tabelas públicas, todas com RLS. O fencing testa permissões temporárias apenas dentro da transação descartada.
- [ ] CI do novo SHA, replay legado 0075, testes autenticados em browser, clientes reais 1x1/2x2, passkey, Stripe sandbox, deploy e recuperação externa permanecem pendentes. O sucesso SQL não certifica esses fluxos.


## Continuação P1/P2 — integridade de medições (26/11/2026)

- [x] P1: comparador de campanhas rejeita renderizadores software conhecidos (SwiftShader, llvmpipe, WARP, entre outros) e modo headless/vídeo não explicitamente falso. Adiciona p50 e 0,1% low ao resumo sem alterar limiares. Não constitui atestação de hardware físico.
- [x] P2: TTFB quente exclui a primeira tentativa por posição cronológica, mesmo se a resposta inicial falhar; contadores de cabeçalhos usam mapas sem protótipo. Não altera endpoints nem volume de requisições.
- [x] RED reproduzido para ambos; GREEN 7/7 testes de campanhas, autoteste TTFB e sintaxe Node 24.22.1 aprovados em arquivos isolados no VPS. Primeira tentativa sem Node no PATH não é evidência de falha de código. CI completo ainda pendente.
- [ ] P0: QA de nove eixos do SHA 5f12d7dc reprovou na preparação de texturas reais (HTTP 403); não contornar WAF. Staging autenticado, Stripe, GPU física, backup externo, Wazuh, revisão e release permanecem condicionados aos gates existentes. Não abrir novo PR, não publicar main.
<!-- audit-verified-20261126-p0p1p2 -->
## Checkpoint auditável — 26/11/2026, após merge do #132

Este registro substitui estados operacionais antigos, sem apagá-los. As validações locais abaixo pertencem ao código corrigido; qualquer commit posterior requer novos checks no SHA exato.

- [x] PR #132 já mesclado na main: merge `c449875f20a1093a31929c114d8274a998eea42e`; referências anteriores a Draft são históricas. PR #179 continua aberto em Draft, sem merge e sem deploy deste conjunto.
- [x] PR #179: corrigida a localização do texto introdutório do multiplayer, do link de autenticação e do retorno ao dashboard, preservando os rótulos honestos 1x1 e 2x2 pendente em português, inglês e espanhol. Implementação inicial em `3ef7fb2ddcebd555711942e2a14b550efab36299`; formatação revisada nesta continuação.
- [x] Checkout de QA isolado no VPS, Node 24.22.1: cinco testes Vitest focados, seis testes Node de bundle, Prettier, ESLint e TypeScript sem erros. Nenhum limite de desempenho foi alterado. O Chrome 158 do VPS executou smoke test headless de um preview anterior; essa observação não certifica o novo HEAD.
- [~] Dezesseis operações de inspeção read-only solicitadas em paralelo no Gateway Pro: 11 aprovaram e cinco falharam por indisponibilidade do executor ou resultado inválido. UFW ativo com entrada deny, zero unidades systemd failed, 33 containers observados, 334 GB disponíveis no filesystem raiz, wazuh-agent retido. Falhas de inspeção não são prova de falha do host.
- [~] Stripe sandbox: 15 produtos ativos e dois endpoints de webhook habilitados, ambos encaminhados a serviços Lovable; integração ponta a ponta com fulfillment/idempotência não certificada. Supabase disponibiliza somente o projeto de produção neste conector.
- [ ] P0: confirmar CI completo, Lighthouse e CodSpeed comparáveis do SHA final; validar checkout/webhook/idempotência, autenticação real, persistência autenticada, backup externo restaurável e rollback em ambiente isolado antes da liberação.
- [ ] P1: validar multiplayer 1x1 e 2x2 com usuários/dispositivos reais, hardening VPS/Wazuh condicionado ao backup, CSP efetiva, CodeQL pendente e gráficos/performance em GPU física.
- [ ] P2: verificar a correção internacionalizada em preview publicado no SHA final e em dispositivos móveis. Não transferir testes visuais do preview anterior.
- [ ] Não efetuar deploy, merge do #179, force-push, cobrança real, migração em produção nem marcar gates como aprovados sem evidências correspondentes.
<!-- /audit-verified-20261126-p0p1p2 -->

<!-- auth-preview-missing-config-20261126 -->
### Continuação da autenticação do preview — 26/11/2026

- [x] **Diagnóstico reproduzido no SHA 7b37970c:** /auth do preview respondeu HTTP 200, mas a interface exibiu o ErrorComponent de raiz. O Chrome CDP capturou: `Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY`; /api/health do mesmo preview retornou HTTP 503 com `failureStage=missing_configuration` e verificações auth/serverCredentials/database falsas. A produção, isoladamente, respondeu HTTP 200/ready. Não confundir compilação Vite e bindings do Worker.
- [x] **Correção de degradação segura no PR #179:** /auth não monta o formulário quando `getConfiguredSupabaseClient()` não encontra configuração; mostra indisponibilidade e navegação pública, sem abrir sessão nem recorrer a credenciais de produção. Teste RED: 1 falha esperada/6 aprovações; GREEN: 7/7, Prettier, ESLint e TypeScript aprovados no checkout isolado. Não é conserto do login real.
- [ ] **P0 homologação:** configurar um projeto Supabase de staging isolado com URL e chave publicável durante o build do Vite, mais os bindings privados apropriados do Worker; executar smoke test com identidades de teste, OAuth/passkey/MFA, saúde da API e fallback seguro. Apenas um projeto Supabase de produção aparece no conector; nenhum segredo foi copiado para staging.
- [ ] **Gates finais:** CI, CodSpeed pareado, Lighthouse, QA visual no novo commit e 1×1/2×2 real permanecem bloqueadores do merge; sem mudanças de produção ou alteração de limiares.
<!-- /auth-preview-missing-config-20261126 -->

### Retomada após o merge do #132 — 26/11/2026

- [x] Revalidar o estado atual: #132 mesclado, produção `c2eec81a` saudável e #179 em rascunho. Usar `c2eec81a` como referência para a Home e os orçamentos.
- [x] Home: quatro modos na mesma linha em desktop, dois por linha em tablet e leitura vertical em mobile. Os links SSR já recebem grid e estilo sem aguardar hidratação. A prancheta 3D do jogo segue fora da Home; a prévia de formação tem seu próprio chunk e CSS.
- [x] VPS: o relatório de 1.194.726 arquivos apontou saída 124 nos dois processos ClamAV de streaming e no Maldet. O Maldet chegou a 90%. No VPS, o limite dos processos ClamAV de streaming passou a 12h, o do Maldet a 11h e o do serviço a 33h. Validação de sintaxe, configuração efetiva, timer e daemon aprovadas. O scan integral permanece pendente.
- [ ] P0: restauração externa verificada, login hospedado, checkout/fulfillment e multiplayer autenticado. A base Supabase de homologação tem tabelas de salas e ledger de saves, mas o painel marca `MIGRATIONS_FAILED`.
- [ ] P1/P2: validar os gates no SHA enviado, medir FPS em GPU física e confirmar estado da varredura além de atualizar Wazuh com recuperação ensaiada.

### CSS e acessibilidade da carreira após a integração do #132 — 26/11/2026

- [x] O #132 já foi mesclado em `c449875f`. O candidato de CSS segue no #179, sincronizado com a `main` `3a74699b`.
- [x] Entrada SSR de estilos específica para criação, login e arquivo. Fontes Tailwind de artigos, tabelas e loja foram realocadas para as folhas que as usam. O arquivo de saves separou seu título do shell pesado do jogo.
- [x] Estilos do escritório e do HUD da partida são carregados com suas próprias telas. Validação inclui os caminhos irmãos `/carreira`, `/partida-rapida` e `/match` e preserva o comparador de bundles.
- [x] Ajustes de foco sob navegação fixa, retorno do menu, contraste, texto ampliado, largura do quadro financeiro e isolamento da nota do assistente de criação.
- [ ] Homologação hospedada dos fluxos autenticados e publicação continuam condicionadas aos gates do SHA do candidato e à infraestrutura de staging. Os contratos SQL do checkpoint anterior permanecem evidência de banco isolado.

### Continuidade do PR #179 após `aef77abd` em 27/11/2026

- [x] Conferir preview no SHA da recuperação cinematográfica, com Lighthouse móvel, QA visual e comparação pareada de 16 benchmarks aprovados nessa revisão.
- [x] Corrigir a indisponibilidade do 1×1 sem Supabase configurado e a semântica de carregamento das rotas. Os dois testes de regressão reproduziram as falhas anteriores.
- [x] Validar restauração local de PostgreSQL, contrato SQL de idempotência em staging e diagnósticos de segurança de escopo fixo no SentinelX.
- [ ] Validar CI e QA hospedada no novo SHA, login e passkey em staging, Stripe Sandbox e fluxo autenticado de 1×1/2×2. A restauração externa, o upgrade coordenado do Wazuh e o teste em GPU física exigem validação própria.

[Auditoria operacional e visual](../../operations/pr179-gateway-vps-visual-audit-2026-11-27.md)

### Homologação a partir de `37bfb1cd` em 27/11/2026

- [x] Revisar CI do checkpoint. No SHA `37bfb1cd`, Quality Gates, Lighthouse móvel nas cinco rotas e os 16 benchmarks pareados passaram.
- [x] Corrigir a falta da região principal na partida rápida. A fase ativa e seu carregamento passam a ter um único `main`, assim como a seleção. O teste de regressão falhou antes da correção e passou com a mudança.
- [x] Validar o Auth isolado com duas contas descartáveis. Links de uso único, renovação, persistência de metadados, logout e remoção das contas passaram. Os contratos SQL de carteira, carreira, fila cooperativa e liquidação também passaram no ambiente isolado.
- [x] Verificar Tailscale, SSH, sudo do Gateway e duas verificações sob demanda em binários de sistema. Os dois arquivos terminaram sem detecção.
- [ ] P0 — Vincular o aplicativo de staging ao Supabase isolado e validar senha com CAPTCHA, passkeys e saves reais. O login direto por senha retornou `captcha_failed` e o preview do PR segue sem configuração do Supabase.
- [ ] P0 — Validar checkout autenticado, evento Stripe assinado e crédito idempotente. A primeira chave fornecida nesta etapa retornou HTTP 401 no modo de testes. O catálogo do sandbox correto respondeu pelo conector.
- [ ] P0/P1 — Validar multiplayer 1×1 e 2×2 no aplicativo de staging, comprovar a restauração externa e executar o upgrade coordenado do Wazuh após o ensaio de recuperação.
- [ ] P2 — Acumular a evidência visual do novo commit, incluindo Android e GPU física. O executor do navegador Android encerrou a sessão antes da interação.
- [ ] Revalidar todos os gates no novo SHA antes de liberar o PR.
