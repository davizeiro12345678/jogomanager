# Integridade, realismo e apresentação 3D — atualização em 23/10/2026

A versão de entrega foi integrada ao main `78ab7089dd48c2658b39654876570aeebeeb76d5`. A rodada integrada passou em 2.002 testes de 366 arquivos, TypeScript, lint e builds da aplicação e do estúdio. O [relatório de 690 partidas](2026-10-22-simulation-690.md) registra a amostra física final, seus denominadores e os problemas de calibração ainda abertos. O [fechamento de entrega](2026-10-23-delivery.md) registra as verificações finais e os limites de publicação. Resultados de rodadas anteriores não substituem a validação desta versão.

Esta entrega integra alterações por responsabilidade sobre o `origin/main`
`5abde06de8eed679307bb318c96eb29f40dad93d`, sem sobrescrever a cópia de trabalho
anterior, suas variáveis de ambiente ou o histórico publicado. Os resultados
locais, a inspeção de infraestrutura e a publicação do código são evidências
distintas. O commit desta entrega não representa um deploy.

## Defeitos corrigidos e comportamento resultante

| Área | Antes | Depois | Limite da evidência |
|---|---|---|---|
| Linha do gol | Postes físicos deslocados 1,6 m para dentro; alguns gols nominais não cruzavam a linha | Postes na linha renderizada, rede atrás e detecção da travessia da bola inteira | 12 confrontos comparados: 2 divergências anteriores, 0 posteriores; uma trave real preservada |
| Cobrança de falta | Jogador originalmente com a bola podia ocupar o caminho do novo cobrador | Posicionamento legal e distância dos adversários antes da reposição | 33 retomadas indevidas do atacante antes, 0 depois na amostra pareada |
| Passe rasteiro | Solução podia prometer distância além do alcance com arrasto | Trajetória com elevação quando a solução rasteira não alcança o destino | Física e controles focados; decisões sob pressão ainda precisam de calibração |
| Recepção e perseguição | Passador inelegível entrava na disputa e receptor podia ser omitido | Receptor considerado e perseguição dirigida ao ponto de chegada | Mesmo estado, escalações e seeds na comparação |
| Contato e expulsão | Alcance de 2,6 m até a bola e direção inadequada na análise de chance clara | Alcance físico de 1,35 m; direção e cobertura na análise | Não constitui certificação completa das regras do futebol |
| Massa e vento | Massa física da bola divergente da usada no impulso | Bola de 0,43 kg e impulso calculado pela massa do corpo | Testes e replay determinístico, sem mudança cosmética de probabilidade |
| Passos pequenos | Limite mínimo de dt avançava tempo além do solicitado | Intervalos positivos pequenos respeitados | 120 chamadas de 1/600 s voltam a representar 0,2 s |
| Recuperação da partida | Checkpoints físicos anteriores podiam ser aceitos sob outra execução | Revisão de execução 3; rejeição atômica de checkpoint incompatível antes de alterar estado/RNG | Histórico de carreiras concluídas preservado; partida antiga em andamento precisa reiniciar |
| Transporte Worker | Pacote inválido podia consumir buffers; ressincronização podia conflitar com comandos | Reciclagem em finally, IDs únicos, duas ressincronizações e fallback após três erros consecutivos | Testes de recuperação e de confirmação de comandos |
| Análises ao vivo | Cópias completas e atualizações frequentes mesmo sem painel visível | Publicação condicional a cada 500 ms; relatório final completo | Simulação continua sequencial no Worker e com os mesmos ticks |
| Replay e progresso | Dados pessoais exportados podiam ser confundidos com autoridade competitiva | Escopo de proprietário; progresso pessoal permanece não atestado | Recompensas duráveis e resultado competitivo dependem do servidor |
| Compras | Comparação de bônus não correspondia a preço/quantidade | Benefício calculado a partir do catálogo; validação servidor de produto, moeda e valor, preservando journal durável | Nenhuma cobrança real foi executada no QA |
| Backup | Ajuda confundia personalizações do editor com carreira | Ações distintas, prévia do save, validação antes da confirmação e restauração em perfil isolado | Cópia pessoal não transfere compras, identidade autenticada ou conquistas atestadas |
| Importação SportsDB | Falhas de autorização, leitura de mapeamento ou liberação podiam escapar ou permitir continuação indevida | Erros genéricos e falha antes de escrita/avanço, mantendo leases, limites e lotes estáveis | SQL e código preparados; sem aplicar migrações remotas nesta entrega |

## Gráficos e orçamento de execução

| Superfície | Alteração | Controle de custo e compatibilidade |
|---|---|---|
| Rosto próximo | Lábios integrados ao crânio, cavidade bucal rasa, relevo nasal suavizado, junção frontal do couro cabeludo com normais contínuas | Mesmo fluxo de identidade/seed e perfil físico; continua um estilo de jogo, não fotorealismo certificado |
| Cabelo | Tranças com relevo próprio, dreads/rabo com pontas arredondadas, coque reunido e moicano ajustado | Detalhe maior condicionado ao retrato; variantes distantes mantêm custo menor |
| Corpo e uniforme | Clavícula, ombros e transições do torso em vértices existentes; gola mais arredondada | Orçamentos de meshes e materiais preservados nos testes de todas as funções |
| Atletas animados | Pele mesclada, grupos de LOD e animação de cabelo próximo | Contratos de rig, dimensões e aparência do main preservados |
| Arquibancada | Instanciamento em grupos compatíveis | Menos objetos e submissões repetidas; granularidade de culling é uma troca explícita |
| Cutscenes | Sujeitos principais mantêm detalhe; trabalho secundário de atores fora de quadro é agregado | Poses usam tempo absoluto; retomada e cortes devem ser verificados visualmente |
| Texturas | Catálogo KTX2 e variantes de resolução no streamer existente | Retenção, propriedade por renderer e descarte preservados; não cria um segundo streamer |
| WASM | Vento e resposta da rede acrescentados aos kernels existentes | ABI validada antes de expor memória; kernel de rig do main e limites de alocação preservados |
| Métricas das cenas | Intervalos pausados não entram no FPS | Quadro longo enquanto a cena está visível continua contado; o relógio autoritativo não é alterado |

