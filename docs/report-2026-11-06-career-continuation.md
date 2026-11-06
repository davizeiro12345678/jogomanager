# Continuação da carreira — 6 de novembro de 2026

## Entregas verificadas
- Guia do treinador em quatro capítulos e dez lições, aberto pelo ícone de livro no cabeçalho. Progresso local, retomável e reiniciável; FAQ acessível pelo guia. Não entrega moedas nem finge comprovar ações.
- Guia contextual específico no painel de jogador para semana, lances, evolução e contratos.
- Serviço de treino: 150 moedas, cinco usos por janela móvel de sete dias; +50% no ganho detalhado do exercício da rodada. Não acumula, não muda desgaste e não pode ser comprado após o exercício.
- Olheiro individual: 120 moedas, sete usos por sete dias. Revela um alvo da liga ativa, preserva dados já presentes no save e evita relatório duplicado. Interface lista até 40 candidatos ordenados; não constitui paginação de todo o mercado.
- Banco confirma preços/limites, bloqueia execução direta por visitante/usuário e impede reutilizar um pedido de outro serviço.
- Separação literal da composição do estádio em `StadiumScene.tsx`; controlador passa de 712 para 304 linhas, preservando Canvas, câmera, efeitos e orçamento. Não é evidência de menor bundle nem de aumento de FPS.
- Prévia do uniforme extraída da tela de criação do clube para componente próprio.

## Evidência
- 311 arquivos e 1.654 testes aprovados na regressão, excluindo explicitamente o stress que tem execução própria.
- Lint geral: zero erros e zero avisos.
- Último sinal automático do preview: build OK.
- Navegador autenticado no dashboard: abertura, marcação de uma lição, Escape e reabertura preservam 1/10. Desktop 1280×1800 e celular 390×844; sem overflow móvel nem erros de execução.
- Telas autenticadas de treino e olheiro mostram os novos serviços; 40 alvos presentes no seletor. Não houve gasto do saldo do usuário nem pagamento real.
- Definição aplicada de `spend_coins_on_service` conferida no banco após a mudança.

## Limites e pendências
O plano integral não está concluído. As 15 ofertas existentes estão ativas, mas os cinco pacotes propostos e o VIP não estão disponíveis com inventário e entrega compatíveis. Não foram criados checkouts falsos nem ativadas cobranças sem benefício correspondente.

O guia é autodeclarado, não o tutorial jogável com ações verificadas e recompensa por conta previsto no plano. Personalização sincronizada, vantagens VIP, eventos/recompensas atestadas e evolução visual dos cinco níveis continuam pendentes.

Serviços continuam seguindo o contrato anterior de cobrança no servidor e efeito no save pessoal. Uma mudança de carreira durante o pedido agora é detectada no novo painel, mas entrega/compensação durável ligada ao save ainda requer implementação; não foi declarado resolvido.

Sem publicação. Stress atualizado, gates de bundles, comparação de simulação, replay do banco, Lighthouse e verificação gráfica permanecem requisitos de lançamento. Não há certificação de FPS em dispositivo físico nem ganho de velocidade medido neste ciclo.