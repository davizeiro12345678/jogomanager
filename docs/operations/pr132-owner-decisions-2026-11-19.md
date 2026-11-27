# PR #132 — decisões autorizadas e critérios de liberação (19/11/2026)

Este documento registra a autorização do proprietário. **Não é prova de execução** nem substitui os checks, testes de restauração ou revisão independente documentada.

## Regras da branch principal

- Manter pull request obrigatório para mudanças na `main`, com force-push e exclusão bloqueados.
- Como existe um único desenvolvedor, configurar **zero aprovações humanas obrigatórias**, permitindo que o próprio proprietário efetue o merge **depois** dos checks.
- Manter obrigatórios os checks realmente publicados pelo GitHub, especialmente `Critical performance release gate`, `Build, types and tests`, `Supabase migration replay and access contracts` e a auditoria de risco independente, conforme os nomes efetivos verificados no contexto do PR.
- Antes do merge, anexar a revisão independente documentada com achados, resolução e identificação do commit; **não confundir inventário automatizado com assinatura de revisor humano**.
- Não fazer bypass de checks, não fazer merge automático durante esta fase e verificar a ruleset por leitura pós-alteração.
- **Bloqueio operacional atual:** o conector GitHub não tem ação de escrita de ruleset; tentativas anteriores de administração retornaram HTTP 403. A navegação autenticada precisa de acesso administrativo interativo. Não marcar a ruleset como modificada sem readback.

## Manutenção e continuidade

- Trabalhar com **zero indisponibilidade planejada** para partidas, login e API. Aplicar em ambiente isolado, medir antes/depois, usar canário e rollback.
- **Preservar** o túnel saudável `jogomanager-vps-multiplayer-canary-20261112` como canário; **não** direcionar automaticamente o tráfego do túnel principal indisponível para ele.
- O túnel principal `jogomanager-vps-fra-01` foi visto como `down` com 0 conexões em 19/11; diagnosticar credencial/identidade/serviço antes de qualquer troca. Não expor rotas administrativas publicamente.
- Recuperação: backup local atual deve ser validado por restauração; manter cópia criptografada no Google Drive e solicitar snapshot independente no painel da 0Ping. Snapshot da 0Ping **ainda não verificado**.
- Google Drive: pasta `JogoManager - Backups criptografados do VPS` contém arquivo datado de 18/11. O sincronizador `jm-backup-offsite-drive` exige `rclone` autenticado e guarda de recuperação; **não** remover essas condições para acelerar a transferência.

## Staging de banco e multiplayer

- Autoriza-se criar **projeto Supabase separado**, sem dados pessoais nem credenciais de produção; a criação paga precisa de cotação e aceite específico do custo, e organização confirmada.
- Desabilitar cron, rotas públicas e gameplay em cada novo ambiente até testes privados completos. Garantir `STAGING_SUPABASE_PROJECT_REF` diferente da produção.
- Testes de cooperativo 2×2 poderão usar **quatro bots autorizados**, cada um com identidade, ticket e assento exclusivos; não substituir teste real do navegador, latência WebSocket, reconexão, Durable Object e liquidação idempotente por simulação local.
- Registrar versão do motor, seed, snapshots, comandos, reconexões, frame time p95/p99, falhas/retentativas e IDs de recibos sem registrar tokens.

## Segurança preventiva e AetherAV

- Bloqueio preventivo permitido **somente para detecções de alta confiança corroboradas**. Preservar quarentena reversível, auditoria e lista de exclusões críticas; nunca apagar automaticamente serviços ou arquivos essenciais.
- Assinatura comunitária/heurística, flag ELF W+X ou classificação isolada de um LLM **não** são suficientes, sozinhas, para declarar infecção confirmada.
- Comparar o ensemble clássico, detector Aegis34, Qwen3.5-2B, Qwen3.5-9B e candidato Qwen3.8-27B em tarefas que realmente executem. Não atribuir recall de malware ao Qwen se o ensaio mediu somente triagem de alertas sintéticos.
- Exigir teste independente **inédito**, rótulos auditados, separação por família/tempo e o **motor completo entregue**, com taxa de detecção e latência comparáveis.
- **Gate conservador**: limite inferior do intervalo de confiança bilateral de 95% do recall ≥98,99% E limite superior do intervalo de 95% da taxa de falsos positivos ≤0,29%; ambos simultaneamente. Dados de testes reutilizados **não** aprovam liberação.
- A leitura estática ELF deve validar magic `0x7f 45 4c 46`, 32/64-bit, endianness, arquitetura, segmentos e limites de leitura; nenhuma amostra é executada pelo parser.
- No VPS, `/opt/jm-aetherav-review/elf-header-staging-20261119` contém um parser somente leitura e gate estatístico experimentais: **13 testes aprovados**. Nenhum desses protótipos foi ativado no pipeline preventivo em produção.

## Dispositivos e métricas do Match 3D

O escopo inclui **Android/iOS móveis intermediários de 2018, intermediários de 2020 e high-end**. Registrar fabricante/modelo, SoC/GPU, RAM, SO, navegador, resolução, DPR, preset, temperatura e consumo. Não tratar emulador/headless como GPU real.

- 2018 intermediário: validar compatibilidade, estabilidade, modo adaptativo e FPS real; registrar redução explícita de qualidade quando necessária.
- 2020 intermediário: validar preset intermediário, recuperação de contexto, variação térmica e qualidade adaptativa.
- High-end: meta de preset alto, média ≥60 FPS, 1% low ≥50 FPS, p95 ≤20 ms, p99 ≤33,3 ms, sem congelamentos inexplicados >250 ms.
- Medir transições de cutscene, primeira renderização, WebGL2/WebGPU fallback, física de contato, memória, p95/p99 de quadro, Lighthouse/INP e regressões visuais.

## Evidências e bloqueios reais no exato SHA

- Snapshot examinado: `a0bb4332826000b7e20a72eb0fad010ec92e9c59`, PR #132 aberto, não mesclado.
- Em `Quality gates`, o Lighthouse móvel falhou em `/`: Performance **0,91** contra ≥0,97 e TBT **340,804 ms** contra ≤200 ms. O gate crítico falhou por dependência desse job; **não diminuir os limites**.
- O VPS apresentou `jm-security-fullscan-10h.service` com saída 2; a última varredura registrou 467.201 itens, alertas ClamAV e Maldet, erros de parser e desaparecimento de entradas mutáveis. É preciso reconciliar alertas com amostras e limpar erros antes de mudar bloqueio automático.
- O uso de `Remote Desktop Commander` como root foi verificado. Isso **não** implica que outros conectores tenham root ou que o host já esteja recuperado de uma possível intrusão anterior.
- Nenhum merge, deploy de produção, troca de túnel ou alteração de ruleset foi autorizado **automaticamente** por este documento.

## Próximo checkpoint

1. Corrigir regressão móvel do Lighthouse sem enfraquecer o limite.
2. Configurar ruleset administrativa, ler resultado e registrar revisão independente.
3. Provisionar staging independente após aceite de organização/custo; rodar bots de quatro assentos + rede real em rota privada.
4. Validar restauração de backup em host isolado e sincronização offsite autenticada.
5. Homologar detector ELF integrado e resultados inéditos de malware; manter políticas de bloqueio atuais até a evidência ser suficiente.
6. Concluir métricas de hardware móvel, CI no último SHA, decisão explícita de Go/No-Go e rollback.
