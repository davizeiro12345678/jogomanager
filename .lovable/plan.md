# Plano: partida 3D muito melhor, IA mais esperta, moedas úteis, 25 idiomas completos, proteção forte e home rápida

Ordem decidida por você: gráficos e física primeiro. Cada etapa só conta como pronta quando bate a meta da coluna "Pronto quando". Antes de mexer, tiro a medida atual no mesmo cenário (mesma partida, mesma semente, mesma câmera, mesma tela) e repito depois.

## Resumo das metas

| Etapa | O que você vai ver | Pronto quando |
|---|---|---|
| 1. Gráficos da partida | Jogadores atléticos, nome e número nas costas, gramado com faixas e desgaste, rede que balança, torcida que reage | Mesmo ou mais quadros por segundo que hoje no nível Médio; menos chamadas de desenho na visão aberta; zero erro de textura ao iniciar |
| 2. Cutscenes | Sem flash branco, cortes de câmera naturais, nada atravessando as pernas | Zero quadro branco em 10 cenas gravadas; cena aparece em até 1,5 s depois do clique em computador médio |
| 3. Física | Ninguém atravessa traves, colegas ou placas; bola quica e gira de verdade; pés sem patinar | Zero atravessamento em 200 partidas simuladas; mesmos resultados com a mesma semente |
| 4. IA | Times defendem em bloco, contra-atacam, goleiro sai no cruzamento, técnico adversário muda a formação | Médias de 200 partidas dentro da faixa do futebol real (gols 2,4–3,0; chutes 22–28; faltas 20–28) |
| 5. Moedas | Mais coisas úteis para gastar e pacotes que valem mais | Cada uso novo testado no servidor, com limites; nada de pagar para ganhar |
| 6. Idiomas | 25 idiomas mais falados sem nenhum texto em inglês "vazando" | Teste automático falha se faltar 1 texto em qualquer um dos 25 |
| 7. Proteção | Anticheat, moderador automático do chat e da partida, antiexploit | Testes de ataque (save falso, moedas falsas, spam, ofensa) são recusados pelo servidor |
| 8. Home e carregamento | Home abre quase instantânea e o botão Jogar aparece primeiro | Nota 95+ no celular, média de 3 medições |

## Etapa 1 — Gráficos da partida 3D (grande salto visual)
### Base
1. Medir: quadros por segundo (média e os 5% piores), chamadas de desenho, triângulos e tempo até a partida aparecer, em 4 tomadas: visão aberta, meio-campo, área com gol e replay.
2. Corrigir primeiro o erro de textura que aparece ao iniciar a partida.

### Jogadores
3. Corpo atlético de perto: ombros, peito, costas, coxas e panturrilhas definidos, com variação por jogador (alto, baixo, forte, magro), sempre a mesma para cada um.
4. Rosto e cabelo: vários estilos de cabelo e barba, formatos de rosto e tons de pele, com brilho de suor no fim do jogo.
5. Uniforme: tecido com dobras, gola e punho, nome e número nas costas nítidos, sujeira de grama nos joelhos ao longo da partida e camisa encharcada na chuva.
6. Animações: corrida, arrancada, freada, giro, passe, chute, cabeçada, carrinho, defesa do goleiro e comemorações com contato correto entre pé e bola.
7. Três níveis de detalhe: completo de perto, médio na transmissão e simplificado de longe, para ganhar desempenho sem perder qualidade onde se vê.

### Campo e estádio
8. Gramado: faixas de corte, marcas de desgaste nas áreas, divots dos carrinhos, brilho molhado na chuva e grama 3D só perto da câmera.
9. Iluminação de transmissão: sol com sombra suave de dia, refletores com quatro sombras à noite, neblina leve no fundo, céu que muda com o horário.
10. Clima: chuva com respingos e poças, neve e vento mexendo bandeiras e rede.
11. Rede e traves: rede ondula onde a bola bateu; traves com reflexo metálico.
12. Torcida: comemora o gol, lamenta a chance perdida, vaia o cartão, mosaico e sinalizadores nos clássicos; de longe vira imagem plana.
13. Estádio: placas de LED animadas, banco de reservas com técnico e reservas, túnel e câmeras na lateral.

