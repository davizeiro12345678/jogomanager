# Grande pacote: competições, simulação, loja e visual

O pedido é grande demais para um único ciclo de 12 créditos. Vai em 6 ciclos, nesta ordem (primeiro o que funciona, depois o que fica bonito). Cada ciclo termina com as verificações do jogo passando e um resumo do que foi medido e do que não foi.

## Ciclo 1 — Mais 89 competições e estatísticas
- Adicionar mais 89 competições: Série C e Série D montadas com clubes brasileiros reais (lista própria, porque o TheSportsDB não tem essas ligas), os estaduais que faltam (Paulista A2, Carioca, Mineiro, Gaúcho, Catarinense, Goiano, Cearense, Alagoano etc.) e as divisões de acesso de países que ainda não têm (Itália Série C, Espanha Primera Federación, Portugal Liga 3, Holanda Eerste Divisie, Argentina Primera Nacional, MLS Next Pro, J3, K League 2 e outras).
- Ligar as competições em pirâmides de acesso: o Brasil fica Série A → B → C → D e os estaduais funcionam como classificatórios.
- Estatísticas por temporada: rodar de novo a importação para todos os jogadores do TheSportsDB. Hoje ele só tem esses números para cerca de 285 jogadores, então o resultado pode não crescer muito. O overall de quem tiver estatísticas é recalculado com gols, assistências e minutos.

## Ciclo 2 — Overall, regens e checagem das temporadas
- Overall muito mais completo: nota separada por atributo e por posição (ritmo, finalização, passe, drible, defesa, físico, reflexos do goleiro), peso da reputação da liga, forma recente, evolução ao longo da temporada e potencial que depende da idade e dos minutos jogados.
- Regens (jogadores novos gerados): quando um jogador se aposenta, nasce um jovem com nome da mesma nacionalidade, posição parecida e potencial baseado na base do clube, com algumas "joias raras". A aposentadoria depende de idade, físico e nível.
- Checagem de temporada rodando de verdade no fim de cada temporada: nenhum clube ou partida duplicada, número certo de jogos, pontos = vitórias × 3 + empates, promoção e rebaixamento com a quantidade certa, vagas continentais válidas, calendário possível e toda competição com campeão. Se achar erro, corrige sozinho e registra. Com testes.

## Ciclo 3 — Resultados mais realistas e imersivos
- Ajustar a distribuição dos placares pelos números reais (média de uns 2,6 gols por jogo, cerca de 25% de empates, vantagem de jogar em casa, goleadas raras).
- Força do time dependendo de cansaço, moral, entrosamento e tática. Gols contra, pênaltis, expulsões e viradas na hora certa.
- Narração e eventos mais ricos: chances claras, defesas difíceis, bola na trave e avaliação pós-jogo com nota de cada jogador.
- Teste de estresse com 2.000 partidas para conferir as médias.

## Ciclo 4 — Loja: cupons, Pix, cripto e descontos
- Cupons permanentes aplicados pelo servidor (não dá para burlar): boas-vindas, de volta ao jogo, criador de conteúdo e datas especiais. Cada um tem limite por conta e validação.
- Formas de pagamento no checkout da Stripe: cartão, Pix, boleto, Apple Pay, Google Pay e Link. **Cripto:** a Stripe só aceita stablecoin (USDC) em alguns países. Se não estiver liberada na sua conta, ela fica escondida, sem botão que não funcione.
- Descontos: preço promocional com data de início e fim, pacotes combinados e preço riscado na loja.

## Ciclo 5 — Etapas 3, 4 e 5 (o que falta)
- Etapa 3: overall integrado aos elencos importados, com detalhamento visível ao jogador.
- Etapa 4: Intercontinental e Supermundial conferidos numa carreira aberta, mais árvores de copa para as competições novas.
- Etapa 5: telemetria enviando dados de verdade (com permissão) e a central de privacidade conferida no celular.

## Ciclo 6 — Visual: texturas KTX2, iluminação, jogadores e animações
- Texturas em alta definição já compiladas em KTX2 para gramado, arquibancada, rede e uniformes/pele dos jogadores, com versões menores para celulares fracos.
- Iluminação: refletores do estádio mais fortes, brilho (bloom) controlado e tom de cor ajustado para o gramado brilhar sem estourar.
- Jogadores: proporções do corpo mais corretas, pele e tecido com sombreamento melhor, respiração e cansaço visíveis. O detalhe extra aparece só em quem está perto da câmera.
- Transições entre animações mais suaves e completas: correr → parar, virar, receber → chutar, carrinho e comemoração.
- FPS medido antes e depois no painel. Em GPU real vai como "não medido" até você testar no seu aparelho.

## Detalhes técnicos
- Competições: novos arquivos de dados em `src/game/data/`, integrados à pirâmide em `pyramid.ts`. Os IDs dos clubes não mudam, então os saves continuam valendo.
- Overall e regens: funções puras e determinísticas em `src/game/overall.ts` e em um novo `src/game/regens.ts`. `checkSeasonIntegrity` é chamado no fechamento de temporada em `career.ts`.
- Simulação: calibrar `sim.ts` com testes estatísticos em Vitest.
- Loja: tabela de cupons com RLS, validada numa função do servidor que passa `discounts` e `payment_method_types` para a Stripe. O Pix fica só em BRL.
- KTX2: usar o `KTX2Loader` que já vem no three, sem dependência nova. As texturas são compiladas uma vez no sandbox e vão prontas no projeto.
- Restrições mantidas: sem trocar de motor gráfico, sem bibliotecas novas sem motivo e medição antes/depois.

## O que não dá para prometer
- Cripto depende da liberação da Stripe para a sua conta.
- Estatísticas por temporada estão limitadas ao que o TheSportsDB tem.
- O ganho de FPS em aparelho real precisa ser confirmado por você.
