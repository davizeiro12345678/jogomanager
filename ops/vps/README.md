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