### Imagem final
14. Correção de cor de TV, brilho só onde faz sentido, desfoque de fundo nos replays e câmera lenta nos gols.
15. A economia de desempenho é reinvestida nos jogadores próximos. O nível "Alto" não é rebaixado em silêncio.
16. Antes e depois: capturas lado a lado das 4 tomadas e tabela com os números.

## Etapa 2 — Cutscenes
1. Gravar 10 cenas e contar quadros brancos e tempo até aparecer.
2. Eliminar o flash: fundo escuro desde o primeiro quadro e troca de cena só depois de pronta.
3. Câmeras com cortes de transmissão: plano aberto, médio e close, sem saltos bruscos.
4. Adereços e móveis com espaço livre para pernas e braços.
5. Pré-carregar a cena seguinte enquanto o jogador está no menu (já existe; vou estender para todas as cenas).

## Etapa 3 — Física (grande salto de qualidade)
### Bola
1. Física de verdade: arrasto do ar, efeito Magnus (a bola faz curva com o giro), quique com perda de energia, rolagem com atrito diferente em grama seca, molhada e gasta.
2. Tipos de chute com trajetória própria: chapado, colocado com curva, cavadinha, bomba de peito de pé, cruzamento fechado e aberto, cabeçada.
3. Rebote realista na trave, no travessão, no corpo do jogador e na mão do goleiro (espalma, encaixa ou solta).
4. Rede segura a bola e devolve com amortecimento.

### Jogadores
5. Corpo com peso: aceleração, freada, mudança de direção e giro dependem da velocidade e do atributo do jogador (rápido e leve vira mais fácil).
6. Disputas físicas: ombro a ombro, carrinho, puxão de camisa e trombada com resultado conforme força, equilíbrio e momento.
7. Quedas realistas com ragdoll só no visual (o resultado continua decidido pelas regras), levantando de forma natural.
8. Pés travados no chão durante a passada: nada de "patinar".
9. Colisão com jogadores, traves, bancos, placas e o goleiro; nada atravessa.
10. Cansaço muda a corrida: passada mais curta e lenta no fim do jogo.

### Garantias
11. Tudo determinístico: mesma semente, mesmo resultado (protege o online e o anticheat).
12. Teste: zero atravessamento e zero bola "presa" em 200 partidas; trajetórias de chute comparadas com valores reais de velocidade e curva.

## Etapa 4 — Inteligência da IA (grande salto de qualidade)
Já existe: substituições por cansaço, lesão e placar; mudança de postura por placar, tempo e expulsões; corte de pressão quando o time cansa.

### Jogadores
1. Cada jogador "enxerga" o campo: avalia linhas de passe, espaço livre e pressão antes de decidir passar, driblar, chutar ou segurar.
2. Personalidade pelos atributos: um craque arrisca o drible, um volante toca simples, um atacante oportunista ataca a segunda bola.
3. Movimento sem bola: infiltração nas costas, apoio por dentro, ultrapassagem do lateral, atacante puxando o zagueiro para abrir espaço.
4. Defesa em bloco: linhas compactas, cobertura, linha de impedimento coordenada, pressão em grupo ao perder a bola.
5. Goleiro: posicionamento pelo ângulo, saída no cruzamento e no um contra um, reposição rápida para o contra-ataque.
6. Bola parada: jogadas ensaiadas de escanteio e falta, barreira e marcação na área.

### Técnico adversário
7. Estilos reais: posse, contra-ataque, pressão alta, retranca e jogo direto, cada um com comportamento diferente.
8. Lê o seu time: se você domina pelas pontas, ele fecha as pontas; se você pressiona, ele joga mais direto.
9. Ajustes ao longo do jogo: muda a formação no intervalo, faz substituições táticas e "fecha a casinha" quando está ganhando.
10. Dificuldade justa: o nível muda a qualidade das decisões, não dá vantagem escondida nos atributos.

