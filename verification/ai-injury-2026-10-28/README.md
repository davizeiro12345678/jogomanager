# Evidências: IA, chat, checkout e salas — 28 de outubro de 2026

## Estado da entrega

Alterações preparadas em branch de desenvolvimento. Esta evidência não certifica multiplayer ao vivo autoritativo, moderação contextual completa, antifraude integral ou integração com GPT-6.1 Terra. A publicação depende dos gates obrigatórios do projeto e de verificação ponta a ponta em ambientes apropriados.

## IA do treinador: lesão antes dos 50 minutos

A versão base é `955a1d97`. Antes, a escolha de substituição retornava imediatamente antes dos 50 minutos, inclusive em caso de lesão. A alteração mantém o limite de cinco substituições e a seleção de reserva apto do mesmo setor, mas avalia a lesão antes dessa restrição. A verificação do treinador ocorre a cada aproximadamente 40 segundos de tempo de jogo; a substituição não é necessariamente instantânea no relógio real.

- Cenário controlado: mesma semente e hash de checkpoint inicial, lesão inserida aos 15 minutos e avaliação do treinador. Base: 0 substituições e atleta lesionado em campo. Candidata: 1 substituição e atleta lesionado fora de campo.
- Amostra natural: 20 partidas Flamengo x Palmeiras em cada versão, com as mesmas 20 sementes. As duas versões concluíram 20 partidas e tiveram 11 lesões antes dos 50 minutos. A base fez 0 substituições por lesão nesse período; a candidata fez 11. O placar final mudou em 7 das 20 partidas.
- A amostra usa um único confronto e não estabelece melhora geral na taxa de vitórias, qualidade tática ou realismo. Mudanças de placar não são, por si, evidência de melhora.
- Os arquivos `natural-baseline.json` e `natural-candidate.json` registram os resultados por semente. `scripts/evaluate-injury-ai.mjs` reproduz cada lado: `node --import tsx scripts/evaluate-injury-ai.mjs <diretorio-da_revisao> <saida.json>`. `scripts/capture-injury-scenario.mjs` produz os dados do cenário controlado usado nas visualizações.

## Desempenho e determinismo

A comparação ABBA do construtor usou Node 24.22.0, a mesma fixture serializada, a mesma árvore de dependências e 62 amostras por revisão. Os 21 checkpoints do protocolo coincidiram. CPU mediana: 0,18729 ms na base e 0,18222 ms na candidata; diferença pontual de -2,70%, com intervalo de razão de 99% de 0,924 a 1,044. O teste não detectou regressão acima do limite de 10%; ele não demonstra ganho estatisticamente confirmado nem certifica FPS.

Os resultados e amostras originais do protocolo estão em `match-setup.json`, `match-fixture.json` e `match-sample-*.json`. Os checkpoints cobrem os instantes e sementes do protocolo, não todas as partidas ou estados futuros.

O teste de estresse executou 200 sementes e seus 200 replays independentes; a validação do relatório confirmou a execução e aprovação. O resultado está em `stress-results.json`.

Na verificação local final: `npm test` passou em 296 arquivos e 1.603 testes; lint, TypeScript, build, `bundle:check` e os 18 testes dos contratos de performance também passaram. O workflow completo de publicação, Lighthouse, replay de banco descartável, comparação de bundles entre revisões e testes de ponta a ponta permanecem pendentes.

## Proteções implementadas nesta branch

- Salas: rejeição de identificadores herdados do objeto de clubes; recuperação de confirmação parada após 120 segundos; token de execução para impedir que um processamento antigo publique ou libere uma confirmação mais recente; proteção da semente quando a saída da sala concorre com a confirmação. O navegador do anfitrião tenta recuperar a confirmação periodicamente.
- Chat global: filtro determinístico antes da gravação no servidor para uma lista limitada de insultos e expressões de ameaça, com normalização de alguns disfarces. Mensagens antigas também são filtradas na apresentação. A ação que só ocultava a mensagem no aparelho deixou de se apresentar como denúncia enviada.
- Chat da sala: validação de formato, limite de tamanho e filtro no cliente para envio e recebimento. O canal continua sendo broadcast sem autenticação de emissor ou moderação autoritativa no servidor.
- Compras de contas conectadas: reserva do mesmo limite transacional já usado por visitantes, cinco tentativas a cada 15 minutos por conta. O limite fecha em caso de falha na consulta. Não é proteção por IP, detecção de cartões testados entre contas ou análise de disputas.

Em consulta somente leitura ao banco vinculado ao site, o limitador existia, apenas `service_role` podia executá-lo, clientes autenticados não tinham INSERT direto no chat nem UPDATE direto nas salas e não podiam ler a tabela das sementes. A consulta não testa o fluxo completo de compra ou sala.

Durante a implantação, execuções ainda ativas de uma versão antiga não verificam o novo token de confirmação. A promoção exige drenar ou aguardar essas execuções antes de testar a recuperação de uma sala antiga; o token não corrige retroativamente o código antigo.

## Limitações de validação

A simulação visual do multiplayer ainda ocorre em cada navegador com uma semente de apresentação, e o servidor calcula outro resultado no final. Os comandos táticos não são compartilhados por um processo autoritativo em tempo real. A lista de moderação pode produzir falsos positivos e perder mensagens ofensivas por contexto ou disfarce. A identificação de quem envia mensagens pelo canal da sala pode ser falsificada. O navegador de testes não conseguiu abrir o site público nem o servidor local, portanto as visualizações entregues mostram dados do motor em 2D e não são gravações do jogo 3D ou de uma partida online.

A troca para GPT-6.1 Terra, testes com duas contas reais, pagamentos Stripe em sandbox, reconexão e perda de pacotes, revisão de falsos positivos, moderação contextual, recuperação operacional e os demais gates de produção continuam pendentes. Nenhuma configuração de conta ou compra foi alterada.
