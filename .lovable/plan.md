# Plano: carreira mais fácil, novos serviços com moedas, VIP e personalização

## O que já existe (confirmado no banco)
- As 15 compras da loja já estão **ativas**, incluindo as 3 mais novas (Pacote médico, Análise tática, Passe anual). Não existe nenhuma compra inativa no banco esperando para ser ligada. Se você se refere a 5 compras específicas, diga quais. Senão, criamos as 5 novas listadas na Etapa 3.
- Hoje as moedas pagam 2 serviços: recuperação de lesão (250 moedas, até 3 por semana) e relatório do adversário (100 moedas, até 10 por semana).

## Etapa 1 — Aprender a jogar sem se perder
- Dicas que aparecem na primeira vez que você abre cada tela (elenco, táticas, mercado, estádio, treino). Cada dica tem "Entendi" e pode ser revista no menu Ajuda.
- Um botão de ação principal fixo em cada tela da carreira ("Jogar próximo jogo", "Definir escalação" etc.).
- Uma Central de Ajuda dentro do jogo, com busca, reaproveitando o FAQ que já existe.
- Revisão de acessibilidade nas telas da carreira, do criador de clube e da carreira de jogador: foco do teclado, rótulos, toques de pelo menos 44px, menos animação para quem pede.

## Etapa 2 — Novos serviços pagos com moedas
O banco cobra e confere os limites, e só depois disso o jogo aplica o efeito. Preços sugeridos (você pode mudar):

| Serviço | Moedas | Limite por semana | Efeito |
|---|---|---|---|
| Aprimorar treino | 150 | 5 | +50% de evolução no treino da semana |
| Acelerar evolução de jovem | 300 | 2 | +2 de potencial atingido em um jovem até 21 anos |
| Olheiro premium | 120 | 7 | Revela os atributos reais de 1 jogador |
| Melhoria do estádio | 500 | 1 | +5% de capacidade e de renda de bilheteria |
| Renegociar contrato de novo | 200 | 3 | Abre uma nova rodada de negociação depois de uma recusa |

## Etapa 3 — VIP e personalização
- **VIP mensal (R$ 19,90)**: 10% de desconto nos serviços com moedas, +1 uso por semana em cada serviço, selo VIP e acesso a todas as skins.
- Personalização da carreira: tema da interface (cores), visual do jogador (cabelo, chuteira, faixa de capitão), uniforme e placas do estádio. Usa os pacotes de temas, kit e estádio que já existem. As peças desbloqueadas ficam guardadas no servidor.
- Uma tela "Personalizar" no menu do treinador e na carreira de jogador.

## Etapa 4 — Melhorias na carreira, na carreira de jogador e no criador de clube
- Criador de clube: assistente em 4 passos (nome e escudo, cores, estádio, elenco inicial), com prévia ao vivo.
- Carreira de jogador: metas da temporada, linha do tempo de contratos e uso dos novos serviços.
- Estádio 3D: as melhorias do estádio aparecem na cena (arquibancada maior, placas personalizadas), dentro do limite de desempenho que já existe.

## Etapa 5 — Separar os arquivos grandes que restam
- Separar, sem mudar como o jogo funciona, a tela da partida e as telas grandes da carreira e do estádio.
- Mesmo procedimento das vezes anteriores: comparar partidas com a mesma semente antes e depois, e rodar os testes.

## Como vamos confirmar
- Testes para cada preço, limite semanal e regra do VIP, com os valores da tabela.
- Testes atuais, stress de 200 partidas, lint zerado e build.
- Telas conferidas no celular e no computador. Gráficos sem confirmação de FPS real, porque aqui não há placa de vídeo.

## Detalhes técnicos
- Estender `spend_coins_on_service` com os 5 novos serviços e o desconto VIP, espelhando os valores em `src/lib/wallet-rules.ts`.
- VIP como produto de assinatura no Stripe, com o webhook já existente atualizando `subscriptions`. O VIP é conferido com `has_active_subscription`.
- Personalização: guardar as peças desbloqueadas em `user_wallet.unlocked_themes` (estendido) e as escolhas do jogador em `profiles.preferences`.
- Modularização: arquivos irmãos que reexportam a API pública, como manda o `AGENTS.md`.
