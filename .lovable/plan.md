# Mega atualização gráfica do estádio + importação completa de dados

Objetivo: elevar o visual da partida 3D (gramado, redes, jogadores, torcida, estádio, luz e câmera), tornar as animações bem mais complexas e naturais, e rodar a importação completa de escudos, uniformes, estádios e elencos reais para todos os clubes.

## 1. Gramado
- Fibras de grama em muito maior quantidade e em duas camadas (rasteira densa + tufos altos), reagindo ao vento e ao chute da bola por perto.
- Desenho de corte mais realista: faixas com bordas irregulares, brilho que muda conforme o ângulo da câmera, poças de desgaste na área e no círculo central.
- Marcas de pisada e rastro de deslize aparecem durante a partida e desbotam com o tempo.
- Linhas do campo pintadas com leve relevo e irregularidade, não perfeitamente retas.

## 2. Redes e gol
- Rede passa a ser uma malha simulada com pontos e fios: balança com o vento e estufa de verdade quando a bola entra, com ondulação que se propaga e amortece.
- Fios mais finos e com sombra própria; travessão e postes com reflexo suave e detalhe do gancho da rede.
- Impacto na trave/poste com vibração curta.

## 3. Jogadores
- Novos movimentos no catálogo de animações: arrancada, desaceleração, giro, drible curto, corte lateral, cabeceio, carrinho, comemoração variada, protesto, mãos na cintura cansado, defesa em três alturas para o goleiro.
- Transição suave entre movimentos (blend) em vez de troca seca, e mistura de camadas: pernas correndo enquanto o tronco olha para a bola.
- Cabeça e olhar seguem a bola; braços com balanço secundário; respiração e cansaço visíveis quando o preparo cai.
- Uniformes com tecido mais realista, número e nome nas costas, variação de corpo (altura, porte) por jogador.
- Sombra de contato melhor e três níveis de detalhe para manter a fluidez.

## 4. Torcida e estádio
- Torcedores com silhueta melhor, braços e movimento individual: sentar/levantar, ondas, aplausos em resposta a chute, gol e defesa.
- Mosaicos das cores do clube nas arquibancadas, bandeirões, faixas e blocos de torcida organizada.
- Fumaça/sinalizadores no gol, papel picado na entrada em campo e névoa leve sob os refletores à noite.
- Estrutura do estádio mais rica: escadas, corrimãos, portões, cabines de imprensa, telão com placar e replay ao vivo, publicidade animada.

## 5. Luz, câmera e acabamento
- Iluminação revista para dia, entardecer e noite, com refletores que projetam quatro sombras como em estádio real.
- Ajuste de cor estilo transmissão, brilho controlado nas luzes e leve granulação; câmera com balanço sutil e zoom automático nos lances de perigo.
- Câmera de replay do gol com ângulo baixo e câmera lenta.

## 6. Importar tudo
- Rodar a importação completa em lotes até cobrir todos os clubes: escudos oficiais, uniformes, estádios e elencos reais.
- Acompanhar o andamento pelo registro de importações e repetir os lotes que faltarem.
- Onde a fonte não tiver dado, mantém-se o escudo/kit gerado pelo jogo, para nenhum clube ficar sem imagem.

## Detalhes técnicos
- Arquivos principais: `src/components/game/Stadium3D.tsx` (gramado, redes, torcida, estádio, luz, pós-processamento), `src/components/game/players/PlayerRig.tsx` e `src/game/animation.ts` (novos clipes, blend e camadas), `src/game/player-model.ts` (variação corporal).
- Grama e torcida continuam em `InstancedMesh` com contagem por nível de qualidade (baixa/média/alta) para não perder desempenho no celular; alvo abaixo de 100 chamadas de desenho.
- Rede: grade de partículas com solver Verlet simples, resolvida no mesmo `useFrame`, com número de pontos reduzido nas qualidades menores.
- Animação: mistura de poses via `mixPose` com tempo de transição por clipe e máscara por articulação para camadas tronco/pernas.
- Importação via `POST /api/public/sync-football` com `scope=all` em lotes de deslocamento crescente, respeitando o orçamento de tempo de cada chamada.
- Verificação a cada etapa com captura de tela no navegador e checagem de tipos.
