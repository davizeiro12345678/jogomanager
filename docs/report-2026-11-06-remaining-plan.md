# Continuação do plano — 06/11/2026

## Entregas
- Passada visual encurta até 18% com cansaço. Cadência aumenta proporcionalmente à mesma velocidade real para manter o pé apoiado estável; simulação e resultados não foram alterados. Relógio compartilhado entre renderização próxima e distante.
- Chat agora envia a denúncia pela função autenticada existente antes de esconder a mensagem. Falha preserva a mensagem e permite tentar novamente. Controles permanecem visíveis no toque, têm tamanho mínimo de 44 px e usam Button. Preferência de movimento reduzido respeitada ao rolar o chat; estado local é restaurado após montagem, sem divergência SSR.
- Banco valida alvo visível, proíbe autodenúncia, limita dez novas denúncias por hora e serializa concorrência por denunciante. Duplicata continua idempotente pela restrição existente. Migração 0049 aplicada e definição lida de volta.
- Estatísticas opcionais da partida carregam por importação dinâmica ao abrir. Nenhum ganho de bytes ou LCP foi alegado sem comparação de produção.
- Índice 0050 no mercado ordena jogadores canônicos por overall e id, evitando varrer e ordenar todo o catálogo. Não foram removidos dados, índices antigos ou permissões.

## Evidência
- Regressão: 306 arquivos, 1.633 testes aprovados em 416,79 s.
- Stress obrigatório: 200 partidas e seus replays independentes aprovados em 588,884 s; stats, gols, mapa de chutes e eventos idênticos. Isso não certifica atravessamentos visuais nem médias de futebol real.
- Lint completo: zero erros e avisos. Harness registrou build OK após as mudanças.
- Atleta isolado em /visual: cenário pronto no desktop e móvel, sem erros de página ou requests falhos. Corrida e cansaço extremo selecionados pelos controles reais; screenshot do atleta inspecionada. Renderizador SwiftShader, não FPS de aparelho físico. Para avaliar movimento no aparelho, abrir /visual e selecionar Corrida + Exausto.
- Chat autenticado abriu corretamente; estava vazio. Não foram inventadas denúncias de jogadores reais; gravação e leitura de uma denúncia real não foram verificadas ponta a ponta.
- Estatísticas de consultas disponíveis em extensions.pg_stat_statements. Consultas do mercado registravam médias acumuladas de aproximadamente 1.002 e 1.049 ms; janela acumulada, não medição normalizada de tráfego.
- EXPLAIN ANALYZE da mesma consulta (idade ≤25, overall ≥70, ordem overall DESC/id ASC, limite 41): antes 3.597,495 ms e 133.451 blocos em cache; depois 3,040 ms e 124 blocos. Três repetições depois: 0,449 / 0,434 / 0,503 ms. Uma amostra antes, sem garantir speedup universal; plano comprova eliminação da varredura de 201.530 atletas.
- Scan consultado: sem findings abertos retornados; resultados desatualizados e scan de conectores incompleto. Não é declaração de segurança completa.

## Ainda não concluído
- Hash encadeado de saves: não existe hoje. Guarda atual rejeita progresso antigo e usa compare-and-swap; somente servidor pode atualizar careers. Novo predecessor obrigatório precisa integração com fila offline, importação e concorrência, sem usar hash como prova de placar legítimo. Não alterado neste ciclo.
- Restante da modularização, upgrade gráfico/cutscenes, estilos e validação de IA, usos adicionais de moedas, revisão completa de acessibilidade e comparações de carregamento permanecem no roadmap.
- Quality gates completo, comparação ABBA, bundles comprimidos e Lighthouse publicados não executados. Publicação bloqueada e não realizada conforme escolha do usuário.