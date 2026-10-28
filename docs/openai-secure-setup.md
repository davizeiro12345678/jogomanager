# Configuração segura da chave OpenAI

Esta alteração é uma proposta em revisão, não uma publicação. A chave existente
da organização Davi deve ser inserida diretamente no Cloudflare; não cole o valor
no chat, em arquivos versionados, capturas de tela ou argumentos do terminal.
O nome da chave, por si só, não permite recuperar seu valor. Se o valor original
não estiver mais disponível, consulte o painel OpenAI; não é possível recuperá-lo
por este repositório.

O Worker existente chama-se `jogomanager-web`. Em um terminal autenticado na
conta Cloudflare correta, a opção abaixo solicita o valor de forma interativa e
prepara uma versão **sem publicá-la**:

```sh
npx wrangler versions secret put OPENAI_API_KEY --name jogomanager-web
```

Não use `wrangler secret put` para este passo: ele publica imediatamente uma
nova versão. Não execute `versions deploy` enquanto os gates obrigatórios de
desempenho e qualidade estiverem falhando. A integração precisa ser incluída
na versão aprovada e a presença do segredo nessa versão deve ser conferida antes
de ativar qualquer recurso. Não altere o token público `VITE_*` para guardar a
chave secreta.

## Recursos e limites

Os novos recursos ficam desligados por padrão e só devem ser ativados em uma
versão testada, usando variáveis de ambiente do servidor:

| Variável | Efeito quando `true` |
| --- | --- |
| `OPENAI_CHAT_MODERATION_ENABLED` | Envia a mensagem ao modelo de moderação. No chat da sala, até três mensagens anteriores da mesma sala são enviadas como contexto; no chat global, apenas a mensagem atual. Se a verificação estiver indisponível, a mensagem não é publicada. |
| `MATCH_AI_OPENAI_ENABLED` | Para uma pessoa autenticada em partida rápida, solicita ao `gpt-6.1-terra` com esforço `max` táticas para o adversário, orientações por posição para ambos os times e um perfil visual para a torcida mandante. Se falhar ou chegar tarde, o jogo mantém o comportamento habitual. |
| `AI_DEEPSEEK_FALLBACK_ENABLED` | Quando o assistente usa OpenAI e a chamada falha por rede, limite de requisições ou erro de servidor, permite enviar a mesma conversa ao DeepSeek como alternativa. Requer `DEEPSEEK_API_KEY` no servidor e permanece desligado por padrão. |

O assistente de texto continua usando Anthropic por padrão. A variável de
servidor `AI_TEXT_PROVIDER=openai` seleciona `gpt-6.1-terra`; nenhuma chave deve
ser colocada em variáveis `VITE_*`. O auxiliar usa o identificador
`deepseek-flash` (DeepSeek-V4.1-Flash) com `reasoning.effort=max`. Uma recusa,
uma falha de autorização ou uma resposta incompleta não é reenviada a outro
provedor. O raciocínio não é mostrado ao jogador.

Cada tentativa do assistente reserva R$ 2 no orçamento de texto antes do
pedido, inclusive quando a alternativa é acionada. Essa reserva também é uma
estimativa, não um teto de cobrança do fornecedor. Cada resposta é limitada a
8.192 tokens de saída, incluindo raciocínio, e cada chamada tem prazo de 45 s;
na alternativa sequencial o tempo total pode ser maior. O envio de contexto ao
segundo fornecedor exige a mesma revisão de privacidade e credenciais já
existentes antes da ativação. Os testes locais usam respostas simuladas: eles
não comprovam acesso às APIs, custo real ou melhoria de qualidade de jogo.

O limite é de 20 tentativas de moderação por conta por minuto, antes da chamada
ao provedor. A IA tática usa um limite adicional de cinco tentativas por conta
em 15 minutos e reserva R$ 2 no orçamento mensal existente antes de chamar o
modelo. Essa reserva é uma **estimativa**, não um limite de cobrança da OpenAI;
latência, tokens, preço e câmbio podem variar. Ativar a IA tática pode gerar
cobranças na conta OpenAI já existente, sem criar crédito ou contratar serviço.

O classificador pode errar e não garante ausência de abuso. Mensagens de salas
são restritas aos participantes e apagadas quando a sala passa a `done`; salas
abandonadas que não chegarem a esse estado conservam mensagens até sua remoção.
O produto precisa informar o uso da moderação externa na sua política de
privacidade antes da ativação. A configuração não comprova melhoria de jogo;
isso exige avaliação com chamadas reais e partidas comparáveis.

O modelo recebe apenas médias de atributos dos elencos geradas a partir do
catálogo do servidor. As respostas são validadas e não definem gols, física ou
resultados. As orientações por posição alteram o peso de finalizações, passes
progressivos e risco no simulador; o perfil da torcida usa os mecanismos visuais
já existentes, que continuam reagindo aos acontecimentos da partida. Nenhuma
chamada é feita por jogador, torcedor ou quadro. Esta integração funciona apenas
na partida rápida local; não é autoridade para o multiplayer online.

Referência: https://developers.cloudflare.com/workers/configuration/secrets/
