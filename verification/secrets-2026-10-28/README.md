# Proteção de segredos — 28 de outubro de 2026

Alteração preparada sobre `b277495a23ad139f7f0f55f16b9e1e94af6b6537` para
revisão; nenhuma publicação ou mudança de credenciais foi feita.

## Evidências

- `.env`, `.env.development` e `.env.production` foram removidos da árvore
  proposta. Eles continham configuração identificada como pública; os padrões
  necessários foram mantidos em `config/public-settings.json` e verificados.
- Uma busca local por padrões comuns examinou 1.893 arquivos de texto
  versionados e excluiu 91 arquivos binários, grandes ou não regulares. Não
  encontrou os padrões selecionados. A busca não prova ausência de segredos.
- Foram verificadas 36 versões históricas dos três arquivos de ambiente para
  nomes e padrões de credenciais comuns. Não houve correspondências. Outros
  arquivos e todo o histórico não foram verificados por essa busca histórica.
- `node --test scripts/public-settings.test.mjs scripts/check-secrets.test.mjs`:
  9 testes passaram, incluindo rejeição de credenciais em variáveis de cliente.
- `npm run lint`, `npm exec -- tsc --noEmit --pretty false`, `npm test`
  (308 arquivos, 1.676 testes), `PFM_LOCAL_VERIFY=1 npm run build`,
  `npm run bundle:check` e `npm run cloudflare:build`: executados com sucesso.
- O pacote do navegador foi examinado em 353 arquivos JavaScript para um
  conjunto limitado de padrões de credenciais; não houve correspondências.
- O arquivo Wrangler gerado preservou as configurações públicas de Supabase e
  Stripe, manteve o checkout visitante desligado e não colocou `OPENAI_API_KEY`
  ou `SUPABASE_SERVICE_ROLE_KEY` em `vars`.
- Uma compilação com credencial OpenAI sintética em `VITE_OPENAI_API_KEY` foi
  bloqueada sem imprimir o valor sintético.

## Limitações

Remover arquivos da árvore atual não remove as versões já existentes no histórico
ou em outras branches. Para credenciais privadas expostas, a pessoa responsável
deve revogá-las no provedor, verificar o uso e configurar substitutas em um
gerenciador de segredos; não basta apagar arquivos ou mensagens.

`vite preview` retornou HTTP 500 pela ausência de `dist/server/server.js`, também
observada na versão anterior. A execução local do Worker pelo Wrangler falhou
no ambiente de execução com `uv_interface_addresses`. Não há, portanto, um
teste HTTP bem-sucedido deste build. Os gates obrigatórios de desempenho, o
replay da base de dados e a CI remota completa não foram executados nesta
alteração; não se trata de uma liberação para produção.
