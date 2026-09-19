# Conclusão integrada do plano: Worker, estabilidade e FPS real

## Objetivo
Concluir as pendências verificáveis do plano anterior sem reescrever o jogo: tirar a simulação ao vivo da linha principal, manter controles e relatórios completos, impedir acúmulo em partidas longas e criar uma medição de FPS que identifica claramente a GPU/renderizador usado.

## Implementação

### 1. Worker completo da partida ao vivo
- Ampliar o protocolo do Worker para iniciar, pausar, retomar, alterar velocidade, atualizar tática, substituir jogador, pular e encerrar a partida.
- Rodar a física em passo fixo no Worker e enviar instantâneos compactos em frequência controlada; a tela apenas interpola jogadores e bola entre os dois instantâneos mais recentes.
- Manter retorno automático seguro para a execução local quando Worker não existir ou falhar, sem travar nem perder a partida.
- Usar o mesmo controlador em partida de carreira e partida rápida, eliminando os dois laços de simulação duplicados.

### 2. Estado completo, relatório e narração
- Incluir nos instantâneos eventos incrementais, estatísticas, jogadores, bola e posse; no resultado final, incluir notas, artilheiros, mapa de chutes e súmula.
- Adaptar relatório, replay e narrador para consumir o estado desacoplado, preservando substituições e ajustes táticos em tempo real.
- Limitar filas, histórico e buffers para uma partida longa não aumentar continuamente memória ou trabalho por quadro.

### 3. Estabilidade e fluidez
- Aplicar interpolação visual independente do FPS e limitar recuperação de atraso para evitar “teleporte” após aba oculta ou queda de quadros.
- Suspender Worker/renderização em segundo plano e limpar timers, listeners e Worker ao sair da tela.
- Corrigir qualquer desvio entre relógio, placar, animações, replay e resultado final nas velocidades 1x, 2x, 4x e 8x.

### 4. Medição real de desempenho
- Evoluir o medidor para registrar FPS atual, médio, 1% low, tempo de quadro, duração, qualidade efetiva, resolução, backend e nome do adaptador/renderizador quando o navegador permitir.
- Adicionar teste de desempenho iniciado pelo usuário durante uma partida e relatório copiável/baixável, sem coletar dados pessoais.
- Executar o teste disponível neste ambiente e registrar honestamente se o Chromium usa GPU física ou renderização por software; nunca apresentar SwiftShader como resultado de GPU real.
- Deixar o mesmo teste pronto para validação no aparelho real do usuário, com indicação objetiva de aprovado/ajustar para a meta adaptativa de 40–60 FPS.

### 5. Validação e fechamento das pendências
- Testar partida rápida completa, carreira, pausa, velocidades, tática, substituição, pular, relatório, narração e replay.
- Rodar uma partida longa automatizada e verificar memória, quantidade de mensagens, estabilidade do relógio e ausência de erros.
- Validar desktop e celular, tipos, testes, compilação, console e o backend gráfico disponível.
- Reconciliar o roadmap: marcar o que já foi entregue, separar bloqueios externos reais e deixar aberto somente o que não puder ser comprovado neste ambiente.

## Critérios de aceite
- A física ao vivo não executa na linha principal quando Worker está disponível.
- Falha do Worker recupera a partida sem tela congelada.
- Partida completa termina com placar, eventos, notas, mapa de chutes, replay e avanço da carreira corretos.
- A interface continua responsiva em 8x e após alternar de aba.
- O relatório de desempenho identifica GPU/backend e não confunde software renderer com GPU real.
- Tipos, testes e compilação passam; fluxo principal é verificado no navegador.

## Limite de verificação
Este ambiente pode expor apenas uma GPU virtual/software. Se isso ocorrer, implementarei e validarei todo o teste, registrarei o resultado local como não representativo e deixarei a medição de GPU física pronta para ser executada diretamente no aparelho real, sem inventar números.
