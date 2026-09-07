# Mega atualização gráfica 3D + correções de segurança e de busca

Três frentes num só ciclo: um salto grande na imagem do jogo, o fechamento das brechas de segurança da loja/chat e o ajuste do que os buscadores veem em todos os seus endereços.

## 1. Salto gráfico 3D

**Campo e bola**
- Bola com física real (colisão com traves, rede, chão e jogadores), efeito curva e quique com atrito variável conforme o gramado esteja seco ou molhado.
- Grama em três camadas com corte diagonal, desgaste que aumenta ao longo do jogo, poças e brilho rasante sob os refletores.
- Marcas de deslize e respingos de terra que ficam no gramado e desbotam.

**Estádio**
- Sombras de contato mais precisas, luz que vaza da cobertura, halo dos refletores com poeira no ar.
- Telão com placar em texto nítido (hoje é uma imagem desenhada a cada mudança) e replay do lance.
- Publicidade em LED com rolagem e cintilação corretas, portões, escadas, cabines e câmeras de TV que acompanham a bola.

**Torcida**
- Mais variação de corpos, roupas e alturas, mosaicos por setor, ola mais orgânica, bandeirões maiores com estampa e cachecóis girando.
- Reação ao placar: pulos, braços erguidos e flashes concentrados no setor do time que marcou.

**Jogadores**
- Nome e número nas costas em texto de verdade (nítido de perto), chuteiras separadas, suor e brilho de tecido.
- Corrida, condução, chute, carrinho e comemoração com transições suaves; nível de detalhe cai com a distância para não pesar.

**Imagem final (pós-processamento)**
- Foco seletivo no replay, cor calibrada por horário, granulado de transmissão, reflexos e anti-serrilhado melhores.
- Tudo continua com os três níveis de qualidade (alta / média / baixa) e a queda automática quando o aparelho sofre.

## 2. Nove novas bibliotecas visuais e de física

Todas são bibliotecas conhecidas e mantidas do ecossistema 3D web:

| Biblioteca | Para quê |
| --- | --- |
| `@react-three/rapier` | física real da bola, traves e colisões |
| `three-mesh-bvh` | colisão e detecção rápidas em cenas pesadas |
| `three-custom-shader-material` | shaders próprios de grama, tecido e água |
| `troika-three-text` | texto nítido no telão, nas costas das camisas e na publicidade |
| `meshline` | rastros de bola e linhas grossas de trajetória |
| `camera-controls` | movimentos de câmera cinematográficos e estáveis |
| `simplex-noise` | texturas e desgaste gerados por procedimento |
| `gsap` | linha do tempo das cutscenes e das entradas de câmera |
| `lenis` | rolagem suave nas páginas do site |

Cada uma entra atrás do nível de qualidade: em aparelho fraco o jogo não carrega o que não vai usar.

## 3. Correções de segurança

Verificado na base de dados:

- **Moedas podem ser alteradas pelo próprio navegador.** Hoje o saldo da carteira é gravado direto pelo aplicativo, e a regra de acesso permite ao usuário gravar qualquer valor na própria carteira. Na prática dá para se dar moedas de graça. Correção: toda alteração de saldo passa a ser feita no servidor, e a regra de acesso do usuário passa a ser apenas de leitura — quem credita é o servidor.
- **Compras e recompensas conferidas no servidor.** Gastar moedas, desbloquear temas, relatórios de olheiro e treinos passam por uma verificação de saldo no servidor, não no navegador.
- **Chat:** limite de tamanho da mensagem, limite de envios por minuto e nome de exibição vindo da conta (hoje é enviado pelo próprio cliente e pode ser forjado).
- Varredura de segurança e de dependências no fim, com correção do que aparecer.

## 4. Buscas e domínios

Verificado agora: os oito endereços redirecionam corretamente para `soccer-manager.fun`, e as verificações rápidas de páginas e metadados estão passando. Restam dois pontos:

- **Etiqueta de tipo duplicada** nas páginas de conteúdo (uma definição global brigando com a da página). Correção: manter só a da página.
- **Google Search Console não concluído** para `www.footballcarrer.fun`: colocar a etiqueta de verificação, publicar, verificar e enviar o mapa do site.
- Revisão do mapa do site e dos textos de título/descrição das páginas novas, e nova varredura ao final.

## Detalhes técnicos

- Física: `@react-three/rapier` só na qualidade alta/média; a simulação de partida (`src/game/sim.ts`) continua sendo a fonte da verdade — a física é visual (bola, rede, bandeiras), sem alterar o resultado.
- Texto 3D via `troika-three-text` substitui os `CanvasTexture` regenerados por quadro no placar.
- Carteira: novas funções de servidor em `src/lib/wallet.functions.ts` com `requireSupabaseAuth`; migração ajustando as políticas de `public.user_wallet` para `SELECT` do usuário e escrita apenas pelo servidor; `src/lib/wallet.ts` passa a chamá-las.
- Chat: validação com `zod`, `CHECK` de tamanho na coluna e `display_name` derivado do usuário autenticado.
- SEO: remover `og:type` do `__root.tsx`; fluxo META de verificação do Search Console; nova varredura ao final.
