# HTTP do catálogo: medições e ajuste em 28/10/2026

## Configuração e segurança

- O Nginx de produção tinha `worker_connections 4096`, mas os oito workers herdavam limite flexível de apenas 1.024 arquivos abertos. Foi aplicado `worker_rlimit_nofile 65535`; após reload, os oito novos workers exibiram 65.535. `nginx -t`, GET anônimo e rejeição de credenciais passaram. O backup ficou em `/etc/nginx/nginx.conf.pre-nofile-20261028T181832Z.bak`.
- O cache das duas rotas públicas também passou a rejeitar Authorization, Cookie, X-API-Key e X-PFM-Event-Token com qualquer valor não vazio, inclusive `0`. A versão anterior não bloqueava o token de eventos na rota de escudos e as condições antigas tratavam `0` como falso. Backup: `/etc/nginx/conf.d/pfm-catalog.conf.pre-credential-check-20261028T173441Z.bak`.
- Os canários temporários, o executável temporário no VPS e a exceção de firewall restrita ao gerador foram removidos. Os três contêineres do gateway estavam saudáveis após os testes.

## Metodologia

O VPS tinha 8 vCPUs. Foi usado OHA 1.16.0, sem limitador de taxa (`-q` não foi usado), para um número fixo de requisições GET e concorrência indicada abaixo. O CodSpeed CLI 5.6.0 executou cada caso em modo WallTime. O timeout de estabelecimento de conexão do OHA era o padrão de cinco segundos; não é um limite de taxa. O tempo no CodSpeed inclui a chamada SSH, a inicialização do processo e requisições de aquecimento; os valores de requisições/s e latência nesta tabela são os dados internos do OHA, não o inverso do tempo total do CodSpeed.

Os testes locais executaram o gerador e o Nginx no próprio VPS: ambos disputam as mesmas 8 vCPUs. No teste HTTPS de produção foi validado o certificado Cloudflare Origin CA, mantendo o hostname correto. O canário comparativo usou HTTP em loopback, gzip nível 2, o mesmo corpo de escudos, 3 réplicas do gateway e servidores Nginx isolados sem logs de acesso; o cenário sem cache Nginx ainda usa o cache interno dos gateways. O canário não representa TLS, Cloudflare, latência da internet ou capacidade comprovada de usuários do jogo. Cada réplica do gateway continua limitada a 1 vCPU.

## HTTPS de produção em loopback, antes e depois do limite de arquivos

50.000 requisições, 4.096 conexões simultâneas, corpo comprimido de 359 bytes. Todas as respostas foram HTTP 200; nenhuma falha foi observada.

| Rodada | Respostas/s | p99 | CPU total média do host |
| --- | ---: | ---: | ---: |
| Antes, 1 amostra | 8.939 | 3,974 s | 77,14% |
| Depois, 1 | 12.873 | 2,282 s | 90,10% |
| Depois, 2 | 14.380 | 1,851 s | 90,90% |
| Depois, 3 | 7.744 | 4,484 s | 77,55% |

A mediana das três rodadas posteriores foi 12.873 respostas/s, mas há apenas uma rodada anterior e grande variação posterior; não é possível atribuir a diferença integralmente à alteração. A [comparação CodSpeed](https://app.codspeed.io/davizeiro12345678/jogomanager/runs/compare/6ae23c5337e925a8af64557e..6ae23c9437e925a8af645582) mostra o tempo do comando completo com SSH, não o throughput do OHA.

## Comparação do cache no canário local

30.000 requisições por rodada, 1.024 conexões, três rodadas alternadas por cenário. Todos os 180.000 pedidos retornaram HTTP 200 sem erro. O corpo bruto do cenário sem cache e com cache teve SHA-256 idêntico, `c64411e0335db13258a99ec235240d002955c673f3647d03d5db876a0482c34a`; o cenário com cache mostrou MISS e depois HIT.

| Cenário | Respostas/s nas três rodadas | Mediana |
| --- | --- | ---: |
| Sem cache Nginx | 8.113; 6.572; 11.627 | 8.113 |
| Com cache Nginx | 19.846; 32.515; 30.307 | 30.307 |

A razão das medianas foi aproximadamente 3,74× no canário, com variação relevante entre rodadas. Isso mede o efeito do cache Nginx já implantado, não uma nova melhoria causada pelo ajuste de limite de arquivos.

Uma rodada maior com cache, 300.000 requisições e 4.096 conexões, retornou todas HTTP 200, a 38.623 respostas/s, com p99 de 343 ms, CPU total média do host de 94,47% e steal de 0%. O gerador e o servidor compartilhavam o VPS; a medição não estabelece a capacidade máxima absoluta. [Resultado CodSpeed](https://app.codspeed.io/davizeiro12345678/jogomanager/runs/6ae23d5937e925a8af6455bd).

## Teste externo para a origem HTTPS

O gerador estava em outro computador, usando o IP de origem de forma explícita e validando a cadeia do certificado. Os resultados incluem a rede, ao contrário dos testes de loopback. Há uma rodada antes e uma depois por caso; variação da rede impede atribuição causal conclusiva.

| Carga | Antes: HTTP 200 / falhas | Depois: HTTP 200 / falhas | Duração antes / depois |
| --- | ---: | ---: | ---: |
| 30.000 pedidos, 512 conexões | 29.429 / 571 | 30.000 / 0 | 14,751 s / 12,881 s |
| 30.000 pedidos, 1.024 conexões | 27.851 / 2.149 | 29.783 / 217 | 17,256 s / 11,011 s |

Depois do ajuste, a rodada de 512 conexões atingiu 2.329 respostas/s, p99 de 655 ms e zero erros. Na de 1.024 conexões ainda houve 217 falhas (141 timeouts de conexão e 76 resets); portanto não é um resultado sem erros nem prova de capacidade máxima. Os contadores observados do servidor não mostraram crescimento de `TcpExtListenOverflows` ou `TcpExtListenDrops` entre as verificações, mas isso não identifica sozinho a origem das falhas.

O DNS público de `catalog.jogomanager.com` segue inconsistente: durante a validação algumas resoluções falharam e outras retornaram endereços Cloudflare. A imagem fornecida mostra `jogomanager.com` no espaço de trabalho Lovable, não conectado ao projeto. A correção de delegação continua pendente de acesso ao gerenciamento autoritativo.
