# Economia e desenvolvimento versionados

Carreiras novas carregam `economyRulesVersion: 2` e `developmentRulesVersion: 2`. A ausência desses campos mantém as fórmulas de balanceamento de uma campanha existente. A migração não altera caixa, lançamentos válidos, salários contratados ou duração dos contratos. Correções de precisão e validação atuam sobre transações futuras.

## Dinheiro

Os cálculos monetários convertem M€ em euros inteiros (`moneyToEuros`) e salários semanais em k€ para euros (`wageToEuros`). M€ e k€/semana continuam nas fronteiras de save e interface. `financialChange` valida a operação inteira antes de qualquer mudança de elenco ou estrutura. Um valor de €1 corresponde a `0.000001` M€ e nunca é arredondado para zero.

A receita existente de TV/posição/desempenho, a ocupação de bilheteria e os prêmios permanecem nas mesmas fórmulas. A bilheteria preserva euros inteiros futuros. O plano operacional e contratos opcionais de patrocínio usam a mesma fronteira monetária. O saldo e as receitas/despesas são somas de euros; índices de risco e semanas de caixa são razões, sem unidade monetária.

`financeSettledThrough` é um cursor por clube/temporada/rodada. Junto da chave imutável de cada operação, ele impede a cobrança repetida depois da truncagem do ledger de 96 registros. Contratações preservam a reserva projetada de quatro semanas, calculada sem antecipar vitórias, vendas ou prêmios e incluindo o novo salário. Taxa, comissão e duas semanas de luvas aparecem na cotação antes de fechar o contrato. Novas obrigações não modificam contratos antigos.

O valor de mercado v2 usa `max(ovr - 52, 0)^2.15 / 55`, com piso final de 0,3 M€. A idade interpola linearmente entre `(18,1.5)`, `(21,1.5)`, `(27,1.35)`, `(30,1)`, `(33,0.55)` e `(36,0.25)`, com extremos limitados. Potencial acrescenta `1 + min(0.12, max(0,potencial-ovr)*0.01)`. O contrato interpola `(0,0.90)`, `(1,0.95)`, `(2,1)` e `(4,1.05)`, usando dois anos quando ausente. O resultado é quantizado a um euro. A fórmula salarial permanece igual, usando o OVR efetivo nas novas propostas.

## Desenvolvimento

`Player.developmentBase` guarda o OVR inicial, os cinco atributos principais e o perfil detalhado inicial. Essa base nunca é sobrescrita pelo treino, envelhecimento ou renomeação. Perfis novos gerados usam o ID como semente; perfis importados, personalizados e legados são congelados a partir da identidade já existente. Atributos detalhados explícitos de importação/personalização têm precedência.

`CareerState.attrDeltas` é a fonte autoritativa da evolução. `effectivePlayer(player, source)` calcula os cinco atributos efetivos a partir das diferenças detalhadas, com os mesmos pesos anteriormente usados em readiness. O OVR é o OVR inicial mais a variação ponderada dos cinco atributos: GK `0.10/0.05/0.15/0.50/0.20`, DF `0.15/0.05/0.10/0.45/0.25`, MF `0.15/0.15/0.40/0.10/0.20`, FW `0.20/0.45/0.10/0.05/0.20` (velocidade/finalização/passe/defesa/físico). Os atributos ficam entre 20 e 99.

`developedPlayer` produz uma projeção explícita com OVR/main5, `detailedAttributes` e `developmentDelta` para consumidores de partida. A projeção sempre deriva da base, impedindo somar a evolução duas vezes. `profileFor(player, source)` aceita a carreira explicitamente; um snapshot de partida usa seu próprio delta. O cache de perfil contém apenas bases, sem a carreira global. Os antigos setters de deltas permanecem como compatibilidade de API, mas não interferem na leitura dos perfis.

Treinos táticos v2 aplicam apenas `0.12 * resposta * peso` aos atributos detalhados. O fator de idade interpola `(18,1.15)`, `(21,1.08)`, `(26,1)`, `(31,0.90)`, `(35,0.76)` e `(38,0.65)`. Condição, espaço até o potencial, personalidade e intensidade mantêm os fatores anteriores. O treino semanal mantém a chance existente e concede `0.20 * resposta` ao primeiro atributo do foco e `0.10 * resposta` aos demais. Não existem sorteios independentes de OVR ou main5 em v2.

`developmentSeasonStart` registra o OVR efetivo no começo de cada temporada e de cada contratação durante a temporada. Novos incrementos são reduzidos proporcionalmente para respeitar crescimento anual de +3 até 23 anos, +1,5 dos 24 aos 28 e +0,5 a partir de 29, queda máxima de 2 pontos e o potencial salvo; quando ausente, vale `min(99,OVR inicial+6)`. O fechamento usa a idade da temporada que encerrou. O limitador não apaga deltas anteriores, inclusive quando o histórico já ultrapassa um teto futuro.

Ficha, treino, seleção, mercado e partida consomem os atributos efetivos. Forma, moral e condição seguem como efeitos temporários de readiness. Saves pessoais e seus marcos locais continuam sem autoridade para liberar conquistas duráveis online.

## Relógio e validação

`advanceRound`, `autoWeek` e `autoSeason` aceitam `evaluatedAt` do chamador, em milissegundos, com suporte a ISO nos helpers públicos. A avaliação do impulso e os timestamps ISO de conquistas usam esse mesmo instante. O protocolo Worker usa milissegundos finitos inteiros. O cálculo da temporada continua sequencial e preserva o snapshot de trocas da pirâmide.

As regressões cobrem todos os valores de €1 a €9.999, compatibilidade de saldos e contratos antigos, reserva de quatro semanas, cursor após truncagem do ledger, interpolação de mercado, OVR derivado e ausência de aplicação dupla, múltiplas carreiras com o mesmo ID, identidade após renomeação/aniversário, teto anual, queda e preservação de histórico, resposta contínua de idade e relógio explícito. Esses testes demonstram os contratos locais; não representam calibração econômica externa ou comprovação de desempenho em GPU física.
