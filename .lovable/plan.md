# Modo carreira de jogador + jogador 3D melhorado

## Parte A — Modo carreira de jogador (novo)
Você cria um atleta e vive a carreira dele. Isso é diferente da carreira de técnico, que continua igual.

1. **Criação:** nome, país, posição, pé bom, altura e aparência. Começa com 16–17 anos na base de um clube real.
2. **Atributos que evoluem:** velocidade, chute, passe, drible, defesa e físico. Sobem com treino e minutos jogados e começam a cair depois dos 30 anos.
3. **Semana a semana:** escolher o treino (técnico, físico, descanso), conferir energia e moral e ver o risco de lesão.
4. **Partidas:** o técnico decide se você é titular, reserva ou se fica fora. Depois de cada jogo vem nota de 0 a 10, gols e assistências, sem precisar assistir a partida inteira.
5. **Carreira:** contrato com salário e duração, propostas de outros clubes, empréstimo, renovação, convocação para a seleção, prêmios da temporada e aposentadoria com resumo da carreira.
6. **Telas novas:** criar atleta, painel do atleta, histórico e propostas. Tudo funciona no celular e no computador.
7. **Salvamento:** fica no aparelho, como as outras carreiras, e é sincronizado com a sua conta quando há login. Conquistas oficiais não valem para saves locais, igual à regra atual.

## Parte B — Jogador 3D (seguindo a especificação: medir primeiro)
1. **Medir antes:** desenho por quadro, triângulos e tempo de animação dos 22 jogadores, com uma tabela dos maiores gargalos.
2. **Corrigir o que mais pesa:** menos peças separadas por jogador, materiais compartilhados e animação a cada 2–4 quadros para quem está longe.
3. **Atleta de destaque (perto da câmera):** corpo com músculos de ombro, peito, coxa e panturrilha, rosto com mandíbula, nariz e sobrancelha, 6 estilos de cabelo, camisa com gola e mangas, número e nome nas costas, meiões e chuteiras.
4. **Movimento:** pé preso no gramado sem deslizar, corpo inclinado ao acelerar e frear, braços que acompanham a passada e chute com o pé encostando na bola.
5. **Os 22 jogadores:** três níveis de detalhe (perto, médio e longe). Os jogadores distantes continuam baratos para o celular.
6. **Conferir no fim:** fotos no estúdio de jogador (390px e 1280px) e números de antes e depois.

## Detalhes técnicos
- Carreira de jogador: `src/game/player-career/*` com funções puras e testadas (evolução, minutos, nota, propostas, aposentadoria) e semente determinística. Rotas novas: `/jogador/novo`, `/jogador`, `/jogador/historico` e `/jogador/propostas`. Save local em `@/lib/offline/store` com uma chave separada. Na nuvem, uma tabela `player_careers` com RLS por `auth.uid()`, com o mesmo padrão de `careers` e `verified_progress` sempre false para saves locais. Usa `CLUBS` e as ligas atuais e a simulação existente para os resultados.
- 3D: `player-model.ts` (proporções), `PlayerRig.tsx` (geometrias de perfil reutilizadas com cache, LOD por grupos), `rig-body.ts`, `ik-solver.ts` (trava do pé), `player-materials` com texturas de número compartilhadas. Validação em `player-studio.html`, porque a partida não abre no navegador de teste sem placa de vídeo.
- Sem bibliotecas novas. As regras da partida não mudam.

## Ordem
A1–A7 primeiro, porque é jogável e você vê o resultado logo. Depois B1–B6, em vários ciclos.
