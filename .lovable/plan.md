# Mercado real, multiplayer ao vivo, criação do treinador e salto gráfico

Quatro frentes numa entrega só, nesta ordem. Cada etapa termina com verificação no navegador (celular e computador).

## 1. Mercado de transferências com clubes reais

- A busca passa a ler o banco real: nome, posição, idade, nacionalidade, número, nível e clube atual — filtros por posição, faixa de idade, nível e liga, com paginação.
- Cada jogador mostra o clube dono (escudo e cores oficiais) e um preço calculado por nível e idade.
- Negociação de verdade: proposta, contraproposta do clube vendedor (aceita, recusa ou pede mais), acordo salarial com o jogador, empréstimo com divisão de salário e venda de atletas do seu elenco.
- Ao fechar: o jogador entra no seu elenco na hora, sai do clube de origem dentro da sua carreira, o caixa e a folha salarial são atualizados, e sai uma notícia.
- Janela de transferências: negociações abertas só no início e no meio da temporada.

## 2. Multiplayer ao vivo (dois jogadores, mesma partida)

- Sala com código de 6 letras: um cria e escolhe o time, o outro entra e escolhe o adversário.
- A partida corre em tempo real para os dois — mesmo placar, mesmos lances, mesmo narrador — cada um comandando o seu time (substituições, mentalidade, pressão).
- Se alguém cair ou trocar de tela, volta no mesmo minuto; se o outro sumir, o computador assume.
- Feito para não travar no celular: a simulação roda em segundo plano e a qualidade da imagem se ajusta sozinha.

## 3. Criação do treinador (início do jogo refeito)

Novo fluxo em etapas, com visual de apresentação e cutscenes 2D entre elas:

1. **Identidade** — nome, país (com bandeira), idade, time do coração.
2. **Aparência** — rosto, tom de pele, cabelo (estilo e cor), barba, roupa de jogo (terno, agasalho), retrato desenhado ao vivo que aparece depois na Central, no banco de reservas e na coletiva.
3. **Perfil** — personalidade (calmo, motivador, durão, tático, jovem promessa), reputação inicial, habilidade distribuída em pontos (ataque, defesa, mercado, gestão de elenco, imprensa) e aprovação inicial da torcida/diretoria.
4. **Clube** — liga e clube, com o efeito das escolhas anteriores visível (reputação baixa limita clubes grandes; time do coração dá bônus de moral).

As escolhas mudam o jogo: paciência da diretoria, moral do elenco, poder de negociação no mercado, crescimento dos jovens no treino.

## 4. Interface, cutscenes e gráficos

- **Painéis**: Central, Elenco, Táticas, Finanças e Mercado ganham cartões com hierarquia clara, números animados, gráficos de evolução, estados vazios bonitos e navegação melhor no celular.
- **Cutscenes 2D**: chegada ao clube, apresentação à imprensa, conversa no vestiário antes do jogo, comemoração de título — cenas ilustradas com o seu retrato e as cores do clube, puláveis, respeitando "reduzir movimento".
- **Animações de treino**: tela de treino com bonecos animados por tipo de atividade (finalização, passe, defesa, físico) e barrinhas de evolução.
- **3D e pós-processamento**: grama com fibras e brilho úmido melhores, torcida mais densa, refletores e telão, reflexos no gramado molhado, profundidade de campo nas reprises, brilho e correção de cor cinematográficos — tudo por nível de qualidade, com o celular caindo automaticamente para o modo leve.

## Detalhes técnicos

- Estado da carreira sobe de versão com migração automática: novos campos `manager` (aparência, país, idade, personalidade, reputação, atributos, aprovação) e `transferWindow`.
- Mercado real: nova server function paginada lendo `clubs`/`players` com cache no cliente; a negociação e a troca de elenco gravam no estado da carreira (sem escrever no banco público).
- Multiplayer: tabela `match_rooms` (código, anfitrião, convidado, semente, clubes, estado do jogo) com RLS e GRANTs, sincronizada por Realtime; simulação determinística por semente compartilhada, o anfitrião publica o relógio, comandos viajam como mensagens.
- Retrato do treinador: gerador SVG determinístico (`src/game/manager-portrait.ts`) reutilizado em todas as telas — sem imagens externas.
- Cutscenes: `src/components/game/Cutscene.tsx` com camadas SVG/CSS animadas e roteiro em `src/content/cutscenes.ts`.
- 3D: pós-processamento por qualidade (Bloom, ToneMapping, DoF só em reprise), instancing para torcida/assentos/placas, LOD por distância, `dpr` limitado no celular.

## Preciso confirmar

O multiplayer exige estar conectado com uma conta (por causa da sala online); o resto do jogo continua funcionando sem login. Se preferir permitir sala anônima só com o código, eu ajusto.