### Validação
11. Médias de 200 partidas dentro do futebol real (gols, chutes, posse, passes, faltas, escanteios, impedimentos).
12. Cada estilo do técnico testado: tem de produzir números diferentes de posse e de chutes.

## Etapa 5 — Moedas e benefícios
Gastos novos:
- Olheiro em outra liga por 1 semana.
- Acelerar a recuperação de 1 lesão (máximo 3 por temporada).
- Sessão extra de treino da semana.
- Relatório tático do próximo adversário.
- Bônus de moral ao renovar o contrato de um jogador.
- Visuais: uniforme especial, placar e iluminação do estádio, mosaico da torcida e comemorações.

Pacotes:
- Pacotes maiores dão proporcionalmente mais moedas.
- Cada pacote ganha 1 item que só existe nele.

Regra fixa: quem decide os gastos é o servidor, com limites por semana e por temporada.

## Etapa 6 — Idiomas
- Completar todas as traduções que faltam nos 25 idiomas mais falados.
- Teste automático que falha se faltar qualquer texto.
- O idioma da página e a direção da escrita (árabe, hebraico, persa e urdu) acompanham a escolha do jogador.

## Etapa 7 — Proteção, anticheat e moderação (reforço massivo)
Princípio: o navegador do jogador nunca é confiável. Tudo que vale algo (moedas, itens, resultados, conquistas, ranking) é decidido e conferido pelo servidor.

### 7.1 Anticheat da carreira e das partidas
- Replay no servidor: partidas que contam para ranking, conquistas ou recompensas são re-simuladas no servidor com a mesma semente. Se o placar enviado diverge, o resultado é descartado e a conta recebe uma marcação.
- Cadeia de saves assinada: cada save carrega o "carimbo" do save anterior (encadeamento por hash). Saves fora de sequência, voltados ao passado ou com lacunas são recusados.
- Limites físicos do jogo: dinheiro, valor de elenco, pontos, gols por partida, temporadas por hora e semanas jogadas por minuto têm tetos plausíveis. Passou do teto, o save é recusado e o caso vai para revisão.
- Tempo real: o servidor confere se a quantidade de partidas cabe no tempo decorrido (ninguém joga 40 temporadas em 5 minutos).
- Pontuação de risco por conta: cada sinal suspeito soma pontos; acima de um nível, recompensas ficam retidas até revisão, em vez de banir de cara.
- Resultado final do online só pelo servidor (já existe; vou estender a todos os modos que dão recompensa).

### 7.2 Antiexploit da economia
- Todo gasto e ganho de moedas passa por funções do banco com trava por pedido: o mesmo pedido enviado 10 vezes conta uma vez só.
- Saldo nunca negativo, garantido pelo próprio banco.
- Limites diários de ganho por fonte (resgate semanal, missões, partidas), tetos por item e por temporada.
- Livro-caixa imutável: cada movimentação fica registrada e só pode ser acrescentada, nunca alterada. Isso permite auditar e desfazer fraudes.
- Compras: entrega só depois da confirmação assinada do pagamento; reembolso e estorno retiram o item automaticamente.
- Detector de padrão: ganhos fora da curva (ex.: 50x a média dos jogadores) geram alerta.

### 7.3 Moderador automático do chat
Hoje o filtro roda só no navegador e pode ser desligado. Vou levar tudo para o servidor:
- Ofensas, inclusive disfarçadas ("p0rr4", "p.o.r.r.a", letras repetidas, acentos trocados), em português, inglês e espanhol.
- Bloqueio de links, convites, telefones, e-mails e dados pessoais (proteção contra golpe e aliciamento).
- Antiflood: máximo de mensagens por minuto, bloqueio de mensagens repetidas e de texto só em maiúsculas.
- Ofensas graves (ódio, ameaça, assédio) analisadas por IA, como segunda camada, só quando o filtro rápido fica em dúvida.
- Punição progressiva: aviso → silêncio de 10 min → 24 h → 7 dias → bloqueio do chat, com o motivo mostrado ao jogador.
- Botão "Denunciar mensagem" e "Bloquear jogador".
- Histórico de infrações para revisão.

