# Mega atualização integrada: conversão, desempenho, visual e conteúdo

## Prioridade 1 — Compartilhar e salvar a carreira

- Criar uma página pública e acessível de compartilhamento com prévia da mensagem, copiar link, compartilhamento nativo e destinos para WhatsApp, Reddit, Facebook, Telegram e X.
- Para Instagram, TikTok, Discord e Messenger, onde não existe compartilhamento web universal com texto preenchido, oferecer “Copiar mensagem” + abrir o aplicativo/site, explicando claramente o passo final.
- Usar uma mensagem completa, mas editável, com o endereço oficial `https://jogomanager.com` e descrição do jogo.
- Adicionar “Salvar na nuvem” no topo do jogo e no painel para visitantes, com Google como ação principal.
- Mostrar um convite discreto após criar o clube e após a partida: “Você está jogando como visitante. Vincule sua conta para manter seus títulos salvos”. O aviso não bloqueará o jogo e não aparecerá para quem já entrou.

## Prioridade 2 — Acesso, perfis e contato

- Criar `profiles` com nome, avatar e preferências por conta, regras que permitam a cada jogador acessar somente o próprio perfil e criação automática no cadastro.
- Redesenhar a página de acesso: Google primeiro, depois Apple, Microsoft, Lovable, telefone e e-mail/senha; estados claros de carregamento, erro, confirmação de e-mail e benefícios de salvar a carreira.
- Manter o retorno seguro à tela desejada após qualquer forma de acesso.
- Telefone por SMS terá tela própria e mensagens de código; SAML empresarial será exibido somente após a configuração do provedor corporativo.
- Publicar os contatos autorizados: WhatsApp `+55 27 99729-4771` e `davizeiro10.jogos@gmail.com`, com aviso antifraude.

## Prioridade 3 — Ícone, SEO e páginas públicas

- Aplicar o SVG fornecido como ícone oficial e gerar versões reais 32, 180, 192 e 512 px para navegador, Apple e PWA.
- Atualizar o título, descrição, Open Graph e Twitter da home com os textos fornecidos e 115 ligas globais.
- Padronizar Guias, Táticas, Scouting, Finanças, Sobre, Criador, Glossário e Comparativo: cabeçalho, resposta rápida, ficha editorial, índice, conteúdo escaneável, CTA “Jogar agora”/“Criar clube” e metadados exclusivos.
- Melhorar o comparativo sem alegações impossíveis de comprovar; destacar navegador, gratuidade, partida 3D e cobertura de ligas como características verificáveis.
- Depois de publicar, solicitar nova indexação das páginas prioritárias e do sitemap no Google Search Console.

## Prioridade 4 — Desempenho, cache e imagens

- Medir a linha de base no navegador disponível, tempos de CPU, tamanho dos pacotes e quantidade de desenhos; tratar o número do navegador sem GPU como diagnóstico, não como FPS de uma máquina real.
- Corrigir o modo baixo para um orçamento adaptativo de 40–60 FPS: DPR dinâmico, sombras e luzes próximas à jogada, torcida e grama em instâncias com atualização reduzida, LOD/frustum culling dos jogadores, pós-processamento desligado ou mínimo e limite de partículas.
- Separar simulação, IA e registro do desenho usando o worker existente e passo fixo com interpolação; reduzir estados React atualizados por quadro e reutilizar vetores/matrizes.
- Dividir o carregamento das áreas pesadas do 3D, loja e análises; evitar que código da partida faça parte da primeira tela.
- Revisar o PWA para cachear somente arquivos estáticos versionados, com navegação pela rede e exclusão de autenticação; remover duplicações e dependências não usadas do pacote inicial.
- Converter imagens próprias para AVIF/WebP responsivo e reduzir logos, fotos e kits antes da exibição. Imagens externas usarão URLs dimensionadas apenas em origens confiáveis; nenhum proxy aceitará URLs arbitrárias.

## Prioridade 5 — 3D, jogadores e simulação

- Preservar WebGL2 como padrão estável e WebGPU como experimental com retorno automático.
- Melhorar iluminação por qualidade: luz principal ajustada à jogada, sombra real somente próxima, contato suave no restante, rebote do gramado e refletores sem luz dinâmica por assento.
- Refinar texturas de gramado, redes, concreto, pele e tecido com versões por qualidade, mapas de normal/rugosidade e anisotropia controlada.
- Refinar proporções, articulações, apoio dos pés, inclinação e frenagem; misturar parado/caminhada/corrida/disputa/chute/defesa/comemoração pelo tempo, sem troca seca.
- Melhorar bola, bloqueios, quique, efeito e cansaço; adversários passam a defender por cobertura/zona, ajustar pressão ao placar/minuto e evitar aglomeração em volta da bola.

## Prioridade 6 — Narrador e assistente

- Expandir para pelo menos 200 variações por idioma, cobrindo quase-gol, defesa difícil, contra-ataque, pênalti, expulsão, virada, empate tardio, acréscimos, goleada, zebra e contexto da temporada.
- Escolher intensidade calma, empolgada ou explosiva conforme minuto, placar e peso do lance; incluir nomes quando os dados forem confiáveis e impedir repetição recente.
- Melhorar o assistente com termos reais de futebol sul-americano e europeu, contexto do save (forma, classificação, caixa, elenco e próximo adversário) e respostas de no máximo três ações.

## Prioridade 7 — Redesign das telas e loja

- Unificar HUD da partida, painel, elenco, tática e loja com hierarquia consistente, ações principais fixas, feedback de carregamento/erro/sucesso e transições leves.
- Criar imagens próprias para os pacotes pagos e exibir claramente preço, quantidade, benefício, entrega e natureza opcional da compra.
- Manter compras e vantagens somente onde já são permitidas, sem alterar preços ou regras comerciais não solicitadas.

## Verificação e limites honestos

- Verificar desktop e celular, teclado/leitor de tela, redução de movimento, todos os acessos configurados, salvamento local/nuvem, compartilhamento, compra de teste e uma partida longa.
- Conferir erros do navegador, tipos, compilação e tamanho final dos pacotes.
- FPS absolutos de 189 no baixo e 79 no alto não são garantíveis em “qualquer placa integrada”; a entrega usará qualidade adaptativa e apresentará medições reais do ambiente testado e metas sustentáveis.
- SAML depende da URL de metadados e dos domínios da organização. SMS depende das configurações de envio do projeto. Instagram/TikTok/Discord não permitem preencher publicação automaticamente a partir de um site comum.
