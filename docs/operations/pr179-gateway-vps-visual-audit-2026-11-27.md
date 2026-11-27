# PR #179 | Continuidade do Gateway, VPS e QA visual | 27/11/2026

## Checkpoint anterior à retomada

- PR: [#179](https://github.com/davizeiro12345678/jogomanager/pull/179), branch `fix/audit-vps-ui-20261126`, **Draft e atrás de main** na verificação desta sessão. Revalidar o SHA antes de qualquer aceitação.
- Baseline de continuidade: `aef77abd3efd021b0bd67a1540abe94f7e7e8220`, com 25 checks `success`, um `neutral`, três `skipped`. O ciclo cinematográfico havia sido validado em Chromium com WebGL por software, não GPU dedicada.
- Correção incremental nesta sessão: novos testes `src/i18n/store-page-messages.test.ts` (commit `78e1133b`), catálogo de mensagens `src/i18n/store-page-messages.ts` (`8b2383dd`), troca de cópia fixa em `src/pages/loja.tsx` (`a8a86ad0`), formatação exigida pelo lint (`4aba9d09`). Verificar CI do **HEAD posterior**, não reutilizar o CI da baseline.
- **Não houve** merge, deploy de produção, checkout/pagamento real, restauração de backups, alteração de firewall/SSH/Tailscale, remoção de credenciais sudo ou atualização do Wazuh.

## Auditoria privilegiada e limites de acesso

O usuário cadastrou o sudo no Gateway e foi possível executar comandos via `Gateway.execute_command(privilege=sudo)` com UID 0. A credencial continua no Gateway; não foi exposta, removida nem modificada.

| Controle | Evidência consultada | Veredito e ação |
| --- | --- | --- |
| `sshd -t` e `visudo -c` | Ambos passam | Sem modificação de acesso; teste de reconexão permanece pré-requisito para qualquer troca de autenticação |
| Autenticação SSH efetiva | `PermitRootLogin no`, `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `AuthenticationMethods publickey`, `AllowTcpForwarding no` | Restritiva; preservar o acesso do Gateway |
| Chaves e CA | `RequiredRSASize 2048`, `TrustedUserCAKeys` configurado | Preocupação histórica com RSA de 1024 já não reflete o estado atual; não mudar CA sem testes |
| Identidades | `jmadmin` com senha local definida; `jadmin` e `jmrescue` com senha bloqueada; todos aparecem no `AllowUsers` | Bloqueio de senha não prova bloqueio de certificados; preservar acessos de recuperação |
| UFW / nftables | UFW `active`, entrada `deny`, roteamento `deny`, saída `allow`, chains `ip/ip6 input` policy `drop`; `jmguard` ativa | Nenhuma alteração; mapear regras completas/ordem de chains antes de ajustes, inclusive Docker/Tailscale |
| Fail2ban | Jail `sshd` ativo, `maxretry=2`, `findtime=600s`, `bantime=-1`; 43 IPs banidos | Estado comprovado; não divulgar listagem dos IPs nem modificar bloqueios por tentativa |
| Antivírus e EDR | ClamAV 1.5.4, daily 28194 de 25/11, Freshclam verificou bases Nov 27 em ciclos horários; Wazuh Agent, CrowdSec, Elastic Agent, auditd e Tetragon ativos | Serviço operacional, **não** comprova taxa de detecção ou testes end-to-end; Falco inativo não implica falha se Tetragon atende escopo |
| Wazuh | Agent 4.14.10, pacote candidato 4.14.11; imagens do manager/indexer/dashboard em 4.14.10 | **Não atualizar isoladamente** sem matriz de compatibilidade, snapshot/teste e rollback |
| Disco | Volume raiz de 650 GiB, aproximadamente 51% utilizado e 308 GiB disponíveis | Sem urgência de limpeza destrutiva |
| Gateway Ops | Plano Pro: 16 trabalhos simultâneos, quatro browsers, 10 inclusões de bundle Ops possíveis, **zero servidores inscritos** | Adicionais de backup/teste de restauração, patch, drift e host health não foram ativados; ação de ativação depende da conta no Gateway |
| Vulnerabilidades do add-on | Aviso antigo com 1.126 identificações no scanner do Gateway de 26/11 | Não há CVEs/versões/pacotes discriminados aqui para confirmar explorabilidade; exige triagem, não são 1.126 correções comprovadas |

### Tailscale e localização da execução

- Da VPS: `tailscale status` = Running, self online, 3 peers (1 online), nenhuma exit node e nenhuma rota anunciada. Teste `tailscale netcheck` observou UDP funcional, DERP Frankfurt perto de 1,2 ms no momento, sem prova de latência SSH end-to-end.
- Gateway usa conexão **overlay**, executada a partir de região automática. Tentativa de atribuir `europe` foi recusada por validação (`Overlay placement is always automatic`). **Nenhuma mudança de região efetivada**.
- As regiões informadas pelo Gateway são compartilhadas; complemento de IP estático/dedicado **não foi comprovado** no inventário. Não assumir a disponibilidade ou origem de um endereço comprado.

### SentinelX: limite de privilégios preservado

- Agent `0.23.60`, host conectado `jm-fra-01`, usuário `sentinelx`; execução em `allowlist`. `sentinel_exec("systemctl is-active ssh")` e `sentinel_exec("ss -lnt")` foram aprovados para diagnóstico não privilegiado.
- Unidade `sentinelx-cloud-core`: `NoNewPrivileges=yes`, `ProtectSystem=strict`, `ProtectHome=yes`, `RestrictSUIDSGID=yes`; `sudo -l -U sentinelx` não autoriza sudo. Teste de comando `sudo -n` dentro do próprio agente falha explicitamente pelo NNP.
- O playbook oficial `add_allowed_command` bloqueia o agente de editar sua própria allowlist; não deve ser burlado usando acesso root do Gateway. **Não foi concedido sudo ao SentinelX**: seria ineficaz com NNP e uma regressão de menor privilégio se desabilitado.
- Recomendação: manter operações root via Gateway autenticado e auditável e usar SentinelX para coleta não privilegiada. Uma ampliação futura precisa preservar NNP e usar broker com operações específicas, auditoria, testes negativos e aprovação da política; não criar regra `NOPASSWD:ALL` nem tornar a política autocontrolável.

## QA visual real: produção versus preview do PR

**Evidência real**: Google Chrome 158 headless na VPS, capturas em 1440×900 (desktop) e 390×844 (mobile), obtidas de `https://jogomanager.com`. Não são screenshots do HEAD PR e **não homologam mudanças ainda não publicadas**.

| Área / captura em `/opt/pfm-pr179-visual-qa-20261127/` | SHA-256 | Evidência |
| --- | --- | --- |
| `desktop-home.png` | `0b14301c29bcaa11123fdbb09c176c89a2e245e86230d62e4b5c4f66ab216ce5` | Hero e CTA renderizados, banner de consentimento presente |
| `desktop-new.png` | `eee7402a360dad3b2512101f6d0478cf1e09e571296803baf77bbe8ce48b42ec` | Etapa 1 do criador, formulário e avatar visíveis; loading de save ainda aparente |
| `desktop-career.png` | `8dc4f6e0274e3a7048cf5adbd1f9b893a38b6e6cc3d71b3a96660cb5e33a46bc` | Página de entrada na carreira, sem prova de save autenticado |
| `desktop-store.png` | `f1580f52a5cfc2d3732f435f3bba761bb83bc682298c427ee675eab8b30ec1c8` | Hero da loja em PT enquanto aviso de conta está em EN com browser EN: **inconsistência reproduzida** |
| `mobile-quick-match.png` | `f290f946752059c808db7e4ee514bc200d72446ba10120db763325b5de0d6e26` | Tela 390×844, CTA inicial parcialmente sob aviso de privacidade; necessidade de conferir scroll e teclado |
| `mobile-player-career.png` | `03c3221e1357d83ad4d36f6753c98e6f1f6dc212e4c5ab274ba0a9c42694d93b` | Artigo de carreira renderizado com aviso de consentimento |
 
- `/multiplayer` e `/dashboard` em screenshot mobile excederam o limite de 27 segundos do processo; **sem evidência válida** de carregamento ou defeito específico.
- Checagem controlada de idioma na mesma VPS, `--lang=en-US` versus `--lang=pt-BR`, confirmou `<html lang=en>` e textos em inglês no primeiro caso e `<html lang=pt-BR>` e textos em português no segundo caso. **Não classificar a partida rápida como bug de tradução PT-BR**.
- `ConsentBanner.tsx` já adiciona `11rem` ao `body` durante abertura do diálogo. Sobreposição inicial não equivale a CTA inacessível ao scroll. Priorizar teste com interação de teclado/scroll e estabilidade SSR/hidratação antes de alteração de layout.
- Gateway Chrome separado recebeu **Cloudflare Managed Challenge**, sem acesso à página e sem contornar o mecanismo. O navegador dessa sessão foi encerrado. Outros três navegadores já existentes na conta não foram interrompidos.
- Google Chrome no VPS abriu a aplicação real sem o desafio, por isso foi usado como fonte visual. Os testes de produção não executaram compras nem ação autenticada.

## Correção em andamento: cópia internacionalizada da loja

- Reproduzido: a hero estática de `src/pages/loja.tsx` tinha textos sempre em português enquanto `GuestSignInNotice` chama `storeAccountMessages(lang)` e renderiza inglês para cliente EN.
- Implementado: `src/i18n/store-page-messages.ts` com PT-BR original, EN e ES; `src/pages/loja.tsx` consome a língua corrente e usa as mensagens nos títulos, subtítulo e benefícios. `src/i18n/store-page-messages.test.ts` exige PT-BR, EN, ES e fallback de idioma legado.
- A primeira execução de CI após a alteração reprovou unicamente a formatação Prettier de um `h1` em `src/pages/loja.tsx`; corrigida no commit `4aba9d09`. CI do novo SHA **pendente de revalidação** no fechamento desta nota; nunca emprestar o resultado anterior.
- Escopo não coberto: restante de strings fixas em `StorePanel.tsx` e dados do catálogo (nomes e descrições de produto); não anunciar i18n total nem desempenho medido para esta alteração.

## Riscos remanescentes e critérios de aceite

| Classificação | Risco | Estado do aceite |
| --- | --- | --- |
| P0 | Checkout Stripe **test** autenticado, evento assinado e crédito de carteira idempotente | Pendente, não exercitado nesta sessão |
| P0 | Multiplayer autoritativo 1×1/2×2 com reconexão e validação de encerramento | Pendente |
| P0 | Backup externo criptografado e restauração isolada comprovada | Bloqueado; Gateway bundle não ativado |
| P0 | Schema SQL e migrações de staging/produção sem regressão de RLS/saves | Pendente |
| P0 | Passkey autenticada E2E em produção e staging | Pendente |
| P1 | QA visual da transição cinematográfica em GPU física, gráficos e partida completa | A transição sintética Chromium passou no HEAD anterior, GPU física pendente |
| P1 | CI do último SHA, typecheck, lint, testes, benchmarks ABBA equivalentes, Lighthouse | **Reverificar HEAD após todos os commits** |
| P1 | Localização da loja | Correção parcial implementada; validação do HEAD e demais textos pendentes |
| P2 | UX do consentimento em viewport pequeno (scroll e foco) | Inspeção visual parcial, sem teste interativo conclusivo |
| P2 | Browser QA Gateway Cloudflare challenge, Chrome/Android/Edge/Firefox | Limitações de acesso; não contornar proteção |
| P2 | SentinelX com sudo delegado | Não implementado por NNP e ausência de broker de menor privilégio; Gateway sudo operacional preservado |

**Rollback:** GitHub commits de localização devem poder ser revertidos independentemente. Não usar `main`/deploy sem homologação em staging isolado, CI do exato HEAD, evidência E2E dos P0, backup restaurado e plano de rollback. Proteções do VPS não foram relaxadas.

## Retomada após o checkpoint do Gateway

- O PR #132 já foi incorporado à `main`. A preparação do #179 preservou a localização da loja e a auditoria inscritas até `3ad38ff` e incorporou a base `7bfcfea6`. O candidato continua em rascunho.
- O Chrome 158 do VPS identificou o preview como `aef77abd` via `/api/health`. Sete páginas renderizaram em 1280×800 e 390×844, todas com HTTP 200, sem rolagem horizontal e sem exceções JavaScript de página. A saúde devolveu 503 nos dois perfis. A resposta registrou autenticação, credenciais do servidor e banco indisponíveis por configuração ausente. Os avisos do Supabase em carreiras, loja e multiplayer pertencem a esse ambiente.
- Chrome, Firefox e Edge do Gateway exercitaram rotas de produção e preview, com quatro sessões de desktop simultâneas. No preview, a seleção **Elenco** mudou o estado do painel da Home, o fluxo de convidado abriu o criador de treinador e a loja respondeu à tentativa de verificar pagamentos. Dois lançamentos Android perderam a máquina do provedor. A cobertura móvel de 390×844 veio do Chrome do VPS.
- O 1×1 no preview anunciava disponibilidade e encaminhava para um login indisponível. O estado corrigido oferece partida rápida local quando o cliente Supabase está ausente. O 2×2 continua identificado como em validação e a entrada normal do 1×1 continua disponível em ambientes configurados. O componente de navegação pendente usa `role="status"` em um `div`, de forma que os esqueletos coexistentes não adicionem elementos `main`.
- Os dois testes de regressão falharam antes das correções. No candidato revisado, 63 testes focados, ESLint e TypeScript passaram. O resultado do Lighthouse, do comparador pareado de 16 benchmarks e dos nove eixos de QA em `aef77abd` é histórico. Cada gate deve ser apurado no próximo SHA publicado.

| Prioridade | Controle | Evidência da retomada |
| --- | --- | --- |
| P0 | Backup do PostgreSQL local | Cinco arquivos conferidos por SHA-256. O dump do jogo foi restaurado em instância PostgreSQL 18 temporária, acessível por socket privado, com duas tabelas no schema de cache. |
| P0 | Cópia criptografada externa | O timer disparou e a unidade foi ignorada porque faltava a confirmação do destino criptografado. `ConditionResult=no` e horário de saída ausente explicam por que `Result=success` sozinho não certifica uma cópia. |
| P0 | Stripe Sandbox | O contrato SQL de entrega repetida aprovou a idempotência no banco isolado e reverteu a fixture. A conta Sandbox indicada tem seu endpoint de risco do JogoManager desabilitado e dois endpoints Lovable habilitados. O checkout autenticado e a entrega assinada do Sandbox ao jogo permanecem sem homologação. |
| P0 | Autenticação e multiplayer | O projeto Supabase isolado responde na API de configuração de Auth e contém as tabelas de sala, carreira e serviços de carteira. O preview do PR não está ligado a ele. Login, passkey, persistência e salas autenticadas continuam pendentes. |
| P1 | Antivírus e EDR | A versão da assinatura diária do ClamAV coincide com a do CDN. Teste do daemon em fluxo aceitou uma amostra limpa e detectou o indicador EICAR. O agente e os três componentes centrais do Wazuh estão em 4.14.10. A atualização para 4.14.11 deve iniciar pelo conjunto central. |
| P1 | GPU física | O dispositivo DRM da VPS é virtual (`bochs-drm`). A matriz física continua pendente. |
| P2 | Acesso operacional | O Gateway conserva sudo para `jmadmin`. A porta 22 escuta somente em loopback e Tailscale. O SentinelX pode solicitar uma coleta privilegiada de SSH, UFW e Fail2ban por unidade dedicada com regra Polkit de escopo fixo. A unidade do agente conserva `NoNewPrivileges=yes`. |

O caminho de retorno do SentinelX fica restrito aos arquivos da nova unidade, ao coletor e à regra Polkit correspondente. O acesso do Gateway, a CA de SSH e as regras do firewall ficam fora desse procedimento.

## Continuação P0/P1 e melhora visual verificável — 27/11/2026, 19:30 UTC

Esta seção complementa, sem substituir, o checkpoint acima. **Não houve merge, deploy
de produção, checkout autenticado, concessão em Stripe, atualização de Wazuh,
restauração externa ou autenticação real 1×1/2×2 nesta retomada.**

### P0 autenticado e banco isolado

- PR #179 permanece Draft. Na revisão inicial desta sessão, `37bfb1cd`:
  26 checks passaram, um foi neutro (CodSpeed walltime instável) e três pulados.
  Novos commits de outros fluxos continuaram a chegar à branch durante a auditoria;
  não usar checks de SHA antigo para aprovar o HEAD atual.
- `game-staging.jogomanager.com/api/health` retornou HTTP 200 e commit
  `fb07df1d`, **não** o código atual do #179. A produção retornou HTTP 200
  em `7bfcfea6`; o preview do PR antes observado com 503 segue sem E2E autenticado.
- A branch Supabase `staging-release-132` mantém `MIGRATIONS_FAILED`
  no inventário de branches, mas consultas read-only ao projeto
  `skycnsjbcqmsaejaairl` mostraram **85 migrations catalogadas**,
  `public.career_save_chain`, `public.match_rooms` e
  `public.payment_webhook_events`. A tabela de save chain tem RLS habilitada
  e a policy `Owners read their save chain`. A tabela de eventos de webhook
  tem RLS habilitada e nenhuma policy de cliente; isso **não constitui por si só**
  falha, pois pode intencionalmente bloquear acesso a clientes. Migrações
  `restore_career_save_hash_chain_0053`, `rls_cached_auth_context_0088`
  e `moderation_foreign_key_indexes_0089` aparecem na história, mas
  não anulam o alerta da branch nem substituem teste de owner/auth.
- O teste do cliente de teste autorizado para Stripe `GET /v1/account`
  retornou **HTTP 200** na conta `acct_1UCpy65Co1CQ7ndi`, sem revelar
  a chave. **Não** houve criação de checkout nem PaymentIntent por esta
  auditoria. O endpoint auxiliar do staging retorna
  `configured_channels:4, required_channels:5` com HTTP 503, pois falta
  `STRIPE_WHSEC_RISK`; a presença de segredo para outros canais não valida
  assinaturas nem crédito. Worker auxiliar registra eventos, não concede itens.
- O teste de integração existente de 2 clientes usa sockets loopback e tickets
  sintéticos. Não constitui validação de duas contas reais, passkeys ou
  multiplayer autenticado 1×1/2×2.

### P0 offsite, P1 Wazuh e segurança operacional

- `jm-backup-offsite-drive.timer` está ativo, mas a unidade
  `jm-backup-offsite-drive.service` exibe `ConditionResult=no`.
  Falta `/root/.config/rclone/rclone.conf` e também
  `/etc/jm-backup-offsite/crypt-remote-verified`. O `rclone listremotes`
  do root não mostrou remotes. **Não criar marker artificial**;
  obter destino criptografado legítimo e comprovar recuperação isolada
  antes de marcar P0 aprovado. O add-on do Gateway está desligado e só a
  pessoa titular da conta pode ativá-lo no painel.
- O Wazuh usa três contêineres centrais 4.14.10; o Compose fixa os três
  tags em `/opt/jm-security-wazuh/single-node/docker-compose.yml`.
  As três imagens **4.14.11 já estão em cache local**, sem contêineres
  atualizados. O indexador tem volume persistente, porém a consulta
  sem credenciais a `/_snapshot/` retornou **HTTP 401**, não uma
  confirmação de snapshot ou restauração. Nenhuma troca de imagem nem
  restart foi executado. Upgrade coordenado depende de snapshot, rollback
  testado e validação pós-reinício. Não atualizar agente antes dos centrais.
- A VPS não dispõe de GPU física dedicada verificável. Preservados
  Gateway sudo, SSH com chaves, UFW, Tailscale, serviços de defesa e política
  `NoNewPrivileges` do SentinelX.

### QA visual e mudança gráfica no mesmo PR

- Browser Gateway Chrome e Edge receberam o desafio Cloudflare; Firefox
  staging exigiu Cloudflare Access. Foram **três sessões lançadas e três
  encerradas**; o quarto browser já existente na conta não foi interrompido.
  Nenhum desafio foi contornado e nenhum controle foi desativado.
- [`8b5ffdda`](https://github.com/davizeiro12345678/jogomanager/commit/8b5ffdda4ac3ab554b45d4f716916f6a7283df4e)
  adicionou três testes para sombra da bola;
  [`5e2d36a0`](https://github.com/davizeiro12345678/jogomanager/commit/5e2d36a05544da40ec0b7979b625e19935550012)
  adicionou o helper `ballShadowAppearance`;
  [`0c2384ff`](https://github.com/davizeiro12345678/jogomanager/commit/0c2384ffb9c5dc3dd6632fd539e9139966879ced)
  renderiza a sombra com textura radial suave, escala crescente e
  opacidade decrescente em função da elevação; usa
  `depthWrite={false}`. Nenhuma regra canônica, física do simulador,
  save ou replay foi modificada. A captura real do resultado **após**
  a alteração ainda não foi produzida: sem inventar comparação A/B ou FPS.
- Relatório HTML mobile-first, com capturas verdadeiras **anteriores**
  e ilustração gráfica explicitamente identificada, produzido na conversa
  com o usuário (não é evidência de deploy). Para aceitar a alteração,
  usar CI do SHA corrente, GPU/Chrome com a mesma cena, perfil térmico,
  frame time e event logs; o CodSpeed anterior estava sujeito a ruído.

### Critério de release e rollback

Manter Draft. Corrigir e validar os P0 de Auth, duas sessões reais, Checkout
sandbox assinado e offsite com restore, além de preparar snapshot dos
centrais Wazuh e teste GPU. Os três commits de sombra são autocontidos e
reversíveis. Este checkpoint não relaxa branch protection, limites de
performance, CSP, RLS, SSH, firewall, Tailscale ou validação de assinatura.


## Continuação 27/11/2026, 19:44 UTC — chaves isoladas, pose segura, HTML mobile e navegadores

**HEAD de referência anterior ao fechamento:** `7504d530c2d2b4d6dfc7f1ab86729cdae86806ba`. A branch é alterada por fluxos paralelos; reconsultar CI após este commit. PR #179 continua **Draft**, sem autorização de merge ou deploy. A matriz de P0 do checkpoint anterior permanece aberta.

### Chaves e conectividade: evidência sem valores secretos

- O Gateway informou nomes, não conteúdos, das credenciais armazenadas. Três candidatas ao Supabase isolado (`jogomanager-supabase-staging-service-role`, `legacy-jogomanager-supabase-staging`, `supabase`) retornaram **HTTP 401** em `http://127.0.0.1:25431/auth/v1/admin/users?per_page=1`. Não se deve trocar bindings da aplicação por essas chaves sem provar origem e papéis.
- O cliente já em execução no contêiner `jm-real-game-stage-local` consulta a URL configurada `supabase-staging.jogomanager.com` com **HTTP 200**. Também houve **HTTP 200** no Envoy local usando as credenciais de serviço/publicáveis de ambos os contêineres (apenas no processo privado, sem exposição). Essas evidências mostram que o 503 do preview **não pode ser atribuído apenas** à falta de todas as chaves ou à diferença textual entre variáveis. A rota `http://127.0.0.1:3092/api/health` ainda retorna **503** com corpo contendo `error`; rastrear aplicação/Worker, DNS e checks reais antes de uma correção.
- A chave de teste `jogomanager-stripe-sandbox-api-key-file` autentica (GET `/v1/account`, **HTTP 200**) na conta **principal em modo teste**, `acct_1UCpy65Co1CQ7ndi`. A chave armazenada como `stripesecret` autentica na **conta Sandbox distinta**, `acct_1UCoO24f5HwE4lTW`. Outra chave candidata recebeu 401. Nada foi cobrado.
- A conta Sandbox separada tinha dois webhooks Lovable habilitados e o endpoint JogoManager risk antigo desabilitado. Criou-se um novo endpoint de **risco sandbox** `we_1UgUzo4f5HwE4lTWy5XaCDCK` com eventos `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`; ele foi **imediatamente desabilitado**, e o estado `disabled` confirmado por leitura posterior. A tentativa de armazenar o segredo HMAC no Cloudflare foi **bloqueada pelo controle de segurança da ferramenta**; não tentar contornar. O segredo não foi exposto em chats, logs ou Git. O Worker continua sem `STRIPE_WHSEC_RISK` e health **503 (4/5 canais)**. Este webhook não deve ser habilitado antes de rotação/instalação autorizada da assinatura e teste de entrega real. O Worker auxiliar só audita, não concede carteira.
- O banco Supabase de **produção** possui `public.user_wallet` e `public.payment_webhook_events` mas não `public.career_save_chain`. A consulta retornou **zero tabelas físicas em public sem RLS habilitada**, o que não substitui testes das policies sob identidade de usuários distintos. Nenhuma migração foi aplicada à produção.

### Correção incremental da animação no PR

- Teste novo `src/game/animation-pose-safety.test.ts` no commit `8c7031b`: garante que `clampPose` elimina NaN/±Infinity, limita ângulos finitos e não modifica a entrada.
- Implementação `646faee`, seguida de formatação exigida por Prettier `59ebf59`: valores de junta não finitos geram **pose neutra (0 rad)**. O rig renderizado também usa o limitador anatômico próprio de `ground-contact.ts`, já resistente a não finitos; esta é uma defesa complementar, **não** uma remodelagem massiva de geometria ou uma alteração de física autoritativa.
- Os commits de sombreamento de contato da bola e a correção da transição cinematográfica permanecem no PR. Seus testes e capturas em Chromium por software não comprovam FPS, 1% lows, frame pacing, qualidade PBR, IK real ou 90 minutos em GPU dedicada. GPU no VPS: PCI virtual `1234:1111`, sem NVIDIA e sem render node. A homologação gráfica física **continua P1 pendente**.
- O CI do primeiro commit de implementação da pose reprovou **apenas Prettier**; corrigido em `59ebf59`. A rodada `7504d530` foi observada com **23 success, 1 neutral, 3 skipped e 1 build em progresso**; revalidar o head mais recente para saber o veredito.

### Navegadores reais e artefato HTML

- A conta Gateway Pro permite quatro navegadores simultâneos. Neste lote: Chrome e Edge receberam **Cloudflare challenge** (sem tentativa de bypass); Firefox abriu `/new` em produção, clicou `Só o essencial` e avançou **Identidade → Aparência → Perfil**, confirmando elementos acessíveis e estado do wizard. A tentativa de clicar `Continuar` fora do viewport falhou inicialmente por scroll, foi repetida após rolar e passou. O Android Chromium encerrou por falha do provedor antes de carregar `/multiplayer`.
- **Todas as quatro sessões desse lote foram encerradas**, com confirmação `stopped` e consumo inferior a US$0,01 de saldo por sessão. Nenhum fluxo autenticado foi testado.
- Gerado e verificado via Chrome 158 do VPS a 390 × 844 o relatório HTML autocontido `/home/jmadmin/relatorio-pr179-auditoria-mobile-2026-11-27.html`: 4.321.934 bytes, SHA-256 `f520b6580e1ded85928fd1c1527570f2cd1b1042291aad6f4602ac0007f2bc0d`. Contém **seis capturas reais embutidas**, origem identificada como produção **anterior** ao head do PR, matrizes P0/P1/P2, distinção entre código e medição, layout responsivo e limites de QA. Artefato transferido ao Gateway com download temporário. Validação móvel `/opt/pfm-pr179-visual-qa-20261127/report-mobile-validation.png` (SHA-256 `dace168ec33ae233f665d2eb4e1094885a738c4f6a956684007f9d92f0314d08`).
- A fatura fornecida pelo proprietário mostra **US$15 de Static IP paga**, mas as três regiões compartilhadas consultadas retornam `staticIp.status=slot_available`, sem IP provisionado à conta. O bundle Ops ainda não está inscrito em nenhum servidor; uma cobrança/fatura e um recurso operacional habilitado são evidências distintas.

**Bloqueios de publicação mantidos:** assinatura Stripe e crédito idempotente em fluxo real sandbox, Auth/passkey/saves staging, multiplayer 1×1 e 2×2 com clientes autenticados, backup externo cifrado restaurado, schema/RLS verificados, Wazuh 4.14.11 com snapshot/rollback e QA 3D/física em GPU física. Sem corte do acesso `sudo` do Gateway, sem desligar firewall, sem migração destrutiva ou merge.
