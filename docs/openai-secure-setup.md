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

Ambos os recursos ficam desligados por padrão e só devem ser ativados em uma
versão testada, usando variáveis de ambiente do servidor:

| Variável | Efeito quando `true` |
| --- | --- |
| `OPENAI_CHAT_MODERATION_ENABLED` | Envia a mensagem ao modelo de moderação. No chat da sala, até três mensagens anteriores da mesma sala são enviadas como contexto; no chat global, apenas a mensagem atual. Se a verificação estiver indisponível, a mensagem não é publicada. |
| `MATCH_AI_OPENAI_ENABLED` | Para uma pessoa autenticada em partida rápida, solicita uma proposta tática para o adversário ao `gpt-6.1-terra` com esforço `max`. Se falhar ou chegar tarde, o jogo mantém a IA habitual. |

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

Referência: https://developers.cloudflare.com/workers/configuration/secrets/
