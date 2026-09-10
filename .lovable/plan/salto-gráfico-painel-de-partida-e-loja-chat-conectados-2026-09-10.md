# Salto gráfico, painel de partida e loja/chat conectados

Ordem de execução conforme sua escolha: primeiro os gráficos, depois o painel de partida no celular, depois home/interface, e por fim loja, chat e conectores.

## 1. Jogadores: geometria e rostos (prioridade)

- Cabeça remodelada: crânio com testa, têmporas, maçãs do rosto, queixo e mandíbula separados; nariz com ponta e narinas; lábios superior e inferior; pescoço com tendões.
- Olhos vivos: íris colorida por jogador, pupila, brilho, pálpebras que piscam e olhar que segue a bola.
- Cabelo e barba com volume real (mechas, costeletas, linha de implantação), 12 estilos revisados.
- Corpo: ombros, peitoral, abdômen, glúteo, panturrilha e tornozelo com volumes próprios; tipos físico magro/normal/forte/alto realmente diferentes.
- Uniforme: gola em V/redonda/polo, mangas com barra, calção com fenda lateral, camisa com prega nas costas, número e nome nítidos, patch de capitão e de campeonato.
- Chuteira: cabedal, língua, cadarço trançado, contraforte e travas por tipo de piso.

## 2. Texturas muito mais detalhadas

- Camisa: trama de malha, ventilação, costuras, desbotamento e amassados; escudo e patrocínio aplicados na textura.
- Pele: poros, sardas, barba por fazer, suor que aumenta ao longo do jogo, rubor pelo esforço.
- Meião, calção, luvas e chuteira com relevo próprio.
- Grama: novas variações de corte, marcas de derrapagem, lama e desgaste da grande área.

## 3. Estádio, torcida e cenas

- Torcida com mais variação de camisas, bandeiras, cachecóis, celulares acesos e ola por setor.
- Estádio: refletores com halo, placar animado, publicidade rotativa, fumaça e papel picado.
- Cenas de história: enquadramentos novos, movimento de câmera, transição entre planos, retrato do técnico integrado à cena.
- Pós-processamento: reflexos no gramado molhado, sombras suaves, desfoque de movimento, cor de transmissão por horário.
- Mais animações de jogador (chegando ao total pedido), com transição suave e escolha por contexto.

## 4. Painel da partida (celular primeiro)

Painel novo, fixo e legível no telefone:
- Tempo, placar, escudos e fase do jogo.
- Posse de bola em barra, finalizações, finalizações no gol.
- Passes tentados, passes certos e percentual de acerto.
- Faltas, cartões amarelos e vermelhos, escanteios, impedimentos.
- Aba de eventos ao vivo e atalhos de ordem tática com o dedo.

## 5. Página inicial e interface do jogo

- Home com o novo visual: destaque animado, números do jogo, atalhos grandes, prova social e ligas.
- Telas internas (elenco, tática, finanças, mercado) com mesma linguagem: cabeçalho, cartões e espaçamento padronizados, tudo confortável no celular.

## 6. Loja e chat dentro da partida

- Loja redesenhada: packs de moedas e itens com preço claro, comparação de vantagem, compra em dois toques, carteira sempre visível.
- Chat redesenhado: conversa com outras pessoas em tempo real e com a assistente de IA na mesma tela, com aviso quando estiver offline.
- Ambos acessíveis durante a partida por uma gaveta lateral, sem sair do jogo.

## 7. Conectores (6)

Vou abrir um cartão de autorização para cada um; você aprova na hora:

1. ElevenLabs — narração falada de verdade nos lances.
2. Logo.dev — logos de clubes reais por domínio.
3. Resend — e-mails de resumo de temporada e recuperação de conta.
4. PostHog — entender o que as pessoas jogam mais.
5. Firecrawl — notícias reais de futebol nas telas do jogo.
6. Google Search Console — acompanhar o site nos buscadores.

Se você preferir trocar algum, é só dizer.

## Detalhes técnicos

- Novas dependências visuais: `three-bvh-csg` (recortes de geometria no estádio), `three-subdivide` (suavizar malhas dos jogadores), `@pmndrs/vanilla` (efeitos extras de pós-processamento), `detect-gpu` (qualidade inicial certa por aparelho), `r3f-perf` (medição de quadros), `@react-three/csg`.
- `PlayerRig.tsx` dividido em partes (`Head.tsx`, `Torso.tsx`, `Limbs.tsx`, `Boots.tsx`) para não virar arquivo gigante; geometrias memorizadas e compartilhadas entre jogadores.
- Texturas novas em `src/game/textures/` com cache único por processo, geradas em canvas e respeitando os níveis de qualidade e a página `/visual`.
- Painel da partida como componente próprio (`MatchHud`), lendo as estatísticas já existentes em `sim.stats`; campos que faltam (passes, cartões) somados no simulador.
- Loja/chat dentro da partida via `Sheet` do shadcn, reaproveitando as rotas `/loja` e `/chat` já existentes.
- Chaves dos conectores ficam só no servidor; nada de segredo no navegador.
- Verificação: typecheck, build e captura de tela da partida em tamanho de celular antes de encerrar.
