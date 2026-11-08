# Plano integrado: carreira, estádio, tutorial, Firebase e dados

## Objetivo e situação

Evoluir o Pro Football Manager 3D sem perder saves, alterar resultados determinísticos ou degradar a experiência móvel. A implementação existente é a referência: o CSS da carreira já tem divisões, o estádio já possui composição própria e o guia do treinador já existe. Conferir o estado de `main` e os PRs antes de cada etapa.

## 1. API-Football e dados

- Ajustar o limite conjunto das reservas para 445.000 por dia UTC e 1.100 por minuto, mantendo os contadores existentes e a diferença para o teto do plano (450.000/dia e 1.200/minuto).
- Confirmar limites por segundo e como o provedor mede janelas; controlar picos entre fronteiras de minuto e outras aplicações que usem a mesma chave. Respeitar respostas 429, cabeçalhos e interrupções por falha.
- Testar concorrência, limites, rollback, repetição, uso anterior no mesmo dia, retomada e acesso restrito em banco isolado. Manter a fila retomável; não reinicializar contadores ou jobs.
- Medir inserções, atualizações, erros, tamanho do banco, armazenamento livre, WAL, CPU e latência antes e depois; 445 mil chamadas não garantem novos registros.
- Aplicar a migração somente após revisão e testes, verificar a versão efetivamente ativa, acompanhar a primeira execução e recuar se houver erro ou pressão no banco. Não alterar o importador TheSportsDB: é outro fornecedor.

## 2. Carreira, interface e CSS

- Mapear as telas reais e os maiores arquivos com seus responsáveis, testes, imports e caminhos de navegação; incluir carreira de treinador e jogador, criando prioridades para tarefas principais.
- Separar comportamento de inicialização, temporadas, escalação, finanças e apresentação em módulos coesos com a API atual reexportada. Preservar as migrações de save e a ordem aleatória.
- Organizar CSS por camadas na ordem atual, consolidar estilos duplicados, estados de carregamento/erro/vazio, foco, alvos de toque e navegação móvel. Fazer revisão visual em celular e desktop, zoom e movimento reduzido.
- Comparar ao menos 30 partidas de mesma semente antes e depois usando fixtures e versões idênticas; conferir estado de carreira e simulação. Medir bundle e tempos; não presumir ganho de performance pela divisão dos arquivos.

## 3. Tutorial completo

- Partir dos guias existentes. Criar capítulos práticos de primeiros passos, elenco, tática, partida, gestão e carreira de jogador, com explicações e caminhos para as telas reais.
- Diferenciar lições verificadas por evidência no save das lições marcadas manualmente. Permitir pular, retomar, reiniciar e acessar ajuda, com navegação por teclado e feedback acessível.
- Persistir progresso por carreira e prever recuperação sem rede. Recompensas só podem ser idempotentes, conferidas pelo servidor e apoiadas em evidências confiáveis; marcações locais não autorizam moedas.
- Testar jornada inicial, retomada, múltiplas carreiras, telas inacessíveis, mudanças de idioma, leitores de tela e sincronização entre dispositivos.

## 4. Estádio e partida 3D

- Manter `Stadium3D.tsx` como responsável pelo Canvas e ciclo de vida e `stadium/StadiumScene.tsx` como composição. Modularizar responsabilidades grandes restantes sem duplicar cenas ou bibliotecas.
- Melhorar iluminação, arquibancadas, atmosfera, câmera e legibilidade de acordo com a capacidade do dispositivo; conferir carregamento, fallback, perda de contexto e liberação de recursos.
- Comparar cenas e medidas em condições iguais, verificar telas preta/branca e reentrada, além de dispositivos móveis físicos quando disponíveis. Não chamar renderização por software de FPS certificado.

## 5. Dependências e segurança

- Inventariar versões, lockfiles, auditoria e avisos de compatibilidade. Atualizar em grupos compatíveis, revisando mudanças de API e regressões; evitar atualizações principais sem migração testada.
- Executar lint sem avisos, build, testes da carreira, simulação e renderização, auditoria de dependências e verificações de segurança. Registrar o que mudou e quaisquer falhas anteriores.

## 6. Firebase (projeto Sjsjs)

- Conferir que a identidade e todas as credenciais web pertencem ao projeto `sjsjs-ed490` e ao aplicativo correto. Comparar o conector Lovable, a configuração de runtime e os valores padrão legados, sem misturar projetos.
- Revisar Analytics somente com consentimento, registro de notificações mediante ação do usuário, VAPID e service worker separado do worker offline. Manter Supabase como autoridade existente de autenticação e saves, salvo migração explicitamente projetada.
- Implementar envio FCM no servidor com credenciais de privilégio mínimo, isolamento por usuário, limitação, remoção de tokens e logs sem segredos. Não publicar chaves administrativas no cliente.
- Testar registro, envio de teste, logout, cancelamento, rejeição de permissão e navegadores compatíveis. Marcar cada serviço como ativo somente após verificação real.

## 7. Entrega

- Atualizar PRs sem duplicar implementações. Registrar arquivos, testes e pendências; revisar concorrência com o trabalho da Lovable.
- Passar os gates obrigatórios definidos em `AGENTS.md`, incluindo stress de 200 partidas, replay do banco, comparação de simulação, bundle, testes gráficos e Lighthouse. Não enfraquecer limites para permitir merge ou publicação.
- Validar o SHA da versão publicada em `/api/health` e registrar medições antes/depois. Nenhum resultado sem medição deve ser anunciado como concluído.

## Estado conhecido em 7 de novembro

