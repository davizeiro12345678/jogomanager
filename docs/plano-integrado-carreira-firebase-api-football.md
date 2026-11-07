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
- Há chamadas adicionais ao mesmo fornecedor fora das reservas centrais. A fila também limita cada invocação a 120 pedidos e espaça chamadas em 350 ms; aumentar somente os tetos não significa alcançar 1.100 por minuto ou 445.000 por dia. Integrar todos os usos, observar o limite por segundo e testar a capacidade do banco antes de aumentar a velocidade.
