# Serviços externos — observações desta sessão

Base de código: `c20036f33a8f7d8eff15012d276606a3964e4a54`. Observações de serviços são pontuais e não representam uma publicação desta candidata.

| Serviço | Observação | Limite da conclusão |
| --- | --- | --- |
| GitHub | PR #125 fechado e mesclado; merge `c20036f` | Novos commits precisam de outra branch/PR para revisão |
| Resend | 41 templates retornados; todos com status `published`; nenhum draft na listagem | Publicação de template não prova disparo automático por todos os eventos de jogo |
| Lovable API | Consulta do projeto conhecido retornou `Unknown tool` | Aplicativo e site puderam ser inspecionados visualmente; nenhuma mudança por API foi simulada |
| SentinelX | Lista de integrações vazia | Nenhuma regra de zona Cloudflare foi alterada por esse conector |
| Supabase | `ACTIVE_HEALTHY`; advisors de segurança/desempenho/saúde arquivados | Revisão somente leitura; sem aplicação remota de migrations |
| NPMScan | 962 dependências verificadas para vulnerabilidades; detalhe adicional de 100 | Auditoria adicional de scripts/licença/ownership incompleta para 862 entradas |

O NPMScan apontou `deepmerge@4.3.1`, severidade baixa, `GHSA-gcqx-w48m-w2h4` / `CVE-2026-93753`, sem versão corrigida informada. A cadeia local é `@react-email/components -> @react-email/render@2.0.6 -> html-to-text -> deepmerge`. Isso é um alerta da dependência, não reprodução de exploração no jogo. Não foi aplicada uma substituição incompatível da árvore apenas para silenciar o scanner. Fontes: [pacote](https://npmscan.com/package/deepmerge), [aviso](https://npmscan.com/vulnerability/GHSA-gcqx-w48m-w2h4). Dados completos: `npmscan-baseline.json`.

Os advisors Supabase incluem tabelas com RLS sem policy (que podem ser intencionalmente privadas), exposição de schema GraphQL e índices sem uso observado. Esses sinais exigem análise de acesso e workload; não justificam remover índices nem declarar um vazamento sem evidência adicional.

Nenhum email real foi enviado, pagamento realizado, segredo publicado, DNS alterado ou carga de ataque aplicada ao domínio de produção como parte desta validação.
