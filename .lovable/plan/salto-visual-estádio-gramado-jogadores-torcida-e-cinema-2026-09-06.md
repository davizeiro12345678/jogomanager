# Salto visual: estádio, gramado, jogadores, torcida e cinema

Objetivo: transformar a partida em algo que pareça uma transmissão de TV, mantendo o jogo fluido em celulares (queda automática de qualidade já existente continua valendo).

## 1. Gramado muito mais detalhado
- Texturas geradas em camadas: base com variação de tom, microfibras, desgaste nas áreas de maior uso (grande área, meio, laterais), marcas de corte em faixas e leve sujeira/lama perto das linhas.
- Mapas de relevo e brilho separados, para o gramado reagir à luz (brilho úmido quando a luz bate rasante).
- Linhas pintadas com bordas imperfeitas, em vez de traços perfeitos.
- Tufos de grama em 3D só perto da câmera, sumindo à distância, com leve balanço de vento.

## 2. Estádio remodelado
- Quebrar o estádio em partes próprias: gramado, gols e rede que reage à bola, arquibancadas, cobertura, iluminação, placas de publicidade, bancos de reserva, bandeirinhas, túnel e detalhes de beira de campo.
- Arquibancadas em anéis com corredores, escadas, cadeiras em duas cores formando mosaicos do clube, setores visitantes.
- Refletores reais projetando luz e sombras múltiplas; céu e ambiente coerentes com o horário do jogo.
- Sujeira e desgaste distribuídos de forma natural pelo concreto.

## 3. Torcida bem mais convincente
- Torcedores com corpo em silhueta (não só blocos), variação de altura, tom de pele, camisas e acessórios.
- Movimento por setor: ondas, pulos em lances de perigo, aplauso, bandeirões e faixas, além de flashes de celular.
- Densidade e detalhe caem automaticamente em aparelhos fracos.

## 4. Jogadores mais realistas
- Corpo com ombros, peito, braços e pernas modelados de verdade, mãos e pés, cabeça com cabelo em estilos variados e tons de pele diversos.
- Uniforme com número nas costas, gola, meião, chuteiras e faixa de capitão.
- Animações melhores: corrida com inclinação, passada, frenagem, giro, chute com preparo e acompanhamento, cabeceio, comemoração, goleiro com mergulho.
- Sombra colada no chão e três níveis de detalhe conforme a distância da câmera.

## 5. Pós-processamento de transmissão
- Camadas novas: oclusão de contato (sombra suave nos encontros de objetos), foco de câmera com fundo levemente desfocado em replays, reflexo de lente dos refletores, correção de cor cinematográfica e leve granulado.
- Presets distintos: jogo normal, replay/gol (mais cinematográfico) e modo leve para celular.
- Momentos especiais (gol, pênalti, fim de jogo) acionam automaticamente o preset cinematográfico.

## 6. Cutscenes muito melhores
- Arte com profundidade em camadas, iluminação e movimento suave de câmera.
- Personagens com expressão e pose variando conforme o clima da cena.
- Transições, som ambiente e ritmo de texto melhor; opção de pular sempre visível.

## 7. Base técnica e desempenho
- Reaproveitar materiais e geometrias entre objetos repetidos e desenhar multidões e cadeiras em lote.
- Texturas geradas uma única vez por sessão e reaproveitadas.
- Verificação em partida longa: sem travar, sem erros, com medição de fluidez em qualidade alta, média e baixa.

## Detalhes técnicos
- Novos módulos em `src/components/game/stadium/`: `Pitch.tsx`, `Goals.tsx`, `Structure.tsx`, `Crowd.tsx`, `Lighting.tsx`, `Props.tsx`, e `textures/` (grass, concrete, seats, ads, skin/kit).
- `Stadium3D.tsx` vira orquestrador enxuto que compõe esses módulos; `Stadium3DImpl` mantém `sim/mode/quality` e o PerformanceMonitor atual.
- `PlayerRig.tsx` dividido em geometria (`players/geometry.ts`), material/kit e animação; instanciação para LOD distante.
- `PostFX.tsx` ganha presets `match | replay | drama | mobile` com N8AO, DepthOfField, LensFlare simplificado, ColorAverage/HueSaturation, SMAA/TAA conforme qualidade.
- Torcida via `InstancedMesh` com atributos por instância e atualização em taxa reduzida fora da qualidade alta.
- Pacotes possivelmente necessários: `@react-three/postprocessing` já presente; avaliar `n8ao` e `maath`.
- Validação: `bunx tsgo --noEmit` e capturas em partida real em três níveis de qualidade.
