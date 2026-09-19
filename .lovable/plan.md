# Conclusão total: gráficos, engine, Worker, narração, UI/UX, SEO e validação

## Resultado esperado
Entregar uma atualização integrada da partida e do jogo inteiro, sem migração de engine e sem reduzir recursos já existentes. A prioridade será estabilidade e fluidez; o nível visual sobe de forma escalável conforme o aparelho. O padrão continua Three.js/R3F com WebGL2 estável e WebGPU experimental com retorno automático.

## 1. Corrigir a base e fechar bugs da engine
- Reproduzir e corrigir falhas atuais de física, jogadores, bola, goleiros, colisões, posicionamento, câmera e mudança de velocidade.
- Tornar a simulação determinística por seed e estável em passo fixo, inclusive em 1x, 2x, 4x, 8x, pausa, troca de aba e retorno.
- Revisar chute, passe, domínio, desarme, interceptação, rebote, bola aérea, efeito Magnus, defesa e reposição para evitar atravessamentos, teleporte, bola presa e jogadores sobrepostos.
- Melhorar decisão e posicionamento da IA: linhas compactas, cobertura, pressão, desmarque, transição, último homem, saída do goleiro e reação ao placar/cansaço.
- Reduzir alocações por passo, limitar históricos e limpar estados temporários para impedir pausas de coleta de memória e acúmulo em partidas longas.
- Criar testes determinísticos para placar, posse, cartões, finalização, substituição, término e integridade dos atributos.

## 2. Worker completo da simulação ao vivo
- Transformar o Worker existente em um controlador persistente com comandos para iniciar, pausar, retomar, velocidade, tática, substituição, pular e encerrar.
- Executar toda a física/IA ao vivo fora da linha principal quando Worker estiver disponível.
- Enviar snapshots compactos e sequenciais em frequência limitada; manter na tela dois estados e interpolar jogadores e bola suavemente entre eles.
- Enviar eventos apenas uma vez, com identificador crescente, evitando repetição da narração e do feed.
- Entregar no resultado final estatísticas, eventos, notas, artilheiros, mapa de chutes e dados necessários ao avanço da carreira e replay.
- Compartilhar o mesmo controlador entre carreira e partida rápida, removendo os laços duplicados da linha principal.
- Implementar watchdog, timeout, recuperação e retorno local seguro; encerrar timers/listeners/Worker ao sair da partida.
- Fazer o botão “pular” usar o Worker, sem congelar a interface.

## 3. Salto gráfico escalável
### Iluminação e sombras
- Recalibrar luz solar, hemisférica, rebatedora e refletores por dia, entardecer, noite e clima, preservando tons de pele e uniformes.
- Melhorar sombras com cascata visual por distância: alta definição perto da jogada, menor custo longe, bias estável e contato no gramado.
- Eliminar sombras tremidas, acne, vazamento de luz, áreas estouradas e médios esmagados.

### Texturas, materiais e definição
- Criar presets reais por qualidade para gramado, linhas, desgaste, lama, arquibancada, concreto, redes, placas, bola, pele, cabelo e tecidos.
- Melhorar normal, roughness, anisotropia, mipmaps e filtragem sem carregar mapas grandes em aparelhos fracos.
- Reutilizar texturas e materiais, liberar recursos no descarte e impedir duplicação em memória.
- Manter pós-processamento seletivo: antialiasing, bloom, vinheta, profundidade e gradação apenas onde houver orçamento.

### Gramado, estádio e torcida
- Corrigir fibras, vento, marcas e poças; variar densidade por distância e ocultar o que não aparece na câmera.
- Melhorar redes, bandeiras, placas, arquibancadas e atmosfera com instancing, LOD e atualização reduzida.
- Melhorar anatomia e variedade dos torcedores sem multiplicar draw calls.

