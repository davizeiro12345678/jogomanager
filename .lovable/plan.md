# Grande atualização: clube próprio, carreira completa, IA, loja e chat

Plano em 5 fases. Cada fase é aprovada e entregue separadamente, para você poder jogar e opinar entre elas.

---

## Fase 1 — Seu clube e seus jogadores

**Criação de clube (nova tela `/clube/novo`)**
- Nome, apelido curto, cidade, país e ano de fundação.
- Escudo montado no navegador: formato do escudo, 2 cores, símbolo e iniciais — com retrato do clube ao vivo, igual ao retrato do treinador.
- Uniforme: padrão (liso, listrado, xadrez, faixa, mangas), cores de camisa/calção/meião, casa e visitante, com prévia 3D no jogador.
- Estádio: nome, capacidade, tipo de cobertura, cor das cadeiras — tudo isso vai direto para o estádio 3D da partida.
- Torcida: tamanho, tipo de canto, cores dos bandeirões e mosaico.
- Escolha da liga onde o clube entra (substituindo um clube existente ou como convidado).

**Jogadores muito mais completos**
- Atributos detalhados por área: finalização, drible, passe, visão, marcação, desarme, cabeceio, velocidade, aceleração, força, fôlego, agilidade, reflexo, posicionamento, saída de gol, liderança, frieza, disciplina.
- Personalidade (profissional, líder, temperamental, ambicioso, caseiro, mercenário) que muda moral, evolução, resposta a conversas e pedidos de saída.
- Ficha do jogador: foto, pé preferido, altura, peso, clubes onde passou, gols/jogos por temporada, lesões, contrato, salário, cláusula, moral, forma, condição física e relação com o treinador.
- Regens: quando um jogador se aposenta nasce um jovem das categorias de base com foto gerada, nome coerente com o país e potencial escondido.
- Fotos geradas por retrato vetorial (rosto, cabelo, barba, tom de pele, cor da camisa) para todos os jogadores sem foto real.

---

## Fase 2 — Carreira de treinador completa

- Temporada inteira: liga, copa nacional, competição continental, pré-temporada, amistosos, janelas de transferência, prêmios de fim de ano.
- Subir de divisão: acesso, rebaixamento, propostas de outros clubes, demissão por pressão, histórico de carreira com troféus.
- Finanças: bilheteria por lotação e importância do jogo, patrocínio, premiação, folha salarial, obras no estádio, orçamento aprovado pela diretoria.
- Pressão: diretoria, torcida e imprensa reagem a resultados, contratações e declarações — com risco de demissão visível.
- Contratações: sondagem, negociação com clube e empolgação do jogador, empréstimos, renovação, cláusulas, agente.
- Eventos dinâmicos que se ajustam ao seu desempenho: rivalidades, crises de vestiário, jogador pedindo para sair, promessa à diretoria, imprensa, contusões, sequências boas e ruins.
- Conquistas (troféus do jogador) com progresso, notificação e vitrine no perfil.

---

## Fase 3 — Salto visual, jogadores 3D e cutscenes

- Estádio e gramado: mais camadas de textura, desgaste, luz por horário, arquibancada e cobertura mais detalhadas, telão e bandeirões.
- Jogadores 3D: corpo mais anatômico, tipos físicos diferentes, cabelo/pele/chuteira variados, número e nome nas costas, animações de comemoração, falta, defesa e substituição.
- Cutscenes: fundos em camadas com movimento de câmera, retratos animados, música/ambiente, entrada em campo, vestiário, coletiva e comemoração de título.
- Narração muito melhor: locutor com ritmo, empolgação crescente, comentários sobre nomes de jogadores, sequência de jogadas, contexto da partida e do campeonato.

**Desempenho no celular (medido, não estimado)**
- Teste automatizado de partida completa em celular médio simulado, medindo quadros por segundo ao longo dos 90 minutos.
- Ajuste automático contínuo: reduz efeitos, sombras e detalhes quando cai, e recupera quando estabiliza — sem travar nem piscar.
- Resultado do teste apresentado a você com números antes e depois.

---

## Fase 4 — Modo editor e customização

- Editor de elencos: criar/editar/remover jogadores, mover entre clubes, editar todos os atributos e fotos.
- Editor de clubes: nome, cores, escudo, uniformes, estádio, torcida, força.
- Editor de ligas e campeonatos: criar competição, escolher clubes, formato (pontos corridos, mata-mata, grupos), rebaixamento, número de vagas continentais.
- Importar/exportar suas edições como arquivo, para guardar ou compartilhar.

---

## Fase 5 — IA, chat e loja

- **IA Gemini** integrada como o cérebro do jogo: diretor esportivo que analisa seu elenco, olheiro que sugere reforços, jornalista que escreve as notícias da temporada, treinador assistente que sugere táticas contra o próximo adversário e comentários de coletiva. Roda no servidor, sempre em texto que aparece dentro do jogo.
- **Chat**: sala global para conversar com outros jogadores em tempo real (com filtro de linguagem, denúncia e bloqueio) e aba de conversa com a IA na mesma tela.
- **Loja com pagamento real (cartão)**: pacotes baratos e justos — moeda do jogo, pacote de olheiro, pacote de treino intensivo, temas visuais/escudos exclusivos, passe de temporada. Nada que garanta vitória automática; melhorias de conveniência e cosméticos, para não quebrar o equilíbrio.

---

## Detalhes técnicos

- Novas tabelas no banco: `custom_clubs`, `custom_players`, `custom_competitions`, `achievements` + `user_achievements`, `chat_messages`, `store_products`, `user_purchases`, `user_wallet` — todas com RLS por usuário e leitura pública apenas onde faz sentido (chat, produtos).
- Chat em tempo real via Realtime do backend; moderação com lista de termos + verificação por IA nas mensagens sinalizadas.
- IA via Lovable AI Gateway com `google/gemini-3.6-flash` (modelo Gemini Flash mais recente), chamada só do servidor, respostas curtas e em cache por rodada para não gastar crédito à toa.
- Pagamentos com Stripe (integração de pagamentos da Lovable): produtos, checkout, webhook confirmando compra e creditando na carteira.
- Editor grava em `custom_*` e é aplicado por cima dos dados oficiais no carregamento, sem alterar os dados importados.
- Desempenho medido com automação de navegador em viewport de celular, coletando FPS por minuto de jogo; ajuste adaptativo já existente é estendido com histerese para não oscilar.
- Retratos de jogadores são SVG gerados por semente (sem imagens externas), portanto leves e infinitos.

## Ordem de entrega

Fase 1 → 2 → 3 → 4 → 5. Aprovando este plano, começo pela Fase 1.
