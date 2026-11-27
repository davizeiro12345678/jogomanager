# PR #179 | Continuidade do Gateway, VPS e QA visual | 27/11/2026

## Identificação, rastreabilidade e política de publicação

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