### Jogadores e animações
- Refinar proporções de tronco, ombros, braços, mãos, quadril, joelhos, pernas, pés, rosto, cabelo e silhuetas por biotipo.
- Melhorar pele, cabelo, olhos, uniformes, chuteiras, números e detalhes com materiais compartilhados e níveis de detalhe.
- Implementar máquina de transições contínuas entre parado, caminhada, corrida, sprint, giro, domínio, passe, chute, cabeceio, desarme, queda, defesa e comemoração.
- Usar inclinação, passada, apoio dos pés e orientação independentes do FPS; evitar deslize dos pés e membros atravessando o corpo.
- Atualizar esqueletos distantes em frequência menor e congelar animações fora da visão sem causar “pulos” ao reaparecer.

### Câmera e cutscenes
- Melhorar câmera de transmissão com antecipação, amortecimento, enquadramento de bola alta, gol e replay sem enjoo.
- Refinar as 25 cenas e 25 cenas híbridas existentes com enquadramento, profundidade, luz, transições, som e identidade do clube.
- Garantir “Pular”, redução de movimento, duração curta e carregamento progressivo.

## 4. FPS, qualidade adaptativa e teste em GPU real
- Evoluir o medidor para FPS atual, média, 1% low, frame time médio/p95, travamentos, duração e quedas de qualidade.
- Registrar backend, renderizador/adaptador permitido pelo navegador, resolução, DPR, nível solicitado/efetivo, sombras, pós-processamento e contagem aproximada de triângulos/draw calls.
- Adicionar no HUD um teste iniciado pelo usuário, com aquecimento, janela de medição, resultado “estável” ou “ajustar”, copiar e baixar relatório local sem dados pessoais.
- Fazer a qualidade adaptativa reagir por etapas: pós-processamento e DPR, torcida/partículas, sombras, grama e distância visual — evitando alternância constante.
- Rodar teste de partida longa em 1x e testes de estresse em 4x/8x, verificando memória, mensagens do Worker, relógio, replay e responsividade.
- Executar a medição neste ambiente e identificar se é GPU física ou renderizador por software. Resultado de SwiftShader/software será marcado como não representativo.
- Deixar o teste pronto para GPU física no aparelho do usuário. Meta operacional: 40–60 FPS adaptativos; 79/189 FPS serão registrados quando o hardware suportar, nunca prometidos universalmente.

## 5. Narrador muito mais variado e realista
- Ampliar o catálogo para pelo menos três vezes a variedade anterior em PT-BR, EN e ES, sem repetir frases recentes.
- Cobrir contexto de início, posse, pressão, passe, lançamento, cruzamento, escanteio, chute, defesa, trave, gol, gol contra, impedimento, falta, amarelo, vermelho, pênalti, lesão, substituição, VAR, acréscimos, intervalo, fim, empate, virada e gol tardio.
- Selecionar fala por minuto, placar, importância, sequência do lance, equipe, jogador, momento e nível emocional.
- Controlar fila e prioridade: gols/cartões interrompem comentários menores; lances vencidos são descartados; nenhum áudio sobreposto.
- Manter texto fechado e validado no servidor, cache limitado e voz em nuvem ligada ao botão, com retorno para voz do navegador quando necessário.
- Testar ligar/desligar, idiomas, repetição, atraso e consumo de memória durante 90 minutos.

## 6. Redesign completo e acessibilidade
- Manter a direção “Gramado premium cinematic”: #0a0f0c, #123322, #22c55e, #eafff2, Archivo Black + Hind; dourado somente para conquista/raridade.
- Revisar partida, painel da carreira, elenco, tática, loja e campeonato com hierarquia mais clara, informação escaneável, ações principais evidentes e estados de carregamento/erro/vazio.
- Melhorar HUD da partida: placar compacto, pressão, eventos, estatísticas, banco, tática, câmera, qualidade, narração e teste de desempenho sem cobrir o campo.
- Melhorar mobile/tablet/desktop: áreas de toque de 44 px, gavetas adequadas, tabelas adaptadas, textos sem corte e sem rolagem horizontal.
- Remover cores rígidas novas e usar apenas tokens semânticos do sistema visual.
- Garantir teclado, foco visível, rótulos, landmarks únicos, contraste, `aria-live`, mensagens de erro associadas e redução de movimento.