### 7.4 Moderação da partida online
- Abandono no meio da partida: derrota automática e penalidade crescente para quem abandona com frequência.
- Detecção de conluio: as mesmas duas contas jogando entre si repetidamente para farmar vitória.
- Contas novas em massa do mesmo aparelho/rede para farmar recompensas ficam marcadas.
- Nomes de clube, treinador e jogador passam pelo mesmo filtro do chat.
- Painel de moderação para administradores e moderadores: fila de denúncias, histórico da conta, aplicar ou retirar punição. Papel de moderador em tabela separada, conferido no servidor.

### 7.5 Blindagem do servidor
- Validação rígida (tipo, tamanho e formato) de tudo que chega em cada função do servidor; entradas fora do formato são recusadas antes de tocar no banco.
- Toda função que mexe em dados de jogador exige login e confere que o dado é do próprio jogador.
- Revisão das regras de acesso de todas as tabelas, com o verificador do banco zerado.
- Cabeçalhos de segurança do site revisados (bloqueio de scripts estranhos, de enquadramento por outros sites e de vazamento de origem).
- Webhooks e rotas públicas só aceitam pedidos assinados.
- Segredos só no servidor; varredura confirmando que nenhum vaza para o navegador.
- Dependências com falha conhecida atualizadas; o que não puder ser atualizado fica listado.
- Varredura de segurança completa no final, com o relatório real.

### 7.6 Testes de ataque
Para cada item acima, um teste que tenta o ataque e precisa ser recusado: save falso, save antigo, moedas inventadas, pedido duplicado, placar adulterado, spam, ofensa disfarçada, link de golpe, conluio e abandono.

Não vou "criptografar" o código do navegador: ele sempre pode ser lido, e embaralhá-lo deixaria o jogo mais lento sem impedir trapaça. A proteção real é o servidor conferir tudo.

## Etapa 8 — Home, estilos e carregamento
1. Medir 3 vezes no celular (hoje: 96 na última medição, com variação até 80).
2. Tirar da home tudo que não aparece na primeira tela: dados de ligas, partes do jogo e animações pesadas carregam só depois.
3. Estilos só do que a home usa; fontes e imagens no tamanho certo.
4. Primeira tela mais clara: botão Jogar em destaque e menos distrações.
5. O mesmo tratamento na página Pacotes (hoje 77).

## Limites honestos
- Quadros por segundo no seu celular: aqui não há placa de vídeo real. Comparo sempre na mesma máquina e você confere no aparelho.
- Nota de velocidade: reporto o número medido, sem arredondar.
- É muito trabalho: vou entregar etapa por etapa, com medição a cada fim.

## Detalhes técnicos
- 3D: reaproveitar R3F, drei, Rapier e pós-processamento já instalados, sem novas bibliotecas; nível de detalhe pelo tamanho na tela; materiais compartilhados e instâncias; contexto visual calculado uma vez por quadro e reutilizado.
- Física e IA: regras puras em `src/game/sim.ts` e `src/game/sim-rules.ts`, com testes; colisão por cápsula com correção limitada; stress de 200 partidas e comparação MatchSim com as mesmas sementes.
- Moedas: regras em `src/lib/wallet-rules.ts` e nas funções do banco (o banco é a autoridade); migração forward em `drizzle/migrations/`.
- Idiomas: teste de completude em `src/i18n/locale-catalog.test.ts`; `lang` e `dir` no elemento raiz.
- Moderação: envio do chat passa por função de servidor; tabelas de infrações e silenciamento com RLS e GRANTs; papel de moderador em `user_roles` com `has_role`.
- Home: carregamento adiado dos módulos de liga e jogo; lista de estilos públicos (`src/public-styles.css`) mantida em sincronia com as páginas leves.
- Gates de desempenho do projeto continuam obrigatórios; nenhum limite afrouxado.
