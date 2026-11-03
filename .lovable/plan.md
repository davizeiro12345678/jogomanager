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

## Etapa 1 — Gráficos da partida 3D
1. Medir: quadros por segundo (média e os 5% piores), chamadas de desenho, triângulos e tempo até a partida aparecer, em 3 tomadas: visão aberta, meio-campo e área com gol.
2. Corrigir primeiro o erro de textura que aparece ao iniciar a partida.
3. Jogadores de perto: ombros, peito, coxas e panturrilhas mais definidos; nome e número nas costas nítidos; cabelo e rosto melhores. De longe: versão simplificada, com bem menos peças desenhadas.
4. Bola: pé encostando na bola no chute, rotação conforme o efeito e sombra de contato.
5. Gramado: faixas de corte, marcas de desgaste nas áreas e no meio, mais escuro e brilhante na chuva; detalhe de grama só perto da câmera.
6. Rede: ondula só onde a bola bateu e para sozinha.
7. Torcida: comemora no gol, lamenta a chance perdida, vaia o cartão; de longe vira imagem plana.
8. A economia de desempenho é reinvestida nos jogadores próximos. O nível "Alto" não é rebaixado em silêncio.

## Etapa 2 — Cutscenes
1. Gravar 10 cenas e contar quadros brancos e tempo até aparecer.
2. Eliminar o flash: fundo escuro desde o primeiro quadro e troca de cena só depois de pronta.
3. Câmeras com cortes de transmissão: plano aberto, médio e close, sem saltos bruscos.
4. Adereços e móveis com espaço livre para pernas e braços.
5. Pré-carregar a cena seguinte enquanto o jogador está no menu (já existe; vou estender para todas as cenas).

## Etapa 3 — Física
1. Colisão de jogador com jogador, traves, bancos e placas; empurra só o necessário para não tremer.
2. Bola: perde velocidade na grama (mais na molhada), quique e efeito realistas, rebote certo na trave e no travessão.
3. Corrida com peso: aceleração, freada e virada com inércia; pés sem patinar.
4. Tudo continua determinístico: mesma semente, mesmo resultado. Isso protege o modo online e o anticheat.

## Etapa 4 — Inteligência da IA
Já existe: substituições por cansaço, lesão e placar; mudança de postura por placar, tempo e expulsões; corte de pressão quando o time cansa.
1. Defesa: bloco compacto e linha de impedimento coordenada.
2. Ataque: passe que pesa o risco de interceptação, contra-ataque rápido após roubar a bola e infiltração nas costas da defesa.
3. Goleiro: sai no cruzamento e no um contra um conforme a distância.
4. Técnico adversário: lê o seu estilo (posse, contra-ataque, pressão) e muda a formação no intervalo.
5. Validar com 200 partidas usando a mesma comparação de sempre.

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

## Etapa 7 — Proteção, anticheat e moderação
Anticheat:
- O servidor só aceita resultado de partida, progresso, conquistas e moedas que ele mesmo conferiu.
- Saves com saltos impossíveis (dinheiro, pontos, temporadas) são recusados e registrados.
- Pedidos repetidos ou fora de ordem são ignorados.

Moderador automático do chat (hoje o filtro roda só no navegador e pode ser burlado):
- O servidor bloqueia ofensas (com variações tipo "p0rr4"), spam, links e mensagens repetidas.
- Silenciamento automático: 10 minutos na 3ª infração, 24 horas na 5ª.
- Histórico guardado para revisão.

Moderação da partida online:
- Abandono repetido e resultados contestados geram marcação automática.
- Fila de revisão para administradores e moderadores (papel separado, conferido no servidor).

Antiexploit:
- Validação rígida de tudo que chega ao servidor e cabeçalhos de segurança revisados.
- Varredura de segurança completa no final.

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
