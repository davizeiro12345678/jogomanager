# Plano: gráficos, física e IA primeiro, depois moedas, idiomas, proteção e home

Ordem escolhida por você: gráficos e física primeiro. Cada etapa termina com medição antes/depois no mesmo cenário (mesma partida, semente, câmera e tela) e com os testes do jogo passando. Nada de "parece melhor" sem número.

## Etapa 1 — Gráficos da partida 3D
- Medir a linha de base: quadros por segundo (média e piores momentos), chamadas de desenho, triângulos e tempo de carregamento da partida, em 3 tomadas fixas (visão aberta, meio-campo, área com gol).
- Jogadores: anatomia mais atlética de perto (ombros, peito, pernas), uniforme com número e nome nas costas legíveis, cabelo/rosto melhores só no nível de perto; de longe, versão mais barata.
- Bola: contato pé-bola alinhado, rotação real e sombra de contato.
- Gramado: faixas de corte, desgaste nas áreas e detalhe de grama só perto da câmera.
- Rede e traves: ondulação localizada quando a bola entra.
- Torcida: reage a gol, chance perdida, cartão e apito final; de longe vira imagem plana.
- Corrigir o erro de textura que aparece ao iniciar a partida.
- O nível de qualidade "Alto" não pode ser rebaixado em segredo; a economia vira mais detalhe onde aparece.

## Etapa 2 — Cutscenes
- Medir tempo até a cena aparecer e piscadas.
- Iluminação de transmissão, câmeras com cortes mais naturais, adereços sem atravessar pernas, transições sem flash branco.
- Pré-carregar a próxima cena enquanto o jogador ainda está no menu.

## Etapa 3 — Física
- Jogadores sem atravessar colegas, traves, bancos e placas (colisão por cápsula, com limite de correção).
- Bola: quique, efeito, desaceleração no gramado molhado e choque com traves mais realistas.
- Pés sem "patinar" durante a corrida; viradas e freadas com peso.
- Tudo continua determinístico: o mesmo jogo com a mesma semente dá o mesmo resultado.

## Etapa 4 — Inteligência da IA
- Já existe: substituições por cansaço, lesão e placar; ajuste de postura por placar, tempo e expulsões; corte de pressão quando o time cansa.
- Adicionar: marcação por zona e linha de impedimento coordenada, escolha de passe considerando o risco da linha, contra-ataque quando recupera a bola, goleiro saindo nos cruzamentos, e treinador adversário que muda a formação conforme o estilo do seu time.
- Medir realismo em 200 partidas (gols, chutes, posse, faltas) com os limites atuais.

## Etapa 5 — Moedas e benefícios (equilibrados)
- Vantagens de jogo, sem pagar para ganhar: contratar olheiro em outra liga, acelerar a recuperação de uma lesão (limite por temporada), sessão extra de treino, relatório tático do próximo adversário, renegociar contrato com bônus de moral.
- Visuais: uniformes especiais, melhorias no estádio (placar, iluminação, mosaico), comemorações.
- Pacotes passam a dar mais em troca: bônus de moedas maior nos pacotes grandes e um item exclusivo por pacote.
- Os gastos continuam decididos só pelo servidor, com limites para não haver abuso.

## Etapa 6 — Idiomas
- Completar as traduções que faltam nos 25 idiomas mais falados (hoje parte dos textos cai em inglês).
- Um teste falha se algum desses 25 ficar com texto faltando.
- O idioma da página (lang e direção da escrita para árabe, hebraico e persa) acompanha a escolha do jogador.

## Etapa 7 — Proteção, anticheat e moderação
- Anticheat: resultados de partidas, progresso de carreira, conquistas e moedas só valem quando o servidor confere. Pedidos repetidos ou fora de ordem são recusados, e salvamentos impossíveis (saltos de dinheiro ou pontos) são rejeitados e registrados.
- Moderador automático do chat no servidor (hoje o filtro roda só no navegador): bloqueia ofensas, spam, links e mensagens repetidas, silencia temporariamente quem insiste e guarda um histórico para revisão.
- Moderação de partida online: abandono repetido e resultados contestados ficam marcados, com fila de revisão para administradores.
- Antiexploit: validação rígida de toda entrada que chega ao servidor, cabeçalhos de segurança revisados, e varredura de segurança completa no final.
- Não vou "criptografar" o código do navegador: ele sempre pode ser lido, e isso deixaria o jogo mais lento sem impedir trapaça. A proteção real fica no servidor.

## Etapa 8 — Home, CSS e carregamento
- Meta: 95+ no celular, medida 3 vezes antes e depois.
- Reduzir o que a home carrega no início (dados de ligas e arquivos do jogo que hoje entram cedo demais), estilos só do que a página usa, fontes e imagens otimizadas.
- Melhorar a experiência: primeira dobra mais clara, botão de jogar mais visível, menos distrações.

## O que não vou prometer
- Quadros por segundo no seu celular: aqui não há placa de vídeo real. Vou medir na mesma máquina e você confere no aparelho.
- Nota 98 garantida: vou medir e reportar o número real.

## Detalhes técnicos
- Gráficos: reaproveitar R3F/drei/Rapier/pós-processamento já instalados; LOD por tamanho na tela; materiais compartilhados e instâncias; sem novas bibliotecas 3D.
- Física e IA: em `src/game/sim.ts` e `src/game/sim-rules.ts`, regras puras com testes; stress de 200 partidas e comparação MatchSim com mesmas sementes.
- Moedas: novas regras em `src/lib/wallet-rules.ts` e nas funções do banco (o banco decide), com migração forward em `drizzle/migrations/`.
- Idiomas: teste de completude em `src/i18n/locale-catalog.test.ts` para os 25 idiomas.
- Moderação: função de servidor no envio do chat, tabelas de infrações e silenciamento com RLS e GRANTs, papel de moderador em tabela separada de papéis.
- Os critérios de desempenho do projeto continuam obrigatórios; nenhum limite será afrouxado.
