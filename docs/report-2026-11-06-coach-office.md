# Carreira: interface e modularização

## Entregue
- Trabalho da semana precede os painéis secundários. A seleção mostra a diferença real de moral, condição, forma e pressão de `applyWeekAction`, antes da simulação.
- Só o botão explícito aplica o foco e avança a rodada; ações ficam bloqueadas durante processamento e demissão.
- Histórico usa `matchLog` existente, com temporada, competição, mando, adversário e resultado; não depende de estado transitório da página.
- Indicadores sem cores literais na página, navegação local, tratamento do carregamento inicial e composição para celular.
- `career-lineup.ts` e `career-quick-sim.ts` mantêm exports compatíveis. `career.ts`: 762 → 542 linhas. CSS permanece nas mesmas páginas, dividido em shell, screens e escritório, com ordem original da cascata.
- Pré-carregamento automático do palco cinematográfico removido da tela; cenas continuam carregando quando abertas.

## Evidência
- Comparação JSON exata de 160 escalações, 300 simulações rápidas e 12 rodadas com mesmos dados/sementes, antes/depois.
- 312 arquivos / 1.656 testes aprovados, incluindo dois testes novos do escritório; lint completo sem erros ou avisos.
- Preview registrou `build OK` após a última edição.
- Navegador com conta autenticada: selecionou semana leve, avançou da rodada 3 para 4, três resultados persistiram após recarregar. Desktop 1280×1800 e celular 390×844; sem overflow horizontal, sem sobreposição nos links locais e sem erros de execução. Galeria abre.

## Limites
- Divisão de arquivos não comprova redução de bytes, TTFB, LCP, INP ou CPU. Não há nova medição de Lighthouse nem certificação gráfica física.
- Não houve pagamento real, entrega atômica de serviços, lançamento VIP nem publicação. Stress atualizado de 200 partidas e demais Quality gates continuam obrigatórios antes de lançar.
- As demais etapas abertas estão no roadmap; não foram declaradas concluídas.