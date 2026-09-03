# Mega upgrade gráfico 3D com bibliotecas renomadas

Objetivo: levar a partida 3D para nível de transmissão — pós-processamento cinematográfico, materiais físicos, iluminação com reflexos, animação de personagens e desempenho controlado.

## Novas dependências 3D (padrão da indústria)

- `@react-three/postprocessing` + `postprocessing` — bloom, vinheta, correção de cor, SMAA, motion blur leve, depth of field no replay.
- `@react-three/rapier` — física real (opcional, ativada apenas para a bola: quique, colisão com trave/rede) sem quebrar a simulação tática existente.
- `maath` — suavização de câmera, damping e ruído determinístico.
- `three-stdlib` — utilitários (Sky, Water-like shading, geometrias fundidas) estáveis para o Vite/SSR.
- `@react-three/drei` já instalado: usar `Instances`, `Lightformer`, `SoftShadows`, `AdaptiveDpr`, `Detailed` (LOD), `useTexture`, `Sparkles`.

Tudo carregado apenas na rota da partida (client-only), sem CDN externo e sem HDR remoto.

## 1. Pipeline de renderização

- ACES Filmic tone mapping, color space correto, `AdaptiveDpr` + `AdaptivePerformance` para segurar 60fps.
- Iluminação baseada em imagem local com `<Environment>` + `Lightformer` (sem preset de CDN).
- Sombras suaves (PCSS via `SoftShadows`) nos níveis Médio/Alto; cascata simples de sombra em torno da bola.
- Pós-processamento por nível de qualidade: Alto = Bloom + Vinheta + Color grading + SMAA + DoF no replay; Médio = Bloom leve + Vinheta; Baixo = nenhum.

## 2. Gramado e estádio

- Grama procedural em alta resolução: listras de corte, desgaste nas áreas e círculo, variação de tom, mapa de normal/roughness gerado por canvas para brilho úmido.
- Traves com material metálico físico (`meshPhysicalMaterial`), redes com malha fina e leve balanço.
- Arquibancadas com LOD, torcida instanciada mais densa com mosaico, ola e flashes de câmera.
- Placas de LED animadas, placar legível, bandeirinhas de escanteio tremulando, refletores com halo volumétrico à noite.
- Três horários (dia/entardecer/noite) com céu, cor de luz e névoa coerentes.

## 3. Jogadores e bola

- Anatomia refinada sobre o esqueleto articulado atual: proporções corretas, pescoço/ombros, tons de pele variados, cabelos variados, luvas de goleiro.
- Blend de poses mais suave (damping por `maath`), sombra de contato individual, número nas costas.
- Kits em textura de maior resolução com padrões (listras, faixa, quadriculado) e gola/mangas.
- Bola com rotação coerente, rastro só em chutes fortes, quique com física (Rapier) e partículas de grama no impacto.

## 4. Câmeras e apresentação

- Suavização por damping em todas as câmeras, leve tremor em lances de perigo.
- Replay de gol com câmera orbital em câmera lenta + depth of field.
- Overlay de transmissão mantido, ajustado para o novo contraste.

## 5. Desempenho

- Níveis Baixo/Médio/Alto controlando torcida, sombras, pós-processamento, resolução e LOD; detecção automática inicial.
- Alvo: draw calls < 100, pixel ratio limitado a 2, 1–2 passes de pós no Alto.

## Notas técnicas

- Trabalho concentrado em `src/components/game/Stadium3D.tsx` (dividido em módulos `stadium/`, `players/`, `ball/`, `camera/`, `post/`), `src/game/kits.ts` e o overlay em `src/routes/_authenticated/match.tsx`.
- Rota da partida permanece client-only; nada de acesso a `window` em escopo de módulo.
- Rapier é opcional e isolado à bola; se o custo pesar, mantém-se a física atual da simulação.
- Verificação por screenshot no navegador em cada fase, mais `tsgo --noEmit` e build de produção limpos.