- PR #125 é rascunho com modularização parcial de CSS e carreira e textos do tutorial; não equivale à conclusão das etapas acima.
- A base de produção media aproximadamente 18,25 GB e `api_football_data` aproximadamente 14,97 GB na consulta pontual; falta série temporal para afirmar crescimento em bytes.
- A fila da API-Football atingiu 74.500 reservas nos três últimos dias. Os recibos informam 74.489 inserções em 7/11, 74.496 em 6/11 e 74.500 em 5/11 (dias UTC). O estado deve ser novamente medido antes de concluir a migração.
- A migração 0057 usa um contador diário UTC e uma janela móvel compartilhada para o importador, a fila e as consultas de clubes e elencos. Antes da atualização, a fila limitava cada invocação a 120 pedidos e espaçava chamadas em 350 ms. Veja a configuração gradual abaixo.
- O Firebase Cloud Messaging v1 está ativo no Sjsjs e o conector Lovable mostra Web Push vinculado ao jogo. O App ID usa o remetente do Sjsjs. Falta testar a inscrição e a entrega em um navegador com a versão publicada.

## Configuração da fila Custom450

A migração 0057 conserva as reservas já registradas e aplica 445.000 por dia UTC, 1.100 em uma janela móvel de minuto e até 19 reservas em um segundo. A ativação preserva a pausa e os leases existentes. Quando a fila está pausada até 00:00 UTC, a primeira retomada ocorre às 21h no horário de Vitória.

- A Edge Function mantém três lanes como padrão e uma lane no piloto administrativo. A variável `FOOTBALL_IMPORT_LANES` permite subir até 16 sem alterar a frequência do cron. Avalie 3, 8, 12 e 16 com a mesma janela de medição e recue ao primeiro sinal persistente de 429, erros de escrita, contenção ou pressão sobre CPU e WAL.
- O teto por invocação é 40 chamadas por lane, com espaçamento de pelo menos 55 ms e prazo de 45 segundos. Em 16 lanes, o teto teórico é 640 por invocação. Alcançar 445.000 por dia exige em média 309,03 chamadas por minuto no conjunto de clientes. Meça a taxa observada em produção após o canário.
- Uma resposta 429 com saldo diário confirmado em zero pausa a fila até a próxima virada UTC. Outros 429 interrompem a janela atual e preservam o trabalho para nova tentativa.
- Antes de aplicar, confirme o projeto, a migração ainda pendente e o limite retornado pelo provedor. Depois, compare o uso registrado, os recibos, o tamanho de `api_football_data` e do banco, os erros, a latência de gravação e a saúde do disco. Para recuar o worker, configure novamente três lanes. A reversão de quota deve ser uma migração de avanço que preserve os contadores.

## Bastidores, compras e qualidade dos dados

- A mesa de decisões apresenta situações de diretoria, comissão técnica, vestiário e torcida. Cada rodada aceita uma escolha por clube. A meta de somar pontos é revisada após a partida e seu resultado fica na memória da carreira.
- O histórico oferece filtros, atualização manual e consulta automática espaçada para pagamentos recentes. O retorno consulta a entrega pelo identificador da sessão na conta autenticada. As permissões de entrega continuam no webhook.
- Uma amostra de 16.870 partidas da API-Football encontrou dois registros com o mesmo clube nos dois lados. A migração 0058 protege novas gravações e preserva o histórico para correção. O catálogo descarta esses jogos do painel do clube e os importadores filtram registros com oponentes inválidos.
- Na amostra operacional de 7 de novembro, havia 9 conexões de cliente para o limite de 90, nenhuma espera por bloqueio e nenhum alerta no assessor de saúde. A atualização dos agregados de lesões rodou 24 vezes em 24 horas, com média de 31,22 s e máximo de 33,48 s. A leitura usa o índice existente. Antes de redimensionar, confirme CPU, memória, IOPS e latência em janelas de importação e de pico.
- O projeto PostHog conectado registrou 393 eventos do domínio em 14 dias. A configuração mantém o consentimento revogável, remove parâmetros e fragmentos das URLs e evita carregar recursos de coleta que o jogo não usa.

## Correções da regressão de carregamento

- O PostHog carrega a distribuição leve empacotada e continua com consentimento, limpeza de URL e eventos explícitos. Os módulos de recuperação da simulação são importados somente quando o caminho local é necessário.
- A carreira apresenta a última avaliação da diretoria na mesa de decisões. O atalho de teclado para o conteúdo usa posicionamento lógico para seguir o idioma da página. Os guias móveis usam fundo opaco e evitam desfoque na barra fixa.
- A comparação local com a mesma máquina e a mesma instalação de dependências aprovou os limites de JavaScript. Brotli total caiu de 2.201,5 para 2.169,9 KiB. A entrada da partida 3D caiu de 550,1 para 536,3 KiB. O orçamento e as asserções do CI seguem aplicáveis.
- O catálogo público de escudos e uniformes usa uma leitura sem sessão. O endpoint e o RPC anterior compartilham a consulta paginada e o cache do servidor. As páginas de erro são carregadas sob demanda e a página inicial usa um único atalho de teclado para pular a navegação.
- A migração 0059 introduz um índice parcial para a classificação mais recente por liga. As 12 ligas verificadas no Supabase tiveram o mesmo resultado com a condição nova. Em banco isolado, o plano usou o índice e preservou o resultado e a permissão do serviço. Em produção, crie o mesmo índice com `CONCURRENTLY` em sessão separada antes de aplicar a migração, para evitar bloquear a fila de importação durante a construção do índice.
