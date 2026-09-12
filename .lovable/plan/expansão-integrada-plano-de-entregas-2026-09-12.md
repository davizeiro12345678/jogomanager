# Expansão integrada — plano de entregas

O pedido é grande demais para uma única execução. Vou entregar em 6 etapas utilizáveis, na ordem que você definiu, publicando ao fim de cada uma. Abaixo o que entra em cada etapa e o detalhe completo da Etapa 1, que começo agora.

## Etapa 1 — Visual integrado, recuperação gráfica e medição (começa agora)

Hoje a página de ajustes visuais guarda preferências em dois lugares e boa parte dos controles não chega à partida. Vou:

- Unificar as preferências em um único lugar, migrando o que você já escolheu sem apagar nada.
- Ligar de verdade à partida: texturas, geometria, sombras, pós-processamento, horário, clima, vento, e corte/cor/desgaste do gramado.
- Ajustes globais e por clube, com prévia 3D, botão de restaurar por seção e indicação de "qualidade escolhida" vs "qualidade efetiva".
- Ordem de precedência: aparência original → global → clube mandante → prévia → limites de desempenho. Clube sem personalização mantém a aparência original.
- Ajuste automático de desempenho: corta primeiro pós-processamento e partículas, depois resolução, sombras, torcida/grama e detalhe. HUD, bola, linhas e uniformes nunca são degradados.
- Regras de tempo: queda imediata abaixo de 40 FPS, queda após duas janelas abaixo de 45, tentativa de recuperação após 20s estáveis, espera de 60s após tentativa malsucedida.
- Recuperação quando o 3D é perdido (aba pausada, contexto perdido) e quando uma imagem falha ao carregar.
- Medição por segundo com p95/p99 e travamentos, exportável como relatório.
- Garantia: nada disso altera o resultado da simulação.

## Etapa 2 — Jogadores, materiais, estádio, interface e cutscenes

Anatomia do jogador (rosto, mãos, ombros, articulações, uniforme, chuteiras, cabelo) com identidade estável por jogador; limites de triângulos mantidos; as 148 animações preservadas com apoio de pé, transferência de peso e transições melhores; grama e torcida em setores; redes, traves, cobertura, túneis e bancos refinados; mapas separados de cor/relevo/rugosidade/oclusão; navegação, tipografia, cartões, tabelas e toque de 44px unificados; 14 cenários e 26 roteiros renovados usando treinador, capitão, escudo e uniforme reais.

## Etapa 3 — Mundo por campanha, criação de clube, editor e fotos

Cada campanha passa a ter mundo próprio: criar clube deixa de mexer nos dados globais. Assistente de criação completo com retrato exportável do clube, indicação clara de qual clube será substituído, capacidade ligada a bilheteria e finanças. Editor sobre rascunhos versionados (editar campanha existente gera cópia "personalizada"). Fotos e escudos como arquivos referenciados, com importar/exportar do pacote e recuperação de imagem ausente. Correção das fotos que não aparecem nos retratos.

## Etapa 4 — Temporadas, acesso/rebaixamento, contratos, eventos e conquistas

28 atributos persistentes e editáveis com evolução por treino/idade/potencial/condição/personalidade; pé dominante, pé fraco, consistência, jogos importantes, relações e especialidades; histórico real da campanha (sem inventar passado); aposentadoria, renovação, regens e base. Calendário, salários, bilheteria, patrocínio, pressão, objetivos, demissão e propostas ligados. Pontos corridos, mata-mata e grupos com folga para número ímpar. Divisões ligadas: 4 acessos no Brasil, 3 nos demais, editável. Fim de temporada arquiva estatísticas e aplica tudo uma única vez. Diretor de eventos determinístico com memória e limite de repetição. As 24 conquistas corrigidas + novos marcos.

## Etapa 5 — Contas supervisionadas, IA, narração, comunidade e loja

Troca do Gemini por OpenAI no servidor com adaptador substituível (Luna para adultos, Sol para menores supervisionados); diretor esportivo, olheiro, assistente tático, imprensa e personagens usando dados reais da campanha; memória resumida; toda contratação/escalação/gasto exige ação sua. Narração com `gpt-4o-mini-tts` em português, identificada como sintética, preparada fora do loop 3D, gol com prioridade, fala atrasada descartada, áudio local como reserva. Orçamento: R$ 350 texto/moderação + R$ 150 voz, com reserva antes de cada pedido e bloqueio no teto. k-ID Family Connect para autorização do responsável, permissões revogáveis, contas de menores privadas, salas por liga/partida, denúncia, bloqueio, painel de moderação. Loja unificada (catálogo, preço, descrição, entrega), separação entre dinheiro do clube / moeda comprada / consumíveis, impulso semanal (+25% de treino, +5 de recuperação, sem acumular), entrega transacional e idempotente, reembolso e histórico. Menor de idade compra via responsável. A tela de confirmação nunca concede saldo.

Recursos supervisionados ficam desligados em produção enquanto a autorização do responsável não estiver funcionando. Abaixo de 13 anos, nenhum dado pessoal vai para a nuvem.

## Etapa 6 — Validação e liberação gradual

Typecheck, lint dos arquivos alterados, build e testes; 148 clipes reproduzíveis; save antigo preservado; duas temporadas seguidas coerentes; pagamento duplicado/concorrente/falho/reembolsado; dois clientes validando chat e revogação; PWA após atualização, queda de conexão e restauração do 3D; no Android disponível, cinco cenários, três execuções de três minutos e duas partidas completas com 22 atletas, torcida, HUD e áudio; relatórios com FPS por segundo, p95/p99 e travamentos. Nenhuma aprovação por média isolada ou emulação.

## Observações técnicas

- Store única de preferências visuais versionada com migração das duas fontes atuais, exposta por contexto e lida sem tocar em `localStorage` durante os quadros.
- Precedência resolvida num seletor puro que devolve o perfil efetivo consumido por `Stadium3D`, `PostFX`, grama e torcida.
- Adaptador de desempenho como máquina de estados com histerese e janelas, separado do laço de render.
- Cache limitado de materiais/geometrias com descarte controlado.
- Simulação continua isolada da configuração gráfica.

## Custos e limites

- Orçamento de R$ 500/mês cobre só IA e voz. Infraestrutura, pagamentos e verificação de responsáveis são à parte e não contrato nada automaticamente.
- k-ID e a conta de pagamentos precisam de credenciais suas quando chegarmos na Etapa 5.
