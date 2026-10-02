# Registro de origem antes da migração

Verificado no painel da conta Cloudflare `31b4ec9dfe5281c893ccfaaaefcfc88d`, zona `jogomanager.com`, em 2 de outubro de 2026.

Registro que impede a criação do domínio personalizado do Worker:

| Campo             | Valor original          |
| ----------------- | ----------------------- |
| Nome              | `jogomanager.com` (`@`) |
| Tipo              | `A`                     |
| Conteúdo          | `185.158.133.1`         |
| Proxy             | Ativado                 |
| TTL               | Auto                    |
| Comentário / tags | Vazios                  |

O Cloudflare recusou a ligação direta por existir esse registro externo, código `100117`. As rotas do Worker foram publicadas, mas a verificação HTTP ainda retornou a hospedagem anterior. Se for preciso restaurar a origem, recriar o registro acima e retirar a ligação de domínio personalizado do Worker. Não alterar registros MX, SPF, DKIM, DMARC, o subdomínio de importação esportiva ou o balanceador de `www` ao substituir o registro raiz.

## Alterações confirmadas

- Criado `fallback.jogomanager.com`, registro A com o mesmo IP `185.158.133.1`, proxy ativado e TTL Auto.
- A origem de fallback do Cloudflare for SaaS foi alterada de `jogomanager.com` para `fallback.jogomanager.com` e permaneceu com status Ativo.
- O registro A original foi preservado por renomeação para `legacy-origin.jogomanager.com`, com o mesmo IP, proxy e TTL. Nenhum registro A foi excluído.
- O Wrangler conectou `jogomanager.com` como domínio personalizado do Worker `jogomanager-web`; o DNS mostra o registro gerenciado do tipo Worker.
- As rotas específicas de importação esportiva e os registros de e-mail anteriores foram preservados.

Após criar o domínio do Worker, as primeiras requisições públicas ainda retornaram o site anterior. A ligação de um nome de host SaaS pode ter prioridade sobre o DNS da zona, conforme a [documentação do Cloudflare](https://developers.cloudflare.com/ssl/reference/certificate-and-hostname-priority/).

## Conclusão verificada da troca

- Desvinculados somente `jogomanager.com` e `www.jogomanager.com` do projeto Lovable. O projeto continua em `stadium-stewards.lovable.app`; os outros domínios desse projeto não foram desvinculados.
- Corrigida a regra `2a2faf329eaa479bb97910ca7a9eb655`: antes redirecionava `https://jogomanager.com/` para o mesmo endereço. Agora a regra `JogoManager HTTP para HTTPS` compara `http://jogomanager.com/*`, envia para `https://jogomanager.com/${1}` e preserva a string de consulta.
- Desabilitada, sem excluir, a regra de redirecionamento em massa `ffrgrgsgrt` (`00241e796a674f0486f47ee4ebcbb820`), cuja única entrada redirecionava `jogomanager.com/` para `https://jogomanager.com/` com status 307, causando outro ciclo.
- Desabilitada a regra geral `Coloque tudo em cache [Modelo]`. A regra de resposta de dados privados foi corrigida para usar uma expressão de prefixos de caminhos, em vez de tratar essa expressão como um texto de URL curinga, e passou a aplicar `no-store`.
- Removidas da configuração do próprio Worker as duas rotas redundantes do domínio raiz; o domínio personalizado nativo atende esses caminhos. A rota de `www` e as rotas específicas de importação esportiva continuam disponíveis.

Verificação final por HTTPS: página inicial, Sobre, Contato, Guias, Perguntas Frequentes, autenticação e `/api/health` retornaram HTTP 200 em `jogomanager.com`. O site de `www` também retornou HTTP 200 com o conteúdo novo. A saúde do backend retornou `ready`, com as três verificações verdadeiras, e `Cache-Control: no-store`.

Para retornar à hospedagem anterior, remover a ligação do domínio personalizado no Worker, restaurar o registro A original a partir dos valores acima e reconectar o domínio no painel do Lovable. Restaurar somente as regras de redirecionamento compatíveis com esse destino; não reativar os dois redirecionamentos circulares.