## Catálogo e monetização

| Medida | Valor e significado |
|---|---|
| Competições selecionáveis | 300 |
| Clubes únicos do catálogo | 4.601 |
| Participações em competições | 4.642; o mesmo clube pode participar de mais de uma |
| Registros de clubes legados examinados | 5.234; não é uma contagem de clubes selecionáveis |
| 200 moedas / R$ 4,90 | 40,82 moedas por real |
| 500 moedas / R$ 4,90 | 102,04 moedas por real |
| 1.500 moedas / R$ 12,90 | 116,28 moedas por real: melhor relação entre esses preços |
| 4.000 moedas / R$ 59,90 | 66,78 moedas por real; não recebe a alegação de melhor bônus |

Nomes publicados devem usar a mesma definição e origem. IDs de pessoa e clube,
função explícita, vínculos e migrações são verificados por contratos próprios;
suspeita por nome semelhante não autoriza fundir pessoas distintas.

## Supabase: capacidade observada e decisão

Inspeção somente de leitura do projeto `lguqnwvsfeefxamzeyos`. Nenhuma alteração
de plano, recurso pago, política de autenticação, DDL, dados ou deploy foi feita.

| Indicador | Observação | Decisão/limite |
|---|---|---|
| Primário | AWS m6g.large, Large, 2 vCPU dedicadas, 8 GB, US$ 0,1517/h indicado pelo painel | Manter capacidade atual; amostra não fundamenta outro aumento |
| Amostra de uso, 22/10 | CPU 2%, RAM 38%, 44 de 160 conexões | Instantâneo não substitui série histórica de pico |
| Disco, 22/10 | GP3 59 GB; 9,10 GB usados, aproximadamente 16%; 3.000 IOPS, 312 MB/s configurados | O aumento externo de 25 para 59 GB não foi ação desta entrega |
| Banco, SQL em 22/10 | 8.736.935.059 bytes, aproximadamente 8,14 GiB; 17 conexões, zero esperas de lock e zero deadlocks na consulta | Métrica do banco difere do espaço total do disco |
| Finalização de importação, janela histórica de 24 h em 20/10 | 84.814 HTTP 200; média 318,31 ms, p95 4.182,8 ms; 23 HTTP 500, aproximadamente 8,05 s | Priorizar a consulta/operação específica; os 23 SQL 57014 são compatíveis com timeout. Não são métricas atuais de 23/10 |
| Claim de importação, 24 h | 85.548 chamadas; média 18,05 ms; p95 34 ms | Não demonstra saturação geral |
| Reserva, 24 h | 83.658 chamadas; média 17,25 ms; p95 29 ms | Não demonstra saturação geral |
| Clubes oficiais, 24 h | 52.357 chamadas; média 15,68 ms; p95 26 ms | Caminho de leitura observado rápido |
| Estatísticas acumuladas | Cache 92,11%, 51,06 GB de temporários, 0 deadlocks desde a janela das estatísticas | Não apresentar estes acumulados como valores das últimas 24 h |
| Alteração externa | Reinício do primário e réplica São Paulo em RESIZING durante a inspeção | Não foi ação desta entrega; repetir avaliação após estabilização |
| Histórico do painel | Parte dos gráficos de CPU/IO/rede/conexões não carregou | Capacidade de pico e diagnóstico completo permanecem limitados |

## Reprodução e interpretação

A medição gráfica usa a mesma fixture parada de transmissão, 1.280 × 720,
DPR 1, qualidade Alta, adaptação desligada, 60 s de aquecimento e 300 s de
coleta. Essa fixture mede apresentação/renderização; não mede o custo de uma
partida física dinâmica. O renderer foi confirmado como Intel Iris Xe por ANGLE
Direct3D11, sem SwiftShader. Bytes estimados das geometrias/texturas e heap JS
não são uma medição de VRAM física.

A comparação de uma execução de cada versão é uma observação local. A campanha
de aceitação exige repetições equivalentes e outro perfil de GPU; os resultados
desta entrega não certificam ganho universal de FPS.

O conjunto de 690 partidas mede integridade e distribuição em fixtures amplas.
Cada fixture roda uma vez; reprodução exata é avaliada separadamente pelos
12 jogos pareados, checkpoints e testes focados. 690 partidas não comportam
todos os 4.601 clubes distintos; a validação de todos os 5.234 registros de
escalação é uma verificação de catálogo, não afirmação de que todos jogaram.

O serviço de varredura registrada Codex Security não estava autorizado para a
conta. A revisão desta entrega é uma revisão de código e testes delimitados,
sem certificado de ausência de vulnerabilidades. As migrações SQL preparadas
exigem aplicação e verificação no ambiente remoto para produzir efeito lá.
