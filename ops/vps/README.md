# JogoManager: operação segura das VPS

Targets: core8 = 194.163.188.190; plus6 = 144.91.111.116.

Este diretório contém scripts de diagnóstico e benchmark **não destrutivos** para executar dentro de cada VPS, após o acesso SSH jmadmin e VNC root terem sido validados.

Uso dentro da VPS 8:

    bash ops/vps/benchmark.sh core8 before
    bash ops/vps/integration-audit.sh

Repita na Plus 6 com plus6 e novamente com after após otimizações. Nunca compare resultados de VPS diferentes ou perfis diferentes.

O benchmark coleta kernel, CPU, RAM, disco, filesystem, redes, serviços, PSI, NTP e testes curtos de CPU/fio/HTTP localhost quando programas existirem. Não instala nada e não executa carga contra terceiros. Categorias não medidas permanecem ausentes, nunca são estimadas.

Em 04/11/2026 o DNS catalog.jogomanager.com tinha registro A proxied para 194.163.188.190; o Cloudflare Tunnel jogomanager-vps-catalog-20261026 estava inativo. Não apontar o DNS para esse túnel até estar íntegro e validado. O canário do cliente de escudos é opt-in e não deve ser habilitado sem medir p95, integridade e fallback Supabase.

O bloqueio de root do plano SSH FIDO2 só pode ocorrer após testar os dois tokens, certificados de 15 minutos, sudo interativo e reversão automática nas duas VPS, uma por vez.


## Ferramentas adicionais

Para ampliar testes de CPU de 1/2/4/6/8 threads e fio em janela controlada, use `JM_MAINTENANCE_APPROVED=1 bash ops/vps/benchmark-maintenance.sh core8 before` somente após validar VNC e carga de produção. Na Plus 6, use `plus6`. Isto não significa ausência de impacto: o modo manutenção pode elevar CPU e I/O temporariamente. Não use fora de janela autorizada.

Execute `bash ops/vps/ssh-fido2-preflight.sh` em cada VPS antes de configurar certificados; o script é somente leitura e **não comprova** acesso VNC, autenticação sudo interativa ou PIN/toque FIDO2. Não desligue root antes dos quatro logins físicos e testes negativos.

Após realizar as duas medições na mesma VPS, compare `python3 ops/vps/compare-results.py CAMINHO_BEFORE CAMINHO_AFTER`. O comparador rejeita perfis distintos e comparações entre máquinas, e não inventa categorias faltantes.

Os arquivos de resultados são locais e privados; não incluí-los em commits, issues ou logs públicos sem revisão de dados operacionais.

## Diagnóstico externo pelo Windows (PowerShell 5.1)

O script `ops/vps/windows-client-probe.ps1` mede **somente** tempos de conexão TCP/22 dos dois IPs e TTFB de URLs HTTPS públicas. Executar localmente no Windows:

    powershell.exe -NoProfile -File .\ops\vps\windows-client-probe.ps1

Não realiza login SSH, leitura de processos, uso de CPU, memória, benchmark NVMe nem vazão WAN. Falhas de conexão ficam contabilizadas, sem abortar a coleta inteira; gera JSON local privado na pasta Downloads. Jamais usar p50/p95 TCP ou TTFB público como benchmark da CPU da VPS.

Quando o SSH retorna `Permission denied (publickey)`, a autenticação foi recusada apesar de TCP/22 estar acessível. Consulte `ops/vps/SSH-PUBLICKEY-RECOVERY.md` para a recuperação correta via VNC root da Contabo. Não habilitar login SSH root por senha para contornar a recusa.

O trabalho de infraestrutura foi incorporado ao PR de integração #123. Evite novos merges independentes do PR #122 ou duplicação de arquivos.
