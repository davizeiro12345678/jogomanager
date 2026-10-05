# Otimização de CPU com Rust/WASM, novo modelo de jogador e cenas 3D

Alvo: celular comum (Android intermediário), 30–60 FPS estáveis. Regra: medir antes, mover para Rust só o que pesa, resultados das partidas idênticos aos de hoje.

## Etapa 1 — Medir (base de comparação)
- Cenário fixo: mesma partida (seed), câmera de transmissão, 390px e 1280px, qualidade Baixa/Média/Alta.
- Registrar tempo por quadro (p50/p95), chamadas de desenho, triângulos, tempo da simulação por rodada e tempo de uma temporada automática.
- Resultado vira tabela "antes"; o que não puder ser medido fica marcado "não medido".

## Etapa 2 — Tirar trabalho desnecessário da CPU (sem Rust ainda)
- Jogadores distantes atualizam animação a cada 2–4 quadros; perto da câmera, todo quadro.
- Contexto visual calculado uma vez por quadro e compartilhado (já existe base em `visual-frame-cache`); eliminar varreduras repetidas de todos os jogadores.
- Remover alocações por quadro (vetores/objetos novos) nos rigs, câmera e torcida.
- Pausar tudo quando a aba fica oculta; renderizar sob demanda em menus e telas paradas.
- Telas fora da partida não carregam bibliotecas 3D.

## Etapa 3 — Rust/WASM onde a medição comprovar ganho
- Expandir o módulo Rust existente (torcida) para:
  1. Torcida: visibilidade, balanço e reação a gol em lote.
  2. Animação: cálculo dos ossos e apoio dos pés (IK) em lote para todos os jogadores.
  3. Simulação rápida da temporada: rodadas automáticas no Worker chamando Rust.
  4. Física da bola e movimento dos jogadores: só se a etapa 1 mostrar que é gargalo; obrigatório teste que compara 2.000 partidas JS vs Rust com placares idênticos antes de trocar.
- Sempre com caminho JavaScript de reserva se o WASM falhar ao carregar.
- Simulação da temporada continua sequencial no Worker dedicado (regra do projeto).

## Etapa 4 — Modelo de jogador
- Corpo: proporções reais (ombro/clavícula, pescoço, tórax, quadril, panturrilha, tornozelo, mãos e pés), variação determinística por jogador.
- Rosto e cabelo: mais estilos e formato de mandíbula/nariz de perto; simplificados à distância.
- Movimento: aceleração/frenagem, viradas, pés travados no gramado sem deslizar, contato do pé com a bola alinhado no passe e no chute.
- Uniforme: gola, mangas, número/nome nas costas por textura, meiões e chuteiras; materiais compartilhados.
- Três níveis de detalhe: perto (completo), médio (simplificado), longe (poucas peças, poucos ossos).

## Etapa 5 — Cenas 3D (todas, puláveis, com mesmo resultado ao pular)
- Abertura noturna do estádio e entrada em campo pelo túnel com a torcida.
- Gol: replay com 2–3 ângulos e comemoração.
- Intervalo e fim de jogo com placar.
- Títulos: taça erguida no fim da temporada.
- Narração sincronizada por marcos; respeita "reduzir movimento"; versão leve no celular.

## Etapa 6 — Conferência
- Repetir as medições da etapa 1 e mostrar tabela antes/depois.
- Capturas em 390px e 1280px das cenas e da partida; testes de determinismo e estresse passando.

## Detalhes técnicos
- Rust em `wasm/crowd-visibility` (renomear crate não é necessário); build via `scripts/build-wasm.mjs`; dados em TypedArrays transferíveis entre Worker e tela.
- Arquivos principais: `src/components/game/players/*` (rig, materiais, LOD), `rig-body.ts`, `rig-skin.ts`, `player-model.ts`, `Cutscene.tsx`, `CinematicStage3D.tsx`, `CrowdLod.tsx`, `match.worker.ts`, `autoplay.ts`.
- Sem Babylon.js e sem bibliotecas novas sem gargalo comprovado. Rapier só para corpos rígidos, se necessário.
- Execução em vários ciclos (limite de 12 créditos/ciclo); cada etapa entregue e conferida antes da próxima.
