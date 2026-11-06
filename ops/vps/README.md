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

## Segurança e erradicação de malware

Auditoria interna conservadora (não destrutiva, exige acesso autenticado na VPS):

    bash ops/vps/security-audit.sh core8
    bash ops/vps/security-audit.sh plus6

Varredura ClamAV completa de diretórios selecionados (carga expressiva; apenas com janela aprovada):

    JM_SECURITY_FULL_SCAN_APPROVED=1 bash ops/vps/security-audit.sh core8

A auditoria reúne portas, processos (sem argumentos/segredos), serviços, timers, cron e executáveis temporários; ClamAV, quando disponível, não apaga arquivos por conta própria. Nomes suspeitos e resultados AV requerem confirmação para evitar falsos positivos.

Após confirmação independente e exata de um binário malicioso (SHA-256, PID executando o arquivo, caminho absoluto), o script a seguir mata o processo e **apaga permanentemente o arquivo, sem quarentena**, bloqueando caminhos centrais do sistema operacional:

    sudo bash ops/vps/erase-confirmed-malware.sh plus6 /caminho/absoluto/binario 64_HEX_SHA256 PID

**ATENÇÃO:** se houve execução de minerador com privilégios root, apagar o binário não recupera a confiança no sistema. Preservar metadados de incidente, reprovisionar com imagem confiável e rotacionar chaves/tokens são indispensáveis. Nunca executar um processo de remoção apenas porque um nome de processo parece suspeito.

### Situação externa verificada em 06/11/2026

- SentinelX conectado somente ao Windows WCOM-457; não havia agente Linux autenticado disponível em nenhuma das VPS.
- Autenticação SSH de root/jmadmin recusada por chave pública no acesso via Windows.
- Uma sondagem externa de 19 portas TCP comuns por VPS encontrou apenas SSH/22 acessível a partir do WCOM-457; isso **não prova ausência de portas abertas fora dessas 19 nem ausência de malware**.
- Porta 443 diretamente nos IPs não respondeu à sondagem, mas domínio principal e catálogo retornaram HTTP 200 via Cloudflare.
- Tunnel `jogomanager-vps-catalog-20261026` ainda inativo, zero conexões; DNS de catálogo permanece proxied A para 194.163.188.190. Não modificar rota ou habilitar failover antes dos gates de segurança.
- Não há benchmark CPU/RAM/NVMe atual de 06/11/2026 nas VPS; somente medições TCP/HTTP externas. A Plus 6 permanece **não elegível para produção/failover** enquanto persistir a suspeita histórica de execução de minerador root.

## Preparação para integração Cloudflare + Supabase (06/11/2026)

Executar **somente na VPS autenticada** (não no Windows ou WSL):

    bash ops/vps/supabase-cloudflare-preflight.sh core8

Na Plus 6, substituir por `plus6`, mas **não instalar segredos nem habilitar tráfego de produção** até que o incidente histórico de minerador root seja resolvido.

O preflight mede HTTPS, TLS e tempos DNS/conexão/TTFB entre a VPS, a API pública do Supabase e o catálogo via Cloudflare, além do health check de `127.0.0.1:3092`. Não usa nem imprime tokens. Não altera rotas, DNS, o banco ou o firewall.

Estado da infraestrutura consultado em 06/11:
- Supabase `JogoManager - Produção`: `lguqnwvsfeefxamzeyos`, projeto saudável na região `us-west-2`. A distância potencial até as VPS europeias deve ser medida antes de decidir conexão PostgreSQL direta versus Data API/Edge Functions.
- Cloudflare Tunnel `jogomanager-vps-catalog-20261026` inativo. O túnel `54ette54` está saudável, mas seu papel no catálogo não está confirmado.
- O DNS do catálogo continua como A proxied para a VPS 8; ingress do túnel do catálogo aponta `https://127.0.0.1:443` com fallback 404. O gateway conhecido espera 3092. Não ativar sem verificar o proxy e health do servidor.
- Advisors do Supabase: aviso de função pública `SECURITY DEFINER` executável por `authenticated` (`mutate_player_career`) e exposições de schema GraphQL. Esses avisos precisam de revisão de política e autorização, não de uma revogação cega. Algumas tabelas públicas de catálogo são públicas intencionalmente.
- Sem chave SSH privada no perfil Windows auditado, agente SSH sem identidades disponíveis e sem sessão de terminal existente. Login SSH administrativo recusado por `publickey`. A recuperação deve seguir pelo painel Contabo autenticado, VNC atual ou Rescue com preservação dos dados.

A configuração definitiva deve manter chaves de serviço e senhas **somente em servidores confiáveis**, nunca no frontend, no GitHub ou em outputs de logs; proteger RLS, rotas e identidades antes de habilitar o tráfego. Um teste HTTP 200 no domínio via Cloudflare não prova a saúde da origem da VPS.