## 7. SEO, indexação e páginas públicas
- Inventariar todas as rotas de conteúdo e garantir título, descrição, OG, Twitter e canonical únicos e coerentes.
- Indexar somente páginas públicas úteis; manter jogo, conta, editores e telas pessoais como `noindex` quando apropriado.
- Padronizar guias, Sobre, Criador, ligas, dicas, contato, privacidade e termos com conteúdo útil, índice, FAQ, autoria de Davi Andrian Thomazini e CTAs “Jogar agora”/“Criar clube”.
- Atualizar sitemap, robots e ligações internas; remover títulos/descrições repetidos e páginas órfãs.
- Revalidar dados estruturados e a descrição central: jogo de futebol manager online em 3D, simulação tática avançada, carreira realista, transferências e 115 ligas globais.
- Preparar submissão para mecanismos de busca; reconhecer que rastreamento e indexação final dependem deles.

## 8. Dados, loja, conta e fluxos já pedidos
- Revalidar elencos, fotos, uniformes e escudos importados; usar apenas dados disponíveis/licenciados e registrar claramente clubes ainda sem fonte.
- Não bloquear esta atualização por APIs pagas: manter reservas existentes e separar a lacuna externa de 415 clubes quando a assinatura não cobrir esses dados.
- Revalidar autenticação, perfil, salvar na nuvem, compartilhar, contatos, PWA e retorno pós-partida.
- Reexecutar compra real ponta a ponta em ambiente seguro: checkout, retorno, entrega idempotente de moedas/impulso, atualização do saldo e prevenção de entrega duplicada.
- Não incluir telefone ou SAML sem infraestrutura/metadados reais; não inventar métodos que o provedor não oferece.

## 9. Validação final
- Tipos, lint, testes e compilação sem erros.
- Testes no navegador para carreira e partida rápida: início, pausa, velocidades, tática, substituição, narração, câmera, pular, relatório, replay e avanço.
- Teste de 90 minutos em desktop e viewport móvel, com console/rede limpos e sem aumento contínuo de memória.
- Comparar visualmente qualidade baixa/média/alta, movimento reduzido e fallback WebGL2/WebGPU experimental.
- Auditar acessibilidade das telas principais e revisar todas as rotas de conteúdo para metadados.
- Atualizar o roadmap com três estados honestos: concluído e verificado; implementado aguardando publicação/indexação; bloqueado por hardware, cota ou licença externa.

## Critérios de aceite
- Com Worker disponível, física e IA ao vivo não executam na linha principal.
- A partida continua jogável se o Worker falhar e o botão “pular” não congela a tela.
- Resultado, narração, replay, notas, mapa de chutes, substituições e carreira permanecem corretos.
- A apresentação melhora em alta qualidade sem comprometer o nível baixo e a adaptação evita oscilações.
- O relatório de desempenho distingue GPU física de renderização por software e pode ser exportado.
- Nenhuma tela principal perde acessibilidade, responsividade ou funcionalidades existentes.
- Todas as páginas públicas têm metadados próprios; telas privadas não competem na indexação.

## Limites honestos
- O sandbox pode não oferecer GPU física; nesse caso, a implementação e o relatório serão validados aqui, mas o número final de GPU real precisará ser gerado no aparelho do usuário.
- 40–60 FPS adaptativos são o alvo prático. 79/189 FPS dependem de GPU, resolução, tela e temperatura e não podem ser garantidos em todos os aparelhos.
- Dados de elencos que exigem plano pago ou licença permanecem bloqueados até a fonte conceder acesso.
- A indexação final depende do mecanismo de busca após publicação e envio do sitemap.
