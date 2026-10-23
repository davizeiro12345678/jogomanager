# Google: código, integração e ativação

Verificação local e leitura das contas em 19/10/2026. Os arquivos deste ciclo
estão em `verification/visual-security-20261019`. Este documento não declara
uma proteção de produção apenas por existir uma chave ou um modelo de configuração.

## Credencial de servidor autorizada e armazenada

Em 19/10/2026, após autorização explícita do usuário, foi criada no projeto
`sscxz-2ee8d` a chave **JogoManager Worker - Fraud Defense**, já restrita a uma
única API: `recaptchaenterprise.googleapis.com`. A chave de navegador existente
do Firebase foi preservada. A credencial nova é de servidor; não foi aplicada
restrição por referenciador de site nem presumido um IP fixo de saída do Worker.

O valor foi transferido diretamente para **GOOGLE_RECAPTCHA_API_KEY**, do tipo
`secret_text`, no ambiente de produção do Worker **jogomanager-web**. A interface
mostra **Valor criptografado** e a consulta autenticada `wrangler secret list`
confirmou o nome/tipo. Os sete nomes de segredos anteriores continuam presentes.
O valor da credencial não foi gravado em arquivo, relatório, captura ou comando.

Foi usada a opção **Mais opções → Salvar**, sem o botão **Adicionar e implantar**.
As consultas de implantações antes/depois retornaram os mesmos dez registros,
com última implantação `127bc4bc-abe0-415a-ac4c-7e8621e8d686` e versão ativa
`c0272087-723a-4d5c-a7dc-8e09291ca3d4`. Nenhum código local foi publicado.
A revisão automática inicialmente bloqueou a interação por associar o menu ao
botão adjacente de implantação. A inspeção somente de leitura distinguiu o menu
e permitiu usar a opção de armazenamento sem implantação.

Este resultado comprova **a criação restrita e o armazenamento do segredo**.
Não comprova avaliações antifraude em produção. As demais configurações Google,
o modo `observe`/`enforce` e a publicação do código continuam pendentes; não foram
habilitados faturamento, contratação SecOps, coletor ou scanner por esta aprovação.
Recibo sem valores privados: `verification/visual-security-20261019/google-credentials-receipt.json`.

| Controle | Implementação e prova | Estado externo / próximo passo |
|---|---|---|
| Fraud Defense | Verificação de validade, ação, hostname e score no servidor; chave de API vai em `x-goog-api-key`, sem segredo na URL; eventos passam por projeção de campos permitidos | Credencial de servidor restrita criada e segredo `GOOGLE_RECAPTCHA_API_KEY` armazenado, sem implantação. A leitura anterior das duas chaves de site para `jogomanager.com` mostrou **Incompleto** e zero avaliações; a conta oferece habilitação de faturamento para proteção completa. Reutilizar a chave de site comum existente, concluir configurações e validar primeiro `observe`, mediante autorização de ativação/publicação. Nenhuma avaliação nova foi enviada neste passo. |
| Google SecOps | `security-event.ts` produz o envelope moderno `inlineSource.events[].udm`; `google-secops-import.mjs` valida offline por padrão e só envia com `--send`; lote de 1–100 eventos e entrada até 1 MiB | O console mostra **Instalar o Google Security Operations** e contato comercial; não apresentou uma instância vinculada neste projeto. Precisa de instância, região, identidade IAM e coletor. A validação local do JSON não comprova que a instância aceitou o evento. Sem feed ativo confirmado. |
| Respostas e logs | Cabeçalhos compartilhados para HTML/JSON/erros; respostas privadas não entram em cache público; cache imutável KTX2 preservado. Eventos 401/403, 429 e 5xx usam enums, sem URL, IP, e-mail, token ou save. Limite de 60 eventos/minuto por classe e isolate, com contador de supressões | Esse limite protege a emissão de logs; não é rate limiting distribuído de requisições. O ponto único de auditoria HTTP fica no `server.ts` do pacote integrado. |
| Web Security Scanner | Requisitos de destino e exclusões documentados abaixo | Painel sem configurações. O Worker Cloudflare atual não é destino suportado: requer uma aplicação pública App Engine/GKE/Compute Engine do projeto. |
| Cloud Armor | Modelo anterior em `infra/google/cloud-armor/` preservado | Requer backend e balanceador Google ligados à política. Não protege o Worker por mera existência do arquivo e não constitui failover. |
| Security Command Center | Preparação e fontes descritas em `google-security-integrations.md` | Ativação/escopo/organização devem ser confirmados na conta; não houve contratação ou troca de plano neste ciclo. |

## SecOps: execução revisável

No Node 24 ou superior, um arquivo JSONL contendo somente os eventos estruturados
emitidos pelo jogo pode ser validado com:

```text
node scripts/google-secops-import.mjs --input security-events.jsonl --output reviewed-batch.json
```

O modo padrão não acessa a rede. O arquivo de saída é criado com exclusividade:
uma execução não sobrescreve uma revisão anterior. Campos arbitrários são
descartados antes de montar o UDM. A CLI não registra payload de erro do provedor,
token de acesso, chave, IP ou dados de conta.

Para ingestão real, configurar `GOOGLE_SECOPS_PARENT` com o recurso
`projects/PROJECT/locations/REGION/instances/INSTANCE` e fornecer um token OAuth
de curta duração em `GOOGLE_SECOPS_ACCESS_TOKEN`, por identidade gerenciada ou
Workload Identity Federation no coletor. Nunca usar `VITE_*`, arquivo público,
argumento de linha de comando ou chave de conta de serviço commitada. Validar
o endpoint regional e a permissão **`chronicle.events.import`** para a API v1;
esse é o nome mostrado na referência atual. Não confundir o nome do serviço
`chronicle.googleapis.com` com o nome da permissão IAM.

Só depois de revisar o lote e a instância, o operador pode acrescentar `--send`.
Confirmar o recebimento com uma consulta UDM e testar uma notificação de alerta.
O coletor deve manter checkpoint, retenção, credencial renovável e tratamento
de falhas. Esta CLI é uma importação limitada, não um feed contínuo implantado.

## Scanner: destino de teste e limites

Preparar um ambiente público de teste em um dos serviços aceitos, vinculado ao
mesmo projeto. Usar dados fictícios e conta de privilégio mínimo. Excluir rotas
de autenticação, checkout, compras, chat, multiplayer, exclusão e funções que
alteram estado. Começar com o menor risco e limite de QPS aceitos, inspecionar
o escopo e confirmar que não existe acesso a dados de produção antes de executar.
Verificações customizadas podem clicar e enviar formulários. Nenhuma varredura
ativa foi disparada contra o jogo de produção neste ciclo.

## Fontes oficiais verificadas

- [Avaliações de sites no Fraud Defense](https://docs.cloud.google.com/recaptcha/docs/create-assessment-website)
- [Criação e restrição de chaves de API](https://docs.cloud.google.com/api-keys/docs/create-manage-api-keys)
- [Segredos do Cloudflare Workers e diferença entre armazenamento e implantação](https://developers.cloudflare.com/workers/configuration/secrets/)
- [ImportEvents v1 e permissão IAM](https://docs.cloud.google.com/chronicle/docs/reference/rest/v1/projects.locations.instances.events/import)
- [Escopo e limites do Web Security Scanner](https://docs.cloud.google.com/security-command-center/docs/concepts-web-security-scanner-overview)
- [Cloud Armor e ligação das políticas aos recursos protegidos](https://docs.cloud.google.com/armor/docs/cloud-armor-overview)
- [RLS e índices no Supabase](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
